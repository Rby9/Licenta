// Detectăm numai indicii de limbă din mesajele utilizatorului, nu din nume sau răspunsurile AI.
function detectLanguage(text, fallback = 'ro') {
    // Frontendul include uneori un JSON cu criterii confirmate. Cheile englezești
    // sunt date tehnice, nu limba în care utilizatorul a ales să converseze.
    const value = String(text || '').replace(/\{[\s\S]*\}/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/\b(?:in|speak|respond in|reply in) english\b/.test(value)) return 'en';
    if (/\b(?:in|speak|respond in|reply in) romanian\b/.test(value) || /\b(?:in|vorbeste|raspunde in) romana\b/.test(value)) return 'ro';
    const score = pattern => (value.match(pattern) || []).length;
    const ro = score(/\b(?:ce|cu|si|sa|imi|am|un|vreau|as|dori|cazare|orase|orasele|hoteluri|nopti|adulti|copii|buget|camera|camere|plata|anulare|rambursare|multumesc|salut|romana|noapte|sejur|persoane|fara|buna|care|sunt|aveti|poti|cum|inapoi)\b/g);
    const en = score(/\b(?:good|morning|evening|thank|could|book|travelling|traveling|you|your|can|is|are|accommodation|tell|cancellation|booking|help|hello|hi|thanks|please|english|want|would|like|looking|need|which|what|where|how|available|cities|hotels|nights|adults|children|budget|room|rooms|payment|pay|cancel|refund|stay|night|cheapest|together|yes|no|two|three|four|five)\b/g);
    if (en > ro) return 'en';
    if (ro > en) return 'ro';
    return fallback === 'en' ? 'en' : 'ro';
}
function conversationLanguage(turns, fallback = 'ro') {
    return (Array.isArray(turns) ? turns : []).reduce((language, turn) => turn?.role === 'user' ? detectLanguage(turn.content, language) : language, fallback === 'en' ? 'en' : 'ro');
}
module.exports = { detectLanguage, conversationLanguage };
