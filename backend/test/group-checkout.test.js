const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createAuth } = require('../src/middleware/auth');
const { errorHandler } = require('../src/services/errors');
const { createGroupCheckoutRouter } = require('../src/modules/assistant/checkout-routes');
const { createGroupCheckout } = require('../src/services/group-checkout');
const { createPaymentService } = require('../src/services/payments');
const secret = 'synthetic-http-group-secret';
async function fixture(t) {
    let reads = 0;
    const db = { promise: () => ({ execute: async sql => {
        assert.equal(sql, 'SELECT id_utilizator,rol FROM Utilizatori WHERE id_utilizator=?'); reads++;
        return [[{ id_utilizator: 1, rol: 'client' }]];
    } }) };
    const config = { jwtSecret: secret, siteUrl: 'http://localhost:5173' };
    const app = express(); app.use(express.json());
    app.use(createGroupCheckoutRouter({ groups: createGroupCheckout({ db, config }), verificaToken: createAuth(db, secret).verificaToken, config, payments: {} }));
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    return { reads: () => reads, request: async (path, { token, body, method = 'POST', origin, language } = {}) => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/rezervari-grup${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}), ...(language ? { 'Accept-Language': language } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, body: await response.json() };
    } };
}
test('checkout grup HTTP: toate operațiile necesită autentificare', async t => {
    const app = await fixture(t);
    for (const [path, method] of [['/oferta', 'POST'], ['/aprobare', 'POST'], ['/confirmare', 'POST'], ['/1', 'GET'], ['', 'GET'], ['/linie/1', 'GET'], ['/1/anulare', 'PATCH'], ['/1/reia-plata', 'POST']]) assert.equal((await app.request(path, { method, body: method === 'GET' ? undefined : {} })).status, 401);
    assert.equal(app.reads(), 0);
});
test('checkout grup HTTP: mesajul de chat sau tokenul de login nu poate aproba oferta', async t => {
    const app = await fixture(t), token = jwt.sign({ id: 1 }, secret);
    for (const body of [{}, { approved: false }, { approved: 'true' }, { approved: true, quoteToken: token }]) {
        const result = await app.request('/aprobare', { token, body });
        assert.ok([400, 409].includes(result.status));
    }
    const blocked = await app.request('/aprobare', { token, body: {}, origin: 'https://other.example' });
    assert.equal(blocked.status, 403);
    const english = await app.request('/aprobare', { token, body: {}, language: 'en' });
    assert.match(english.body.eroare, /explicitly approve/);
    assert.equal((await app.request('/1/anulare', { token, method: 'PATCH', body: {} })).status, 400);
});
test('checkout grup: confirmarea Stripe versiunea 2 este delegată cu identitatea apelantului', async () => {
    let confirmed;
    const session = { id: 'cs_test_group', metadata: { booking_version: '2' } };
    const payments = createPaymentService({ stripe: { checkout: { sessions: { retrieve: async () => session } } }, groups: { confirm: async (...args) => { confirmed = args; return { id_grup: 3 }; } }, config: {} });
    assert.equal((await payments.confirm(session.id, 7)).id_grup, 3);
    assert.deepEqual(confirmed, [session, 7]);
});
