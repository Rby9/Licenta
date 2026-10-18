const { integer } = require('../../services/validation');

function registerRoutes(app, { db, verificaToken }) {

    app.get('/api/hoteluri/:id/recenzii', (req, res) => {
        db.query(`
            SELECT re.id_recenzie, re.rating, re.comentariu, re.data_recenziei,
                   u.nume_complet
            FROM Recenzii re
            JOIN Utilizatori u ON re.id_utilizator = u.id_utilizator
            WHERE re.id_hotel = ?
            ORDER BY re.data_recenziei DESC
        `, [req.params.id], (err, rows) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json(rows);
        });
    });

    app.post('/api/hoteluri/:id/recenzii', verificaToken, (req, res) => {
        const idHotel = integer(req.params.id, 'Hotel');
        const idUser  = req.user.id;
        const { rating, comentariu } = req.body;

        if (!Number.isInteger(rating) || rating < 1 || rating > 5 || (comentariu != null && (typeof comentariu !== 'string' || comentariu.length > 5000)))
            return res.status(400).json({ eroare: 'Rating-ul trebuie să fie între 1 și 5.' });

        // Verifică că userul a avut o rezervare confirmată la acest hotel (cu checkout în trecut)
        const verifQ = `
            SELECT r.id_rezervare FROM Rezervari r
            JOIN Camere c ON r.id_camera = c.id_camera
            JOIN Categorii_Camere cc ON c.id_categorie = cc.id_categorie
            WHERE cc.id_hotel = ? AND r.id_utilizator = ?
              AND r.status_rezervare = 'confirmata'
              AND r.data_checkout < NOW()
            LIMIT 1`;

        db.query(verifQ, [idHotel, idUser], (err, rows) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            if (!rows.length)
                return res.status(403).json({ eroare: 'Poți recenza doar hotelurile unde ai stat.' });

            db.query(
                'INSERT INTO Recenzii (id_hotel, id_utilizator, rating, comentariu) VALUES (?,?,?,?)',
                [idHotel, idUser, rating, comentariu || null],
                (err2) => {
                    if (err2) {
                        if (err2.code === 'ER_DUP_ENTRY')
                            return res.status(409).json({ eroare: 'Ai lăsat deja o recenzie pentru acest hotel.' });
                        return res.status(500).json({ eroare: 'Eroare server.' });
                    }
                    res.status(201).json({ mesaj: 'Recenzie adăugată!' });
                }
            );
        });
    });
}

module.exports = { registerRoutes };
