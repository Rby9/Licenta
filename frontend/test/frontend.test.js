import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, before, after } from 'node:test';
import { Linter } from 'eslint';
import { jsxBindings } from '../eslint-jsx.js';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

let vite, cacheDir;
before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'hoteluriro-unit-vite-'));
  vite = await createServer({
    cacheDir,
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
});
after(async () => { await vite?.close(); if (cacheDir) await rm(cacheDir, { recursive: true, force: true }); });
const load = path => vite.ssrLoadModule(`/src/${path}`);
const render = (Component, props) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Component, props)));

// Synthetic data only: no real MySQL, Stripe or email calls.
test('API: datele și tokenul sunt trimise prin opțiunile cererii', async t => {
  const { apiRequest } = await load('utils/apiRequest.js');
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/test');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
    assert.equal(options.method, 'PATCH');
    assert.equal(options.body, '{"test":true}');
    return { ok: true, json: async () => ({ mesaj: 'Salvat' }) };
  });
  assert.deepEqual(await apiRequest('/api/test', { token: 'synthetic-token', method: 'PATCH', body: '{"test":true}' }), { mesaj: 'Salvat' });
});

test('API: un răspuns de eroare nu este confundat cu succesul', async t => {
  const { apiRequest } = await load('utils/apiRequest.js');
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 409, json: async () => ({ eroare: 'Camera este ocupată.' }) }));
  await assert.rejects(apiRequest('/api/test'), /Camera este ocupată/);
});

test('API: un răspuns non-JSON produce un mesaj controlat', async t => {
  const { apiRequest } = await load('utils/apiRequest.js');
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError(); } }));
  await assert.rejects(apiRequest('/api/test'), /502/);
});

test('API: cererea poate fi anulată când filtrul sau pagina se schimbă', async t => {
  const { apiRequest } = await load('utils/apiRequest.js');
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, 'fetch', async (url, options) => { assert.equal(options.signal, controller.signal); options.signal.throwIfAborted(); });
  await assert.rejects(apiRequest('/api/test', { signal: controller.signal }), error => error.name === 'AbortError');
});

test('sesiune: stocarea invalidă nu blochează pagina', async () => {
  const { parseUser } = await load('utils/session.js');
  for (const value of [null, 'undefined', 'invalid', '[]', '"text"', '0']) assert.equal(parseUser(value), null);
  assert.equal(parseUser('{"nume_complet":"Demo"}').nume_complet, 'Demo');
});

test('sesiune: login și logout notifică aplicația și celelalte taburi sunt urmărite selectiv', async t => {
  const { saveSession, clearSession, subscribeSession } = await load('utils/session.js');
  const target = new EventTarget();
  const storage = new Map();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window;
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage); else delete globalThis.localStorage;
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
  } });
  let updates = 0;
  const unsubscribe = subscribeSession(() => updates++);
  saveSession('synthetic-token', { nume_complet: 'Demo' });
  assert.equal(updates, 1);
  assert.equal(storage.get('token'), 'synthetic-token');
  const unrelated = new Event('storage'); unrelated.key = 'other'; target.dispatchEvent(unrelated);
  assert.equal(updates, 1);
  const external = new Event('storage'); external.key = 'utilizator'; target.dispatchEvent(external);
  assert.equal(updates, 2);
  clearSession();
  assert.equal(updates, 3);
  assert.equal(storage.size, 0);
  unsubscribe();
  target.dispatchEvent(new Event('utilizator-update'));
  assert.equal(updates, 3);
});

test('paginarea afișează intervalul și pagina curentă', async () => {
  const { default: Paginator } = await load('pages/admin/Paginator.jsx');
  const html = render(Paginator, { total: 31, pagina: 2, setPagina() {} });
  assert.match(html, /16–30 din 31/);
  assert.equal(render(Paginator, { total: 4, pagina: 1, setPagina() {} }), '');
});

