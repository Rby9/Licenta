const { date } = require('../../services/validation');

function registerRoutes(app, { db, verificaToken }) {

    app.get('/api/coduri/valideaza', verificaToken, (req, res) => {
        const { cod, checkin } = req.query;
        if (typeof cod !== 'string' || !cod.trim() || cod.length > 30) return res.status(400).json({ eroare: 'Cod invalid.' });
        if (checkin) date(checkin);
        const dataRef = checkin || null;
        db.query(`
            SELECT id_cod, cod, procent_reducere, descriere, utilizari_maxime, utilizari_curente,
                   data_start, data_expirare
            FROM Coduri_Reducere
            WHERE cod = ? AND activ = 1
            AND (? IS NULL OR data_start IS NULL OR data_start <= ?)
            AND (? IS NULL OR data_expirare IS NULL OR data_expirare >= ?)
            AND (utilizari_maxime IS NULL OR utilizari_curente < utilizari_maxime)
        `, [cod.toUpperCase().trim(), dataRef, dataRef, dataRef, dataRef], (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            if (!results.length) return res.status(404).json({ eroare: 'Cod invalid sau nu se aplică pentru perioada selectată.' });
            res.json(results[0]);
        });
    });

    app.get('/api/oferte-sezon', (req, res) => {
        db.query('SELECT * FROM Oferte_Sezon WHERE activa = 1 ORDER BY data_start ASC', (err, r) => {
            if (err) return res.status(500).json({ eroare: 'Eroare oferte sezon' });
            res.json(r);
        });
    });
}

module.exports = { registerRoutes };
