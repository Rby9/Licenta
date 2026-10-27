import { test, expect } from '@playwright/test';
import { mockCatalog } from './fixtures';
export const analysis = {
  criteria: { city: 'Brașov', checkin: '2090-11-10', checkout: '2090-11-13', adults: 2, children: [], budget: 1000, budget_unit: 'stay', room_preference: 'together' },
  nights: 3, nightlyBudget: 333.33, complete: true, canSearch: true,
  reply: 'Verifică rezumatul de mai jos, apoi confirmă căutarea pentru o singură cameră.',
};
export async function openAssistant(page, { enabled = true, authenticated = false } = {}) {
  const failures = await mockCatalog(page, { authenticated });
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { enabled } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Asistent hoteluri', exact: true }).click();
  return { panel: page.getByRole('dialog', { name: 'Asistent HoteluriRo' }), failures };
}
async function send(panel, message) {
  await panel.getByLabel('Mesajul tău').fill(message);
  await panel.getByRole('button', { name: 'Trimite mesajul' }).click();
}
for (const width of [390, 1440]) test(`AI: alegerea camerei și checkout explicit la ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 850 });
  const { panel, failures } = await openAssistant(page, { authenticated: true });
  await expect(panel.getByRole('button', { name: 'Căutare pas cu pas' })).toHaveCount(0);
  await page.route('**/api/assistant/chat', route => route.fulfill({ json: analysis }));
  let searches = 0;
  page.on('request', request => { if (request.url().includes('/api/hoteluri/search?')) searches++; });
  await send(panel, 'Brașov, doi adulți, fără copii, o cameră, 10–13 noiembrie 2090, 1000 lei pe sejur');
  await expect(panel.getByRole('region', { name: 'Rezumatul căutării' })).toContainText('1.000 RON pentru tot sejurul');
  expect(searches).toBe(0);
  const request = page.waitForRequest(request => request.url().includes('/api/hoteluri/search?'));
  await panel.getByRole('button', { name: 'Confirmă și caută camere' }).click();
  expect(new URL((await request).url()).searchParams.get('pret_max')).toBe('333.33');
  await panel.getByRole('button', { name: 'Alege camera la Hotel Demo' }).click();
  await expect(panel.getByRole('region', { name: 'Camere de rezervat' })).toContainText('1 cameră · 2 adulți');
  await expect(panel.getByText('750 RON total cazare', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`assistant-checkout-${width}.png`) });
  const bounds = await panel.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  await panel.getByRole('link', { name: 'Continuă la checkout — 1 cameră' }).click();
  await expect(page).toHaveURL(/\/rezervare\?hotel_id=1&categorie_id=1&checkin=2090-11-10&checkout=2090-11-13&guests=2&rooms=1/);
  await expect(page.getByText('2 persoane în aceeași cameră')).toBeVisible();
  await expect(page.getByText('1 cameră', { exact: true })).toBeVisible();
  expect(failures).toEqual([]);
});
test('AI: răspunsurile scurte includ întrebările anterioare în context', async ({ page }) => {
  const { panel } = await openAssistant(page);
  const bodies = [];
  await page.route('**/api/assistant/chat', route => { bodies.push(route.request().postDataJSON()); return route.fulfill({ json: { ...analysis, canSearch: false, reply: 'Câți adulți călătoresc?' } }); });
  await send(panel, 'Vreau în Brașov'); await expect(panel.getByLabel('Mesajul tău')).toHaveValue('');
  await send(panel, 'Doi'); await expect(panel.getByLabel('Mesajul tău')).toHaveValue('');
  expect(bodies[1].turns).toEqual([{ role: 'user', content: 'Vreau în Brașov' }, { role: 'assistant', content: 'Câți adulți călătoresc?' }, { role: 'user', content: 'Doi' }]);
});
test('AI: o eroare păstrează rezumatul și mesajul, iar reîncercarea nu dublează mesajele', async ({ page }) => {
  const { panel } = await openAssistant(page);
  let attempts = 0;
  await page.route('**/api/assistant/chat', route => route.fulfill(++attempts === 2 ? { status: 429, json: { eroare: 'Limita AI a fost atinsă.' } } : { json: analysis }));
  await send(panel, 'O căutare completă'); await expect(panel.getByRole('button', { name: 'Confirmă și caută camere' })).toBeVisible();
  await send(panel, 'Altă perioadă'); await expect(panel.getByRole('alert')).toContainText('Limita AI');
  await expect(panel.getByRole('region', { name: 'Rezumatul căutării' })).toContainText('Brașov');
  await expect(panel.getByLabel('Mesajul tău')).toHaveValue('Altă perioadă');
  await expect(panel.getByRole('button', { name: 'Confirmă și caută camere' })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Trimite mesajul' }).click();
  await expect(panel.getByLabel('Mesajul tău')).toHaveValue('');
  await expect(panel.locator('.assistant-message-user').filter({ hasText: 'Altă perioadă' })).toHaveCount(1);
});
test('AI: conversația nouă nu primește rezultatul unei cereri anterioare', async ({ page }) => {
  const { panel } = await openAssistant(page);
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/assistant/chat', async route => { await gate; await route.fulfill({ json: analysis }).catch(() => {}); });
  await send(panel, 'O căutare'); await expect(panel.getByText('Verific cererea…')).toBeVisible();
  await panel.getByRole('button', { name: 'Conversație nouă' }).click(); release();
  await expect(panel.getByLabel('Mesajul tău')).toBeEnabled();
  await expect(panel.getByRole('region', { name: 'Rezumatul căutării' })).toHaveCount(0);
});
test('AI: istoricul este reluat după reload și poate fi șters', async ({ page }) => {
  const { panel } = await openAssistant(page);
  await page.route('**/api/assistant/chat', route => route.fulfill({ json: analysis }));
  await send(panel, 'Căutarea mea salvată'); await expect(panel.getByRole('region', { name: 'Rezumatul căutării' })).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Asistent hoteluri', exact: true }).click();
  await expect(panel.locator('.assistant-message-user').filter({ hasText: 'Căutarea mea salvată' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Confirmă și caută camere' })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Istoric conversații' }).click();
  await expect(panel.getByRole('region', { name: 'Istoric conversații' }).getByRole('button', { name: 'Căutarea mea salvată' })).toBeVisible();
  await panel.getByRole('button', { name: 'Șterge istoricul local' }).click();
  await expect(panel.getByText('Nicio conversație salvată.')).toBeVisible();
  await page.reload(); await page.getByRole('button', { name: 'Asistent hoteluri', exact: true }).click();
  await expect(panel.locator('.assistant-message-user').filter({ hasText: 'Căutarea mea salvată' })).toHaveCount(0);
});

test('AI: catalogul afișează orașe și hoteluri fără formular de rezervare și fără cheie', async ({ page }) => {
  const { panel } = await openAssistant(page, { enabled: false });
  await page.route('**/api/assistant/chat', route => {
    const body = route.request().postDataJSON();
    const intent = body.catalog?.intent;
    return route.fulfill({ json: intent === 'cities'
      ? { kind: 'catalog', reply: 'Orașele cu hoteluri în catalog: Brașov. Disponibilitatea se verifică după alegerea perioadei.', catalog: { type: 'cities', cities: [{ id_oras: 1, nume_oras: 'Brașov', numar_hoteluri: 1 }] } }
      : intent === 'hotels' ? { kind: 'catalog', reply: 'În Brașov găsești Hotel Demo. Prețurile nu confirmă disponibilitatea.', catalog: { type: 'hotels', hotels: [{ id_hotel: 1, nume_hotel: 'Hotel Demo', nume_oras: 'Brașov', stele: 4, pret_minim: 250 }] } }
        : { kind: 'catalog', reply: 'Hotel Demo are WiFi și o categorie Dublă, pentru maximum două persoane.', catalog: { type: 'hotel_details', hotel: { id_hotel: 1, nume_hotel: 'Hotel Demo' } } } });
  });
  await panel.getByRole('button', { name: 'Ce orașe sunt disponibile?', exact: true }).click();
  await expect(panel.locator('.assistant-message-assistant').last()).toContainText('Brașov');
  await expect(panel.getByRole('region', { name: 'Rezumatul căutării' })).toHaveCount(0);
  await panel.getByRole('button', { name: /Brașov.*1 hotel/ }).click();
  await panel.getByRole('button', { name: 'Detalii despre Hotel Demo' }).click();
  await expect(panel.locator('.assistant-message-assistant').last()).toContainText('WiFi');
  await expect(panel.getByRole('link', { name: 'Vezi Hotel Demo' })).toHaveAttribute('href', '/hoteluri/1');
});

for (const width of [390, 1440, 2560]) test(`AI: panou extins, compact și istoric separat la ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const { panel } = await openAssistant(page);
  const expanded = await panel.boundingBox();
  expect(expanded.y).toBe(0); expect(expanded.height).toBe(900);
  expect(expanded.width).toBe(width === 390 ? 390 : Math.max(390, width * .25));
  const messageBox = await panel.locator('.assistant-messages').boundingBox();
  expect(messageBox.height).toBeGreaterThan(650);
  await panel.getByRole('button', { name: 'Micșorează panoul' }).click();
  expect((await panel.boundingBox()).height).toBeLessThan(700);
  await panel.getByRole('button', { name: 'Mărește panoul' }).click();
  await panel.getByRole('button', { name: 'Istoric conversații', exact: true }).click();
  await expect(panel.getByRole('region', { name: 'Istoric conversații' })).toBeVisible();
  await expect(panel.getByLabel('Mesajul tău')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath(`assistant-history-${width}.png`) });
  await panel.getByRole('button', { name: 'Înapoi la conversație' }).click();
  await expect(panel.getByLabel('Mesajul tău')).toBeVisible();
});