test('secțiunile administrative extrase se redau cu date sintetice', async t => {
  t.mock.method(console, 'error', (...args) => assert.fail(args.join(' ')));
  const { createAdminStyles } = await load('pages/admin/adminStyles.js');
  const s = createAdminStyles(null);
  const record = { id_rezervare: 1, id_utilizator: 1, nume_complet: 'Client Demo', nume_hotel: 'Hotel Demo',
    nume_oras: 'Brașov', email: 'demo@example.invalid', pret_total: 100, rol: 'client', stele: 3,
    data_checkin: '2090-11-10', data_checkout: '2090-11-12', data_crearii: '2090-10-10', status_rezervare: 'confirmata' };
  const examples = [
    ['OverviewTab', { stats: { total_utilizatori: 1, top_hoteluri: [] }, graficLunar: [], graficVenituri: [], getStatsFiltrate: () => ({ total: 1, active: 1, venituri: 100 }) }, 'Dashboard'],
    ['HotelsTab', { hoteluri: [{ ...record, id_hotel: 1 }], categorii: {}, orase: [] }, 'Hotel Demo'],
    ['ReservationsTab', { rezervariFiltrate: [record], paginaRez: 1, utilizator: { rol: 'super_admin' } }, 'Hotel Demo'],
    ['UsersTab', { utilizatori: [record], paginaUtil: 1, utilizator: { id: 2, rol: 'super_admin' } }, 'Client Demo'],
    ['PaymentsTab', { platiLista: [record], paginaPlati: 1 }, 'Hotel Demo'],
    ['MarketingTab', { utilizatori: [], coduri: [], hoteluri: [], rezervari: [], oferteSez: [], formCod: {}, formNewsletter: {}, OFERTE_VIZIBILE: 5 }, 'Cod nou'],
  ];
  for (const [name, props, expected] of examples) {
    const { default: Component } = await load(`pages/admin/${name}.jsx`);
    const html = render(Component, { s, ...props });
    assert.ok(html.length > 100, name);
    if (expected !== 'Dashboard') assert.ok(html.includes(expected), `${name}: ${expected}`);
  }
});

test('imaginea absentă folosește un înlocuitor local', async () => {
  const { default: HotelImage } = await load('components/HotelImage.jsx');
  const html = render(HotelImage, { src: null, alt: 'Hotel Demo' });
  assert.match(html, /src="(?:data:image\/svg\+xml;base64,|[^"]*hotel-placeholder)/);
  assert.ok(!html.includes('unsplash'));
});

test('graficele anuale exclud rezervările din alți ani și însumează numai veniturile confirmate', async () => {
  const { monthlyBookings } = await load('pages/admin/adminData.js');
  const data = monthlyBookings([
    { data_crearii: '2025-01-10', status_rezervare: 'confirmata', pret_total: 900 },
    { data_crearii: '2026-01-10', status_rezervare: 'confirmata', pret_total: 100 },
    { data_crearii: '2026-01-11', status_rezervare: 'anulata', pret_total: 500 },
    { data_crearii: 'invalid', status_rezervare: 'confirmata', pret_total: 800 },
  ], 2026);
  assert.equal(data.counts[0].value, 2);
  assert.equal(data.revenue[0].value, 100);
  assert.equal(data.counts.length, 12);
});

test('paginarea revine la ultima pagină validă după restrângerea listei', async () => {
  const { clampPage } = await load('pages/admin/adminData.js');
  assert.equal(clampPage(5, 16), 2);
  assert.equal(clampPage(5, 0), 1);
  const { default: Paginator } = await load('pages/admin/Paginator.jsx');
  assert.match(render(Paginator, { total: 16, pagina: 5, setPagina() {} }), /16–16 din 16/);
});

test('descărcarea refuză erorile API și răspunsurile care nu sunt PDF', async t => {
  const { downloadReservation } = await load('utils/downloadReservation.js');
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, json: async () => ({ eroare: 'Acces neautorizat.' }) }));
  await assert.rejects(downloadReservation(1, 'synthetic-token'), /Acces neautorizat/);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, headers: new Headers({ 'content-type': 'application/json' }) }));
  await assert.rejects(downloadReservation(1, 'synthetic-token'), /nu a returnat un document PDF/);
});


