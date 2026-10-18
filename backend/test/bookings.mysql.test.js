const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { initialize } = require('../database/init');
const crypto = require('node:crypto');
const { createBookingService } = require('../src/services/bookings');

const enabled = process.env.TEST_MYSQL === '1';
let pool, root, bookings;
let created = false;
const databaseName = `hoteluriro_test_${crypto.randomBytes(8).toString('hex')}`;
const input = { id_camera: 1, data_checkin: '2090-11-10', data_checkout: '2090-11-12', guests: 2, pret_total: 0.01 };
before(async () => {
    if (!enabled) return;
    const { database } = require('../src/config/database');
    const mysql = require('mysql2/promise');
    const config = database();
    delete config.database;
    root = await mysql.createConnection(config);
    assert.match(databaseName, /^hoteluriro_test_[a-f0-9]+$/);
    await root.query(`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4`);
    created = true;
    pool = mysql.createPool({ ...config, database: databaseName, dateStrings: true, connectionLimit: 6 });
    await initialize({ config: { ...config, database: databaseName }, demo: true });
    await pool.execute("INSERT INTO Utilizatori (id_utilizator,nume_complet,email,parola) VALUES (1,'Test','test@example.invalid','hash-fictiv')");
    await pool.execute("INSERT INTO Coduri_Reducere (id_cod,cod,procent_reducere,utilizari_maxime) VALUES (1,'TEST10',10,1),(2,'TEST20',20,5)");
    await pool.execute('UPDATE Categorii_Camere SET pret_pe_noapte=199.99 WHERE id_categorie=1');
    await pool.execute("INSERT INTO Camere (id_camera,id_categorie,numar_camera,status_camera) VALUES (3,1,'103','inactiva')");
    bookings = createBookingService(pool);
});
after(async () => {
    if (pool) await pool.end();
    if (root) {
        if (created && /^hoteluriro_test_[a-f0-9]+$/.test(databaseName)) await root.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
        await root.end();
    }
});
const check = (name, callback) => test(`MySQL tranzacții: ${name}`, { skip: !enabled }, callback);
check('tariful este calculat din DB, ignorând suma trimisă de client', async () => {
    const quote = await bookings.quote(input);
    assert.equal(quote.totalCents, 39998);
    const result = await bookings.book(1, input);
    assert.equal(result.pret_total, 399.98);
    await pool.execute('DELETE FROM Rezervari');
});
check('două cereri concurente pe aceeași cameră produc o singură rezervare', async () => {
    const results = await Promise.allSettled([bookings.book(1, input), bookings.book(1, input)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
    const [[row]] = await pool.execute('SELECT COUNT(*) AS n FROM Rezervari');
    assert.equal(row.n, 1);
    await pool.execute('DELETE FROM Rezervari');
});
check('aceeași sesiune Stripe confirmată concurent nu este inserată de două ori', async () => {
    const payment = { sessionId: 'cs_test_duplicate', method: 'online_total', price: { totalCents: 39998, advanceCents: 11999 } };
    const results = await Promise.all([bookings.book(1, input, payment), bookings.book(1, input, payment)]);
    assert.equal(results[0].id_rezervare, results[1].id_rezervare);
    assert.equal(results.filter(r => r.duplicate).length, 1);
    await pool.execute('DELETE FROM Rezervari');
});
check('limita codului de reducere este respectată pentru două camere concurente', async () => {
    const results = await Promise.allSettled([
        bookings.book(1, { ...input, id_cod: 1 }), bookings.book(1, { ...input, id_camera: 2, id_cod: 1 }),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
    const [[code]] = await pool.execute('SELECT utilizari_curente FROM Coduri_Reducere WHERE id_cod=1');
    assert.equal(code.utilizari_curente, 1);
    await pool.execute('DELETE FROM Rezervari');
});
check('reducerea și avansul sunt calculate la cent', async () => {
    const quote = await bookings.quote({ ...input, id_cod: 2 });
    assert.equal(quote.totalCents, 31998);
    assert.equal(quote.advanceCents, 9599);
});
check('reactivarea unei rezervări anulate nu poate suprapune altă rezervare', async () => {
    const first = await bookings.book(1, input);
    await bookings.changeStatus(first.id_rezervare, 'anulata');
    await bookings.book(1, input);
    await assert.rejects(bookings.changeStatus(first.id_rezervare, 'confirmata'), e => e.status === 409);
    await pool.execute('DELETE FROM Rezervari');
});
check('checkout-ul permite alt checkin în aceeași zi', async () => {
    await bookings.book(1, input);
    await bookings.book(1, { ...input, data_checkin: '2090-11-12', data_checkout: '2090-11-14' });
    await pool.execute('DELETE FROM Rezervari');
});
check('camerele inactive, capacitatea și perioada sunt validate fără inserare', async () => {
    for (const invalid of [{ id_camera: 3 }, { guests: 3 }, { data_checkin: '2090-02-30' }, { data_checkout: input.data_checkin }]) {
        await assert.rejects(bookings.book(1, { ...input, ...invalid }), e => [400,409].includes(e.status));
    }
    const [[row]] = await pool.execute('SELECT COUNT(*) AS n FROM Rezervari');
    assert.equal(row.n, 0);
});
check('plata online nu poate fi declarată prin ruta cash', async () => {
    await assert.rejects(bookings.book(1, { ...input, metoda_plata: 'online_total' }), e => e.status === 400);
});

check('idempotenta functioneaza si fara indexul unic din schema noua', async () => {
    await pool.query('ALTER TABLE Rezervari DROP INDEX uq_rezervari_stripe_session');
    try {
        const payment = { sessionId: 'cs_test_no_index', method: 'online_total', price: { totalCents: 39998, advanceCents: 11999 } };
        const results = await Promise.all([bookings.book(1, input, payment), bookings.book(1, input, payment)]);
        assert.equal(results[0].id_rezervare, results[1].id_rezervare);
        assert.equal(results.filter(r => r.duplicate).length, 1);
    } finally {
        await pool.execute('DELETE FROM Rezervari');
        await pool.query('ALTER TABLE Rezervari ADD UNIQUE KEY uq_rezervari_stripe_session (stripe_session_id)');
    }
});
check('o inserare eșuată revine și asupra consumului codului de reducere', async () => {
    const [[before]] = await pool.execute('SELECT utilizari_curente FROM Coduri_Reducere WHERE id_cod=2');
    await assert.rejects(bookings.book(999, { ...input, id_cod: 2 }), e => e.code === 'ER_NO_REFERENCED_ROW_2');
    const [[after]] = await pool.execute('SELECT utilizari_curente FROM Coduri_Reducere WHERE id_cod=2');
    assert.equal(before.utilizari_curente, after.utilizari_curente);
    const [[row]] = await pool.execute('SELECT COUNT(*) AS n FROM Rezervari');
    assert.equal(row.n, 0);
});
check('un utilizator nu poate anula rezervarea altuia', async () => {
    const result = await bookings.book(1, input);
    await assert.rejects(bookings.changeStatus(result.id_rezervare, 'anulata', { userId: 2, cancellation: true }), e => e.status === 403);
    const [[row]] = await pool.execute('SELECT status_rezervare FROM Rezervari WHERE id_rezervare=?', [result.id_rezervare]);
    assert.equal(row.status_rezervare, 'confirmata');
    await pool.execute('DELETE FROM Rezervari');
});
