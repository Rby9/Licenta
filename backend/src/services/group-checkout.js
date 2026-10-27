const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { HttpError } = require('./errors');
const { integer, interval, money } = require('./validation');
const { freeRoomSQL } = require('./availability');
const { withTransaction } = require('./transaction');
const { sendNotification } = require('./notifications');
const policy = 'cancel-over-24h-manual-refund-v1';
const fail = (message, status = 409) => { throw new HttpError(status, message); };
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const asDate = value => value instanceof Date ? value.toLocaleDateString('en-CA') : String(value).slice(0, 10);

function createGroupCheckout({ db, config, stripe, notify = async () => {} }) {
    const tx = work => withTransaction(db, work);
    const sql = (connection, query, params = []) => connection.execute(query, params);
    function input(value) {
        if (!value || typeof value !== 'object' || !Array.isArray(value.rooms) || !value.rooms.length || value.rooms.length > 100) fail('Alege între 1 și 100 de camere.', 400);
        const rooms = value.rooms.map(room => ({ categoryId: integer(room?.categoryId, 'Categorie'), adults: integer(room?.adults, 'Adulți', 1, 100) })).sort((a, b) => a.categoryId - b.categoryId || a.adults - b.adults);
        const adults = rooms.reduce((sum, room) => sum + room.adults, 0);
        if (adults > 100) fail('Grupul poate avea maximum 100 de adulți.', 400);
        const method = value.method || 'online_total';
        if (!['online_total', 'avans_online', 'cash_cazare'].includes(method)) fail('Metodă de plată invalidă.', 400);
        return { hotelId: integer(value.hotelId, 'Hotel'), ...interval(value.checkin, value.checkout, { future: true }), rooms, adults, method, policy };
    }
    async function inspect(connection, data, { lock = false, approvedPrices = false } = {}) {
        const [hotels] = await sql(connection, 'SELECT id_hotel,nume_hotel FROM Hoteluri WHERE id_hotel=?', [data.hotelId]);
        if (!hotels.length) fail('Hotelul nu mai există.');
        const ids = [...new Set(data.rooms.map(room => room.categoryId))];
        const [categories] = await sql(connection, `SELECT id_categorie,denumire,capacitate,pret_pe_noapte FROM Categorii_Camere WHERE id_hotel=? AND id_categorie IN (${ids.map(() => '?').join(',')}) ORDER BY id_categorie`, [data.hotelId, ...ids]);
        const [physical] = await sql(connection, `SELECT c.id_camera,c.id_categorie FROM Camere c WHERE c.id_categorie IN (${ids.map(() => '?').join(',')}) AND c.status_camera='activa' ORDER BY c.id_camera${lock ? ' FOR UPDATE' : ''}`, ids);
        const [free] = await sql(connection, `SELECT c.id_camera FROM Camere c WHERE c.id_categorie IN (${ids.map(() => '?').join(',')}) AND c.status_camera='activa' AND ${freeRoomSQL()} ORDER BY c.id_camera`, [...ids, data.checkout, data.checkin]);
        const freeIds = new Set(free.map(room => room.id_camera));
        const available = physical.filter(room => freeIds.has(room.id_camera));
        const rooms = data.rooms.map(room => {
            const category = categories.find(row => Number(row.id_categorie) === room.categoryId);
            if (!category || Number(category.capacitate) < room.adults) fail('Categoria sau capacitatea camerei s-a schimbat. Cere o ofertă nouă.');
            const index = available.findIndex(row => Number(row.id_categorie) === room.categoryId);
            if (index < 0) fail('Nu mai sunt disponibile toate camerele. Nu a fost confirmată nicio cameră.');
            const [physicalRoom] = available.splice(index, 1);
            const nightlyCents = approvedPrices ? room.nightlyCents : money(category.pret_pe_noapte);
            if (!Number.isSafeInteger(nightlyCents) || nightlyCents <= 0) fail('Prețul camerei nu este valid.');
            return { categoryId: room.categoryId, adults: room.adults, name: category.denumire, capacity: Number(category.capacitate), nightlyCents, totalCents: nightlyCents * data.nights, roomId: physicalRoom.id_camera, lineId: room.lineId };
        });
        const totalCents = rooms.reduce((sum, room) => sum + room.totalCents, 0);
        if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || totalCents > 9999999999) fail('Totalul rezervării nu este valid.', 400);
        return { ...data, hotelName: hotels[0].nume_hotel, rooms, totalCents, advanceCents: Math.round(totalCents * .3) };
    }
    function snapshot(quote) {
        return { hotelId: quote.hotelId, hotelName: quote.hotelName, checkin: quote.checkin, checkout: quote.checkout, nights: quote.nights, adults: quote.adults, method: quote.method, policy,
            rooms: quote.rooms.map(({ categoryId, adults, nightlyCents, name, capacity }) => ({ categoryId, adults, nightlyCents, name, capacity })), totalCents: quote.totalCents };
    }
    async function preview(owner, value) {
        const userId = integer(owner, 'Utilizator');
        const quote = await inspect(db.promise(), input(value));
        const payload = { ...snapshot(quote), userId, approvalId: crypto.randomUUID() };
        const quoteToken = jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256', audience: 'hoteluriro-checkout-approval', expiresIn: '10m' });
        const dueNowCents = quote.method === 'cash_cazare' ? 0 : quote.method === 'avans_online' ? quote.advanceCents : quote.totalCents;
        return { ...quote, rooms: quote.rooms.map(({ roomId, lineId, ...room }) => { void roomId; void lineId; return room; }), dueNowCents, remainingCents: quote.totalCents - dueNowCents,
            quoteToken, expiresAt: new Date(Date.now() + 600000).toISOString(), onlineEnabled: Boolean(stripe) };
    }
    function approved(owner, value) {
        if (value?.approved !== true || typeof value.quoteToken !== 'string' || value.quoteToken.length > 40000) fail('Este necesară aprobarea explicită a ofertei.', 400);
        let data;
        try { data = jwt.verify(value.quoteToken, config.jwtSecret, { algorithms: ['HS256'], audience: 'hoteluriro-checkout-approval' }); }
        catch { fail('Oferta a expirat sau nu este validă. Cere o ofertă nouă.'); }
        if (data.userId !== integer(owner, 'Utilizator')) fail('Oferta aparține altui utilizator.', 403);
        input(data);
        if (data.policy !== policy) fail('Condițiile s-au schimbat. Cere o ofertă nouă.');
        return data;
    }
    async function group(connection, id, owner, lock = false) {
        const [rows] = await sql(connection, `SELECT g.*,h.nume_hotel FROM Rezervari_Grup g JOIN Hoteluri h ON h.id_hotel=g.id_hotel WHERE g.id_grup=?${lock ? ' FOR UPDATE' : ''}`, [integer(id, 'Grup')]);
        if (!rows.length) fail('Rezervarea de grup nu există.', 404);
        if (owner != null && Number(rows[0].id_utilizator) !== Number(owner)) fail('Rezervarea aparține altui utilizator.', 403);
        return rows[0];
    }
    async function lines(connection, id) {
        const [rows] = await sql(connection, `SELECT l.*,cc.denumire,cc.capacitate FROM Rezervari_Grup_Camere l JOIN Categorii_Camere cc ON cc.id_categorie=l.id_categorie WHERE l.id_grup=? ORDER BY l.id_linie_grup`, [id]);
        return rows;
    }
    function storedData(g, rows) {
        return { hotelId: Number(g.id_hotel), checkin: asDate(g.data_checkin), checkout: asDate(g.data_checkout), nights: interval(asDate(g.data_checkin), asDate(g.data_checkout)).nights,
            adults: Number(g.nr_adulti), method: g.metoda_plata, rooms: rows.map(row => ({ categoryId: Number(row.id_categorie), adults: Number(row.nr_adulti), nightlyCents: money(row.pret_pe_noapte), lineId: row.id_linie_grup })) };
    }
    async function bookAll(connection, g, rows, payment = false) {
        if (g.status_rezervare === 'confirmata') return;
        if (g.status_rezervare !== 'in_asteptare') fail('Comanda nu mai poate fi confirmată.');
        const quote = await inspect(connection, storedData(g, rows), { lock: true, approvedPrices: true });
        if (quote.totalCents !== money(g.pret_total)) fail('Totalul aprobat nu corespunde camerelor.');
        let allocatedAdvance = 0, allocatedCommission = 0;
        for (let index = 0; index < quote.rooms.length; index++) {
            const room = quote.rooms[index], last = index === quote.rooms.length - 1;
            const advance = last ? Math.round(quote.totalCents * .3) - allocatedAdvance : Math.floor(room.totalCents * .3);
            const commission = last ? Math.round(quote.totalCents * .1) - allocatedCommission : Math.floor(room.totalCents * .1);
            allocatedAdvance += advance; allocatedCommission += commission;
            await sql(connection, `INSERT INTO Rezervari (id_utilizator,id_camera,data_checkin,data_checkout,pret_total,status_rezervare,stripe_session_id,comision_platforma,suma_hotel,status_plata,metoda_plata,suma_avans,id_linie_grup)
                VALUES (?,?,?,?,?,'confirmata',NULL,?,?,?,?,?,?)`, [g.id_utilizator, room.roomId, quote.checkin, quote.checkout, room.totalCents / 100, commission / 100, (room.totalCents - commission) / 100,
                payment && quote.method === 'online_total' ? 'platita' : 'in_asteptare', quote.method, quote.method === 'avans_online' ? advance / 100 : null, room.lineId]);
        }
        await sql(connection, "UPDATE Rezervari_Grup SET status_rezervare='confirmata',status_plata=? WHERE id_grup=?", [payment ? quote.method === 'online_total' ? 'platita' : 'avans_platit' : 'in_asteptare', g.id_grup]);
    }
    async function view(id, owner) {
        const connection = db.promise(), g = await group(connection, id, owner), rows = await lines(connection, id);
        const [reservations] = await sql(connection, 'SELECT r.id_rezervare,r.pret_total,r.suma_avans FROM Rezervari r JOIN Rezervari_Grup_Camere l ON l.id_linie_grup=r.id_linie_grup WHERE l.id_grup=? ORDER BY l.id_linie_grup', [id]);
        return { id_grup: g.id_grup, hotelName: g.nume_hotel, ...storedData(g, rows), rooms: rows.map(row => ({ categoryId: row.id_categorie, name: row.denumire, capacity: Number(row.capacitate), adults: Number(row.nr_adulti), nightlyCents: money(row.pret_pe_noapte), totalCents: money(row.pret_total) })),
            totalCents: money(g.pret_total), dueNowCents: g.metoda_plata === 'cash_cazare' ? 0 : g.metoda_plata === 'avans_online' ? money(g.suma_avans) : money(g.pret_total),
            status: g.status_rezervare, paymentStatus: g.status_plata, reservations };
    }
    async function notifyGroup(id, owner) {
        const result = await view(id, owner);
        for (const reservation of result.reservations) sendNotification(() => notify({ ...reservation, id_utilizator: owner, nume_hotel: result.hotelName, tip_camera: `Grup #${id}`, data_checkin: result.checkin, data_checkout: result.checkout,
            nopti: result.nights, metoda_plata: result.method, suma_avans: result.method === 'avans_online' ? reservation.suma_avans : null }), 'Email grup indisponibil.');
    }
    async function approve(owner, value) {
        const data = approved(owner, value);
        if (data.method !== 'cash_cazare' && !stripe) fail('Plățile online nu sunt configurate.', 503);
        const digest = hash(snapshot(data));
        let created = false;
        const id = await tx(async connection => {
            // Serializăm aprobările aceleiași persoane înainte de verificarea cheii idempotente.
            await sql(connection, 'SELECT id_utilizator FROM Utilizatori WHERE id_utilizator=? FOR UPDATE', [owner]);
            const [existing] = await sql(connection, 'SELECT * FROM Rezervari_Grup WHERE cerere_aprobare_id=? FOR UPDATE', [data.approvalId]);
            if (existing.length) {
                if (Number(existing[0].id_utilizator) !== Number(owner) || existing[0].oferta_hash !== digest) fail('Aprobare invalidă.', 403);
                return existing[0].id_grup;
            }
            const quote = await inspect(connection, data, { lock: true });
            if (hash(snapshot(quote)) !== digest) fail('Prețul sau oferta s-a schimbat. Verifică și aprobă o ofertă nouă.');
            const [inserted] = await sql(connection, `INSERT INTO Rezervari_Grup (id_utilizator,id_hotel,data_checkin,data_checkout,nr_adulti,pret_total,metoda_plata,suma_avans,cerere_aprobare_id,oferta_hash,aprobat_la,expira_la)
                VALUES (?,?,?,?,?,?,?,?,?,?,NOW(6),DATE_ADD(NOW(6),INTERVAL 35 MINUTE))`, [owner, data.hotelId, data.checkin, data.checkout, data.adults, quote.totalCents / 100, data.method, data.method === 'avans_online' ? quote.advanceCents / 100 : null, data.approvalId, digest]);
            const id = inserted.insertId;
            for (const room of quote.rooms) await sql(connection, 'INSERT INTO Rezervari_Grup_Camere (id_grup,id_categorie,nr_adulti,pret_pe_noapte,pret_total) VALUES (?,?,?,?,?)', [id, room.categoryId, room.adults, room.nightlyCents / 100, room.totalCents / 100]);
            if (data.method === 'cash_cazare') await bookAll(connection, await group(connection, id, owner), await lines(connection, id));
            created = true;
            return id;
        });
        if (data.method === 'cash_cazare') {
            if (created) await notifyGroup(id, owner).catch(() => {});
            return { group: await view(id, owner) };
        }
        const g = await group(db.promise(), id, owner);
        if (g.status_rezervare === 'confirmata') return { group: await view(id, owner) };
        if (g.status_rezervare !== 'in_asteptare') fail('Comanda nu mai este activă.');
        const amount = data.method === 'avans_online' ? money(g.suma_avans) : money(g.pret_total);
        const session = await stripe.checkout.sessions.create({ mode: 'payment', payment_method_types: ['card'], client_reference_id: String(owner),
            expires_at: Math.floor(new Date(g.expira_la).getTime() / 1000),
            success_url: `${config.siteUrl}/rezervare/grup?group_id=${id}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.siteUrl}/rezervare/grup?group_id=${id}`,
            line_items: [{ quantity: 1, price_data: { currency: 'ron', unit_amount: amount, product_data: { name: `${g.nume_hotel} — ${data.rooms.length} camere`, description: `${data.checkin} – ${data.checkout}; ${data.adults} adulți` } } }],
            metadata: { booking_version: '2', group_id: String(id), id_utilizator: String(owner), oferta_hash: digest },
        }, { idempotencyKey: `group-checkout-${id}` });
        await sql(db.promise(), 'UPDATE Rezervari_Grup SET stripe_session_id=? WHERE id_grup=? AND (stripe_session_id IS NULL OR stripe_session_id=?)', [session.id, id, session.id]);
        return { id_grup: id, url: session.url };
    }
    async function confirm(session, owner) {
        const meta = session.metadata || {};
        const id = integer(meta.group_id, 'Grup');
        const g = await group(db.promise(), id, owner);
        if (Number(meta.id_utilizator) !== Number(g.id_utilizator) || meta.oferta_hash !== g.oferta_hash || (g.stripe_session_id && g.stripe_session_id !== session.id)) fail('Sesiunea nu corespunde comenzii.', 403);
        if (g.status_rezervare === 'confirmata') return { ...await view(id, g.id_utilizator), duplicate: true };
        const expected = g.metoda_plata === 'avans_online' ? money(g.suma_avans) : money(g.pret_total);
        if (g.metoda_plata === 'cash_cazare' || session.payment_status !== 'paid' || session.currency !== 'ron' || session.amount_total !== expected || !session.payment_intent) fail('Plata nu corespunde ofertei aprobate.');
        const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
        const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] });
        if (intent.latest_charge?.refunded || intent.latest_charge?.amount_refunded > 0) {
            await sql(db.promise(), "UPDATE Rezervari_Grup SET status_plata='rambursata' WHERE id_grup=? AND status_rezervare<>'confirmata'", [id]);
            throw Object.assign(new HttpError(409, 'Plata a fost rambursată.'), { paymentRefunded: true });
        }
        if (intent.status !== 'succeeded' || intent.currency !== 'ron' || intent.amount_received !== expected || !intent.latest_charge || typeof intent.latest_charge !== 'object') fail('Plata nu a fost verificată.');
        let changed = false;
        try {
            await tx(async connection => {
                const current = await group(connection, id, owner, true);
                if (current.status_rezervare === 'confirmata') return;
                await bookAll(connection, current, await lines(connection, id), true);
                await sql(connection, 'UPDATE Rezervari_Grup SET stripe_session_id=?,stripe_payment_intent_id=? WHERE id_grup=?', [session.id, intentId, id]);
                changed = true;
            });
        } catch (error) {
            if ([400, 404, 409].includes(error.status)) {
                // Întâi memorăm rambursarea în curs: un retry nu mai poate crea rezervări.
                const shouldRefund = await tx(async connection => {
                    const current = await group(connection, id, owner, true);
                    if (current.status_rezervare === 'confirmata') return false;
                    await sql(connection, "UPDATE Rezervari_Grup SET status_rezervare='anulata',status_plata='rambursare_in_curs' WHERE id_grup=?", [id]);
                    return true;
                });
                if (!shouldRefund) return { ...await view(id, g.id_utilizator), duplicate: true };
                await stripe.refunds.create({ payment_intent: intentId }, { idempotencyKey: `group-refund-${id}` });
                await sql(db.promise(), "UPDATE Rezervari_Grup SET status_plata='rambursata',stripe_session_id=?,stripe_payment_intent_id=? WHERE id_grup=?", [session.id, intentId, id]);
                throw Object.assign(new HttpError(409, 'Camerele nu au putut fi confirmate. Rambursarea întregii plăți a fost inițiată.'), { paymentRefunded: true });
            }
            throw error;
        }
        if (changed) await notifyGroup(id, g.id_utilizator).catch(() => {});
        return { ...await view(id, g.id_utilizator), duplicate: !changed };
    }
    async function cancel(id, owner) {
        await tx(async connection => {
            const g = await group(connection, id, owner, true);
            if (g.status_rezervare !== 'confirmata') fail('Rezervarea nu poate fi anulată în această stare.');
            const midnight = new Date(`${asDate(g.data_checkin)}T00:00:00Z`);
            const offset = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', hourCycle: 'h23' }).format(midnight));
            if (midnight.getTime() - offset * 3600000 - Date.now() <= 86400000) fail('Anularea necesită mai mult de 24h înainte de check-in.');
            const [reservations] = await sql(connection, 'SELECT r.id_camera FROM Rezervari r JOIN Rezervari_Grup_Camere l ON l.id_linie_grup=r.id_linie_grup WHERE l.id_grup=? ORDER BY r.id_camera', [id]);
            for (const room of reservations) await sql(connection, 'SELECT id_camera FROM Camere WHERE id_camera=? FOR UPDATE', [room.id_camera]);
            await sql(connection, "UPDATE Rezervari r JOIN Rezervari_Grup_Camere l ON l.id_linie_grup=r.id_linie_grup SET r.status_rezervare='anulata' WHERE l.id_grup=?", [id]);
            await sql(connection, "UPDATE Rezervari_Grup SET status_rezervare='anulata' WHERE id_grup=?", [id]);
        });
        return view(id, owner);
    }
    async function byLine(lineId, owner) {
        const [rows] = await sql(db.promise(), 'SELECT id_grup FROM Rezervari_Grup_Camere WHERE id_linie_grup=?', [integer(lineId, 'Cameră grup')]);
        if (!rows.length) fail('Grup inexistent.', 404);
        return view(rows[0].id_grup, owner);
    }
    async function list(owner) {
        const [rows] = await sql(db.promise(), 'SELECT g.id_grup,g.status_rezervare,g.pret_total,h.nume_hotel FROM Rezervari_Grup g JOIN Hoteluri h ON h.id_hotel=g.id_hotel WHERE g.id_utilizator=? ORDER BY g.id_grup DESC LIMIT 100', [integer(owner, 'Utilizator')]);
        return rows.map(row => ({ id_grup: row.id_grup, status_rezervare: row.status_rezervare, totalCents: money(row.pret_total), nume_hotel: row.nume_hotel }));
    }
    async function resume(id, owner) {
        const g = await group(db.promise(), id, owner);
        if (g.status_rezervare === 'confirmata') return { group: await view(id, owner) };
        if (!stripe || !g.stripe_session_id || g.status_rezervare !== 'in_asteptare') fail('Nu există o plată activă de continuat.');
        const session = await stripe.checkout.sessions.retrieve(g.stripe_session_id);
        if (session.payment_status === 'paid') return { group: await confirm(session, owner) };
        if (session.status === 'expired') {
            await sql(db.promise(), "UPDATE Rezervari_Grup SET status_rezervare='expirata' WHERE id_grup=? AND status_rezervare='in_asteptare'", [id]);
            return { group: await view(id, owner) };
        }
        if (session.status !== 'open' || !session.url) fail('Sesiunea de plată a expirat. Cere o ofertă nouă.');
        return { url: session.url };
    }
    return { preview, approve, confirm, view, cancel, byLine, list, resume };
}
module.exports = { createGroupCheckout };
