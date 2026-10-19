const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogService, coordinates } = require('../src/services/catalog');

for (const input of [{}, { latitudine: '', longitudine: 25 }, { latitudine: 91, longitudine: 25 }, { latitudine: 45, longitudine: 181 }, { latitudine: true, longitudine: 25 }]) {
    test(`coordonate invalide respinse: ${JSON.stringify(input)}`, () => {
        assert.throws(() => coordinates(input, true), error => error.status === 400);
    });
}

test('categoria invalidă nu deschide o tranzacție', async () => {
    const service = createCatalogService({ getConnection: async () => assert.fail('Nu trebuie accesată DB') });
    for (const numar_camere of [undefined, 0, -1, 501, 1.5]) {
        await assert.rejects(service.createCategory({ id_hotel: 1, denumire: 'Dublă', capacitate: 2, pret_pe_noapte: 200, numar_camere }), error => error.status === 400);
    }
});

test('crearea camerelor eșuată anulează și categoria, fără commit parțial', async () => {
    let rollback = false, released = false;
    const failure = new Error('Eroare inserare camere');
    const connection = {
        async query(sql) { if (sql.startsWith('INSERT')) throw failure; },
        async beginTransaction() {},
        async execute(sql) { return sql.startsWith('SELECT') ? [[{ id_hotel: 1 }]] : [{ insertId: 9 }]; },
        async commit() { assert.fail('Nu trebuie confirmată categoria fără camere'); },
        async rollback() { rollback = true; },
        release() { released = true; },
    };
    const service = createCatalogService({ getConnection: async () => connection });
    await assert.rejects(service.createCategory({ id_hotel: 1, denumire: 'Dublă', capacitate: 2, pret_pe_noapte: 200, numar_camere: 3 }), error => error === failure);
    assert.ok(rollback && released);
});
