const { HttpError } = require('../../services/errors');
const { detectLanguage } = require('./language');
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const kinds = ['cities', 'hotels', 'hotel_details', 'capabilities'];

function latestMention(items, text, name) {
    const value = normalize(text);
    let selected = null, latest = -1;
    for (const item of items) {
        const position = value.lastIndexOf(normalize(name(item)));
        if (position > latest) { selected = item; latest = position; }
    }
    return selected;
}

function detectCatalogQuestion(text) {
    const value = normalize(text);
    if (/what can you|how can you help|ce poti|cu ce ma poti|cum ma poti|ce stii sa/.test(value)) return 'capabilities';
    if (/(?:what|which) cities|available cities|list.*cities|what destinations|ce orase|in ce orase|lista oras|orase.*(?:disponibile|aveti)|ce destinatii/.test(value)) return 'cities';
    if (/amenities|facilities|does.*(?:parking|pool)|about (?:the )?hotel|hotel details|room types|what rooms|ce facilitati|are (?:parcare|piscina)|despre hotel|detalii.*hotel|tipuri de camere|ce camere/.test(value)) return 'hotel_details';
    if (/check.?in|check.?out|nights|tomorrow|nopti|maine|\d{4}-\d{2}/.test(value)) return null;
    if (/(?:what|which) hotels|hotels (?:in |are |do you)|show.*hotels|list.*hotels|ce hotel|care (?:sunt )?hotel|hoteluri (?:aveti|sunt|in |din |disponibile)|arata.*hotel|lista.*hotel|aveti hoteluri/.test(value)) return 'hotels';
    return null;
}

