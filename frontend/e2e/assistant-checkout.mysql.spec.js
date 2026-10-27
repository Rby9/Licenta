import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);

async function setup(page) {
  const mysql = require('../../backend/node_modules/mysql2');
  const { database } = require('../../backend/src/config/database');
  const { initialize } = require('../../backend/database/init');
  const { createApp } = require('../../backend/src/app');
  const bcrypt = require('../../backend/node_modules/bcryptjs');
  const name = `hoteluriro_test_assistant_${crypto.randomBytes(7).toString('hex')}`;
  const config = { ...database(), database: name };
  const root = await mysql.createConnection({ ...config, database: undefined }).promise();
  let pool, server;
  const sessions = new Map(), refunds = new Set(), failures = [];
  let providerFails = false;
  page.on('pageerror', error => failures.push(error.message));
  const dispose = async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.promise().end();
    if (/^hoteluriro_test_assistant_[a-f0-9]+$/.test(name)) await root.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await root.end();
  };
  try {
    await initialize({ config, demo: true });
    pool = mysql.createPool(config);
    const sql = pool.promise();
    await sql.execute("INSERT INTO Utilizatori(id_utilizator,nume_complet,email,parola,rol) VALUES(1,'Client Test','client@example.invalid',?,'client')", [await bcrypt.hash('Browser-test-123', 4)]);
    await sql.execute('UPDATE Categorii_Camere SET pret_pe_noapte=199.99 WHERE id_categorie=1');
    const stripe = {
      checkout: { sessions: {
        create: async (data, options) => {
          if (!sessions.has(options.idempotencyKey)) {
            const id = `cs_test_group_${data.metadata.group_id}`;
            sessions.set(options.idempotencyKey, { id, status: 'open', payment_status: 'unpaid', amount_total: data.line_items[0].price_data.unit_amount, currency: 'ron', metadata: data.metadata,
              payment_intent: `pi_${id}`, successUrl: data.success_url.replace('{CHECKOUT_SESSION_ID}', id), url: `http://127.0.0.1:${server.address().port}/test-stripe/${id}` });
          }
          return sessions.get(options.idempotencyKey);
        },
        retrieve: async id => [...sessions.values()].find(session => session.id === id),
      } },
      paymentIntents: { retrieve: async id => { const session = [...sessions.values()].find(item => item.payment_intent === id); return { status: 'succeeded', currency: 'ron', amount_received: session.amount_total, latest_charge: { refunded: refunds.has(id), amount_refunded: refunds.has(id) ? session.amount_total : 0 } }; } },
      refunds: { create: async data => { refunds.add(data.payment_intent); return { id: 're_synthetic' }; } },
    };
    const app = createApp({ db: pool, stripe, config: { jwtSecret: crypto.randomBytes(32).toString('hex'), siteUrl: 'http://localhost:5173', groqApiKey: 'synthetic-key', emailFrom: 'test@example.invalid' }, transport: { sendMail: async () => {} },
      assistantFetch: async () => {
        if (providerFails) return { ok: false, status: 429 };
        return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ intent: 'search', hotel: null, city: 'Brașov', checkin: '2090-11-10', checkout: '2090-11-13', adults: 3, children: [], budget: 2000, budget_unit: 'stay', room_preference: 'separate', clarification: null }) } }] }) };
      },
    });
    app.get('/test-stripe/:session', (req, res) => res.type('html').send('<!doctype html><html lang="ro"><title>Stripe simulat local</title><h1>Plată simulată pentru test</h1><p>Nu sunt folosite carduri sau fonduri reale.</p><form method="post"><button>Autorizează plata simulată</button></form></html>'));
    app.post('/test-stripe/:session', (req, res) => {
      const session = [...sessions.values()].find(item => item.id === req.params.session);
      session.payment_status = 'paid'; session.status = 'complete'; res.redirect(session.successUrl);
    });
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const api = `http://127.0.0.1:${server.address().port}`;
    await page.route(/\/(api|uploads)\//, async route => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: `${api}${url.pathname}${url.search}` });
      await route.fulfill({ response });
    });
    await page.route(/https:\/\/(fonts\.|tile\.openstreetmap|images\.unsplash)/, route => route.abort());
    return { sql, sessions, refunds, failures, dispose, setProviderFailure: () => { providerFails = true; } };
  } catch (error) { await dispose(); throw error; }
}
async function login(page) {
  await page.getByLabel('Email', { exact: true }).fill('client@example.invalid');
  await page.getByLabel('Parolă', { exact: true }).fill('Browser-test-123');
  await page.getByRole('button', { name: 'Intră în cont', exact: true }).click();
}
async function selectGroup(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Asistent hoteluri', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Mesajul tău').fill('Brașov, 3 adulți, fără copii, camere separate, 10–13 noiembrie 2090, 2000 RON pe sejur');
  await panel.getByRole('button', { name: 'Trimite mesajul' }).click();
  await panel.getByRole('button', { name: 'Caută repartizări pentru grup' }).click();
  await expect(panel.getByRole('region', { name: 'Repartizări pentru grup' })).toContainText('2 camere · 3 adulți');
  await panel.getByRole('link', { name: 'Verifică oferta și aprobă rezervarea' }).first().click();
  await expect(page).toHaveURL(/\/autentificare/); await login(page);
  await expect(page.getByRole('region', { name: 'Oferta de rezervare' })).toContainText('1.199,94 RON');
}

