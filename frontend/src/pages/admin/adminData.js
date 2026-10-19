import { PER_PAGE } from './adminConstants';

export function clampPage(page, total) {
  return Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / PER_PAGE)));
}

export function monthlyBookings(reservations, year = new Date().getFullYear()) {
  const months = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const counts = Array(12).fill(0);
  const revenue = Array(12).fill(0);
  for (const reservation of reservations) {
    const date = new Date(reservation.data_crearii);
    if (date.getFullYear() !== year) continue;
    const month = date.getMonth();
    counts[month]++;
    if (reservation.status_rezervare === 'confirmata') revenue[month] += Number(reservation.pret_total) || 0;
  }
  return {
    counts: months.map((label, index) => ({ label, value: counts[index] })),
    revenue: months.map((label, index) => ({ label, value: Math.round(revenue[index]) })),
  };
}