function createCatalogAssistant(db) {
    async function answer({ intent, city, hotel, text = '', context = '', language = 'ro' }) {
        if (!kinds.includes(intent)) throw new HttpError(400, 'Întrebare de catalog invalidă.');
        if ([city, hotel, text, context].some(value => value !== undefined && value !== null && typeof value !== 'string')) throw new HttpError(400, 'Parametri de catalog invalizi.');
        if ((city?.length || 0) > 100 || (hotel?.length || 0) > 150 || text.length > 1500 || context.length > 12000) throw new HttpError(400, 'Întrebarea este prea lungă.');
        language = detectLanguage(text, language);
        const en = language === 'en';
        const t = (ro, english) => en ? english : ro;
        const base = { language, kind: 'catalog', canSearch: false, complete: false };
        if (intent === 'capabilities') return { ...base, reply: t('Pot să îți arăt orașele și hotelurile din catalog, să explic facilitățile și categoriile unui hotel, să caut o cameră pentru perioada și bugetul tău și să te conduc la checkout. Îți explic și plata, anularea sau rambursarea. Camerele multiple și politicile pentru copii nu sunt încă activate.', 'I can show you cities and hotels in the catalog, explain hotel amenities and room categories, search for a room for your dates and budget, and take you to checkout. I can also explain payment, cancellation and refunds. Multiple rooms and child policies are not supported yet.') };
        if (intent === 'cities') {
            const [rows] = await db.promise().execute(`SELECT o.id_oras, o.nume_oras, COUNT(h.id_hotel) AS numar_hoteluri
                FROM Orase o JOIN Hoteluri h ON h.id_oras=o.id_oras
                GROUP BY o.id_oras,o.nume_oras ORDER BY o.nume_oras`);
            const names = rows.map(row => `${row.nume_oras} (${Number(row.numar_hoteluri)} ${Number(row.numar_hoteluri) === 1 ? 'hotel' : t('hoteluri', 'hotels')})`).join(', ');
            return { ...base, reply: rows.length ? t(`Orașele cu hoteluri în catalog sunt: ${names}. Alege un oraș ca să vezi hotelurile. Disponibilitatea pentru un sejur se verifică după alegerea perioadei.`, `Cities with hotels in the catalog: ${names}. Choose a city to see its hotels. Availability is checked after you choose your dates.`) : t('Nu există încă orașe cu hoteluri în catalog.', 'There are no cities with hotels in the catalog yet.'), catalog: { type: 'cities', cities: rows } };
        }
        const [rows] = await db.promise().execute(`SELECT h.id_hotel,h.nume_hotel,h.adresa,h.descriere,h.stele,h.imagine_url,
            o.nume_oras,MIN(cc.pret_pe_noapte) AS pret_minim
            FROM Hoteluri h JOIN Orase o ON o.id_oras=h.id_oras
            LEFT JOIN Categorii_Camere cc ON cc.id_hotel=h.id_hotel
            GROUP BY h.id_hotel,o.nume_oras ORDER BY h.nume_hotel LIMIT 100`);
        const cityNames = [...new Set(rows.map(row => row.nume_oras))];
        const cityMatch = city ? cityNames.find(name => normalize(name) === normalize(city))
            : latestMention(cityNames, text, name => name)
                || (/there|that city|acolo|acel oras/.test(normalize(text)) ? latestMention(cityNames, context, name => name) : null);
        if (intent === 'hotels') {
            if (!city && !cityMatch && /\b(?:in|din)\s+[a-z]/.test(normalize(text)) && !/in (?:the )?(?:catalog|app)|in catalog|in aplicatie|din catalog|din aplicatie/.test(normalize(text))) return { ...base, reply: t('Nu identific orașul cerut în catalog. Întreabă-mă ce orașe sunt disponibile sau selectează unul din listă.', 'I cannot identify that city in the catalog. Ask which cities are available or choose one from the list.') };
            if (city && !cityMatch) return { ...base, reply: t(`Nu găsesc hoteluri în orașul „${city}” în catalog. Întreabă-mă ce orașe sunt disponibile.`, `There are no hotels in “${city}” in the catalog. Ask which cities are available.`) };
            const hotels = cityMatch ? rows.filter(row => row.nume_oras === cityMatch) : rows;
            const names = hotels.slice(0, 8).map(row => row.nume_hotel).join(', ');
            return { ...base, reply: hotels.length ? t(`${cityMatch ? `În ${cityMatch}` : 'În catalog'} găsești: ${names}${hotels.length > 8 ? ` și alte ${hotels.length - 8} hoteluri` : ''}. Prețurile de catalog nu confirmă disponibilitatea pentru o perioadă. Poți deschide un hotel sau cere detalii.`, `${cityMatch ? `In ${cityMatch}` : 'In the catalog'}: ${names}${hotels.length > 8 ? ` and ${hotels.length - 8} other hotels` : ''}. Catalog prices do not confirm availability for your dates. Open a hotel or ask for details.`) : t('Nu am găsit hoteluri pentru acest oraș.', 'No hotels were found for this city.'), catalog: { type: 'hotels', hotels: hotels.slice(0, 8), city: cityMatch || null, total: hotels.length } };
        }
        // Numele din conversație este folosit doar pentru a alege un ID din catalog, niciodată ca SQL.
        const target = hotel ? rows.find(row => normalize(row.nume_hotel) === normalize(hotel))
            : latestMention(rows, text, row => row.nume_hotel)
                || (/this hotel|that hotel|facilities|amenities|what rooms|acest|acel|hotelul|facilitati|ce camere/.test(normalize(text)) ? latestMention(rows, context, row => row.nume_hotel) : null);
        if (!target) return { ...base, reply: t('Despre ce hotel dorești informații? Scrie numele lui sau alege „Detalii” din lista hotelurilor.', 'Which hotel would you like to know about? Enter its name or choose “Details” from the hotel list.') };
        const [[rooms], [facilities]] = await Promise.all([
            db.promise().execute('SELECT id_categorie,denumire,capacitate,pret_pe_noapte,descriere FROM Categorii_Camere WHERE id_hotel=? ORDER BY pret_pe_noapte', [target.id_hotel]),
            db.promise().execute('SELECT f.nume FROM Facilitati f JOIN Hoteluri_Facilitati hf ON hf.id_facilitate=f.id_facilitate WHERE hf.id_hotel=? ORDER BY f.nume', [target.id_hotel]),
        ]);
        const facilityNames = facilities.map(value => value.nume);
        // Descrierile și denumirile introduse de hotel rămân în limba din catalog.
        const details = en
            ? `${target.nume_hotel}, ${target.nume_oras}, ${target.stele} ${Number(target.stele) === 1 ? 'star' : 'stars'}.\nHotel description (original catalog text): ${target.descriere || 'not provided'}.\nListed amenities (original names): ${facilityNames.length ? facilityNames.join(', ') : 'no information in the catalog'}.\nRoom categories (original names): ${rooms.length ? rooms.map(room => `${room.denumire} (up to ${room.capacitate} guests, ${Number(room.pret_pe_noapte)} RON/room/night)`).join('; ') : 'no room categories configured'}.\nFor available rooms and the stay total, please provide your dates and guests.`
            : `${target.nume_hotel}, ${target.nume_oras}, ${target.stele} ${Number(target.stele) === 1 ? 'stea' : 'stele'}. ${target.descriere || ''}\nFacilități înregistrate: ${facilityNames.length ? facilityNames.join(', ') : 'nu există informații în catalog'}.\nCategorii: ${rooms.length ? rooms.map(room => `${room.denumire} (maximum ${room.capacitate} persoane, ${Number(room.pret_pe_noapte)} RON/cameră/noapte)`).join('; ') : 'nu există categorii configurate'}.\nPentru camere libere și prețul sejurului avem nevoie de perioadă și persoane.`;
        return { ...base, reply: details, catalog: { type: 'hotel_details', hotel: target, rooms, facilities: facilityNames } };
    }
    return { answer: async request => { const result = await answer(request); return { ...result, reply: result.reply.slice(0, 1900) }; } };
}
module.exports = { createCatalogAssistant, detectCatalogQuestion, catalogKinds: kinds };
