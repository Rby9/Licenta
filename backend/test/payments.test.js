const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPaymentService } = require('../src/services/payments');
const { HttpError } = require('../src/services/errors');

function fixture({ owner = 1, paid = true, amount = 39998, refunded = false, existing = [], failure, notify } = {}) {
    const calls = { books: [], refunds: [], checkout: [] };
    const session = { id: 'cs_test_session', payment_status: paid ? 'paid' : 'unpaid', currency: 'ron', amount_total: amount,
        payment_intent: 'pi_test', metadata: { booking_version: '1', id_utilizator: String(owner), id_camera: '1',
            data_checkin: '2090-11-10', data_checkout: '2090-11-12', total_cents: '39998', advance_cents: '11999',
            metoda_plata: 'online_total', id_cod: '', guests: '2', nume_hotel: 'Hotel Test', tip_camera: 'Dublă' } };
    const bookings = {
        quote: async () => ({ roomId: 1, checkin: '2090-11-10', checkout: '2090-11-12', nights: 2,
            totalCents: 39998, advanceCents: 11999, hotelName: 'Hotel Test', roomName: 'Dublă' }),
        book: async (...args) => { calls.books.push(args); if (failure) throw failure; return { id_rezervare: 5, duplicate: false }; },
    };
    const stripe = {
        checkout: { sessions: { retrieve: async () => session, create: async args => { calls.checkout.push(args); return { id: session.id, url: 'https://checkout.example.invalid' }; } } },
        paymentIntents: { retrieve: async () => ({ status: 'succeeded', currency: 'ron', amount_received: amount,
            latest_charge: { refunded, amount_refunded: refunded ? amount : 0 } }) },
        refunds: { create: async (...args) => { calls.refunds.push(args); return { id: 're_test' }; } },
    };
    const db = { promise: () => ({ execute: async () => [existing] }) };
    const service = createPaymentService({ stripe, bookings, db, config: { siteUrl: 'http://localhost:5173' }, notify });
    return { service, calls, session };
}

test('checkout folosește suma canonică de pe server, nu suma clientului', async () => {
    const { service, calls } = fixture();
    await service.checkout(1, { pret_total: 0.01 });
    assert.equal(calls.checkout[0].line_items[0].price_data.unit_amount, 39998);
    assert.equal(calls.checkout[0].metadata.total_cents, '39998');
});
test('avansul este calculat pe server', async () => {
    const { service, calls } = fixture();
    const result = await service.checkout(1, { metoda_plata: 'avans_online', suma_avans: 1 });
    assert.equal(calls.checkout[0].line_items[0].price_data.unit_amount, 11999);
    assert.equal(result.suma_avans, 119.99);
});
test('alt utilizator nu poate confirma sesiunea și nu poate declanșa refund', async () => {
    const { service, calls } = fixture({ owner: 2 });
    await assert.rejects(service.confirm('cs_test_session', 1), e => e.status === 403);
    assert.equal(calls.books.length, 0);
    assert.equal(calls.refunds.length, 0);
});
for (const [name, options] of [['plată nefinalizată', { paid: false }], ['sumă modificată', { amount: 1 }], ['plată rambursată', { refunded: true }]]) {
    test(`${name}: nu se creează rezervare`, async () => {
        const { service, calls } = fixture(options);
        await assert.rejects(service.confirm('cs_test_session', 1));
        assert.equal(calls.books.length, 0);
    });
}
test('plata validă transmite serviciului tranzacțional numai suma verificată', async () => {
    const { service, calls } = fixture();
    await service.confirm('cs_test_session', 1);
    assert.equal(calls.books.length, 1);
    assert.equal(calls.books[0][2].price.totalCents, 39998);
    assert.equal(calls.refunds.length, 0);
});
test('confirmarea repetată returnează rezervarea existentă', async () => {
    const { service, calls } = fixture({ existing: [{ id_rezervare: 7, id_utilizator: 1 }] });
    const result = await service.confirm('cs_test_session', 1);
    assert.equal(result.id_rezervare, 7);
    assert.equal(result.duplicate, true);
    assert.equal(calls.books.length, 0);
});
test('camera ocupată după checkout declanșează refund cu cheie idempotentă', async () => {
    const { service, calls } = fixture({ failure: new HttpError(409, 'Ocupat') });
    await assert.rejects(service.confirm('cs_test_session', 1), /Rambursarea/);
    assert.equal(calls.refunds.length, 1);
    assert.deepEqual(calls.refunds[0], [{ payment_intent: 'pi_test' }, { idempotencyKey: 'booking-refund-cs_test_session' }]);
});
test('eroarea tehnică DB este reîncercabilă și nu declanșează refund', async () => {
    const failure = new Error('Eroare simulată');
    const { service, calls } = fixture({ failure });
    await assert.rejects(service.confirm('cs_test_session', 1), failure);
    assert.equal(calls.refunds.length, 0);
});
test('moneda diferită este respinsă', async () => {
    const { service, calls, session } = fixture();
    session.currency = 'eur';
    await assert.rejects(service.confirm('cs_test_session', 1), e => e.status === 409);
    assert.equal(calls.books.length, 0);
});


test('emailul eșuat după confirmarea plății nu produce eroare sau refund', async t => {
    t.mock.method(console, 'error', () => {});
    const { service, calls } = fixture({ notify: () => { throw new Error('Email indisponibil'); } });
    const result = await service.confirm('cs_test_session', 1);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(result.id_rezervare, 5);
    assert.equal(calls.books.length, 1);
    assert.equal(calls.refunds.length, 0);
});
