const express = require('express');
const { HttpError } = require('../../services/errors');
function createGroupCheckoutRouter({ groups, verificaToken, payments, config }) {
    const router = express.Router();
    router.use('/api/rezervari-grup', (req, res, next) => {
        if (req.get('origin') && req.get('origin') !== config.siteUrl) return next(new HttpError(403, 'Origine nepermisă.'));
        next();
    }, verificaToken);
    router.post('/api/rezervari-grup/oferta', async (req, res) => res.json(await groups.preview(req.user.id, req.body)));
    router.post('/api/rezervari-grup/aprobare', async (req, res) => res.json(await groups.approve(req.user.id, req.body)));
    router.post('/api/rezervari-grup/confirmare', async (req, res) => res.json(await payments.confirm(req.body.session_id, req.user.id)));
    router.get('/api/rezervari-grup', async (req, res) => res.json(await groups.list(req.user.id)));
    router.post('/api/rezervari-grup/:id/reia-plata', async (req, res) => res.json(await groups.resume(req.params.id, req.user.id)));
    router.get('/api/rezervari-grup/linie/:lineId', async (req, res) => res.json(await groups.byLine(req.params.lineId, req.user.id)));
    router.get('/api/rezervari-grup/:id', async (req, res) => res.json(await groups.view(req.params.id, req.user.id)));
    router.patch('/api/rezervari-grup/:id/anulare', async (req, res) => {
        if (req.body.approved !== true) throw new HttpError(400, 'Confirmă explicit anularea întregului grup.');
        res.json(await groups.cancel(req.params.id, req.user.id));
    });
    router.use((error, req, res, next) => {
        if (req.get('accept-language') === 'en' && error instanceof HttpError) {
            const message = error.message;
            error.message = /altui utilizator|aparține/.test(message) ? 'This booking or offer belongs to another user.'
                : /expirat/.test(message) ? 'The offer or payment session has expired. Please request a new offer.'
                : /schimbat|corespunde/.test(message) ? 'The offer has changed. Please review and approve a new offer.'
                : /24h/.test(message) ? 'Cancellation requires more than 24 hours before check-in.'
                : /ramburs/.test(message) ? 'The rooms could not be confirmed. A full payment refund has been initiated.'
                : /disponibile/.test(message) ? 'Not all rooms are available. No rooms have been confirmed.'
                : /configurat/.test(message) ? 'Online payments are not configured. You can choose to pay at the property.'
                : /explicit/.test(message) ? 'Please explicitly approve the offer or cancellation.'
                : 'The request could not be completed. Please review the booking details and try again.';
        }
        next(error);
    });
    return router;
}
module.exports = { createGroupCheckoutRouter };
