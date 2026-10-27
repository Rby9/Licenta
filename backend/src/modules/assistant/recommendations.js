const { freeRoomSQL } = require('../../services/availability');
const { money } = require('../../services/validation');
const { HttpError } = require('../../services/errors');
const { validateExtraction } = require('./service');
const { recommendRoomPlans } = require('./room-plans');

function createRoomRecommendations(db) {
    return {
        async search(criteria, language = 'ro') {
            if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) throw new HttpError(400, 'Criterii invalide.');
            const [cities] = await db.promise().execute('SELECT nume_oras FROM Orase ORDER BY nume_oras');
            let analysis;
            try { analysis = validateExtraction({ ...criteria, intent: 'search', clarification: null }, cities.map(city => city.nume_oras), undefined, language); }
            catch (error) { if (error.status === 502) throw new HttpError(400, 'Criterii invalide.'); throw error; }
            if (!analysis.complete || analysis.criteria.children.length) throw new HttpError(400, 'Completează criteriile. Recomandările de grup acceptă momentan numai adulți.');
            const values = analysis.criteria;
            const [rows] = await db.promise().execute(`SELECT h.id_hotel,h.nume_hotel,h.imagine_url,h.stele,o.nume_oras,
                cc.id_categorie,cc.denumire,cc.capacitate,cc.pret_pe_noapte,COUNT(c.id_camera) AS camere_libere
                FROM Hoteluri h JOIN Orase o ON o.id_oras=h.id_oras
                JOIN Categorii_Camere cc ON cc.id_hotel=h.id_hotel JOIN Camere c ON c.id_categorie=cc.id_categorie
                WHERE o.nume_oras=? AND c.status_camera='activa' AND ${freeRoomSQL()}
                GROUP BY h.id_hotel,o.nume_oras,cc.id_categorie ORDER BY h.id_hotel,cc.id_categorie`, [values.city, values.checkout, values.checkin]);
            const budgetCents = values.budget_unit === 'unlimited' ? null : money(values.budget) * (values.budget_unit === 'nightly' ? analysis.nights : 1);
            const hotels = new Map();
            for (const row of rows) {
                if (!hotels.has(row.id_hotel)) hotels.set(row.id_hotel, { hotel: { id_hotel: row.id_hotel, nume_hotel: row.nume_hotel, imagine_url: row.imagine_url, stele: row.stele, nume_oras: row.nume_oras }, categories: [] });
                hotels.get(row.id_hotel).categories.push(row);
            }
            const options = [...hotels.values()].map(({ hotel, categories }) => ({ hotel, plans: recommendRoomPlans(categories, { adults: values.adults, preference: values.room_preference, nights: analysis.nights, budgetCents }) }))
                .filter(option => option.plans.length).sort((a, b) => a.plans[0].totalCents - b.plans[0].totalCents || Number(a.hotel.id_hotel) - Number(b.hotel.id_hotel));
            const en = language === 'en';
            return { language, criteria: values, nights: analysis.nights, totalHotels: options.length, hotels: options.slice(0, 5),
                reply: options.length ? (en ? 'These room arrangements fit your group and budget. Review the guests in each room and the whole-stay total. Multiple-room checkout is not available yet; rooms are not held.' : 'Aceste repartizări se încadrează în grupul și bugetul tău. Verifică persoanele din fiecare cameră și totalul sejurului. Checkout-ul pentru mai multe camere nu este disponibil încă; camerele nu sunt blocate.')
                    : (en ? 'No room arrangement fits your dates, group and budget. You can change the dates, city or budget.' : 'Nu am găsit o combinație de camere pentru perioada, grupul și bugetul tău. Poți modifica perioada, orașul sau bugetul.') };
        },
    };
}
module.exports = { createRoomRecommendations };
