const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogAssistant, detectCatalogQuestion } = require('../src/modules/assistant/catalog');
const hotels = [
    { id_hotel: 1, nume_hotel: 'Hotel Demo', nume_oras: 'Brașov', stele: 4, pret_minim: '250.00', descriere: 'Hotel demonstrativ' },
    { id_hotel: 2, nume_hotel: 'Hotel Central', nume_oras: 'București', stele: 3, pret_minim: null },
];
function fixture() {
    const calls = [];
    const db = { promise: () => ({ execute: async (sql, params) => {
        assert.match(sql, /^SELECT /); calls.push({ sql, params });
        if (sql.includes('COUNT(h.id_hotel)')) return [[{ id_oras: 1, nume_oras: 'Brașov', numar_hoteluri: 1 }]];
        if (sql.includes('FROM Hoteluri h')) return [hotels];
        if (sql.includes('FROM Categorii_Camere')) return [[{ id_categorie: 4, denumire: 'Dublă', capacitate: 2, pret_pe_noapte: 250 }]];
        if (sql.includes('FROM Facilitati')) return [[{ nume: 'WiFi gratuit' }]];
        assert.fail('Interogare neașteptată');
    } }) };
    return { service: createCatalogAssistant(db), calls };
}
test('catalog: întrebările despre orașe, hoteluri și facilități sunt recunoscute separat de sejur', () => {
    assert.equal(detectCatalogQuestion('Ce orașe sunt disponibile?'), 'cities');
    assert.equal(detectCatalogQuestion('Ce hoteluri aveți în Brașov?'), 'hotels');
    assert.equal(detectCatalogQuestion('Ce facilități are Hotel Demo?'), 'hotel_details');
    assert.equal(detectCatalogQuestion('Ce poți să faci?'), 'capabilities');
    assert.equal(detectCatalogQuestion('Vreau hoteluri în Brașov, 3 nopți, check-in mâine'), null);
});
test('catalog: orașele și numărul hotelurilor vin din SELECT, fără a confirma disponibilitate', async () => {
    const { service, calls } = fixture();
    const result = await service.answer({ intent: 'cities' });
    assert.equal(result.catalog.cities[0].nume_oras, 'Brașov');
    assert.match(result.reply, /Disponibilitatea/);
    assert.equal(calls.length, 1);
});
test('catalog: filtrul de oraș este exact și nu inventează proprietăți într-un oraș necunoscut', async () => {
    const { service } = fixture();
    const result = await service.answer({ intent: 'hotels', city: 'brasov' });
    assert.deepEqual(result.catalog.hotels.map(hotel => hotel.id_hotel), [1]);
    assert.match((await service.answer({ intent: 'hotels', city: 'Atlantida' })).reply, /Nu găsesc hoteluri/);
    assert.equal((await service.answer({ intent: 'hotels', text: 'Ce hoteluri aveți în Atlantida?' })).catalog, undefined);
});
test('catalog: detaliile și capacitatea sunt citite prin ID parametrizat, fără disponibilitate inventată', async () => {
    const { service, calls } = fixture();
    const result = await service.answer({ intent: 'hotel_details', hotel: 'Hotel Demo' });
    assert.match(result.reply, /WiFi gratuit/);
    assert.match(result.reply, /maximum 2 persoane/);
    assert.deepEqual(calls.slice(1).map(call => call.params), [[1], [1]]);
    assert.equal(result.canSearch, false);
    assert.equal((await service.answer({ intent: 'hotel_details', hotel: 'Hotel Inventat' })).catalog, undefined);
});
test('catalog: tipurile invalide sunt respinse și descrierile lungi sunt limitate', async () => {
    const { service } = fixture();
    await assert.rejects(service.answer({ intent: 'sql' }), error => error.status === 400);
    await assert.rejects(service.answer({ intent: 'hotels', city: {} }), error => error.status === 400);
});

test('catalog: întrebările în engleză și detaliile folosesc același catalog real', async () => {
    for (const [text, intent] of [['Which cities are available?', 'cities'], ['What hotels are in Brasov?', 'hotels'], ['What amenities does Hotel Demo have?', 'hotel_details'], ['What can you do?', 'capabilities']]) assert.equal(detectCatalogQuestion(text), intent);
    assert.equal(detectCatalogQuestion('Which hotels are available for 3 nights?'), null);
    const { service } = fixture();
    const cities = await service.answer({ intent: 'cities', language: 'en' });
    assert.match(cities.reply, /Brașov \(1 hotel\).*Availability/);
    const hotels = await service.answer({ intent: 'hotels', text: 'What hotels are in Brasov?' });
    assert.equal(hotels.language, 'en');
    assert.deepEqual(hotels.catalog.hotels.map(hotel => hotel.id_hotel), [1]);
    assert.match(hotels.reply, /do not confirm availability/);
    assert.equal((await service.answer({ intent: 'hotels', text: 'What hotels are in Atlantis?' })).catalog, undefined);
    const details = await service.answer({ intent: 'hotel_details', hotel: 'Hotel Demo', language: 'en' });
    assert.match(details.reply, /up to 2 guests, 250 RON\/room\/night/);
    assert.match(details.reply, /original catalog text/);
});

test('catalog: întrebările de continuare folosesc ultimul oraș și ultimul hotel menționat', async () => {
    const { service, calls } = fixture();
    const cities = await service.answer({ intent: 'hotels', text: 'Ce hoteluri sunt acolo?', context: 'Vreau în Brașov. M-am răzgândit: București.' });
    assert.deepEqual(cities.catalog.hotels.map(hotel => hotel.id_hotel), [2]);
    const details = await service.answer({ intent: 'hotel_details', text: 'Ce facilități are acest hotel?', context: 'Detalii despre Hotel Demo. Acum vreau Hotel Central.' });
    assert.equal(details.catalog.hotel.id_hotel, 2);
    assert.deepEqual(calls.slice(-2).map(call => call.params), [[2], [2]]);
    const explicit = await service.answer({ intent: 'hotel_details', hotel: 'Hotel Demo', context: 'Hotel Central' });
    assert.equal(explicit.catalog.hotel.id_hotel, 1);
    const english = await service.answer({ intent: 'hotels', text: 'What hotels are there?', context: 'Brasov, then Bucuresti' });
    assert.equal(english.language, 'en');
    assert.deepEqual(english.catalog.hotels.map(hotel => hotel.id_hotel), [2]);
});