test('lintul detectează componente JSX neimportate și recunoaște importurile folosite în JSX', () => {
  const linter = new Linter();
  const config = [{
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { local: { rules: { bindings: jsxBindings } } },
    rules: { 'local/bindings': 'error', 'no-unused-vars': 'error' },
  }];
  assert.equal(linter.verify('export default () => <Missing />;', config)[0].ruleId, 'local/bindings');
  assert.deepEqual(linter.verify('const Card = () => null; export default () => <Card />;', config), []);
});

test('fotografiile demonstrative sunt stabile, iar selecția și uploadul administratorului au prioritate', async () => {
  const { hotelCover, demoHotelImage, demoImageChoices, usesDemoImage } = await load('utils/demoImages.js');
  assert.equal(hotelCover({ id_hotel: 1000 }), demoHotelImage({ id_hotel: 1000 }));
  assert.equal(hotelCover({ id_hotel: 1000, imagine_url: 'demo:modern' }), demoImageChoices.modern);
  assert.equal(hotelCover({ id_hotel: 1000, imagine_url: '/uploads/custom.jpg' }), '/uploads/custom.jpg');
  assert.ok(usesDemoImage({ imagine_url: 'https://images.unsplash.com/legacy' }));
  assert.equal(usesDemoImage({ imagine_url: '/uploads/custom.jpg' }), false);
});

test('filtrele hotelurilor combină căutarea fără diacritice, orașul, stelele și oferta', async () => {
  const { filterAdminHotels, defaultHotelFilters } = await load('pages/admin/hotelFilters.js');
  const hotels = [
    { id_hotel: 1, nume_hotel: 'Hotel Șoim', nume_oras: 'Brașov', adresa: 'Strada Liniștii', stele: 4, oferta_activa: 1 },
    { id_hotel: 2, nume_hotel: 'Hotel Șoim', nume_oras: 'București', stele: 4, oferta_activa: 0 },
    { id_hotel: 3, nume_hotel: 'Pensiune', nume_oras: 'Brașov', stele: 3, oferta_activa: '0' },
  ];
  const filters = { ...defaultHotelFilters, query: 'soim', city: 'Brasov', stars: '4', offer: 'active' };
  assert.deepEqual(filterAdminHotels(hotels, filters).map(h => h.id_hotel), [1]);
  assert.deepEqual(filterAdminHotels(hotels, { ...defaultHotelFilters, query: 'linistii' }).map(h => h.id_hotel), [1]);
  assert.deepEqual(filterAdminHotels(hotels, { ...defaultHotelFilters, offer: 'inactive' }).map(h => h.id_hotel), [2, 3]);
  assert.equal(filterAdminHotels(hotels, { ...filters, stars: '5' }).length, 0);
  assert.equal(filterAdminHotels(hotels, defaultHotelFilters).length, 3);
});

test('sortarea prețurilor este numerică, păstrează prețurile necunoscute la final și nu modifică lista inițială', async () => {
  const { filterAdminHotels, defaultHotelFilters, hotelCityOptions } = await load('pages/admin/hotelFilters.js');
  const hotels = [
    { id_hotel: 1, nume_hotel: 'Zefir', pret_minim: null, nume_oras: 'Brașov' },
    { id_hotel: 2, nume_hotel: 'Azur', pret_minim: '100', nume_oras: 'București' },
    { id_hotel: 3, nume_hotel: 'Alpin', pret_minim: '20', nume_oras: 'Brașov' },
  ];
  assert.deepEqual(filterAdminHotels(hotels, { ...defaultHotelFilters, sort: 'price-asc' }).map(h => h.id_hotel), [3, 2, 1]);
  assert.deepEqual(filterAdminHotels(hotels, { ...defaultHotelFilters, sort: 'price-desc' }).map(h => h.id_hotel), [2, 3, 1]);
  assert.deepEqual(filterAdminHotels(hotels, { ...defaultHotelFilters, sort: 'name' }).map(h => h.id_hotel), [3, 2, 1]);
  assert.deepEqual(hotels.map(h => h.id_hotel), [1, 2, 3]);
  assert.deepEqual(hotelCityOptions(hotels, [{ nume_oras: 'Brasov' }]), ['Brașov', 'București']);
});
