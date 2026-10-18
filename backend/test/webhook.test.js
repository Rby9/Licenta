const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Stripe = require('stripe');
const { registerWebhook } = require('../src/modules/plati/routes');
const { errorHandler } = require('../src/services/errors');

for (const valid of [true, false]) {
    test(`webhook verifică semnătura reală Stripe: ${valid ? 'validă' : 'invalidă'}`, async t => {
        const stripe = new Stripe('sk_test_fictitious');
        const secret = 'whsec_fictitious_for_unit_test';
        const payload = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed',
            data: { object: { id: 'cs_test_session', payment_status: 'paid' } } });
        const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: valid ? secret : 'wrong' });
        let confirmed = 0;
        const app = express();
        registerWebhook(app, { stripe, config: { stripeWebhookSecret: secret }, payments: { confirm: async id => {
            assert.equal(id, 'cs_test_session'); confirmed++;
        } } });
        app.use(express.json());
        app.use(errorHandler);
        const server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        t.after(() => new Promise(resolve => server.close(resolve)));
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/plati/webhook`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': signature }, body: payload,
        });
        assert.equal(response.status, valid ? 200 : 400);
        assert.equal(confirmed, valid ? 1 : 0);
    });
}
