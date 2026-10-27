const { conversationLanguage } = require('./language');
const express = require('express');
const { createAssistantService, validateTurns, validateExtraction } = require('./service');
const { createCatalogAssistant, detectCatalogQuestion } = require('./catalog');
const { HttpError } = require('../../services/errors');

function createAssistantRouter({ db, config, fetchImpl }) {
    const router = express.Router();
    const catalog = createCatalogAssistant(db);
    const service = createAssistantService({ apiKey: config.groqApiKey, model: config.groqModel, fetchImpl });
    // Limită globală pentru prototipul privat; fără stocare de conversații sau adrese IP.
    let windowStart = Date.now(), used = 0, active = 0;
    router.get('/api/assistant/status', (req, res) => res.json({ enabled: service.enabled }));
    router.post('/api/assistant/chat', async (req, res, next) => {
        const language = conversationLanguage(req.body?.turns, req.body?.language);
        try {
            if (req.body.language !== undefined && !['ro', 'en'].includes(req.body.language)) throw new HttpError(400, 'Limbă neacceptată.');
            if (req.get('origin') && req.get('origin') !== config.siteUrl) throw new HttpError(403, 'Origine nepermisă.');
            if (req.body.catalog !== undefined) {
                if (!req.body.catalog || typeof req.body.catalog !== 'object' || Array.isArray(req.body.catalog)) throw new HttpError(400, 'Întrebare de catalog invalidă.');
                return res.json(await catalog.answer({ ...req.body.catalog, language }));
            }
            if (req.body.criteria !== undefined) {
                const [rows] = await db.promise().execute('SELECT nume_oras FROM Orase ORDER BY nume_oras');
                try {
                    return res.json(validateExtraction({ ...req.body.criteria, intent: 'search', clarification: null }, rows.map(row => row.nume_oras), undefined, language));
                } catch (error) {
                    if (error.status === 502) throw new HttpError(400, 'Criterii invalide. Verifică numărul persoanelor, vârstele copiilor și suma bugetului.');
                    throw error;
                }
            }
            validateTurns(req.body.turns);
            const lastText = req.body.turns.at(-1).content;
            const context = req.body.turns.filter(turn => turn.role === 'user').map(turn => turn.content).join(' ');
            const directIntent = detectCatalogQuestion(lastText);
            if (directIntent) return res.json(await catalog.answer({ intent: directIntent, text: lastText, context, language }));
            if (!service.enabled) throw new HttpError(503, 'Conversația AI nu este configurată. Poți completa criteriile folosind opțiunile din conversație.');
            if (Date.now() - windowStart >= 60000) { windowStart = Date.now(); used = 0; }
            if (used >= 10 || active >= 2) throw new HttpError(429, 'Prea multe mesaje AI. Așteaptă puțin înainte de a reîncerca.');
            used++; active++;
            try {
                const [rows] = await db.promise().execute('SELECT nume_oras FROM Orase ORDER BY nume_oras');
                const result = await service.interpret(req.body.turns, rows.map(row => row.nume_oras), language);
                res.json(result.catalogRequest ? await catalog.answer({ ...result.catalogRequest, text: lastText, context, language }) : result);
            } finally { active--; }
        } catch (error) {
            if (language === 'en' && error instanceof HttpError) {
                const messages = {
                    400: 'Please check your message or search criteria. Do not share emails, card details, passwords or API keys. Start a new conversation after 12 replies or 12,000 characters (1,500 per message).',
                    403: 'This request is not allowed.',
                    429: 'Too many AI requests. Please wait a moment or use the search form.',
                    502: 'The AI could not process your message. Try again or use the search form; your criteria are preserved.',
                    503: 'Free-text AI is unavailable. You can still browse cities and hotels or use the search form.',
                };
                error.message = messages[error.status] || 'The request could not be completed. Please try again.';
            }
            next(error);
        }
    });
    return router;
}
module.exports = { createAssistantRouter };
