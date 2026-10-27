const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recommendRoomPlans } = require('../src/modules/assistant/room-plans');
const { createRoomRecommendations } = require('../src/modules/assistant/recommendations');
const category = (id, capacity, price, available = 1) => ({ id_categorie: id, denumire: `Categoria ${id}`, capacitate: capacity, pret_pe_noapte: price, camere_libere: available });
const request = { adults: 5, preference: 'cheapest', nights: 3 };

test('repartizare: combină categorii și nu depășește inventarul sau capacitatea', () => {
    const plans = recommendRoomPlans([category(1, 2, '100.10', 2), category(2, 1, '50.05')], request);
    assert.equal(plans.length, 1);
    assert.deepEqual(plans[0].rooms.map(room => room.adults), [2, 2, 1]);
    assert.equal(plans[0].totalCents, 75075);
    assert.equal(plans[0].canCheckout, false);
    assert.deepEqual(recommendRoomPlans([category(1, 2, 100, 2)], request), []);
    assert.deepEqual(recommendRoomPlans([category(1, 10, 100, 0)], request), []);
});
test('repartizare: cost minim și număr minim de camere pot fi opțiuni distincte', () => {
    const plans = recommendRoomPlans([category(1, 5, 400), category(2, 2, 100, 3)], request);
    assert.deepEqual(plans.map(plan => [plan.kind, plan.roomCount, plan.totalCents]), [['cheapest', 3, 90000], ['fewest', 1, 120000]]);
    assert.equal(plans[1].canCheckout, true);
    assert.deepEqual(recommendRoomPlans([category(1, 5, 400), category(2, 2, 100, 3)], { ...request, budgetCents: 89999 }), []);
    assert.equal(recommendRoomPlans([category(1, 5, 400), category(2, 2, 100, 3)], { ...request, budgetCents: 90000 }).length, 1);
});
test('repartizare: respectă camera comună și marchează explicit alternativele separate', () => {
    const rows = [category(1, 5, 400), category(2, 2, 100, 3)];
    const together = recommendRoomPlans(rows, { ...request, preference: 'together' });
    assert.equal(together[0].roomCount, 1);
    assert.equal(together[0].requiresSeparateConsent, false);
    const fallback = recommendRoomPlans(rows, { ...request, preference: 'together', budgetCents: 90000 });
    assert.equal(fallback[0].requiresSeparateConsent, true);
    assert.equal(fallback[0].canCheckout, false);
    const separate = recommendRoomPlans(rows, { ...request, preference: 'separate' });
    assert.ok(separate.every(plan => plan.roomCount >= 2));
    assert.equal(recommendRoomPlans(rows, { ...request, preference: 'separate', adults: 1 }).length, 0);
});
test('repartizare: compară rezultatul cu enumerarea completă pentru inventare mici', () => {
    for (let seed = 1; seed <= 40; seed++) {
        const rows = [category(1, 1 + seed % 3, 30 + seed % 4, seed % 3), category(2, 2 + seed % 4, 65, 2), category(3, 4, 100 + seed % 7, 1)];
        for (const preference of ['cheapest', 'separate', 'together']) {
            const adults = 1 + seed % 9;
            let combinations = [];
            for (let a = 0; a <= rows[0].camere_libere; a++) for (let b = 0; b <= 2; b++) for (let c = 0; c <= 1; c++) {
                const count = a + b + c, capacity = a * rows[0].capacitate + b * rows[1].capacitate + c * rows[2].capacitate;
                if (count <= adults && count >= (preference === 'separate' ? 2 : 1) && capacity >= adults) combinations.push({ count, cents: a * rows[0].pret_pe_noapte * 100 + b * 6500 + c * rows[2].pret_pe_noapte * 100 });
            }
            if (preference === 'together' && combinations.some(value => value.count === 1)) combinations = combinations.filter(value => value.count === 1);
            const plans = recommendRoomPlans(rows, { adults, preference, nights: 1 });
            if (!combinations.length) { assert.equal(plans.length, 0); continue; }
            assert.equal(plans[0].nightlyCents, Math.min(...combinations.map(value => value.cents)));
            assert.equal(Math.min(...plans.map(plan => plan.roomCount)), Math.min(...combinations.map(value => value.count)));
            for (const plan of plans) {
                assert.equal(plan.rooms.reduce((sum, room) => sum + room.adults, 0), adults);
                assert.ok(plan.rooms.every(room => room.adults >= 1 && room.adults <= room.capacity));
                for (const row of rows) assert.ok(plan.rooms.filter(room => room.categoryId === row.id_categorie).length <= row.camere_libere);
            }
        }
    }
});
test('repartizare: respinge criterii și inventare invalide și acceptă grupuri mari', () => {
    for (const patch of [{ adults: 101 }, { adults: 0 }, { nights: 0 }, { preference: 'anything' }, { budgetCents: -1 }]) assert.throws(() => recommendRoomPlans([], { ...request, ...patch }), error => error.status === 400);
    assert.throws(() => recommendRoomPlans([category(1, 0, 20)], request), error => error.status === 503);
    const large = recommendRoomPlans([category(1, 2, 100, 1000)], { ...request, adults: 100 });
    assert.equal(large[0].roomCount, 50);
    assert.equal(large[0].rooms.reduce((sum, room) => sum + room.adults, 0), 100);
});

const criteria = { city: 'brasov', checkin: '2090-11-10', checkout: '2090-11-13', adults: 5, children: [], budget: 900, budget_unit: 'stay', room_preference: 'cheapest' };
function fixture() {
    const calls = [];
    const db = { promise: () => ({ execute: async (sql, params) => {
        calls.push({ sql, params }); assert.match(sql, /^SELECT /);
        if (sql.includes('SELECT nume_oras')) return [[{ nume_oras: 'Brașov' }]];
        return [[...[
            { id_hotel: 2, nume_hotel: 'Hotel B', ...category(2, 2, 100, 3) },
            { id_hotel: 1, nume_hotel: 'Hotel A', ...category(1, 2, 150, 3) },
        ].map(row => ({ ...row, nume_oras: 'Brașov' }))]];
    } }) };
    return { service: createRoomRecommendations(db), calls };
}
test('recomandări: numai SELECT parametrizat, disponibilitate pe interval și buget pentru toate camerele', async () => {
    const { service, calls } = fixture();
    const result = await service.search(criteria);
    assert.equal(result.hotels.length, 1);
    assert.equal(result.hotels[0].hotel.id_hotel, 2);
    assert.equal(result.hotels[0].plans[0].totalCents, 90000);
    assert.deepEqual(calls[1].params, ['Brașov', '2090-11-13', '2090-11-10']);
    assert.match(calls[1].sql, /NOT EXISTS/);
    assert.match(calls[1].sql, /status_camera='activa'/);
    assert.match(result.reply, /Checkout-ul pentru mai multe camere nu este disponibil/);
    const english = await service.search({ ...criteria, budget: 300, budget_unit: 'nightly' }, 'en');
    assert.equal(english.hotels[0].plans[0].totalCents, 90000);
    assert.match(english.reply, /Multiple-room checkout is not available/);
});
test('recomandări: criteriile incomplete, copiii și orașele necunoscute nu citesc inventarul', async () => {
    const { service, calls } = fixture();
    for (const patch of [{ city: 'Atlantida' }, { children: [4] }, { checkin: '2000-01-01' }, { budget: null }, { adults: '5' }]) await assert.rejects(service.search({ ...criteria, ...patch }), error => error.status === 400);
    assert.ok(calls.every(call => call.sql.includes('SELECT nume_oras')));
});