test('AI: răspunsul rămâne vizibil când sunt afișate mai multe hoteluri', async ({ page }, testInfo) => {
  const { panel } = await openAssistant(page);
  await page.route('**/api/assistant/chat', route => route.fulfill({ json: {
    kind: 'catalog', reply: 'În catalog sunt cinci hoteluri. Alege unul pentru detalii.',
    catalog: { type: 'hotels', hotels: Array.from({ length: 5 }, (_, index) => ({ id_hotel: index + 1, nume_hotel: `Hotel ${index + 1}`, nume_oras: 'Brașov', stele: 3, pret_minim: 200 })) },
  } }));
  await send(panel, 'Ce hoteluri aveți în Brașov?');
  const lastReply = panel.locator('.assistant-message-assistant').last();
  await expect(lastReply).toContainText('cinci hoteluri');
  await expect(lastReply).toBeInViewport();
  await expect(panel.getByRole('heading', { name: 'Hotel 1', exact: true })).toBeInViewport();
  await expect(panel.getByRole('heading', { name: 'Hotel 5', exact: true })).not.toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('assistant-reply-before-results.png') });
});

test('AI: română inițial, engleză în răspuns/interfață, istoric și revenire la română', async ({ page }) => {
  await openAssistant(page);
  const panel = page.getByRole('dialog');
  await expect(panel.locator('.assistant-message-assistant')).toContainText('Salut!');
  const bodies = [];
  await page.route('**/api/assistant/chat', route => {
    const body = route.request().postDataJSON(); bodies.push(body);
    const romanian = body.turns?.at(-1).content === 'Vreau o cameră';
    return route.fulfill({ json: { ...analysis, language: romanian ? 'ro' : 'en', reply: romanian ? analysis.reply : 'Review the summary below, then confirm the search for one room.' } });
  });
  await send(panel, 'I need a room in Brasov');
  await expect(panel).toHaveAttribute('lang', 'en');
  await expect(panel.getByLabel('Your message')).toHaveValue('');
  await expect(panel.getByRole('button', { name: 'Confirm and find rooms' })).toBeVisible();
  await panel.getByLabel('Your message').fill('3');
  await panel.getByRole('button', { name: 'Send message' }).click();
  await expect(panel.getByLabel('Your message')).toHaveValue('');
  expect(bodies[1].language).toBe('en');
  await panel.getByRole('button', { name: 'Options and questions' }).click();
  await expect(panel.getByRole('button', { name: 'What payment methods are available?' })).toBeVisible();
  await panel.getByRole('button', { name: 'Search criteria', exact: false }).click();
  await expect(panel.getByLabel('Budget for the entire group')).toBeVisible();
  await panel.getByRole('button', { name: 'Back to conversation' }).click();
  await panel.getByRole('button', { name: 'Confirm and find rooms' }).click();
  await panel.getByRole('button', { name: 'Choose a room at Hotel Demo' }).click();
  await expect(panel.getByRole('link', { name: 'Continue to checkout — 1 room' })).toBeVisible();
  await expect(panel.getByRole('region', { name: 'Rooms to book' })).toContainText('750 RON accommodation total');
  await page.reload();
  await page.getByRole('button', { name: 'Hotel assistant', exact: true }).click();
  await expect(panel).toHaveAttribute('lang', 'en');
  await expect(panel.getByRole('button', { name: 'Confirm and find rooms' })).toHaveCount(0);
  await panel.getByLabel('Your message').fill('Vreau o cameră');
  await panel.getByRole('button', { name: 'Send message' }).click();
  await expect(panel).toHaveAttribute('lang', 'ro');
  await panel.getByRole('button', { name: 'Conversație nouă' }).click();
  await expect(panel.locator('.assistant-message-assistant')).toContainText('Salut!');
  await expect(panel.getByLabel('Mesajul tău')).toBeVisible();
});

