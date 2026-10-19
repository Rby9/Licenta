import { test, expect } from '@playwright/test';
import { mockCatalog, demoHotel } from './fixtures';

for (const width of [390, 768, 1440]) {
  test(`paginile principale și administrarea la ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    const failures = await mockCatalog(page);
    for (const path of ['/', '/hoteluri', '/hoteluri/1', '/rezervare?hotel_id=1&categorie_id=1', '/profil', '/admin']) {
      await page.goto(path);
      await expect(page.locator('nav')).toBeVisible();
      if (path === '/') await expect(page.getByText('Destinații populare')).toBeVisible();
      else if (path === '/hoteluri') await expect(page.getByText('Hotel Demo', { exact: true })).toBeVisible();
      else if (path === '/admin') await expect(page.getByRole('heading', { name: 'Panou administrare' })).toBeVisible();
      if (path === '/hoteluri/1') {
        const roomPhoto = page.locator('.room-demo-image').first();
        await expect(roomPhoto).toBeAttached();
        await expect.poll(() => roomPhoto.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
      }
      if (width === 390 && ['/hoteluri/1', '/admin'].includes(path)) await page.screenshot({ path: testInfo.outputPath(path === '/admin' ? 'admin-mobile.png' : 'hotel-mobile.png') });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: `${path}: depășire orizontală la ${width}px` }).toBe(true);
    }
    expect(failures).toEqual([]);
  });
}

test('rotița deasupra hărții derulează pagina și nu schimbă zoomul', async ({ page }) => {
  await mockCatalog(page);
  for (const path of ['/', '/hoteluri/1']) {
    await page.goto(path);
    const map = page.locator('.leaflet-container').first();
    await expect(map).toBeVisible();
    await map.scrollIntoViewIfNeeded();
    const bounds = await map.boundingBox();
    await page.mouse.move(bounds.x + bounds.width * .25, bounds.y + bounds.height * .3);
    const scrollBefore = await page.evaluate(() => scrollY);
    const delta = await page.evaluate(() => scrollY >= document.documentElement.scrollHeight - innerHeight - 20 ? -250 : 250);
    await map.click({ position: { x: bounds.width * .25, y: bounds.height * .3 } });
    const before = await page.locator('.leaflet-proxy').first().getAttribute('style');
    await page.mouse.wheel(0, delta);
    await expect.poll(() => page.evaluate(() => scrollY)).not.toBe(scrollBefore);
    expect(await page.locator('.leaflet-proxy').first().getAttribute('style')).toBe(before);
  }
});

for (const width of [390, 1440]) test(`toate secțiunile administrative se deschid fără erori la ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  const failures = await mockCatalog(page);
  await page.goto('/admin');
  for (const label of ['Hoteluri', 'Rezervări', 'Utilizatori', 'Plăți', 'Marketing', 'Dashboard']) {
    await page.locator('.admin-tabs').getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('.page-layout')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  expect(failures).toEqual([]);
});

test('o ofertă respinsă de server nu este afișată ca actualizată', async ({ page }) => {
  await mockCatalog(page, { role: 'admin_marketing', seasonStatus: 500 });
  await page.goto('/admin');
  const toggle = page.getByRole('button', { name: '✓ Activă', exact: true });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByRole('alert')).toContainText('nu a putut fi actualizată');
  await expect(toggle).toHaveText('✓ Activă');
});

test('formularul de autentificare rămâne accesibil pe telefon', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await mockCatalog(page, { authenticated: false });
  await page.goto('/autentificare');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Parolă', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('adăugare hotel: hartă, imagine și protecție la dublu click pe telefon', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  const failures = await mockCatalog(page, { role: 'admin_hotel' });
  let saved, creates = 0;
  await page.route('**/api/admin/hoteluri', async route => {
    saved = route.request().postDataJSON();
    creates++;
    await new Promise(resolve => setTimeout(resolve, 100));
    await route.fulfill({ status: 201, json: { id_hotel: 2, mesaj: 'Hotel adăugat.' } });
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: '+ Adaugă hotel', exact: true }).click();
  await page.getByLabel('Oraș *', { exact: true }).selectOption('1');
  await page.getByLabel('Nume hotel *', { exact: true }).fill('Hotel Nou Demo');
  const map = page.locator('.hotel-location-picker .leaflet-container');
  await map.click({ position: { x: 140, y: 100 } });
  await expect(page.getByLabel('Latitudine', { exact: true })).not.toHaveValue('');
  await page.getByRole('button', { name: 'Imagine modern', exact: true }).click();
  await page.getByRole('button', { name: 'Adaugă hotel', exact: true }).dblclick();
  await expect.poll(() => saved?.nume_hotel).toBe('Hotel Nou Demo');
  await expect(page.getByText('Hotel adăugat!', { exact: false })).toBeVisible();
  expect(creates).toBe(1);
  expect(saved.imagine_url).toBe('demo:modern');
  expect(Number.isFinite(saved.latitudine) && Number.isFinite(saved.longitudine)).toBe(true);
  expect(failures).toEqual([]);
});

