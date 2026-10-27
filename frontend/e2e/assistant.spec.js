import { test, expect } from '@playwright/test';
import { mockCatalog } from './fixtures';
const analysis = { criteria: { city: 'Brașov', checkin: '2090-11-10', checkout: '2090-11-13', adults: 2, children: [], budget: 1000, budget_unit: 'stay', room_preference: 'together' }, nights: 3, nightlyBudget: 333.33, complete: true, canSearch: true, reply: 'Confirmă criteriile.' };
async function open(page, enabled = true) {
  const failures = await mockCatalog(page, { authenticated: false });
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { enabled } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Asistent hoteluri', exact: true }).click();
  return { panel: page.getByRole('dialog', { name: 'Asistent HoteluriRo' }), failures };
}
test('asistent: criteriile presetate funcționează în conversație fără AI', async ({ page }) => {
  const { panel, failures } = await open(page, false);
  let body;
  await page.route('**/api/assistant/chat', route => { body = route.request().postDataJSON(); return route.fulfill({ json: analysis }); });
  await expect(panel.getByLabel('Mesajul tău')).toBeEnabled();
  await panel.getByRole('button', { name: 'Caută o cameră', exact: true }).click();
  await panel.getByLabel('Oraș', { exact: true }).selectOption('Brașov');
  await panel.getByLabel('Check-in', { exact: true }).fill('2090-11-10');
  await panel.getByLabel('Check-out', { exact: true }).fill('2090-11-13');
  await panel.getByLabel('Adulți', { exact: true }).fill('2');
  await panel.getByLabel('Buget pentru întregul grup', { exact: true }).selectOption('stay');
  await panel.getByLabel('Suma în RON', { exact: false }).fill('1000');
  await panel.getByLabel('Preferința camerelor').selectOption('together');
  await panel.getByRole('button', { name: 'Aplică criteriile' }).click();
  await expect(panel.getByRole('button', { name: 'Confirmă și caută camere' })).toBeVisible();
  expect(body.criteria).toEqual(analysis.criteria);
  expect(body.turns).toBeUndefined();
  expect(failures).toEqual([]);
});
test('asistent: preferința camerei se completează fără apel la model', async ({ page }) => {
  const { panel } = await open(page);
  let patch;
  await page.route('**/api/assistant/chat', route => {
    const body = route.request().postDataJSON();
    if (body.criteria) { patch = body.criteria; return route.fulfill({ json: analysis }); }
    return route.fulfill({ json: { ...analysis, canSearch: false, criteria: { ...analysis.criteria, room_preference: null } } });
  });
  await panel.getByLabel('Mesajul tău').fill('Caută în Brașov'); await panel.getByRole('button', { name: 'Trimite mesajul' }).click();
  await panel.getByRole('button', { name: 'O singură cameră', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Confirmă și caută camere' })).toBeVisible();
  expect(patch.room_preference).toBe('together');
});
test('asistent: categoria ocupată între căutare și alegere nu permite checkout', async ({ page }) => {
  const { panel } = await open(page);
  await page.route('**/api/assistant/chat', route => route.fulfill({ json: analysis }));
  await page.route('**/api/hoteluri/1/disponibilitate?*', route => route.fulfill({ json: [{ id_categorie: 1, capacitate: 2, pret_pe_noapte: 250, camere_libere: 0 }] }));
  await panel.getByLabel('Mesajul tău').fill('Brașov'); await panel.getByRole('button', { name: 'Trimite mesajul' }).click();
  await panel.getByRole('button', { name: 'Confirmă și caută camere' }).click();
  await panel.getByRole('button', { name: 'Alege camera la Hotel Demo' }).click();
  await expect(panel.getByText('Nu mai există o cameră potrivită', { exact: false })).toBeVisible();
  await expect(panel.getByRole('link', { name: /Continuă la checkout/ })).toHaveCount(0);
});
test('asistent: Escape închide panoul; paginile private nu afișează asistentul', async ({ page }) => {
  const { panel } = await open(page);
  await panel.getByLabel('Mesajul tău').press('Escape');
  await expect(panel).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Asistent hoteluri', exact: true })).toBeFocused();
  await page.goto('/profil');
  await expect(page.getByRole('button', { name: 'Asistent hoteluri', exact: true })).toHaveCount(0);
});
