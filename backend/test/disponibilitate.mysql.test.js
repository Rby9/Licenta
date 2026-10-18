const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHoteluriRouter } = require('../src/modules/hoteluri/routes');

// Date sintetice în CTE-uri: nicio tabelă și nicio rezervare existentă nu se modifică.
// Activare: TEST_MYSQL=1 npm test --prefix backend
const enabled = process.env.TEST_MYSQL === '1';
let db;
before(() => {
    if (!enabled) return;
    require('../src/config/env');
    db = require('mysql2').createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'licenta_booking',
    }).promise();
});
after(async () => { if (db) await db.end(); });

async function availability(bookings) {
    let statement;
    const router = createHoteluriRouter({ query: (sql, params) => { statement = { sql, params }; } });
    const layer = router.stack.find(item => item.route?.path === '/api/hoteluri/:id/disponibilitate');
    layer.route.stack[0].handle({ params: { id: '1' }, query: {
        checkin: '2026-11-10', checkout: '2026-11-15',
    } }, {});
    const bookingRows = bookings.length ? bookings : [[null, null, null, null]];
    const reservationSQL = bookingRows.map(() => 'SELECT ? AS id_camera, ? AS status_rezervare, CAST(? AS DATE) AS data_checkin, CAST(? AS DATE) AS data_checkout').join(' UNION ALL ');
    const fixtures = `WITH
        Camere AS (
            SELECT 1 AS id_camera, 1 AS id_categorie, 'activa' AS status_camera
            UNION ALL SELECT 2, 1, 'activa'
            UNION ALL SELECT 3, 1, 'inactiva'
        ),
        Categorii_Camere AS (
            SELECT 1 AS id_categorie, 1 AS id_hotel, 'Dublă' AS denumire,
                   2 AS capacitate, 200 AS pret_pe_noapte, '' AS descriere
        ),
        Rezervari AS (${reservationSQL})`;
    try {
        const [rows] = await db.query(fixtures + statement.sql, [...bookingRows.flat(), ...statement.params]);
        assert.equal(rows[0].total_camere, 2);
        return rows[0].camere_libere;
    } catch (error) {
        // Nu include SQL, configurație sau date private în erorile testelor.
        throw new Error(`Verificarea SELECT MySQL a eșuat: ${error.code || 'eroare'}`);
    }
}

const cases = [
    ['fără rezervări', [], 2],
    ['checkout existent egal cu checkin cerut', [[1, 'confirmata', '2026-11-08', '2026-11-10']], 2],
    ['checkin existent egal cu checkout cerut', [[1, 'confirmata', '2026-11-15', '2026-11-18']], 2],
    ['rezervare inclusă în interval', [[1, 'confirmata', '2026-11-11', '2026-11-13']], 1],
    ['rezervare care acoperă intervalul', [[1, 'confirmata', '2026-11-01', '2026-11-20']], 1],
    ['rezervare anulată ignorată', [[1, 'anulata', '2026-11-11', '2026-11-13']], 2],
    ['caracterizare defect: două sejururi pe aceeași cameră scad de două ori (corect: 1)', [
        [1, 'confirmata', '2026-11-10', '2026-11-12'],
        [1, 'confirmata', '2026-11-13', '2026-11-15'],
    ], 0],
    ['caracterizare defect: rezervarea unei camere inactive scade din totalul activ (corect: 2)', [
        [3, 'confirmata', '2026-11-10', '2026-11-15'],
    ], 1],
];
for (const [name, bookings, expected] of cases) {
    test(`MySQL disponibilitate: ${name}`, { skip: !enabled }, async () => {
        assert.equal(await availability(bookings), expected);
    });
}
