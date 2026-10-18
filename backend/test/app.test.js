const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { createApp } = require('../src/app');

async function fixture(t, execute, query = () => assert.fail('Interogare callback neașteptată')) {
    const sent = [];
    const db = { promise: () => ({ execute }), query };
    const app = createApp({ db, stripe: null,
        config: { jwtSecret: 'unit-test-secret', siteUrl: 'http://localhost:5173', emailFrom: 'test@example.invalid' },
        transport: { sendMail: async message => { sent.push(message); } },
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    return { sent, request: async (path, body, token) => {
        const result = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: result.status, body: result.headers.get('content-type')?.includes('application/pdf') ? Buffer.from(await result.arrayBuffer()) : await result.json() };
    } };
}

test('autentificarea citește rolul actual din DB, nu rolul vechi din JWT', async t => {
    const app = await fixture(t, async () => [[{ id_utilizator: 1, rol: 'client' }]]);
    const token = jwt.sign({ id: 1, rol: 'super_admin' }, 'unit-test-secret');
    const result = await app.request('/api/admin/stats', undefined, token);
    assert.equal(result.status, 403);
});
test('token lipsă sau invalid: rezervarea nu accesează DB', async t => {
    const app = await fixture(t, async () => assert.fail('Nu trebuie accesată DB'));
    assert.equal((await app.request('/api/rezervari', {})).status, 401);
    assert.equal((await app.request('/api/rezervari', {}, 'invalid')).status, 403);
});
test('un cont eliminat nu păstrează accesul prin token', async t => {
    const app = await fixture(t, async () => [[]]);
    const result = await app.request('/api/admin/stats', undefined, jwt.sign({ id: 1 }, 'unit-test-secret'));
    assert.equal(result.status, 401);
});
test('tipurile invalide la autentificare sunt respinse cu 400', async t => {
    const app = await fixture(t, async () => assert.fail('Nu trebuie accesată DB'));
    for (const body of [{ email: [], parola: 'abcdef' }, { email: 'test@example.invalid', parola: {} }]) {
        assert.equal((await app.request('/api/auth/login', body)).status, 400);
    }
});
test('login validează hash-ul și nu returnează parola sau tokenurile de resetare', async t => {
    const password = 'parola-fictiva-test';
    const hash = await bcrypt.hash(password, 4);
    const app = await fixture(t, async () => [[{ id_utilizator: 1, rol: 'client', email: 'test@example.invalid',
        nume_complet: 'Test', parola: hash, reset_token: 'private-reset-token' }]]);
    const result = await app.request('/api/auth/login', { email: 'test@example.invalid', parola: password });
    assert.equal(result.status, 200);
    assert.equal(result.body.utilizator.parola, undefined);
    assert.ok(!JSON.stringify(result.body).includes('private-reset-token'));
    assert.equal(jwt.verify(result.body.token, 'unit-test-secret').id, 1);
});
test('resetarea parolei stochează numai digestul tokenului', async t => {
    let digest;
    const app = await fixture(t, async (sql, params) => {
        if (sql.startsWith('SELECT')) return [[{ id_utilizator: 1, nume_complet: 'Test' }]];
        digest = params[0]; return [{ affectedRows: 1 }];
    });
    const result = await app.request('/api/auth/forgot-password', { email: 'test@example.invalid' });
    assert.equal(result.status, 200);
    assert.equal(app.sent.length, 1);
    const token = app.sent[0].text.match(/token=([a-f0-9]+)/)[1];
    assert.notEqual(digest, token);
    assert.equal(digest, crypto.createHash('sha256').update(token).digest('hex'));
});
test('tokenul de resetare este consumat printr-o singură operație condiționată', async t => {
    let used = false;
    const app = await fixture(t, async (sql, params) => {
        assert.match(sql, /reset_token_expires>NOW\(\)/);
        assert.match(sql, /reset_token=NULL/);
        assert.notEqual(params[0], 'parola-fictiva-test');
        if (used) return [{ affectedRows: 0 }];
        used = true; return [{ affectedRows: 1 }];
    });
    const body = { token: 'a'.repeat(64), parola_noua: 'parola-fictiva-test' };
    assert.equal((await app.request('/api/auth/reset-password', body)).status, 200);
    assert.equal((await app.request('/api/auth/reset-password', body)).status, 400);
});
test('configurația fără Stripe permite pornirea și răspunde 503 la plată', async t => {
    const app = await fixture(t, async () => [[{ id_utilizator: 1, rol: 'client' }]]);
    const token = jwt.sign({ id: 1 }, 'unit-test-secret');
    assert.equal((await app.request('/api/plati/creare-sesiune', {}, token)).status, 503);
});
test('ruta API inexistentă are răspuns JSON 404', async t => {
    const app = await fixture(t, async () => assert.fail('Nu trebuie accesată DB'));
    const result = await app.request('/api/inexistent');
    assert.equal(result.status, 404);
    assert.ok(result.body.eroare);
});

test('PDF-ul unei rezervări nu este accesibil altui utilizator', async t => {
    const app = await fixture(t, async () => [[{ id_utilizator: 1, rol: 'client' }]], (sql, params, callback) => {
        callback(null, [{ id_rezervare: 7, id_utilizator: 2 }]);
    });
    const token = jwt.sign({ id: 1 }, 'unit-test-secret');
    assert.equal((await app.request('/api/rezervari/7/factura', undefined, token)).status, 403);
});
test('PDF-ul propriei rezervări este descărcat ca document portabil', async t => {
    const app = await fixture(t, async () => [[{ id_utilizator: 1, rol: 'client' }]], (sql, params, callback) => {
        callback(null, [{ id_rezervare: 7, id_utilizator: 1, nume_complet: 'Ștefan', email: 'test@example.invalid',
            nume_hotel: 'Hotel', adresa_hotel: 'Adresă', nume_oras: 'Brașov', stele: 4, tip_camera: 'Dublă',
            data_checkin: '2090-11-10', data_checkout: '2090-11-12', pret_total: 400, pret_pe_noapte: 200 }]);
    });
    const result = await app.request('/api/rezervari/7/factura', undefined, jwt.sign({ id: 1 }, 'unit-test-secret'));
    assert.equal(result.status, 200);
    assert.equal(result.body.subarray(0,5).toString(), '%PDF-');
});

test('validarea codului promoțional acceptă checkin fără checkout', async t => {
    const app = await fixture(t, async () => [[{ id_utilizator: 1, rol: 'client' }]], (sql, params, callback) => {
        assert.match(sql, /FROM Coduri_Reducere/);
        callback(null, [{ id_cod: 1, procent_reducere: 10 }]);
    });
    const result = await app.request('/api/coduri/valideaza?cod=TEST&checkin=2090-11-10', undefined, jwt.sign({ id: 1 }, 'unit-test-secret'));
    assert.equal(result.status, 200);
    assert.equal(result.body.procent_reducere, 10);
});

test('numele utilizatorului nu poate injecta HTML în emailul de bun venit', async () => {
    const { createEmailService } = require('../src/services/email');
    let sent;
    const service = createEmailService({ db: {}, config: { emailFrom: 'test@example.invalid', siteUrl: 'http://localhost:5173' },
        transport: { sendMail: async message => { sent = message; } } });
    await service.trimiteEmailBunVenit('test@example.invalid', '<img src=x onerror=alert(1)>');
    assert.ok(!sent.html.includes('<img src=x'));
    assert.ok(sent.html.includes('&lt;img'));
});
