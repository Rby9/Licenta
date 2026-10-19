const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro').trim();
const collator = new Intl.Collator('ro', { sensitivity: 'base', numeric: true });

export const defaultHotelFilters = { query: '', city: '', stars: '', offer: '', sort: 'default' };

export function hotelCityOptions(hotels, cities) {
  const names = new Map();
  for (const city of [...cities, ...hotels]) {
    if (city.nume_oras) names.set(normalize(city.nume_oras), city.nume_oras);
  }
  return [...names.values()].sort(collator.compare);
}

export function filterAdminHotels(hotels, filters = defaultHotelFilters) {
  const query = normalize(filters.query);
  const city = normalize(filters.city);
  const result = hotels.filter(hotel => {
    const active = Number(hotel.oferta_activa) === 1;
    return (!query || normalize(`${hotel.nume_hotel ?? ''} ${hotel.adresa ?? ''} ${hotel.nume_oras ?? ''}`).includes(query))
      && (!city || normalize(hotel.nume_oras) === city)
      && (!filters.stars || Number(hotel.stele) === Number(filters.stars))
      && (!filters.offer || (filters.offer === 'active' ? active : !active));
  });
  const byName = (a, b) => collator.compare(a.nume_hotel ?? '', b.nume_hotel ?? '') || Number(a.id_hotel) - Number(b.id_hotel);
  const price = hotel => hotel.pret_minim == null || hotel.pret_minim === '' || !Number.isFinite(Number(hotel.pret_minim)) ? null : Number(hotel.pret_minim);
  if (filters.sort === 'name') result.sort(byName);
  if (['price-asc', 'price-desc'].includes(filters.sort)) result.sort((a, b) => {
    const first = price(a), second = price(b);
    if (first === null || second === null) return first === second ? byName(a, b) : first === null ? 1 : -1;
    return (filters.sort === 'price-desc' ? second - first : first - second) || byName(a, b);
  });
  if (filters.sort === 'stars') result.sort((a, b) => Number(b.stele) - Number(a.stele) || byName(a, b));
  return result;
}
