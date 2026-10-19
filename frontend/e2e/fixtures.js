export const demoUser = { id: 1, id_utilizator: 1, nume_complet: 'Client Demo', email: 'demo@example.invalid', rol: 'super_admin', email_marketing: false };
export const demoRoom = { id_categorie: 1, denumire: 'Camera Standard', capacitate: 2, pret_pe_noapte: 250, descriere: 'Cameră demonstrativă', camere_libere: 2, total_camere: 2 };
export const demoHotel = { id_hotel: 1, nume_hotel: 'Hotel Demo', nume_oras: 'Brașov', id_oras: 1, adresa: 'Adresă demonstrativă', stele: 4,
  descriere: 'Un hotel fictiv pentru verificarea interfeței.', latitudine: 45.65, longitudine: 25.60,
  pret_minim: 250, categorii_camere: [demoRoom], camere_disponibile: 2 };
export const demoBooking = { id_rezervare: 1, id_utilizator: 1, nume_complet: 'Client Demo', nume_hotel: 'Hotel Demo', nume_oras: 'Brașov',
  email: 'demo@example.invalid', data_checkin: '2090-11-10', data_checkout: '2090-11-12', data_crearii: '2090-10-10',
  pret_total: 500, status_rezervare: 'confirmata', metoda_plata: 'cash_cazare', tip_camera: 'Camera Standard', id_hotel: 1 };

export async function mockCatalog(page, { role = 'super_admin', authenticated = true, seasonStatus = 200 } = {}) {
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  if (authenticated) await page.addInitScript(user => {
    localStorage.setItem('token', 'synthetic-token');
    localStorage.setItem('utilizator', JSON.stringify(user));
  }, { ...demoUser, rol: role });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data = [], status = 200;
    if (path === '/api/orase') data = [{ id_oras: 1, nume_oras: 'Brașov', numar_hoteluri: 1 }];
    else if (path === '/api/hoteluri/harta' || path === '/api/hoteluri/search' || path === '/api/hoteluri') data = [demoHotel];
    else if (path === '/api/hoteluri/1') data = demoHotel;
    else if (path.endsWith('/disponibilitate')) data = [demoRoom];
    else if (path === '/api/admin/stats') data = { total_utilizatori: 1, top_hoteluri: [demoHotel] };
    else if (path === '/api/admin/rezervari' || path === '/api/rezervari/mele') data = [demoBooking];
    else if (path === '/api/admin/utilizatori') data = [demoUser];
    else if (path === '/api/admin/plati/stats') data = {};
    else if (path === '/api/admin/oferte-sezon' && route.request().method() === 'GET') data = [{ id_oferta: 1, titlu: 'Ofertă Demo', tip: 'vara', activa: 1, discount_procent: 10 }];
    else if (path.startsWith('/api/admin/oferte-sezon/') && route.request().method() !== 'GET') {
      status = seasonStatus; data = status === 200 ? { mesaj: 'Salvat' } : { eroare: 'Eroare simulată' };
    }
    await route.fulfill({ status, json: data });
  });
  // External services are unrelated to these UI tests; keep runs deterministic.
  await page.route(/https:\/\/(fonts\.|tile\.openstreetmap|unpkg\.|images\.unsplash)/, route => route.abort());
  return failures;
}
