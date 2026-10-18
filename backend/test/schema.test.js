const { test } = require('node:test');
const assert = require('node:assert/strict');
const { initialize } = require('../database/init');
const { genereazaPDFBuffer } = require('../src/services/pdf');
const fontkit = require('fontkit');
const path = require('node:path');

test('inițializarea refuză o bază care conține deja tabele, fără DDL sau DML', async () => {
    let closed = false;
    await assert.rejects(initialize({ config: { database: 'existing_database' }, connect: async () => ({
        execute: async () => [[{ TABLE_NAME: 'Utilizatori' }]],
        query: async () => assert.fail('Nu trebuie modificată o bază existentă'),
        end: async () => { closed = true; },
    }) }), /conține deja tabele/);
    assert.equal(closed, true);
});
test('numele rezervate sau invalide sunt respinse înaintea conectării', async () => {
    for (const name of ['mysql', 'information_schema', 'test`;DROP DATABASE x', '']) {
        await assert.rejects(initialize({ config: { database: name }, connect: async () => assert.fail('Nu trebuie conectată DB') }));
    }
});
test('fonturile PDF includ alfabetul românesc și pot genera documentul', async () => {
    for (const weight of ['Regular', 'Bold']) {
        const font = fontkit.openSync(path.join(__dirname, `../fonts/Roboto-${weight}.ttf`));
        for (const character of 'ABCabc123ăâîșțĂÂÎȘȚ') assert.ok(font.hasGlyphForCodePoint(character.codePointAt(0)));
    }
    const buffer = await genereazaPDFBuffer({ id_rezervare: 1, nume_complet: 'Ștefan Țăran', email: 'test@example.invalid',
        nume_hotel: 'Hotel Brașov', adresa_hotel: 'Strada Școlii', nume_oras: 'Brașov', stele: 4,
        tip_camera: 'Dublă', data_checkin: '2090-11-10', data_checkout: '2090-11-12', pret_pe_noapte: 200,
        pret_total: 400, status_rezervare: 'confirmata', metoda_plata: 'online_total' });
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
    assert.ok(buffer.length > 5000);
});

test('TVA inclus se separă din total fără a modifica totalul rezervării', () => {
    const { vatBreakdown } = require('../src/services/pdf');
    const result = vatBreakdown(399.98);
    assert.deepEqual(result, { pretFaraTVA: 336.12, tva: 63.86 });
    assert.equal(Math.round((result.pretFaraTVA + result.tva) * 100), 39998);
});
