const { sendNotification } = require('./notifications');
const { HttpError } = require('./errors');
const { reservationView } = require('./reservation-view');
const { integer } = require('./validation');

function createPaymentService({ stripe, bookings, db, config, notify = async () => {}, groups }) {
    const gateway = () => { if (!stripe) throw new HttpError(503, 'Plățile online nu sunt configurate.'); return stripe; };
    async function checkout(userId, input) {
        const method = input.metoda_plata || 'online_total';
        if (!['online_total', 'avans_online'].includes(method)) throw new HttpError(400, 'Metodă de plată online invalidă.');
        const api = gateway();
        const quote = await bookings.quote(input);
        const amount = method === 'avans_online' ? quote.advanceCents : quote.totalCents;
        const session = await api.checkout.sessions.create({
            mode: 'payment', payment_method_types: ['card'], locale: 'ro',
            client_reference_id: String(userId),
            success_url: `${config.siteUrl}/rezervare/succes?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.siteUrl}/rezervare/anulat`,
            line_items: [{ price_data: { currency: 'ron', unit_amount: amount,
                product_data: { name: `${quote.hotelName} — ${quote.roomName}`,
                    description: `${quote.checkin} – ${quote.checkout}; ${quote.nights} nopți` } }, quantity: 1 }],
            metadata: { booking_version: '1', id_utilizator: String(integer(userId)), id_camera: String(quote.roomId),
                data_checkin: quote.checkin, data_checkout: quote.checkout, guests: quote.guests ? String(quote.guests) : '',
                id_cod: quote.codeId ? String(quote.codeId) : '', total_cents: String(quote.totalCents),
                advance_cents: String(quote.advanceCents), metoda_plata: method,
                nume_hotel: quote.hotelName, tip_camera: quote.roomName },
        });
        return { url: session.url, session_id: session.id, pret_total: quote.totalCents / 100,
            suma_avans: method === 'avans_online' ? quote.advanceCents / 100 : null };
    }
    async function confirm(sessionId, userId) {
        if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new HttpError(400, 'Session ID invalid.');
        const api = gateway();
        const session = await api.checkout.sessions.retrieve(sessionId);
        if (session.metadata?.booking_version === '2' && groups) return groups.confirm(session, userId);
        const meta = session.metadata || {};
        const owner = integer(meta.id_utilizator, 'Utilizator sesiune');
        if (userId != null && Number(userId) !== owner) throw new HttpError(403, 'Sesiunea de plată aparține altui utilizator.');
        if (session.payment_status !== 'paid') throw new HttpError(400, 'Plata nu a fost finalizată.');
        const [existing] = await db.promise().execute(`SELECT r.*,h.nume_hotel,cc.denumire AS tip_camera FROM Rezervari r
            JOIN Camere c ON c.id_camera=r.id_camera JOIN Categorii_Camere cc ON cc.id_categorie=c.id_categorie
            JOIN Hoteluri h ON h.id_hotel=cc.id_hotel WHERE r.stripe_session_id=?`, [sessionId]);
        if (existing.length) {
            if (Number(existing[0].id_utilizator) !== owner) throw new HttpError(403, 'Acces neautorizat.');
            return reservationView({ ...existing[0], duplicate: true });
        }
        if (meta.booking_version !== '1') throw new HttpError(409, 'Sesiune creată cu o versiune veche. Este necesară verificarea plății.');
        const totalCents = integer(meta.total_cents, 'Total');
        const advanceCents = integer(meta.advance_cents, 'Avans');
        const method = meta.metoda_plata;
        if (!['online_total', 'avans_online'].includes(method) || advanceCents !== Math.round(totalCents * 0.30)) throw new HttpError(400, 'Metadate de plată invalide.');
        const expected = method === 'avans_online' ? advanceCents : totalCents;
        if (session.currency !== 'ron' || session.amount_total !== expected || !session.payment_intent) throw new HttpError(409, 'Suma sau moneda plății nu corespunde rezervării.');
        const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
        const intent = await api.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] });
        if (intent.latest_charge && typeof intent.latest_charge === 'object'
            && (intent.latest_charge.refunded || intent.latest_charge.amount_refunded > 0)) {
            throw Object.assign(new HttpError(409, 'Plata a fost rambursată.'), { paymentRefunded: true });
        }
        if (intent.status !== 'succeeded' || intent.currency !== 'ron' || intent.amount_received !== expected
            || !intent.latest_charge || typeof intent.latest_charge === 'string'
            || intent.latest_charge.refunded || intent.latest_charge.amount_refunded > 0) {
            throw new HttpError(409, 'Plata nu poate confirma această rezervare sau a fost rambursată.');
        }
        let reservation;
        try {
            reservation = await bookings.book(owner, { ...meta, guests: meta.guests || null }, {
                sessionId, method, price: { totalCents, advanceCents, hotelName: meta.nume_hotel, roomName: meta.tip_camera },
            });
        } catch (error) {
            // Dacă disponibilitatea/codul s-a schimbat în timpul plății, nu păstrăm banii fără rezervare.
            // Erorile temporare DB rămân reîncercabile de webhook; nu declanșează refund.
            if ([400, 404, 409].includes(error.status)) {
                await api.refunds.create({ payment_intent: intentId }, { idempotencyKey: `booking-refund-${sessionId}` });
                throw Object.assign(new HttpError(409, 'Rezervarea nu a putut fi confirmată. Rambursarea plății a fost inițiată.'), { paymentRefunded: true });
            }
            throw error;
        }
        if (!reservation.duplicate) sendNotification(() => notify(reservation), 'Email confirmare indisponibil.');
        return reservation;
    }
    return { checkout, confirm };
}
module.exports = { createPaymentService };
