const { sendNotification } = require('../../services/notifications');
const { escapeHTML } = require('../../services/html');
const { genereazaPDFBuffer } = require('../../services/pdf');

function registerRoutes(app, { db, verificaToken, ADMIN_ROLES, emailTransporter, config, bookings }) {
    const EMAIL_FROM = config.emailFrom;

    app.get('/api/rezervari/mele', verificaToken, (req, res) => {
        const query = `
            SELECT r.*, h.id_hotel, h.nume_hotel, h.adresa, h.stele, o.nume_oras,
                   cc.denumire AS tip_camera, cc.capacitate, cc.pret_pe_noapte
            FROM Rezervari r
            JOIN Camere c    ON r.id_camera   = c.id_camera
            JOIN Categorii_Camere cc ON c.id_categorie = cc.id_categorie
            JOIN Hoteluri h  ON cc.id_hotel   = h.id_hotel
            JOIN Orase o     ON h.id_oras     = o.id_oras
            WHERE r.id_utilizator = ?
            ORDER BY r.data_crearii DESC
        `;
        db.query(query, [req.user.id], (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json(results);
        });
    });

    app.patch('/api/rezervari/:id/anulare', verificaToken, (req, res) => {
        const { id } = req.params;

        const queryFull = `
            SELECT r.*, u.email, u.nume_complet,
                   h.nume_hotel, o.nume_oras, cc.denumire AS tip_camera
            FROM Rezervari r
            JOIN Utilizatori u ON r.id_utilizator = u.id_utilizator
            JOIN Camere c ON r.id_camera = c.id_camera
            JOIN Categorii_Camere cc ON c.id_categorie = cc.id_categorie
            JOIN Hoteluri h ON cc.id_hotel = h.id_hotel
            JOIN Orase o ON h.id_oras = o.id_oras
            WHERE r.id_rezervare = ? AND r.id_utilizator = ?`;

        db.query(queryFull, [id, req.user.id], (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            if (!results.length) return res.status(404).json({ eroare: 'Rezervarea nu a fost găsită.' });

            const r = results[0];
            if (r.status_rezervare === 'anulata')
                return res.status(400).json({ eroare: 'Rezervarea este deja anulată.' });

            const checkin = new Date(r.data_checkin);
            const diffOre = (checkin - new Date()) / (1000 * 60 * 60);
            if (diffOre <= 24)
                return res.status(400).json({ eroare: 'Nu mai poți anula cu mai puțin de 24h înainte de check-in.' });

            bookings.changeStatus(id, 'anulata', { userId: req.user.id, cancellation: true }).then(() => {


                // Email confirmare anulare
                const fmtD = (s) => s ? new Date(s).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
                sendNotification(() => emailTransporter.sendMail({
                    from: EMAIL_FROM,
                    to:      r.email,
                    subject: `Rezervare #${r.id_rezervare} anulată — HoteluriRo`,
                    html: `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0d5c0">
                      <div style="background:#0A0E23;padding:28px 32px">
                        <h1 style="font-family:Georgia,serif;color:#C4A050;margin:0;font-size:1.6rem">HoteluriRo</h1>
                      </div>
                      <div style="padding:32px">
                        <h2 style="font-family:Georgia,serif;color:#0A0E23;margin:0 0 8px">Rezervare anulată</h2>
                        <p style="color:#666;margin:0 0 24px">Bună, <strong>${escapeHTML(r.nume_complet)}</strong>!</p>
                        <p style="color:#555;margin:0 0 20px">Rezervarea ta la <strong>${escapeHTML(r.nume_hotel)}</strong> (${escapeHTML(r.nume_oras)}) a fost anulată cu succes.</p>
                        <div style="background:#fdf8f0;border:1px solid #e8d9b0;border-radius:6px;padding:20px;margin-bottom:24px">
                          <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
                            <tr><td style="color:#888;padding:5px 0">Număr rezervare</td><td style="text-align:right;font-weight:600;color:#0A0E23">#${r.id_rezervare}</td></tr>
                            <tr><td style="color:#888;padding:5px 0">Hotel</td><td style="text-align:right;font-weight:600;color:#0A0E23">${escapeHTML(r.nume_hotel)}</td></tr>
                            <tr><td style="color:#888;padding:5px 0">Cameră</td><td style="text-align:right;color:#0A0E23">${escapeHTML(r.tip_camera)}</td></tr>
                            <tr><td style="color:#888;padding:5px 0">Check-in</td><td style="text-align:right;color:#0A0E23">${fmtD(r.data_checkin)}</td></tr>
                            <tr><td style="color:#888;padding:5px 0">Check-out</td><td style="text-align:right;color:#0A0E23">${fmtD(r.data_checkout)}</td></tr>
                          </table>
                        </div>
                        <p style="color:#555;font-size:0.88rem">Rezervarea a fost anulată. Pentru plățile online, verifică separat starea rambursării cu administratorul.</p>
                        <hr style="border:none;border-top:1px solid #e8d9b0;margin:24px 0">
                        <p style="color:#aaa;font-size:0.8rem;margin:0">© 2025 HoteluriRo</p>
                      </div>
                    </div>`,
                }), 'Email anulare indisponibil.');

                res.json({ mesaj: 'Rezervare anulată cu succes.' });
            }).catch(error => res.status(error.status || 500).json({ eroare: error.status ? error.message : 'Eroare la anulare.' }));
        });
    });

    app.get('/api/rezervari/:id/factura', verificaToken, (req, res) => {
        const query = `
            SELECT r.*,
                   u.nume_complet, u.email, u.telefon,
                   h.nume_hotel, h.adresa AS adresa_hotel, h.stele,
                   o.nume_oras,
                   cc.denumire AS tip_camera, COALESCE(gc.pret_pe_noapte,cc.pret_pe_noapte) AS pret_pe_noapte
            FROM Rezervari r
            JOIN Utilizatori u   ON r.id_utilizator = u.id_utilizator
            JOIN Camere c        ON r.id_camera = c.id_camera
            JOIN Categorii_Camere cc ON c.id_categorie = cc.id_categorie
            JOIN Hoteluri h      ON cc.id_hotel = h.id_hotel
            JOIN Orase o         ON h.id_oras = o.id_oras
            LEFT JOIN Rezervari_Grup_Camere gc ON gc.id_linie_grup=r.id_linie_grup
            WHERE r.id_rezervare = ?
        `;

        db.query(query, [req.params.id], async (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            if (!results.length) return res.status(404).json({ eroare: 'Rezervarea nu există.' });

            const r = results[0];

            // Verificăm că rezervarea aparține userului logat (sau e admin)
            if (r.id_utilizator !== req.user.id && !ADMIN_ROLES.includes(req.user.rol)) {
                return res.status(403).json({ eroare: 'Acces neautorizat.' });
            }

            try {
                const buffer = await genereazaPDFBuffer(r);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="Factura_HoteluriRo_${r.id_rezervare}.pdf"`);
                return res.send(buffer);
            } catch (e) {
                console.error('PDF error:', e.message);
                return res.status(500).json({ eroare: 'Eroare la generarea PDF.' });
            }
        });
    });
}

module.exports = { registerRoutes };

function registerCreation(app, { verificaToken, bookings, notify }) {
    const create = async (req, res) => {
        const reservation = await bookings.book(req.user.id, req.body);
        sendNotification(() => notify(reservation), 'Email confirmare indisponibil.');
        res.status(201).json({ ...reservation, mesaj: 'Rezervare creată cu succes!' });
    };
    app.post('/api/rezervari', verificaToken, create);
    app.post('/api/rezervari/cash', verificaToken, create);
    app.post('/api/rezervari/oferta-pret', verificaToken, async (req, res) => {
        const quote = await bookings.quote(req.body);
        res.json({ pret_total: quote.totalCents / 100, suma_avans: quote.advanceCents / 100, nopti: quote.nights });
    });
}
module.exports.registerCreation = registerCreation;