test('categorie nouă: formularul trimite și numărul camerelor rezervabile', async ({ page }) => {
  await mockCatalog(page, { role: 'admin_hotel' });
  let saved;
  await page.route('**/api/admin/categorii', async route => {
    saved = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { id_categorie: 2, numar_camere: 3 } });
  });
  await page.goto('/admin');
  await page.getByRole('button', { name: '▼ Vezi', exact: true }).click();
  await page.getByRole('button', { name: '+ Adaugă categorie' }).click();
  await page.getByPlaceholder('Ex: Camera Deluxe').fill('Dublă Demo');
  await page.getByPlaceholder('Ex: 350').fill('250');
  await page.getByLabel('Număr de camere rezervabile *', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Adaugă categorie', exact: true }).click();
  await expect.poll(() => saved?.numar_camere).toBe('3');
  expect(saved.id_hotel).toBe(1);
});


for (const [role, visible] of [
  ['admin_hotel', ['Hoteluri', 'Rezervări']],
  ['admin_booking', ['Rezervări', 'Utilizatori', 'Plăți']],
  ['admin_marketing', ['Dashboard', 'Marketing']],
]) test(`meniul administrativ respectă rolul ${role}`, async ({ page }) => {
  const failures = await mockCatalog(page, { role });
  await page.goto('/admin');
  await expect(page.locator('.admin-tabs button')).toHaveText(visible);
  expect(failures).toEqual([]);
});

test('formularul arată eroarea în dialog când lipsește poziția hotelului', async ({ page }) => {
  await mockCatalog(page, { role: 'admin_hotel' });
  await page.goto('/admin');
  await page.getByRole('button', { name: '+ Adaugă hotel', exact: true }).click();
  await page.getByLabel('Oraș *', { exact: true }).selectOption('1');
  await page.getByLabel('Nume hotel *', { exact: true }).fill('Hotel Demo');
  await page.getByRole('button', { name: 'Adaugă hotel', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Alege poziția hotelului');
});


for (const width of [390, 1440]) test(`filtre hoteluri: combinare, sortare, rezultat gol și resetare la ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  const failures = await mockCatalog(page, { role: 'admin_hotel' });
  const hotels = [
    { ...demoHotel, id_hotel: 1, nume_hotel: 'Hotel Șoim', stele: 4, oferta_activa: 1, pret_minim: 250 },
    { ...demoHotel, id_hotel: 2, nume_hotel: 'Hotel Capital', nume_oras: 'București', stele: 3, oferta_activa: 0, pret_minim: 300 },
    { ...demoHotel, id_hotel: 3, nume_hotel: 'Zefir', stele: 5, oferta_activa: 1, pret_minim: 100 },
  ];
  await page.route('**/api/hoteluri', route => route.fulfill({ json: hotels }));
  await page.goto('/admin');
  const table = page.locator('.admin-table-card').first();
  await expect(page.getByText('3 din 3 hoteluri', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Caută hotel' }).fill('soim');
  await expect(table.getByText('Hotel Șoim', { exact: true })).toBeVisible();
  await expect(table.getByText('Hotel Capital', { exact: true })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Caută hotel' }).clear();
  await page.getByLabel('Oraș', { exact: true }).selectOption('Brașov');
  await page.getByLabel('Stele', { exact: true }).selectOption('5');
  await page.getByLabel('Ofertă', { exact: true }).selectOption('active');
  await expect(page.getByText('1 din 3 hoteluri', { exact: true })).toBeVisible();
  await expect(table.getByText('Zefir', { exact: true })).toBeVisible();
  await page.getByLabel('Ofertă', { exact: true }).selectOption('inactive');
  await expect(table.getByText('Niciun hotel nu corespunde filtrelor selectate.')).toBeVisible();
  await page.getByRole('button', { name: 'Resetează filtrele' }).click();
  await expect(page.getByText('3 din 3 hoteluri', { exact: true })).toBeVisible();
  await page.getByLabel('Sortare', { exact: true }).selectOption('price-asc');
  await expect(table.locator('tbody tr').first()).toContainText('Zefir');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(failures).toEqual([]);
});
