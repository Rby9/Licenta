const express = require('express');

// DB este injectată pentru verificări izolate, fără conectare sau scrieri în MySQL.
function createHoteluriRouter(db) {
    const router = express.Router();

    router.get('/api/camere', (req, res) => {
        db.query('SELECT * FROM Camere', (err, r) => {
            if (err) return res.status(500).json({ eroare: 'Eroare camere' });
            res.json(r);
        });
    });

    router.get('/api/orase', (req, res) => {
        db.query(`SELECT o.id_oras, o.nume_oras, o.imagine_url,
                  COUNT(h.id_hotel) AS numar_hoteluri
                  FROM Orase o LEFT JOIN Hoteluri h ON o.id_oras = h.id_oras
                  GROUP BY o.id_oras, o.nume_oras, o.imagine_url ORDER BY numar_hoteluri DESC`,
        (err, r) => {
            if (err) return res.status(500).json({ eroare: 'Eroare orase' });
            res.json(r);
        });
    });

    router.get('/api/hoteluri', (req, res) => {
        const { oras, stele_min, pret_max, sort } = req.query;
        let query = `SELECT h.id_hotel, h.nume_hotel, h.adresa, h.stele, h.descriere,
                            h.imagine_url, h.imagine_2, h.imagine_3, h.oferta_activa, o.nume_oras, MIN(cc.pret_pe_noapte) AS pret_minim
                     FROM Hoteluri h
                     JOIN Orase o ON h.id_oras = o.id_oras
                     LEFT JOIN Categorii_Camere cc ON h.id_hotel = cc.id_hotel`;
        const params = [], conditii = [];
        if (oras)      { conditii.push('o.nume_oras = ?'); params.push(oras); }
        if (stele_min) { conditii.push('h.stele >= ?');    params.push(parseInt(stele_min)); }
        if (conditii.length) query += ' WHERE ' + conditii.join(' AND ');
        query += ' GROUP BY h.id_hotel';
        if (pret_max) { query += ' HAVING pret_minim <= ? OR pret_minim IS NULL'; params.push(parseFloat(pret_max)); }
        const sortMap = { pret_asc:'pret_minim ASC', pret_desc:'pret_minim DESC', stele_asc:'h.stele ASC', stele_desc:'h.stele DESC', nume_asc:'h.nume_hotel ASC' };
        query += ' ORDER BY ' + (sortMap[sort] || 'h.stele DESC');
        db.query(query, params, (err, r) => {
            if (err) return res.status(500).json({ eroare: 'Eroare hoteluri' });
            res.json(r);
        });
    });

    router.get('/api/hoteluri/harta', (req, res) => {
        db.query(`
            SELECT h.id_hotel, h.nume_hotel, h.stele, h.latitudine, h.longitudine,
                   h.imagine_url, o.id_oras, o.nume_oras,
                   MIN(cc.pret_pe_noapte) AS pret_minim
            FROM Hoteluri h
            JOIN Orase o ON h.id_oras = o.id_oras
            LEFT JOIN Categorii_Camere cc ON h.id_hotel = cc.id_hotel
            WHERE h.latitudine IS NOT NULL AND h.longitudine IS NOT NULL
            GROUP BY h.id_hotel, h.nume_hotel, h.stele, h.latitudine, h.longitudine, h.imagine_url, o.id_oras, o.nume_oras
            ORDER BY h.stele DESC`,
        (err, r) => {
            if (err) return res.status(500).json({ eroare: 'Eroare harta hoteluri' });
            res.json(r);
        });
    });

    router.get('/api/hoteluri/search', (req, res) => {
        const { oras, checkin, checkout, guests, stele_min, stele_exact, pret_max, facilitati, sort } = req.query;

        // Subquery pentru camere ocupate în perioada selectată
        let subqueryCamereOcupate = '';
        const paramsOcupate = [];
        if (checkin && checkout) {
            subqueryCamereOcupate = `
                SELECT r.id_camera FROM Rezervari r
                WHERE r.status_rezervare != 'anulata'
                AND r.data_checkin < ? AND r.data_checkout > ?`;
            paramsOcupate.push(checkout, checkin);
        }

        let query = `
            SELECT
                h.id_hotel, h.nume_hotel, h.adresa, h.stele,
                h.descriere, h.imagine_url, h.latitudine, h.longitudine, h.oferta_activa,
                o.nume_oras,
                MIN(cc.pret_pe_noapte) AS pret_minim,
                ${checkin && checkout
                    ? `SUM(CASE WHEN c.id_camera NOT IN (${subqueryCamereOcupate}) THEN 1 ELSE 0 END)`
                    : `COUNT(DISTINCT c.id_camera)`
                } AS camere_disponibile
            FROM Hoteluri h
            JOIN Orase o ON h.id_oras = o.id_oras
            JOIN Categorii_Camere cc ON h.id_hotel = cc.id_hotel
            JOIN Camere c ON cc.id_categorie = c.id_categorie
            WHERE c.status_camera = 'activa'`;

        const params = [...paramsOcupate];

        if (oras)        { query += ' AND o.nume_oras = ?';     params.push(oras); }
        if (stele_exact) { query += ' AND h.stele = ?';         params.push(parseInt(stele_exact)); }
        else if (stele_min) { query += ' AND h.stele >= ?';    params.push(parseInt(stele_min)); }
        if (guests)      { query += ' AND cc.capacitate >= ?';  params.push(parseInt(guests)); }

        if (facilitati) {
            const ids = facilitati.split(',').map(id => parseInt(id)).filter(Boolean);
            if (ids.length > 0) {
                query += ` AND h.id_hotel IN (
                    SELECT hf.id_hotel FROM Hoteluri_Facilitati hf
                    WHERE hf.id_facilitate IN (${ids.map(() => '?').join(',')})
                    GROUP BY hf.id_hotel HAVING COUNT(DISTINCT hf.id_facilitate) = ?)`;
                params.push(...ids, ids.length);
            }
        }

        query += ' GROUP BY h.id_hotel';
        if (pret_max) { query += ' HAVING pret_minim <= ?'; params.push(parseFloat(pret_max)); }

        const sortMap = {
            pret_asc:    'pret_minim ASC',
            pret_desc:   'pret_minim DESC',
            stele_asc:   'h.stele ASC',
            stele_desc:  'h.stele DESC',
            nume_asc:    'h.nume_hotel ASC',
            disponibile: 'camere_disponibile DESC',
        };
        query += ' ORDER BY ' + (sortMap[sort] || 'h.stele DESC');

        db.query(query, params, (err, results) => {
            if (err) { console.error('Eroare search:', err.message); return res.status(500).json({ eroare: 'Eroare.' }); }
            res.json(results);
        });
    });

    router.get('/api/hoteluri/:id', (req, res) => {
        db.query(`SELECT h.*, o.nume_oras FROM Hoteluri h JOIN Orase o ON h.id_oras=o.id_oras WHERE h.id_hotel=?`,
        [req.params.id], (err, hotel) => {
            if (err) return res.status(500).json({ eroare: 'Eroare hotel' });
            if (!hotel.length) return res.status(404).json({ eroare: 'Hotel negăsit' });
            db.query(`SELECT * FROM Categorii_Camere WHERE id_hotel=? ORDER BY pret_pe_noapte ASC`,
            [req.params.id], (err2, cat) => {
                if (err2) return res.status(500).json({ eroare: 'Eroare categorii' });
                res.json({ ...hotel[0], categorii_camere: cat });
            });
        });
    });

    router.get('/api/camere/disponibila', (req, res) => {
        const { categorie_id, checkin, checkout } = req.query;
        if (!categorie_id || !checkin || !checkout)
            return res.status(400).json({ eroare: 'Parametri lipsă.' });

        const query = `
            SELECT c.id_camera FROM Camere c
            WHERE c.id_categorie = ?
              AND c.status_camera = 'activa'
              AND c.id_camera NOT IN (
                SELECT r.id_camera FROM Rezervari r
                WHERE r.status_rezervare != 'anulata'
                  AND r.data_checkin  < ?
                  AND r.data_checkout > ?
              )
            LIMIT 1
        `;
        db.query(query, [parseInt(categorie_id), checkout, checkin], (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            if (!results.length)
                return res.status(409).json({ eroare: 'Nu există camere disponibile în perioada selectată.' });
            res.json({ id_camera: results[0].id_camera });
        });
    });

    router.get('/api/hoteluri/:id/galerie', (req, res) => {
        db.query(
            'SELECT * FROM Hoteluri_Galerie WHERE id_hotel=? ORDER BY ordine ASC, id_poza ASC',
            [req.params.id],
            (err, results) => {
                if (err) return res.status(500).json({ eroare: 'Eroare server.' });
                res.json(results);
            }
        );
    });

    router.get('/api/facilitati', (req, res) => {
        db.query('SELECT * FROM Facilitati ORDER BY categorie, nume', (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json(results);
        });
    });

    // Ordinea istorică este păstrată: /:id interceptează încă /cauta.
    // Corecția de rutare se face separat de extragerea codului.
    router.get('/api/hoteluri/cauta', (req, res) => {
        const { oras, checkin, checkout, guests, stele_min, pret_max, facilitati, sort } = req.query;

        let query = `
            SELECT DISTINCT
                h.id_hotel, h.nume_hotel, h.adresa, h.stele,
                h.descriere, h.imagine_url, h.latitudine, h.longitudine, h.oferta_activa,
                o.nume_oras,
                MIN(cc.pret_pe_noapte) AS pret_minim,
                COUNT(DISTINCT c.id_camera) AS camere_disponibile
            FROM Hoteluri h
            JOIN Orase o ON h.id_oras = o.id_oras
            JOIN Categorii_Camere cc ON h.id_hotel = cc.id_hotel
            JOIN Camere c ON cc.id_categorie = c.id_categorie
            WHERE c.status_camera = 'activa'
        `;

        const params = [];

        // Filtrare după oraș
        if (oras) { query += ' AND o.nume_oras = ?'; params.push(oras); }

        // Filtrare după stele
        if (stele_min) { query += ' AND h.stele >= ?'; params.push(parseInt(stele_min)); }

        // Filtrare după capacitate (nr persoane)
        if (guests) { query += ' AND cc.capacitate >= ?'; params.push(parseInt(guests)); }

        // Disponibilitate — excludem camerele ocupate în perioada selectată
        if (checkin && checkout) {
            query += `
                AND c.id_camera NOT IN (
                    SELECT r.id_camera FROM Rezervari r
                    WHERE r.status_rezervare != 'anulata'
                    AND r.data_checkin < ? AND r.data_checkout > ?
                )
            `;
            params.push(checkout, checkin);
        }

        // Filtrare după facilități (hotelul trebuie să aibă TOATE facilitățile selectate)
        if (facilitati) {
            const ids = facilitati.split(',').map(id => parseInt(id)).filter(Boolean);
            if (ids.length > 0) {
                query += `
                    AND h.id_hotel IN (
                        SELECT hf.id_hotel FROM Hoteluri_Facilitati hf
                        WHERE hf.id_facilitate IN (${ids.map(() => '?').join(',')})
                        GROUP BY hf.id_hotel
                        HAVING COUNT(DISTINCT hf.id_facilitate) = ?
                    )
                `;
                params.push(...ids, ids.length);
            }
        }

        query += ' GROUP BY h.id_hotel';

        // Filtrare după preț maxim
        if (pret_max) {
            query += ' HAVING pret_minim <= ?';
            params.push(parseFloat(pret_max));
        }

        // Sortare
        const sortMap = {
            'pret_asc':    'pret_minim ASC',
            'pret_desc':   'pret_minim DESC',
            'stele_asc':   'h.stele ASC',
            'stele_desc':  'h.stele DESC',
            'nume_asc':    'h.nume_hotel ASC',
            'disponibile': 'camere_disponibile DESC',
        };
        query += ' ORDER BY ' + (sortMap[sort] || 'h.stele DESC');

        db.query(query, params, (err, results) => {
            if (err) {
                console.error('Eroare cauta:', err.message);
                return res.status(500).json({ eroare: 'Eroare la căutare.' });
            }
            res.json(results);
        });
    });

    router.get('/api/hoteluri/:id/disponibilitate', (req, res) => {
        const { checkin, checkout, guests } = req.query;
        const { id } = req.params;

        let query = `
            SELECT
                cc.id_categorie, cc.denumire, cc.capacitate,
                cc.pret_pe_noapte, cc.descriere,
                COUNT(c.id_camera) AS total_camere,
                COUNT(c.id_camera) - COALESCE(
                    (SELECT COUNT(*) FROM Camere c2
                     JOIN Rezervari r ON c2.id_camera = r.id_camera
                     WHERE c2.id_categorie = cc.id_categorie
                     AND r.status_rezervare != 'anulata'
                     AND r.data_checkin < ? AND r.data_checkout > ?), 0
                ) AS camere_libere
            FROM Categorii_Camere cc
            JOIN Camere c ON cc.id_categorie = c.id_categorie
            WHERE cc.id_hotel = ?
            AND c.status_camera = 'activa'
        `;

        const params = [
            checkout || '9999-12-31',
            checkin  || '0000-01-01',
            id
        ];

        if (guests) {
            query += ' AND cc.capacitate >= ?';
            params.push(parseInt(guests));
        }

        query += ' GROUP BY cc.id_categorie ORDER BY cc.pret_pe_noapte ASC';

        db.query(query, params, (err, results) => {
            if (err) {
                console.error('Eroare disponibilitate:', err.message);
                return res.status(500).json({ eroare: 'Eroare server.' });
            }
            res.json(results);
        });
    });

    router.get('/api/hoteluri/:id/facilitati', (req, res) => {
        db.query(`
            SELECT f.* FROM Facilitati f
            JOIN Hoteluri_Facilitati hf ON f.id_facilitate = hf.id_facilitate
            WHERE hf.id_hotel = ?
            ORDER BY f.categorie, f.nume
        `, [req.params.id], (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json(results);
        });
    });

    return router;
}

module.exports = { createHoteluriRouter };
