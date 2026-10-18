const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createHoteluriRouter } = require('../src/modules/hoteluri/routes');

async function request(t, url, replies = []) {
    const queries = [];
    const db = {
        query(sql, params, callback) {
            if (typeof params === 'function') { callback = params; params = []; }
            assert.match(sql.trim(), /^SELECT\b/i, 'Rutele publice trebuie să fie doar de citire');
            queries.push({ sql, params });
            const reply = replies.shift() || {};
            callback(reply.error || null, reply.rows || []);
        },
    };
    const app = express();
    app.use(createHoteluriRouter(db));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`);
    return { status: response.status, body: await response.json(), queries };
}

for (const path of ['/api/camere', '/api/orase', '/api/hoteluri', '/api/hoteluri/harta',
    '/api/hoteluri/search', '/api/facilitati', '/api/hoteluri/1/galerie',
    '/api/hoteluri/1/facilitati', '/api/hoteluri/1/disponibilitate?checkin=2026-11-01&checkout=2026-11-03']) {
    test(`GET ${path} păstrează răspunsul listei`, async t => {
        const rows = [{ id: 1, nume: 'Exemplu' }];
        const result = await request(t, path, [{ rows }]);
        assert.equal(result.status, 200);
        assert.deepEqual(result.body, rows);
        assert.equal(result.queries.length, 1);
    });
}

test('detaliile includ categoriile, cu parametri separați de SQL', async t => {
    const result = await request(t, '/api/hoteluri/7', [
        { rows: [{ id_hotel: 7 }] }, { rows: [{ id_categorie: 3 }] },
    ]);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { id_hotel: 7, categorii_camere: [{ id_categorie: 3 }] });
    assert.deepEqual(result.queries.map(q => q.params), [['7'], ['7']]);
});

test('hotel absent: 404', async t => {
    const result = await request(t, '/api/hoteluri/999');
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, { eroare: 'Hotel negăsit' });
});

test('eroare DB la categorii: 500', async t => {
    const result = await request(t, '/api/hoteluri/1', [
        { rows: [{ id_hotel: 1 }] }, { error: new Error('Test') },
    ]);
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, { eroare: 'Eroare categorii' });
});

test('cameră: parametrii lipsă sunt respinși fără acces DB', async t => {
    const result = await request(t, '/api/camere/disponibila?categorie_id=1');
    assert.equal(result.status, 400);
    assert.equal(result.queries.length, 0);
});

test('cameră: intervalul transmite checkout înainte de checkin pentru suprapunere', async t => {
    const result = await request(t, '/api/camere/disponibila?categorie_id=3&checkin=2026-11-01&checkout=2026-11-03', [{ rows: [{ id_camera: 9 }] }]);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { id_camera: 9 });
    assert.deepEqual(result.queries[0].params, [3, '2026-11-03', '2026-11-01']);
    assert.match(result.queries[0].sql, /r\.data_checkin\s+< \?/);
    assert.match(result.queries[0].sql, /r\.data_checkout\s+> \?/);
});

test('cameră indisponibilă: 409', async t => {
    const result = await request(t, '/api/camere/disponibila?categorie_id=3&checkin=2026-11-01&checkout=2026-11-03');
    assert.equal(result.status, 409);
});

test('eroare DB la lista hotelurilor: 500', async t => {
    const result = await request(t, '/api/hoteluri', [{ error: new Error('Test') }]);
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, { eroare: 'Eroare hoteluri' });
});

test('filtrele căutării păstrează ordinea parametrilor și sortarea', async t => {
    const result = await request(t, '/api/hoteluri/search?checkin=2026-11-01&checkout=2026-11-03&oras=Gala%C8%9Bi&guests=2&stele_exact=4&pret_max=500&facilitati=1,2&sort=pret_asc');
    assert.deepEqual(result.queries[0].params, ['2026-11-03', '2026-11-01', 'Galați', 4, 2, 1, 2, 2, 500]);
    assert.match(result.queries[0].sql, /ORDER BY pret_minim ASC$/);
});

test('sortarea necunoscută folosește valoarea implicită', async t => {
    const result = await request(t, '/api/hoteluri/search?sort=invalid');
    assert.match(result.queries[0].sql, /ORDER BY h\.stele DESC$/);
});

test('caracterizare defect existent: /cauta este interpretat ca ID de hotel', async t => {
    const result = await request(t, '/api/hoteluri/cauta');
    assert.equal(result.status, 404);
    assert.deepEqual(result.queries[0].params, ['cauta']);
});
