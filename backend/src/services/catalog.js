const { integer, money } = require('./validation');
const { HttpError } = require('./errors');
const { withTransaction } = require('./transaction');

function text(value, label, max, required = false) {
    if (value == null || value === '') {
        if (required) throw new HttpError(400, `${label} este obligatoriu.`);
        return null;
    }
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new HttpError(400, `${label} invalid.`);
    return value.trim() || null;
}
function coordinates(input, required) {
    const empty = value => value == null || value === '';
    if (empty(input.latitudine) && empty(input.longitudine) && !required) return [null, null];
    return ['latitudine', 'longitudine'].map((key, index) => {
        const value = input[key];
        const limit = index === 0 ? 90 : 180;
        if (empty(value) || !['string', 'number'].includes(typeof value) || !String(value).trim()
            || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > limit) {
            throw new HttpError(400, 'Alege o poziție validă pentru hotel pe hartă.');
        }
        return Number(Number(value).toFixed(8));
    });
}
function hotelValues(input, requiredPosition) {
    return [integer(input.id_oras, 'Oraș'), text(input.nume_hotel, 'Numele hotelului', 150, true),
        text(input.adresa, 'Adresa', 255), integer(input.stele ?? 3, 'Stele', 1, 5), text(input.descriere, 'Descrierea', 15000),
        ...['imagine_url', 'imagine_2', 'imagine_3'].map(key => text(input[key], 'Adresa imaginii', 255)),
        ...coordinates(input, requiredPosition)];
}
function createCatalogService(pool) {
    const db = () => typeof pool.promise === 'function' ? pool.promise() : pool;
    async function createHotel(input) {
        const values = hotelValues(input, true);
        try {
            const [result] = await db().execute(`INSERT INTO Hoteluri
                (id_oras,nume_hotel,adresa,stele,descriere,imagine_url,imagine_2,imagine_3,latitudine,longitudine)
                VALUES (?,?,?,?,?,?,?,?,?,?)`, values);
            return result.insertId;
        } catch (error) {
            if (error.code === 'ER_NO_REFERENCED_ROW_2') throw new HttpError(400, 'Orașul selectat nu există.');
            throw error;
        }
    }
    async function updateHotel(id, input) {
        const values = hotelValues(input, false);
        const [result] = await db().execute(`UPDATE Hoteluri SET id_oras=?,nume_hotel=?,adresa=?,stele=?,descriere=?,
            imagine_url=?,imagine_2=?,imagine_3=?,latitudine=COALESCE(?,latitudine),longitudine=COALESCE(?,longitudine)
            WHERE id_hotel=?`, [...values, integer(id, 'Hotel')]);
        if (!result.affectedRows) throw new HttpError(404, 'Hotelul nu există.');
    }
    async function createCategory(input) {
        const hotelId = integer(input.id_hotel, 'Hotel');
        const name = text(input.denumire, 'Denumirea categoriei', 100, true);
        const capacity = integer(input.capacitate ?? 2, 'Capacitate', 1, 100);
        const price = money(input.pret_pe_noapte);
        if (price <= 0) throw new HttpError(400, 'Prețul trebuie să fie mai mare decât zero.');
        const count = integer(input.numar_camere, 'Număr camere', 1, 500);
        const description = text(input.descriere, 'Descrierea', 15000);
        return withTransaction(pool, async connection => {
            const [hotels] = await connection.execute('SELECT id_hotel FROM Hoteluri WHERE id_hotel=? FOR UPDATE', [hotelId]);
            if (!hotels.length) throw new HttpError(404, 'Hotelul nu există.');
            const [category] = await connection.execute(`INSERT INTO Categorii_Camere
                (id_hotel,denumire,capacitate,pret_pe_noapte,descriere) VALUES (?,?,?,?,?)`, [hotelId, name, capacity, price / 100, description]);
            const rooms = Array.from({ length: count }, (_, index) => [`C${category.insertId}-${index + 1}`, category.insertId]);
            await connection.query('INSERT INTO Camere (numar_camera,id_categorie) VALUES ?', [rooms]);
            return { id_categorie: category.insertId, numar_camere: count };
        });
    }
    async function deleteResource(id, category = false) {
        const resourceId = integer(id, category ? 'Categorie' : 'Hotel');
        return withTransaction(pool, async connection => {
            let hotelId = resourceId;
            if (category) {
                const [initial] = await connection.execute('SELECT id_hotel FROM Categorii_Camere WHERE id_categorie=?', [resourceId]);
                if (!initial.length) throw new HttpError(404, 'Categoria nu există.');
                hotelId = initial[0].id_hotel;
            }
            const [hotel] = await connection.execute('SELECT id_hotel FROM Hoteluri WHERE id_hotel=? FOR UPDATE', [hotelId]);
            if (!hotel.length) throw new HttpError(404, 'Hotelul nu există.');
            if (category) {
                const [rows] = await connection.execute('SELECT id_categorie FROM Categorii_Camere WHERE id_categorie=? FOR UPDATE', [resourceId]);
                if (!rows.length) throw new HttpError(404, 'Categoria nu există.');
            }
            const roomFilter = category ? 'id_categorie=?' : 'id_categorie IN (SELECT id_categorie FROM Categorii_Camere WHERE id_hotel=?)';
            // Same room locks as booking creation: a concurrent reservation cannot slip past the history check.
            const [rooms] = await connection.execute(`SELECT id_camera FROM Camere WHERE ${roomFilter} ORDER BY id_camera FOR UPDATE`, [resourceId]);
            if (rooms.length) {
                const ids = rooms.map(room => room.id_camera);
                const [history] = await connection.execute(`SELECT id_rezervare FROM Rezervari WHERE id_camera IN (${ids.map(() => '?').join(',')}) LIMIT 1 FOR UPDATE`, ids);
                if (history.length) throw new HttpError(409, 'Ștergerea este blocată: există rezervări asociate. Istoricul trebuie păstrat.');
            }
            await connection.execute(category ? 'DELETE FROM Categorii_Camere WHERE id_categorie=?' : 'DELETE FROM Hoteluri WHERE id_hotel=?', [resourceId]);
        });
    }
    return { createHotel, updateHotel, createCategory, deleteHotel: id => deleteResource(id), deleteCategory: id => deleteResource(id, true) };

}
module.exports = { createCatalogService, coordinates };