function groupResult(adults, preference = 'separate', language = 'ro') {
  const rooms = Array.from({ length: Math.ceil(adults / 2) }, (_, index) => ({ categoryId: 1, name: 'Camera Standard', capacity: 2, adults: Math.min(2, adults - index * 2), nightlyCents: 10000 }));
  return { language, criteria: { ...analysis.criteria, adults, room_preference: preference }, nights: 3, totalHotels: 1,
    reply: language === 'en' ? 'Review the room arrangements. Multiple-room checkout is not available yet.' : 'Verifică repartizarea. Checkout-ul pentru mai multe camere nu este disponibil încă.',
    hotels: [{ hotel: { id_hotel: 1, nume_hotel: 'Hotel Demo', nume_oras: 'Brașov', stele: 4 }, plans: [{ kind: 'cheapest', roomCount: rooms.length, rooms, nightlyCents: rooms.length * 10000, totalCents: rooms.length * 30000, canCheckout: false, requiresSeparateConsent: preference === 'together' }] }] };
}
for (const adults of [3, 4, 5]) for (const width of [390, 1440]) test(`AI grup: ${adults} adulți la ${width}px, repartizare și total fără checkout multiplu`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const { panel, failures } = await openAssistant(page);
  const result = groupResult(adults);
  await page.route('**/api/assistant/chat', route => route.fulfill({ json: { ...analysis, criteria: result.criteria, reply: 'Confirmă criteriile pentru grup.' } }));
  let sent;
  await page.route('**/api/assistant/recommendations', route => { sent = route.request().postDataJSON(); return route.fulfill({ json: result }); });
  await send(panel, `Brașov, ${adults} adulți, fără copii, camere separate, 3 nopți, 1000 lei pe sejur`);
  await panel.getByRole('button', { name: 'Caută repartizări pentru grup' }).click();
  const region = panel.getByRole('region', { name: 'Repartizări pentru grup' });
  await expect(region).toContainText(`${Math.ceil(adults / 2)} camere · ${adults} adulți · 3 nopți`);
  await expect(region).toContainText(`${Math.ceil(adults / 2) * 300} RON total sejur pentru întregul grup`);
  await expect(region.getByRole('listitem')).toHaveCount(Math.ceil(adults / 2));
  await expect(region.getByRole('link', { name: /checkout/ })).toHaveCount(0);
  await expect(region.getByRole('link', { name: 'Verifică oferta și aprobă rezervarea' })).toHaveAttribute('href', /\/rezervare\/grup\?/);
  expect(sent.criteria.adults).toBe(adults); expect(sent.criteria.budget_unit).toBe('stay');
  await page.screenshot({ path: testInfo.outputPath(`group-${adults}-${width}.png`) });
  await panel.getByRole('button', { name: 'Conversație nouă' }).click();
  await expect(region).toHaveCount(0);
  expect(failures).toEqual([]);
});
test('AI grup: lipsa unei camere comune oferă alternativa explicită în camere separate', async ({ page }) => {
  const { panel } = await openAssistant(page);
  const result = groupResult(3, 'together');
  await page.route('**/api/assistant/chat', route => route.fulfill({ json: { ...analysis, criteria: result.criteria } }));
  await page.route('**/api/hoteluri/search?*', route => route.fulfill({ json: [] }));
  await page.route('**/api/assistant/recommendations', route => route.fulfill({ json: result }));
  await send(panel, 'Vreau aceeași cameră pentru trei adulți');
  await panel.getByRole('button', { name: 'Confirmă și caută camere' }).click();
  await expect(panel.getByText('Grupul nu încape într-o singură cameră disponibilă în buget. Aceasta este o alternativă în camere separate.')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Accept camere separate' })).toBeVisible();
  await expect(panel.getByRole('link', { name: /checkout/ })).toHaveCount(0);
});
test('AI grup: engleză, alternativă într-o cameră și continuare pe checkout-ul existent', async ({ page }) => {
  await openAssistant(page);
  const panel = page.getByRole('dialog');
  const result = groupResult(5, 'cheapest', 'en');
  result.hotels[0].plans.push({ kind: 'fewest', roomCount: 1, rooms: [{ categoryId: 2, name: 'Family', capacity: 5, adults: 5, nightlyCents: 40000 }], nightlyCents: 40000, totalCents: 120000, canCheckout: true });
  await page.route('**/api/assistant/chat', route => route.fulfill({ json: { ...analysis, language: 'en', criteria: result.criteria } }));
  await page.route('**/api/assistant/recommendations', route => route.fulfill({ json: result }));
  await send(panel, 'I need rooms for five adults, cheapest arrangement');
  await panel.getByRole('button', { name: 'Find room arrangements' }).click();
  const region = panel.getByRole('region', { name: 'Room arrangements for your group' });
  await expect(region).toContainText('3 rooms · 5 adults · 3 nights');
  await expect(region).toContainText('1 room · 5 adults · 3 nights');
  await expect(region).toContainText('1,200 RON whole-stay total for the entire group');
  await expect(region.getByRole('link', { name: 'Review the offer and approve the booking' })).toHaveCount(2);
});
