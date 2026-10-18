const express = require('express');
const { HttpError } = require('../../services/errors');
function registerPayments(app, { payments, verificaToken }) {
    app.post('/api/plati/creare-sesiune', verificaToken, async (req, res) => res.json(await payments.checkout(req.user.id, req.body)));
    app.post('/api/plati/confirmare', verificaToken, async (req, res) => {
        const reservation = await payments.confirm(req.body.session_id, req.user.id);
        res.json({ ...reservation, mesaj: reservation.duplicate ? 'Rezervare deja confirmată.' : 'Rezervare confirmată!' });
    });
}
function registerWebhook(app, { payments, stripe, config }) {
    app.post('/api/plati/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
        if (!stripe || !config.stripeWebhookSecret) throw new HttpError(503, 'Webhook neconfigurat.');
        let event;
        try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripeWebhookSecret); }
        catch { throw new HttpError(400, 'Semnătură webhook invalidă.'); }
        if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)
            && event.data.object.payment_status === 'paid') {
            try { await payments.confirm(event.data.object.id); }
            catch (error) {
                // Conflictele rambursate nu se reîncearcă. Erorile tehnice primesc 500 pentru retry.
                if (!error.paymentRefunded) throw error;
            }
        }
        res.json({ received: true });
    });
}
module.exports = { registerPayments, registerWebhook };
