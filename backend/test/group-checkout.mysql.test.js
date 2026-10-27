const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { initialize } = require('../database/init');
const { createGroupCheckout } = require('../src/services/group-checkout');
const { createBookingService } = require('../src/services/bookings');
const enabled = process.env.TEST_MYSQL === '1';
const name = `hoteluriro_test_group_${crypto.randomBytes(7).toString('hex')}`;
let root, pool, config, service, provider, sessions, refunds;
const input = { hotelId: 1, checkin: '2090-11-10', checkout: '2090-11-13', rooms: [{ categoryId: 1, adults: 2 }, { categoryId: 1, adults: 1 }], method: 'cash_cazare' };
before(async () => {
    if (!enabled) return;
    const mysql = require('mysql2/promise');
    config = require('../src/config/database').database();
    delete config.database;
    root = await mysql.createConnection(config);
    assert.match(name, /^hoteluriro_test_group_[a-f0-9]+$/);
    await initialize({ config: { ...config, database: name }, demo: true });
    pool = mysql.createPool({ ...config, database: name, dateStrings: true, connectionLimit: 8 });
    await pool.execute("INSERT INTO Utilizatori (id_utilizator,nume_complet,email,parola) VALUES (1,'Test','test@example.invalid','fake'),(2,'Test doi','test2@example.invalid','fake')");
});
after(async () => {
    if (pool) await pool.end();
    if (root) { await root.query(`DROP DATABASE IF EXISTS \`${name}\``); await root.end(); }
});
beforeEach(async () => {
    if (!enabled) return;
    await pool.execute('DELETE FROM Rezervari');
    await pool.execute('DELETE FROM Rezervari_Grup_Camere');
    await pool.execute('DELETE FROM Rezervari_Grup');
    await pool.execute('UPDATE Categorii_Camere SET pret_pe_noapte=199.99 WHERE id_categorie=1');
    sessions = new Map(); refunds = [];
    provider = {
        checkout: { sessions: {
            create: async (body, options) => {
                const key = options.idempotencyKey;
                if (!sessions.has(key)) sessions.set(key, { id: `cs_test_group_${body.metadata.group_id}`, payment_status: 'unpaid', status: 'open', currency: 'ron', amount_total: body.line_items[0].price_data.unit_amount,
                    payment_intent: `pi_test_${body.metadata.group_id}`, metadata: body.metadata, url: 'https://checkout.example.invalid', body });
                return sessions.get(key);
            },
            retrieve: async id => [...sessions.values()].find(session => session.id === id),
        } },
        paymentIntents: { retrieve: async id => { const session = [...sessions.values()].find(item => item.payment_intent === id); return { status: 'succeeded', currency: 'ron', amount_received: session.amount_total, latest_charge: { refunded: refunds.some(value => value.id === id), amount_refunded: 0 } }; } },
        refunds: { create: async (body, options) => { refunds.push({ id: body.payment_intent, key: options.idempotencyKey }); return { id: 're_test' }; } },
    };
    service = createGroupCheckout({ db: { promise: () => pool }, config: { jwtSecret: 'synthetic-group-test-secret', siteUrl: 'http://localhost:5173' }, stripe: provider });
});
const check = (title, callback) => test(`MySQL grup: ${title}`, { skip: !enabled }, callback);
const approve = async (owner = 1, patch = {}) => { const quote = await service.preview(owner, { ...input, ...patch }); return service.approve(owner, { quoteToken: quote.quoteToken, approved: true }); };
check('afișarea ofertei nu creează nicio comandă, iar prețul clientului este ignorat', async () => {
    const quote = await service.preview(1, { ...input, totalCents: 1 });
    assert.equal(quote.totalCents, 119994);
    assert.equal(quote.dueNowCents, 0);
    assert.ok(quote.rooms.every(room => room.roomId === undefined));
    const [[row]] = await pool.execute('SELECT COUNT(*) AS n FROM Rezervari_Grup');
    assert.equal(row.n, 0);
    await assert.rejects(service.approve(1, { quoteToken: quote.quoteToken }), error => error.status === 400);
    await assert.rejects(service.approve(2, { quoteToken: quote.quoteToken, approved: true }), error => error.status === 403);
    await assert.rejects(service.approve(1, { quoteToken: `${quote.quoteToken}x`, approved: true }), error => error.status === 409);
});
check('camera din alt hotel, capacitatea și intervalele invalide nu sunt acceptate', async () => {
    for (const patch of [{ hotelId: 2 }, { rooms: [{ categoryId: 1, adults: 3 }] }, { checkin: '2090-02-30' }, { checkin: '2000-01-01' }, { method: 'anything' }]) await assert.rejects(service.preview(1, { ...input, ...patch }));
});
check('prețul schimbat invalidează aprobarea fără a crea o comandă', async () => {
    const quote = await service.preview(1, input);
    await pool.execute('UPDATE Categorii_Camere SET pret_pe_noapte=200 WHERE id_categorie=1');
    await assert.rejects(service.approve(1, { quoteToken: quote.quoteToken, approved: true }), error => error.status === 409);
    const [[row]] = await pool.execute('SELECT COUNT(*) AS n FROM Rezervari_Grup'); assert.equal(row.n, 0);
});
check('aprobarea cash repetată simultan creează un singur grup și exact două rezervări', async () => {
    const quote = await service.preview(1, input);
    const request = { quoteToken: quote.quoteToken, approved: true };
    const [a, b] = await Promise.all([service.approve(1, request), service.approve(1, request)]);
    assert.equal(a.group.id_grup, b.group.id_grup);
    assert.equal(a.group.status, 'confirmata');
    assert.equal(a.group.reservations.length, 2);
    assert.equal(a.group.totalCents, 119994);
    const [[totals]] = await pool.execute('SELECT COUNT(*) AS n,SUM(pret_total) AS total,SUM(comision_platforma) AS commission FROM Rezervari');
    assert.equal(totals.n, 2); assert.equal(Number(totals.total), 1199.94); assert.equal(Number(totals.commission), 119.99);
    await assert.rejects(service.view(a.group.id_grup, 2), error => error.status === 403);
    assert.equal((await service.list(1)).length, 1);
    assert.equal((await service.list(2)).length, 0);
});
check('două grupuri concurente nu pot ocupa aceleași camere', async () => {
    const [one, two] = await Promise.all([service.preview(1, input), service.preview(2, input)]);
    const results = await Promise.allSettled([service.approve(1, { quoteToken: one.quoteToken, approved: true }), service.approve(2, { quoteToken: two.quoteToken, approved: true })]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const [[row]] = await pool.execute('SELECT COUNT(*) AS n FROM Rezervari'); assert.equal(row.n, 2);
});
check('o rezervare individuală ocupată între ofertă și aprobare nu lasă un grup parțial', async () => {
    const quote = await service.preview(1, input);
    await createBookingService({ promise: () => pool }).book(2, { id_camera: 1, data_checkin: input.checkin, data_checkout: input.checkout, guests: 1 });
    await assert.rejects(service.approve(1, { quoteToken: quote.quoteToken, approved: true }), error => error.status === 409);
    const [[row]] = await pool.execute('SELECT COUNT(*) AS n FROM Rezervari_Grup'); assert.equal(row.n, 0);
});
check('online creează o singură sesiune idempotentă și confirmă toate camerele după plată', async () => {
    const quote = await service.preview(1, { ...input, method: 'avans_online' });
    assert.equal(quote.dueNowCents, 35998); assert.equal(quote.remainingCents, 83996);
    const request = { quoteToken: quote.quoteToken, approved: true };
    const [first, second] = await Promise.all([service.approve(1, request), service.approve(1, request)]);
    assert.equal(first.id_grup, second.id_grup); assert.equal(sessions.size, 1);
    const session = [...sessions.values()][0];
    assert.equal(session.amount_total, 35998);
    const [[before]] = await pool.execute('SELECT COUNT(*) AS n FROM Rezervari'); assert.equal(before.n, 0);
    await assert.rejects(service.confirm(session, 1), error => error.status === 409);
    session.payment_status = 'paid';
    const confirmed = await Promise.all([service.confirm(session, 1), service.confirm(session, 1)]);
    assert.equal(confirmed.filter(value => !value.duplicate).length, 1);
    assert.equal(confirmed[0].status, 'confirmata');
    assert.equal(confirmed[0].paymentStatus, 'avans_platit');
    const [[totals]] = await pool.execute('SELECT COUNT(*) AS n,SUM(suma_avans) AS advance FROM Rezervari'); assert.equal(totals.n, 2); assert.equal(Number(totals.advance), 359.98);
    assert.equal(refunds.length, 0);
});
check('conflict după plată: rambursare integrală fără rezervări parțiale', async () => {
    await approve(1, { method: 'online_total' });
    const session = [...sessions.values()][0];
    await createBookingService({ promise: () => pool }).book(2, { id_camera: 1, data_checkin: input.checkin, data_checkout: input.checkout, guests: 1 });
    session.payment_status = 'paid';
    await assert.rejects(service.confirm(session, 1), error => error.paymentRefunded === true);
    assert.equal(refunds.length, 1);
    const [[row]] = await pool.execute('SELECT COUNT(*) AS n FROM Rezervari WHERE id_utilizator=1'); assert.equal(row.n, 0);
    const data = await service.view(Number(session.metadata.group_id), 1); assert.equal(data.paymentStatus, 'rambursata');
});
check('anularea este totală, fără rambursare automată și fără anulare individuală a unei camere', async () => {
    const { group } = await approve();
    const [[line]] = await pool.execute('SELECT id_linie_grup FROM Rezervari WHERE id_rezervare=?', [group.reservations[0].id_rezervare]);
    assert.equal((await service.byLine(line.id_linie_grup, 1)).id_grup, group.id_grup);
    await assert.rejects(createBookingService({ promise: () => pool }).changeStatus(group.reservations[0].id_rezervare, 'anulata'), error => error.status === 409);
    await assert.rejects(service.cancel(group.id_grup, 2), error => error.status === 403);
    assert.equal((await service.cancel(group.id_grup, 1)).status, 'anulata');
    const [[row]] = await pool.execute("SELECT COUNT(*) AS n FROM Rezervari WHERE status_rezervare='anulata'"); assert.equal(row.n, 2);
    assert.equal(refunds.length, 0);
});
check('migrarea pe schema veche păstrează rezervările individuale existente', async () => {
    const migrationDb = `${name}_m`;
    assert.match(migrationDb, /^hoteluriro_test_group_[a-f0-9]+_m$/);
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({ ...config, multipleStatements: true });
    try {
        await conn.query(`CREATE DATABASE \`${migrationDb}\``); await conn.changeUser({ database: migrationDb });
        const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8').split('-- Checkout de grup cu aprobare explicită.')[0];
        await conn.query(schema); await conn.query(fs.readFileSync(path.join(__dirname, '../database/demo.sql'), 'utf8'));
        await conn.execute("INSERT INTO Utilizatori(id_utilizator,nume_complet,email,parola) VALUES(1,'Legacy','legacy@example.invalid','fake')");
        await conn.execute("INSERT INTO Rezervari(id_utilizator,id_camera,data_checkin,data_checkout,pret_total) VALUES(1,1,'2090-11-01','2090-11-02',250)");
        const [[old]] = await conn.execute('SELECT * FROM Rezervari');
        await conn.query(fs.readFileSync(path.join(__dirname, '../database/migrations/001_group_checkout_approval.sql'), 'utf8'));
        const [[{ id_linie_grup, ...preserved }]] = await conn.execute('SELECT * FROM Rezervari');
        assert.equal(id_linie_grup, null); assert.deepEqual(preserved, old);
    } finally { await conn.query(`DROP DATABASE IF EXISTS \`${migrationDb}\``); await conn.end(); }
});

check('tokenul expirat sau destinat altui scop nu poate aproba o comandă', async () => {
    const jwt = require('jsonwebtoken');
    const quote = await service.preview(1, input);
    const { iat, exp, aud, ...data } = jwt.decode(quote.quoteToken);
    assert.ok(iat && exp && aud);
    for (const options of [{ audience: aud, expiresIn: -1 }, { audience: 'other-purpose', expiresIn: '10m' }]) {
        const token = jwt.sign(data, 'synthetic-group-test-secret', options);
        await assert.rejects(service.approve(1, { quoteToken: token, approved: true }), error => error.status === 409);
    }
});
check('o eroare după prima inserare face rollback pentru întregul grup cash', async () => {
    await pool.query("CREATE TRIGGER test_fail_group BEFORE INSERT ON Rezervari FOR EACH ROW BEGIN IF NEW.id_camera=2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'; END IF; END");
    try {
        await assert.rejects(approve());
        for (const table of ['Rezervari', 'Rezervari_Grup', 'Rezervari_Grup_Camere']) { const [[row]] = await pool.query(`SELECT COUNT(*) AS n FROM ${table}`); assert.equal(row.n, 0); }
    } finally { await pool.query('DROP TRIGGER test_fail_group'); }
});
check('după aprobarea online se păstrează prețul aprobat, chiar dacă tariful catalogului crește', async () => {
    await approve(1, { method: 'online_total' });
    const session = [...sessions.values()][0]; session.payment_status = 'paid';
    await pool.execute('UPDATE Categorii_Camere SET pret_pe_noapte=500 WHERE id_categorie=1');
    const result = await service.confirm(session, 1);
    assert.equal(result.totalCents, 119994);
});
check('suma, moneda, proprietarul și oferta Stripe sunt verificate înainte de confirmare', async () => {
    await approve(1, { method: 'online_total' });
    const original = [...sessions.values()][0]; original.payment_status = 'paid';
    await assert.rejects(service.confirm(original, 2), error => error.status === 403);
    for (const patch of [{ currency: 'eur' }, { amount_total: 1 }, { metadata: { ...original.metadata, oferta_hash: 'different' } }]) await assert.rejects(service.confirm({ ...original, ...patch }, 1));
    const [[row]] = await pool.execute('SELECT COUNT(*) AS n FROM Rezervari'); assert.equal(row.n, 0); assert.equal(refunds.length, 0);
});
check('plata aprobată se poate relua; o sesiune expirată nu rezervă camere', async () => {
    const result = await approve(1, { method: 'online_total' });
    assert.match((await service.resume(result.id_grup, 1)).url, /checkout/);
    const session = [...sessions.values()][0]; session.status = 'expired';
    assert.equal((await service.resume(result.id_grup, 1)).group.status, 'expirata');
    const [[row]] = await pool.execute('SELECT COUNT(*) AS n FROM Rezervari'); assert.equal(row.n, 0);
});

check('categoria redenumită sau capacitatea schimbată invalidează oferta înainte de aprobare', async () => {
    const [[original]] = await pool.execute('SELECT denumire,capacitate FROM Categorii_Camere WHERE id_categorie=1');
    try {
        const quote = await service.preview(1, input);
        await pool.execute("UPDATE Categorii_Camere SET denumire='Categorie schimbată' WHERE id_categorie=1");
        await assert.rejects(service.approve(1, { quoteToken: quote.quoteToken, approved: true }), error => error.status === 409);
    } finally { await pool.execute('UPDATE Categorii_Camere SET denumire=?,capacitate=? WHERE id_categorie=1', [original.denumire, original.capacitate]); }
});
