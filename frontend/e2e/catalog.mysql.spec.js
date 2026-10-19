import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

test('administrare completă în Chrome cu backend și MySQL izolat', async ({ page, request }) => {
  test.skip(process.env.TEST_MYSQL !== '1', 'Necesită TEST_MYSQL=1 și MySQL local.');
  const mysql = require('../../backend/node_modules/mysql2');
  const { database } = require('../../backend/src/config/database');
  const { initialize } = require('../../backend/database/init');
  const { createApp } = require('../../backend/src/app');
  const bcrypt = require('../../backend/node_modules/bcryptjs');
  const jwt = require('../../backend/node_modules/jsonwebtoken');
  const name = `hoteluriro_test_e2e_${crypto.randomBytes(8).toString('hex')}`;
  const config = { ...database(), database: name };
  const secret = crypto.randomBytes(32).toString('hex');
  let root, pool, server, created = false;
  const uploadsDir = await mkdtemp(path.join(os.tmpdir(), 'hoteluriro-e2e-uploads-'));
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  try {
    root = await mysql.createConnection({ ...config, database: undefined }).promise();
    await root.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
    created = true;
    await initialize({ config, demo: true });
    pool = mysql.createPool(config);
    const sql = pool.promise();
    // Only synthetic credentials, never an account from the application database.
    await sql.execute(`INSERT INTO Utilizatori (id_utilizator,nume_complet,email,parola,rol)
      VALUES (1,'Admin Demo','admin@example.invalid',?,'super_admin')`, [await bcrypt.hash('Browser-demo-123', 4)]);
    const app = createApp({ db: pool, stripe: null, uploadsDir,
      config: { jwtSecret: secret, siteUrl: 'http://localhost:5173', emailFrom: 'demo@example.invalid' },
      transport: { sendMail: async () => {} },
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const api = `http://127.0.0.1:${server.address().port}`;
    // Real application routes and SQL, redirected only inside this disposable browser context.
    await page.route(/\/(api|uploads)\//, async route => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: `${api}${url.pathname}${url.search}` });
      await route.fulfill({ response });
    });
    await page.route(/https:\/\/(fonts\.|tile\.openstreetmap|images\.unsplash)/, route => route.abort());
    await page.addInitScript(() => sessionStorage.setItem('returnTo', '/admin'));
    await page.goto('/autentificare');
    await page.getByLabel('Email', { exact: true }).fill('admin@example.invalid');
    await page.getByLabel('Parolă', { exact: true }).fill('Browser-demo-123');
    await page.getByRole('button', { name: 'Intră în cont', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Panou administrare' })).toBeVisible();
    await page.locator('.admin-tabs').getByRole('button', { name: 'Hoteluri', exact: true }).click();
    await page.getByRole('button', { name: '+ Adaugă hotel', exact: true }).click();
    await page.getByLabel('Oraș *', { exact: true }).selectOption('1');
    await page.getByLabel('Nume hotel *', { exact: true }).fill('Hotel Browser Demo');
    await page.getByLabel('Adresă', { exact: true }).fill('Adresă demonstrativă');
    await page.locator('.hotel-location-picker .leaflet-container').click({ position: { x: 130, y: 110 } });
    const latitude = await page.getByLabel('Latitudine', { exact: true }).inputValue();
    const longitude = await page.getByLabel('Longitudine', { exact: true }).inputValue();
    await page.getByRole('button', { name: 'Imagine mountain', exact: true }).click();
    await page.getByRole('button', { name: 'Adaugă hotel', exact: true }).click();
    await expect(page.getByText('Hotel adăugat!', { exact: false })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Caută hotel' }).fill('Browser Demo');
    await expect(page.getByText('1 din 2 hoteluri', { exact: true })).toBeVisible();

    // Regression: list data must preserve coordinates when the edit dialog opens.
    await page.getByRole('button', { name: 'Editează', exact: true }).click();
    await expect.poll(async () => Number(await page.getByLabel('Latitudine', { exact: true }).inputValue())).toBe(Number(latitude));
    await expect.poll(async () => Number(await page.getByLabel('Longitudine', { exact: true }).inputValue())).toBe(Number(longitude));
    await page.getByLabel('Adresă', { exact: true }).fill('Adresă actualizată');
    await page.getByRole('button', { name: 'Salvează modificările', exact: true }).click();
    await expect(page.getByText('Hotel actualizat!', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: '▼ Vezi', exact: true }).click();
    await page.getByRole('button', { name: '+ Adaugă categorie', exact: true }).click();
    await page.getByLabel('Denumire *', { exact: true }).fill('Dublă Browser');
    await page.getByPlaceholder('Ex: 350').fill('200');
    await page.getByLabel('Număr de camere rezervabile *', { exact: true }).fill('3');
    await page.getByRole('button', { name: 'Adaugă categorie', exact: true }).click();
    await expect(page.getByText('Dublă Browser', { exact: true })).toBeVisible();
    const [[hotel]] = await sql.execute('SELECT * FROM Hoteluri WHERE nume_hotel=?', ['Hotel Browser Demo']);
    const [[category]] = await sql.execute('SELECT * FROM Categorii_Camere WHERE id_hotel=?', [hotel.id_hotel]);
    const [rooms] = await sql.execute('SELECT * FROM Camere WHERE id_categorie=?', [category.id_categorie]);
    expect(rooms).toHaveLength(3);
    expect(hotel.adresa).toBe('Adresă actualizată');
    expect(hotel.imagine_url).toBe('demo:mountain');
    const mapResponse = await request.get(`${api}/api/hoteluri/harta`);
    expect((await mapResponse.json()).some(row => row.id_hotel === hotel.id_hotel)).toBe(true);
    await page.goto(`/hoteluri/${hotel.id_hotel}?checkin=2090-11-10&checkout=2090-11-12&guests=2`);
    await expect(page.getByRole('heading', { name: 'Hotel Browser Demo', exact: true })).toBeVisible();
    await expect(page.getByText('Dublă Browser', { exact: true })).toBeVisible();
    await expect.poll(() => page.locator('.room-demo-image').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    await page.goto(`/rezervare?hotel_id=${hotel.id_hotel}&categorie_id=${category.id_categorie}&checkin=2090-11-10&checkout=2090-11-12&guests=2`);
    await expect(page.getByText('Dublă Browser', { exact: true })).toBeVisible();

    // Exercise the real cover-upload form, stored outside the application's uploads directory.
    await page.goto('/admin');
    await page.locator('.admin-tabs').getByRole('button', { name: 'Hoteluri', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Caută hotel' }).fill('Browser Demo');
    await page.getByRole('button', { name: 'Editează', exact: true }).click();
    await page.getByRole('button', { name: 'Upload fișier', exact: true }).click();
    const coverBytes = await readFile(fileURLToPath(new URL('../src/assets/demo/hotel-modern.jpg', import.meta.url)));
    await page.locator('input[type=file]').first().setInputFiles({ name: 'hotel-demo.jpg', mimeType: 'image/jpeg', buffer: coverBytes });
    await page.getByRole('button', { name: 'Salvează modificările', exact: true }).click();
    await expect(page.getByText('Hotel actualizat!', { exact: false })).toBeVisible();
    const [[uploadedHotel]] = await sql.execute('SELECT imagine_url FROM Hoteluri WHERE id_hotel=?', [hotel.id_hotel]);
    expect(uploadedHotel.imagine_url).toMatch(/^\/uploads\/hotel_/);
    const uploadedResponse = await request.get(`${api}${uploadedHotel.imagine_url}`);
    expect(uploadedResponse.status()).toBe(200);
    expect((await uploadedResponse.body()).equals(coverBytes)).toBe(true);
    await page.goto(`/hoteluri/${hotel.id_hotel}`);
    const cover = page.getByRole('img', { name: 'Hotel Browser Demo', exact: true }).first();
    await expect(cover).toHaveAttribute('src', uploadedHotel.imagine_url);
    await expect.poll(() => cover.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);

    const booking = await request.post(`${api}/api/rezervari/cash`, {
      headers: { Authorization: `Bearer ${jwt.sign({ id: 1 }, secret)}` },
      data: { id_camera: rooms[0].id_camera, data_checkin: '2090-11-10', data_checkout: '2090-11-12', guests: 2 },
    });
    expect(booking.status()).toBe(201);
    await page.setViewportSize({ width: 390, height: 850 });
    await page.goto('/rezervarile-mele');
    await expect(page.getByText('Hotel Browser Demo', { exact: true })).toBeVisible();
    await expect(page.getByText('Dublă Browser', { exact: true })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Factură PDF', exact: false }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^Factura_HoteluriRo_\d+\.pdf$/);
    const pdf = await readFile(await download.path());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/admin');
    await page.locator('.admin-tabs').getByRole('button', { name: 'Hoteluri', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Caută hotel' }).fill('Browser Demo');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Șterge', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('există rezervări');
    const [[retained]] = await sql.execute('SELECT COUNT(*) AS n FROM Rezervari WHERE id_camera=?', [rooms[0].id_camera]);
    expect(retained.n).toBe(1);
    expect(failures).toEqual([]);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.promise().end();
    await rm(uploadsDir, { recursive: true, force: true });
    if (root) {
      if (created && /^hoteluriro_test_e2e_[a-f0-9]+$/.test(name)) await root.query(`DROP DATABASE \`${name}\``);
      await root.end();
    }
  }
});
