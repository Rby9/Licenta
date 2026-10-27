const { HttpError } = require('../../services/errors');
const { money } = require('../../services/validation');

// Rucsac cu inventar limitat: un loc în tabel pentru (număr camere, capacitate).
// Loturile binare evită enumerarea tuturor combinațiilor de camere fizice.
function recommendRoomPlans(categories, { adults, preference, nights, budgetCents = null }) {
    if (!Number.isInteger(adults) || adults < 1 || adults > 100 || !['together', 'separate', 'cheapest'].includes(preference)
        || !Number.isInteger(nights) || nights < 1 || (budgetCents !== null && (!Number.isSafeInteger(budgetCents) || budgetCents < 0))) throw new HttpError(400, 'Criterii de repartizare invalide.');
    const rows = categories.map(row => {
        const capacity = Number(row.capacitate), available = Number(row.camere_libere);
        if (!Number.isSafeInteger(capacity) || capacity < 1 || !Number.isSafeInteger(available) || available < 0) throw new HttpError(503, 'Inventarul camerelor nu poate fi verificat.');
        return { ...row, capacity, available, cents: money(row.pret_pe_noapte) };
    }).filter(row => row.available > 0).sort((a, b) => Number(a.id_categorie) - Number(b.id_categorie));
    const table = Array.from({ length: adults + 1 }, () => Array(adults + 1).fill(null));
    table[0][0] = { cents: 0, previous: null };
    for (const row of rows) {
        let remaining = Math.min(row.available, adults);
        for (let size = 1; remaining > 0; size *= 2) {
            const quantity = Math.min(size, remaining); remaining -= quantity;
            for (let count = adults; count >= quantity; count--) {
                for (let capacity = adults; capacity >= 0; capacity--) {
                    const previous = table[count - quantity][capacity];
                    if (!previous) continue;
                    const nextCapacity = Math.min(adults, capacity + row.capacity * quantity);
                    const cents = previous.cents + row.cents * quantity;
                    if (!table[count][nextCapacity] || cents < table[count][nextCapacity].cents) {
                        table[count][nextCapacity] = { cents, previous, row, quantity };
                    }
                }
            }
        }
    }
    const minimumRooms = preference === 'separate' ? 2 : 1;
    const candidates = [];
    for (let count = minimumRooms; count <= adults; count++) {
        const state = table[count][adults];
        if (state && Number.isSafeInteger(state.cents * nights) && state.cents * nights <= 9999999999 && (budgetCents === null || state.cents * nights <= budgetCents)) candidates.push({ count, state });
    }
    // O singură cameră este preferată explicit; alternativele separate sunt marcate.
    const single = candidates.find(candidate => candidate.count === 1);
    const eligible = preference === 'together' && single ? [single] : candidates;
    if (!eligible.length) return [];
    const cheapest = [...eligible].sort((a, b) => a.state.cents - b.state.cents || a.count - b.count)[0];
    const fewest = [...eligible].sort((a, b) => a.count - b.count || a.state.cents - b.state.cents)[0];
    return [cheapest, ...(fewest !== cheapest ? [fewest] : [])].map((candidate, index) => {
        const rooms = [];
        for (let node = candidate.state; node?.row; node = node.previous) {
            for (let room = 0; room < node.quantity; room++) rooms.push({ categoryId: node.row.id_categorie, name: node.row.denumire, capacity: node.row.capacity, adults: 1, nightlyCents: node.row.cents });
        }
        rooms.sort((a, b) => a.categoryId - b.categoryId);
        // Fiecare cameră primește cel puțin un adult; locurile rămase se distribuie echilibrat.
        let remaining = adults - rooms.length;
        while (remaining > 0) for (const room of rooms) {
            if (remaining && room.adults < room.capacity) { room.adults++; remaining--; }
        }
        return { kind: index === 0 ? 'cheapest' : 'fewest', roomCount: rooms.length, rooms,
            nightlyCents: candidate.state.cents, totalCents: candidate.state.cents * nights,
            requiresSeparateConsent: preference === 'together' && rooms.length > 1,
            canCheckout: rooms.length === 1 };
    });
}
module.exports = { recommendRoomPlans };
