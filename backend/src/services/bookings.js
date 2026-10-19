const { HttpError } = require('./errors');
const { reservationView } = require('./reservation-view');
const { integer, interval, money } = require('./validation');

function bookingInput(input, { future = true } = {}) {
    return { roomId: integer(input.id_camera, 'Camera'),
        ...interval(input.data_checkin, input.data_checkout, { future }),
        guests: input.guests == null ? null : integer(input.guests, 'Persoane'),
        codeId: input.id_cod == null || input.id_cod === '' ? null : integer(input.id_cod, 'Cod reducere') };
}
function createBookingService(pool) {
    const promisePool = () => typeof pool.promise === 'function' ? pool.promise() : pool;
    async function transaction(work) {
        const connection = await promisePool().getConnection();
        let reusable = true;
        try {
            await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
            await connection.beginTransaction();
            const result = await work(connection);
            await connection.commit();
            return result;
        } catch (error) {
            try { await connection.rollback(); }
            catch {
                // O conexiune cu tranzacție incertă nu trebuie să reintre în pool.
                reusable = false;
                connection.destroy();
            }
            throw error;
        } finally { if (reusable) connection.release(); }
    }
    async function room(connection, id) {
        const [locked] = await connection.execute('SELECT * FROM Camere WHERE id_camera=? FOR UPDATE', [id]);
        if (!locked.length) throw new HttpError(404, 'Camera nu există.');
        const [rows] = await connection.execute(`SELECT c.id_camera,c.status_camera,
            cc.capacitate,cc.pret_pe_noapte,cc.denumire,h.nume_hotel
            FROM Camere c JOIN Categorii_Camere cc ON cc.id_categorie=c.id_categorie
            JOIN Hoteluri h ON h.id_hotel=cc.id_hotel WHERE c.id_camera=?`, [id]);
        if (!rows.length) throw new HttpError(404, 'Camera nu există.');
        return rows[0];
    }
    async function checkFree(connection, data, currentRoom, excludeId = 0) {
        if (currentRoom.status_camera !== 'activa') throw new HttpError(409, 'Camera nu este activă.');
        if (data.guests && data.guests > currentRoom.capacitate) throw new HttpError(400, 'Capacitatea camerei este depășită.');
        const [busy] = await connection.execute(`SELECT r.id_rezervare FROM Rezervari r
            WHERE r.id_camera=? AND r.id_rezervare<>?
            AND (r.status_rezervare IS NULL OR r.status_rezervare<>'anulata')
            AND r.data_checkin < ? AND r.data_checkout > ? LIMIT 1 FOR UPDATE`,
        [data.roomId, excludeId, data.checkout, data.checkin]);
        if (busy.length) throw new HttpError(409, 'Camera nu mai este disponibilă în perioada selectată.');
    }
    async function code(connection, data, consume = false, snapshot = false) {
        if (!data.codeId) return null;
        const [rows] = await connection.execute('SELECT * FROM Coduri_Reducere WHERE id_cod=? FOR UPDATE', [data.codeId]);
        const c = rows[0];
        const asDate = value => value instanceof Date ? value.toLocaleDateString('en-CA') : String(value).slice(0, 10);
        if (!c || (!snapshot && (!c.activ || (c.data_start && asDate(c.data_start) > data.checkin)
            || (c.data_expirare && asDate(c.data_expirare) < data.checkin)))
            || (c.utilizari_maxime != null && c.utilizari_curente >= c.utilizari_maxime)) {
            throw new HttpError(409, 'Codul de reducere nu mai este disponibil pentru această rezervare.');
        }
        integer(c.procent_reducere, 'Reducere', 0, 100);
        if (consume) await connection.execute('UPDATE Coduri_Reducere SET utilizari_curente=utilizari_curente+1 WHERE id_cod=?', [data.codeId]);
        return c;
    }
    function amounts(data, currentRoom, discount) {
        const base = money(currentRoom.pret_pe_noapte) * data.nights;
        const totalCents = base - Math.round(base * Number(discount?.procent_reducere || 0) / 100);
        if (totalCents <= 0 || totalCents > 9999999999) throw new HttpError(400, 'Valoarea rezervării nu este validă.');
        return { totalCents, advanceCents: Math.round(totalCents * 0.30),
            commissionCents: Math.round(totalCents * 0.10), nights: data.nights,
            hotelName: currentRoom.nume_hotel, roomName: currentRoom.denumire };
    }
    async function quote(input) {
        const data = bookingInput(input);
        return transaction(async connection => {
            const currentRoom = await room(connection, data.roomId);
            await checkFree(connection, data, currentRoom);
            return { ...data, ...amounts(data, currentRoom, await code(connection, data)) };
        });
    }
    async function book(userId, input, payment = null) {
        const data = bookingInput(input, { future: !payment });
        const user = integer(userId, 'Utilizator');
        if (!payment && input.metoda_plata && input.metoda_plata !== 'cash_cazare') throw new HttpError(400, 'Plata online necesită confirmarea Stripe.');
        return transaction(async connection => {
            // Toate fluxurile blochează aceeași cameră înainte de verificare și scriere.
            const currentRoom = await room(connection, data.roomId);
            if (payment) {
                const [existing] = await connection.execute('SELECT * FROM Rezervari WHERE stripe_session_id=? FOR UPDATE', [payment.sessionId]);
                if (existing.length) {
                    if (Number(existing[0].id_utilizator) !== user) throw new HttpError(403, 'Acces neautorizat.');
                    return reservationView({ ...existing[0], nume_hotel: currentRoom.nume_hotel, tip_camera: currentRoom.denumire, duplicate: true });
                }
            }
            await checkFree(connection, data, currentRoom);
            const discount = await code(connection, data, true, Boolean(payment));
            const price = payment ? payment.price : amounts(data, currentRoom, discount);
            const totalCents = integer(price.totalCents, 'Total în bani');
            const commission = Math.round(totalCents * 0.10);
            const method = payment ? payment.method : 'cash_cazare';
            const advance = method === 'avans_online' ? price.advanceCents / 100 : null;
            const [result] = await connection.execute(`INSERT INTO Rezervari
                (id_utilizator,id_camera,data_checkin,data_checkout,pret_total,status_rezervare,
                 stripe_session_id,comision_platforma,suma_hotel,status_plata,metoda_plata,suma_avans)
                VALUES (?,?,?,?,?,'confirmata',?,?,?,?,?,?)`,
            [user, data.roomId, data.checkin, data.checkout, totalCents / 100,
                payment?.sessionId || null, commission / 100, (totalCents - commission) / 100,
                payment && method === 'online_total' ? 'platita' : 'in_asteptare', method, advance]);
            return { id_rezervare: result.insertId, id_utilizator: user,
                pret_total: totalCents / 100, comision: commission / 100, suma_hotel: (totalCents - commission) / 100,
                nume_hotel: price.hotelName || currentRoom.nume_hotel, tip_camera: price.roomName || currentRoom.denumire,
                data_checkin: data.checkin, data_checkout: data.checkout, nopti: data.nights,
                metoda_plata: method, suma_avans: advance, duplicate: false };
        });
    }
    async function changeStatus(id, status, { userId, cancellation = false } = {}) {
        const reservationId = integer(id, 'Rezervare');
        if (!['confirmata', 'in_asteptare', 'anulata'].includes(status)) throw new HttpError(400, 'Status invalid.');
        return transaction(async connection => {
            const [initial] = await connection.execute('SELECT id_camera FROM Rezervari WHERE id_rezervare=?', [reservationId]);
            if (!initial.length) throw new HttpError(404, 'Rezervarea nu există.');
            const currentRoom = await room(connection, initial[0].id_camera);
            const [rows] = await connection.execute('SELECT * FROM Rezervari WHERE id_rezervare=? FOR UPDATE', [reservationId]);
            const reservation = rows[0];
            if (!reservation) throw new HttpError(404, 'Rezervarea nu există.');
            if (userId && Number(reservation.id_utilizator) !== Number(userId)) throw new HttpError(403, 'Acces neautorizat.');
            if (cancellation) {
                if (reservation.status_rezervare === 'anulata') throw new HttpError(400, 'Rezervarea este deja anulată.');
                if (new Date(reservation.data_checkin).getTime() - Date.now() <= 86400000) throw new HttpError(400, 'Anularea necesită cel puțin 24h înainte de check-in.');
            }
            if (status !== 'anulata' && reservation.status_rezervare === 'anulata') {
                const toDate = value => value instanceof Date ? value.toLocaleDateString('en-CA') : String(value).slice(0,10);
                await checkFree(connection, { roomId: reservation.id_camera, checkin: toDate(reservation.data_checkin), checkout: toDate(reservation.data_checkout) }, currentRoom, reservationId);
            }
            await connection.execute('UPDATE Rezervari SET status_rezervare=? WHERE id_rezervare=?', [status, reservationId]);
            return reservation;
        });
    }
    return { quote, book, changeStatus };
}
module.exports = { createBookingService, bookingInput };