test('Chrome + MySQL real: asistent, autentificare, aprobare cash, profil, PDF și anulare totală', async ({ page }, testInfo) => {
  test.skip(process.env.TEST_MYSQL !== '1', 'Necesită baza MySQL temporară.'); test.setTimeout(90000);
  const app = await setup(page);
  try {
    await selectGroup(page);
    const [[before]] = await app.sql.execute('SELECT COUNT(*) AS n FROM Rezervari'); expect(before.n).toBe(0);
    await page.getByLabel('Metoda de plată').selectOption('cash_cazare');
    await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Confirmă rezervarea cu plata la cazare' }).click();
    await expect(page.getByRole('heading', { name: 'Toate camerele sunt confirmate' })).toBeVisible();
    const [[result]] = await app.sql.execute('SELECT COUNT(*) AS n,SUM(pret_total) AS total FROM Rezervari'); expect(result.n).toBe(2); expect(Number(result.total)).toBe(1199.94);
    const groupUrl = page.url();
    await page.reload(); await expect(page.getByRole('heading', { name: 'Toate camerele sunt confirmate' })).toBeVisible();
    await page.goto('/rezervarile-mele');
    await expect(page.getByRole('link', { name: 'Gestionează întregul grup' })).toHaveCount(2);
    await expect(page.getByText('599,97 RON', { exact: false })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Anulează', exact: true })).toHaveCount(0);
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Factură PDF', exact: false }).first().click();
    const pdf = await download; expect((await readFile(await pdf.path())).subarray(0, 5).toString()).toBe('%PDF-');
    await pdf.saveAs(testInfo.outputPath('invoice-group-room.pdf'));
    await page.goto(groupUrl); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Confirmă anularea întregului grup' }).click();
    await expect(page.getByRole('heading', { name: 'Rezervare de grup anulată' })).toBeVisible();
    const [[cancelled]] = await app.sql.execute("SELECT COUNT(*) AS n FROM Rezervari WHERE status_rezervare='anulata'"); expect(cancelled.n).toBe(2);
    await page.screenshot({ path: testInfo.outputPath('group-cancelled-real-api.png'), fullPage: true });
    expect(app.failures).toEqual([]);
  } finally { await app.dispose(); }
});

for (const method of ['online_total', 'avans_online']) test(`Chrome + MySQL real: ${method}, aprobare, reluare și autorizare Stripe simulată`, async ({ page }, testInfo) => {
  test.skip(process.env.TEST_MYSQL !== '1', 'Necesită baza MySQL temporară.'); test.setTimeout(90000);
  const app = await setup(page);
  try {
    await selectGroup(page); await page.getByLabel('Metoda de plată').selectOption(method);
    await expect(page.getByRole('region')).toContainText(method === 'avans_online' ? '839,96 RON' : '1.199,94 RON');
    await page.getByRole('checkbox').check(); await page.getByRole('button', { name: method === 'avans_online' ? 'Aprobă și continuă la plata de 359,98 RON' : 'Aprobă și continuă la plata de 1.199,94 RON' }).click();
    await expect(page.getByRole('heading', { name: 'Plată simulată pentru test' })).toBeVisible();
    const [[before]] = await app.sql.execute('SELECT COUNT(*) AS n FROM Rezervari'); expect(before.n).toBe(0);
    const groupId = [...app.sessions.values()][0].metadata.group_id;
    await page.goto(`/rezervare/grup?group_id=${groupId}`);
    await expect(page.getByRole('heading', { name: 'În așteptarea plății — camerele nu sunt confirmate' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuă plata ofertei aprobate' }).click();
    await expect(page.getByRole('heading', { name: 'Plată simulată pentru test' })).toBeVisible();
    expect(app.sessions.size).toBe(1);
    await app.sql.execute('UPDATE Categorii_Camere SET pret_pe_noapte=500 WHERE id_categorie=1');
    await page.getByRole('button', { name: 'Autorizează plata simulată' }).click();
    await expect(page.getByRole('heading', { name: 'Toate camerele sunt confirmate' })).toBeVisible();
    await expect(page.getByText(method === 'avans_online' ? 'Starea plății: avans plătit' : 'Starea plății: plătită integral')).toBeVisible();
    await expect(page.getByText('Achitat online', { exact: true })).toBeVisible();
    const [[paid]] = await app.sql.execute('SELECT COUNT(*) AS n,SUM(suma_avans) AS advance FROM Rezervari'); expect(paid.n).toBe(2); expect(Number(paid.advance)).toBe(method === 'avans_online' ? 359.98 : 0);
    await page.reload(); await expect(page.getByRole('heading', { name: 'Toate camerele sunt confirmate' })).toBeVisible();
    const [[after]] = await app.sql.execute('SELECT COUNT(*) AS n FROM Rezervari'); expect(after.n).toBe(2); expect(app.refunds.size).toBe(0); expect(app.failures).toEqual([]);
    await page.goto('/rezervarile-mele');
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Factură PDF', exact: false }).first().click();
    await (await download).saveAs(testInfo.outputPath('invoice-approved-price.pdf'));
    await page.getByRole('link', { name: 'Gestionează întregul grup' }).first().click();
    await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Confirmă anularea întregului grup' }).click();
    await expect(page.getByText('Anularea nu rambursează automat plata. Pentru verificarea rambursării, contactează administratorul.')).toBeVisible();
    expect(app.refunds.size).toBe(0);
  } finally { await app.dispose(); }
});

test('Chrome + MySQL real: conflict după plata simulată, fără confirmare parțială, refund integral', async ({ page }) => {
  test.skip(process.env.TEST_MYSQL !== '1', 'Necesită baza MySQL temporară.'); test.setTimeout(90000);
  const app = await setup(page);
  try {
    await selectGroup(page); await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Aprobă și continuă la plata de 1.199,94 RON' }).click();
    await expect(page.getByRole('heading', { name: 'Plată simulată pentru test' })).toBeVisible();
    await app.sql.execute("INSERT INTO Rezervari(id_utilizator,id_camera,data_checkin,data_checkout,pret_total,status_rezervare) VALUES(1,1,'2090-11-10','2090-11-13',599.97,'confirmata')");
    await page.getByRole('button', { name: 'Autorizează plata simulată' }).click();
    await expect(page.getByRole('alert')).toContainText('Rambursarea întregii plăți a fost inițiată');
    const [[row]] = await app.sql.execute('SELECT COUNT(*) AS n FROM Rezervari WHERE id_linie_grup IS NOT NULL'); expect(row.n).toBe(0); expect(app.refunds.size).toBe(1);
    expect(app.failures).toEqual([]);
  } finally { await app.dispose(); }
});

test('Chrome + MySQL real: catalog bilingv fără criterii și eroarea AI păstrează conversația', async ({ page }) => {
  test.skip(process.env.TEST_MYSQL !== '1', 'Necesită baza MySQL temporară.'); test.setTimeout(60000);
  const app = await setup(page);
  try {
    await page.goto('/'); await page.getByRole('button', { name: 'Asistent hoteluri', exact: true }).click();
    const panel = page.getByRole('dialog'); await panel.getByLabel('Mesajul tău').fill('Which cities are available?');
    await panel.getByRole('button', { name: 'Trimite mesajul' }).click();
    await expect(panel.locator('.assistant-message-assistant').last()).toContainText('Cities with hotels in the catalog');
    await expect(panel).toHaveAttribute('lang', 'en');
    await panel.getByRole('button', { name: /Brașov.*1 hotel/ }).click();
    await panel.getByRole('button', { name: 'Details about Hotel Demo' }).click();
    await expect(panel.locator('.assistant-message-assistant').last()).toContainText('Wi-Fi');
    app.setProviderFailure(); await panel.getByLabel('Your message').fill('I want a room for next week');
    await panel.getByRole('button', { name: 'Send message' }).click();
    await expect(panel.getByRole('alert')).toBeVisible(); await expect(panel.getByLabel('Your message')).toHaveValue('I want a room for next week');
    expect(app.failures).toEqual([]);
  } finally { await app.dispose(); }
});
