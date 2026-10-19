const { createCatalogService } = require('../../services/catalog');
const { escapeHTML } = require('../../services/html');
const { integer, money, date } = require('../../services/validation');

function registerRoutes(app, { db, verificaToken, verificaRol, oriceAdmin, adminHotel, adminBooking, adminMarketing, superAdmin, upload, uploadGalerie, emailTransporter, config, bookings }) {
    const catalog = createCatalogService(db);
    const EMAIL_FROM = config.emailFrom;
    const SITE_URL = config.siteUrl;

    app.get('/api/admin/stats', verificaToken, oriceAdmin, (req, res) => {
        const queries = {
            total_rezervari:   'SELECT COUNT(*) as val FROM Rezervari',
            rezervari_active:  "SELECT COUNT(*) as val FROM Rezervari WHERE status_rezervare='confirmata'",
            total_utilizatori: 'SELECT COUNT(*) as val FROM Utilizatori',
            venituri_totale:   "SELECT COALESCE(SUM(pret_total),0) as val FROM Rezervari WHERE status_rezervare='confirmata'",
            top_hoteluri: `
                SELECT h.nume_hotel, o.nume_oras, h.stele,
                       COUNT(r.id_rezervare) AS nr_rezervari,
                       COALESCE(SUM(CASE WHEN r.status_rezervare='confirmata' THEN r.pret_total ELSE 0 END),0) AS venit_total
                FROM Hoteluri h
                JOIN Orase o ON h.id_oras = o.id_oras
                LEFT JOIN Categorii_Camere cc ON h.id_hotel = cc.id_hotel
                LEFT JOIN Camere c ON cc.id_categorie = c.id_categorie
                LEFT JOIN Rezervari r ON c.id_camera = r.id_camera
                GROUP BY h.id_hotel ORDER BY nr_rezervari DESC LIMIT 5`,
        };

        Promise.all([
            new Promise((resolve, reject) => db.query(queries.total_rezervari, (error, rows) => error ? reject(error) : resolve(rows?.[0]?.val ?? 0))),
            new Promise((resolve, reject) => db.query(queries.rezervari_active, (error, rows) => error ? reject(error) : resolve(rows?.[0]?.val ?? 0))),
            new Promise((resolve, reject) => db.query(queries.total_utilizatori, (error, rows) => error ? reject(error) : resolve(rows?.[0]?.val ?? 0))),
            new Promise((resolve, reject) => db.query(queries.venituri_totale, (error, rows) => error ? reject(error) : resolve(rows?.[0]?.val ?? 0))),
            new Promise((resolve, reject) => db.query(queries.top_hoteluri, (error, rows) => error ? reject(error) : resolve(rows || []))),
        ]).then(([total_rezervari, rezervari_active, total_utilizatori, venituri_totale, top_hoteluri]) => {
            res.json({ total_rezervari, rezervari_active, total_utilizatori, venituri_totale, top_hoteluri });
        }).catch(() => res.status(500).json({ eroare: 'Eroare server.' }));
    });

    app.get('/api/admin/rezervari', verificaToken, verificaRol('super_admin', 'admin_hotel', 'admin_booking', 'admin_marketing'), (req, res) => {
        db.query(`
            SELECT r.*, u.nume_complet, u.email,
                   h.nume_hotel, o.nume_oras, cc.denumire AS tip_camera
            FROM Rezervari r
            JOIN Utilizatori u ON r.id_utilizator = u.id_utilizator
            JOIN Camere c ON r.id_camera = c.id_camera
            JOIN Categorii_Camere cc ON c.id_categorie = cc.id_categorie
            JOIN Hoteluri h ON cc.id_hotel = h.id_hotel
            JOIN Orase o ON h.id_oras = o.id_oras
            ORDER BY r.data_crearii DESC
        `, (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json(results);
        });
    });

    app.patch('/api/admin/rezervari/:id/status', verificaToken, verificaRol('super_admin', 'admin_hotel', 'admin_booking'), async (req, res) => {
        await bookings.changeStatus(req.params.id, req.body.status);
        res.json({ mesaj: 'Status actualizat.' });
    });

    app.get('/api/admin/utilizatori', verificaToken, verificaRol('super_admin','admin_booking','admin_marketing'), (req, res) => {
        db.query(`
            SELECT u.id_utilizator, u.nume_complet, u.email, u.telefon, u.rol, u.email_marketing,
                   COUNT(r.id_rezervare) AS nr_rezervari
            FROM Utilizatori u
            LEFT JOIN Rezervari r ON u.id_utilizator = r.id_utilizator
            GROUP BY u.id_utilizator ORDER BY u.id_utilizator DESC
        `, (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json(results);
        });
    });

    app.patch('/api/admin/utilizatori/:id/rol', verificaToken, superAdmin, (req, res) => {
        const { rol } = req.body;
        const ROLURI_VALIDE = ['super_admin', 'admin_hotel', 'admin_marketing', 'admin_booking', 'client'];
        if (!ROLURI_VALIDE.includes(rol))
            return res.status(400).json({ eroare: 'Rol invalid.' });
        db.query('UPDATE Utilizatori SET rol=? WHERE id_utilizator=?',
            [rol, req.params.id],
            (err) => {
                if (err) return res.status(500).json({ eroare: 'Eroare server.' });
                res.json({ mesaj: 'Rol actualizat.' });
            }
        );
    });

    app.post('/api/admin/hoteluri', verificaToken, adminHotel, async (req, res) => {
        const id = await catalog.createHotel(req.body);
        res.status(201).json({ mesaj: 'Hotel adăugat.', id_hotel: id });
    });

    app.put('/api/admin/hoteluri/:id', verificaToken, adminHotel, async (req, res) => {
        await catalog.updateHotel(req.params.id, req.body);
        res.json({ mesaj: 'Hotel actualizat.' });
    });

    app.post('/api/admin/hoteluri/:id/poze', verificaToken, adminHotel, upload.array('poze', 3), (req, res) => {
        if (!req.files || req.files.length === 0)
            return res.status(400).json({ eroare: 'Niciun fișier primit.' });

        const urls = req.files.map(f => `/uploads/${f.filename}`);
        const imagine_url = urls[0] || null;
        const imagine_2   = urls[1] || null;
        const imagine_3   = urls[2] || null;

        // Salvăm doar câmpurile care au fișiere (nu suprascriem cu null cele existente)
        let setClauses = [];
        let params = [];
        if (imagine_url) { setClauses.push('imagine_url=?'); params.push(imagine_url); }
        if (imagine_2)   { setClauses.push('imagine_2=?');   params.push(imagine_2); }
        if (imagine_3)   { setClauses.push('imagine_3=?');   params.push(imagine_3); }
        params.push(req.params.id);

        db.query(`UPDATE Hoteluri SET ${setClauses.join(',')} WHERE id_hotel=?`,
            params,
            (err) => {
                if (err) return res.status(500).json({ eroare: 'Eroare server.' });
                res.json({ mesaj: `${urls.length} poze salvate!`, imagine_url, imagine_2, imagine_3 });
            }
        );
    });

    app.delete('/api/admin/hoteluri/:id', verificaToken, adminHotel, async (req, res) => {
        await catalog.deleteHotel(req.params.id);
        res.json({ mesaj: 'Hotel șters.' });
    });

    app.post('/api/admin/orase', verificaToken, adminHotel, (req, res) => {
        const { nume_oras, imagine_url } = req.body;
        if (!nume_oras) return res.status(400).json({ eroare: 'Numele orașului este obligatoriu.' });
        db.query('INSERT INTO Orase (nume_oras, imagine_url) VALUES (?, ?)', [nume_oras, imagine_url||null], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY')
                    return res.status(409).json({ eroare: 'Acest oraș există deja.' });
                return res.status(500).json({ eroare: 'Eroare server.' });
            }
            res.status(201).json({ mesaj: 'Oraș adăugat.', id_oras: result.insertId });
        });
    });

    app.post('/api/admin/categorii', verificaToken, adminHotel, async (req, res) => {
        const category = await catalog.createCategory(req.body);
        res.status(201).json({ mesaj: 'Categoria și camerele au fost adăugate.', ...category });
    });

    app.put('/api/admin/categorii/:id', verificaToken, adminHotel, (req, res) => {
        const { denumire, capacitate, pret_pe_noapte, descriere } = req.body;
        integer(capacitate ?? 2, 'Capacitate'); money(pret_pe_noapte);
        if (!denumire || !pret_pe_noapte)
            return res.status(400).json({ eroare: 'Denumirea și prețul sunt obligatorii.' });
        db.query(
            'UPDATE Categorii_Camere SET denumire=?, capacitate=?, pret_pe_noapte=?, descriere=? WHERE id_categorie=?',
            [denumire, capacitate || 2, pret_pe_noapte, descriere || null, req.params.id],
            (err) => {
                if (err) return res.status(500).json({ eroare: 'Eroare server.' });
                res.json({ mesaj: 'Categorie actualizată.' });
            }
        );
    });

    app.delete('/api/admin/categorii/:id', verificaToken, adminHotel, async (req, res) => {
        await catalog.deleteCategory(req.params.id);
        res.json({ mesaj: 'Categorie ștearsă.' });
    });

    app.patch('/api/admin/hoteluri/:id/oferta', verificaToken, verificaRol('super_admin', 'admin_hotel', 'admin_marketing'), (req, res) => {
        db.query('UPDATE Hoteluri SET oferta_activa = NOT oferta_activa WHERE id_hotel = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json({ mesaj: 'Ofertă actualizată.' });
        });
    });

    app.get('/api/admin/coduri', verificaToken, adminMarketing, (req, res) => {
        db.query('SELECT * FROM Coduri_Reducere ORDER BY data_creare DESC', (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json(results);
        });
    });

    app.post('/api/admin/coduri', verificaToken, adminMarketing, (req, res) => {
        const { cod, procent_reducere, descriere, data_start, data_expirare, utilizari_maxime } = req.body;
        if (typeof cod !== 'string' || !cod.trim() || !procent_reducere)
            return res.status(400).json({ eroare: 'Codul și procentul sunt obligatorii.' });
        integer(procent_reducere, 'Procent', 1, 90);
        if (cod.length > 30) return res.status(400).json({ eroare: 'Codul poate avea maximum 30 de caractere.' });
        if (data_start) date(data_start); if (data_expirare) date(data_expirare);
        if (data_start && data_expirare && data_expirare < data_start) return res.status(400).json({ eroare: 'Perioadă invalidă.' });
        if (procent_reducere < 1 || procent_reducere > 90)
            return res.status(400).json({ eroare: 'Procentul trebuie să fie între 1 și 90.' });
        const maxUt = utilizari_maxime ? integer(utilizari_maxime, 'Număr utilizări') : null;
        if (maxUt !== null && (isNaN(maxUt) || maxUt < 1))
            return res.status(400).json({ eroare: 'Numărul de utilizări trebuie să fie cel puțin 1.' });
        db.query(
            'INSERT INTO Coduri_Reducere (cod, procent_reducere, descriere, data_start, data_expirare, utilizari_maxime) VALUES (?, ?, ?, ?, ?, ?)',
            [cod.toUpperCase().trim(), procent_reducere, descriere || null, data_start || null, data_expirare || null, maxUt],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY')
                        return res.status(409).json({ eroare: 'Există deja un cod cu acest nume.' });
                    return res.status(500).json({ eroare: 'Eroare server.' });
                }
                res.status(201).json({ mesaj: 'Cod creat.', id_cod: result.insertId });
            }
        );
    });

    app.patch('/api/admin/coduri/:id/toggle', verificaToken, adminMarketing, (req, res) => {
        db.query('UPDATE Coduri_Reducere SET activ = NOT activ WHERE id_cod = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json({ mesaj: 'Status actualizat.' });
        });
    });

    app.delete('/api/admin/coduri/:id', verificaToken, adminMarketing, (req, res) => {
        db.query('DELETE FROM Coduri_Reducere WHERE id_cod = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json({ mesaj: 'Cod șters.' });
        });
    });

    app.get('/api/admin/oferte-sezon', verificaToken, adminMarketing, (req, res) => {
        db.query('SELECT * FROM Oferte_Sezon ORDER BY created_at ASC', (err, r) => {
            if (err) return res.status(500).json({ eroare: 'Eroare' });
            res.json(r);
        });
    });

    app.patch('/api/admin/oferte-sezon/:id/toggle', verificaToken, adminMarketing, (req, res) => {
        db.query('UPDATE Oferte_Sezon SET activa = NOT activa WHERE id_oferta = ?', [req.params.id], err => {
            if (err) return res.status(500).json({ eroare: 'Eroare toggle' });
            res.json({ ok: true });
        });
    });

    app.patch('/api/admin/oferte-sezon/:id', verificaToken, adminMarketing, (req, res) => {
        const { discount_procent, data_start, data_sfarsit, descriere } = req.body;
        integer(discount_procent, 'Reducere', 0, 100);
        if (data_start) date(data_start); if (data_sfarsit) date(data_sfarsit);
        if (data_start && data_sfarsit && data_sfarsit < data_start) return res.status(400).json({ eroare: 'Perioadă invalidă.' });
        db.query(
            'UPDATE Oferte_Sezon SET discount_procent=?, data_start=?, data_sfarsit=?, descriere=? WHERE id_oferta=?',
            [discount_procent, data_start, data_sfarsit, descriere, req.params.id],
            err => {
                if (err) return res.status(500).json({ eroare: 'Eroare actualizare' });
                res.json({ ok: true });
            }
        );
    });

    app.post('/api/admin/hoteluri/:id/galerie', verificaToken, adminHotel,
        uploadGalerie.array('galerie', 10), (req, res) => {
        if (!req.files || req.files.length === 0)
            return res.status(400).json({ eroare: 'Niciun fișier primit.' });

        const rows = req.files.map((f, i) => [
            req.params.id,
            `/uploads/${f.filename}`,
            req.body.titlu || null,
            i
        ]);

        db.query(
            'INSERT INTO Hoteluri_Galerie (id_hotel, imagine_url, titlu, ordine) VALUES ?',
            [rows],
            (err, result) => {
                if (err) return res.status(500).json({ eroare: 'Eroare server.' });
                res.status(201).json({ mesaj: `${req.files.length} poze adăugate!`, count: req.files.length });
            }
        );
    });

    app.delete('/api/admin/galerie/:id_poza', verificaToken, adminHotel, (req, res) => {
        db.query('DELETE FROM Hoteluri_Galerie WHERE id_poza=?', [req.params.id_poza], (err) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json({ mesaj: 'Poză ștearsă.' });
        });
    });

    app.get('/api/admin/plati/lista', verificaToken, adminBooking, (req, res) => {
        db.query(`
            SELECT r.id_rezervare, r.pret_total, r.comision_platforma, r.suma_hotel,
                   r.stripe_session_id, r.data_crearii, r.status_rezervare,
                   r.data_checkin, r.data_checkout,
                   u.nume_complet, u.email,
                   h.nume_hotel, o.nume_oras, cc.denumire AS tip_camera
            FROM Rezervari r
            JOIN Utilizatori u ON r.id_utilizator = u.id_utilizator
            JOIN Camere c ON r.id_camera = c.id_camera
            JOIN Categorii_Camere cc ON c.id_categorie = cc.id_categorie
            JOIN Hoteluri h ON cc.id_hotel = h.id_hotel
            JOIN Orase o ON h.id_oras = o.id_oras
            WHERE r.stripe_session_id IS NOT NULL
            ORDER BY r.data_crearii DESC
        `, (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json(results);
        });
    });

    app.get('/api/admin/plati/stats', verificaToken, adminBooking, (req, res) => {
        db.query(`
            SELECT
                COUNT(*) AS total_rezervari,
                COALESCE(SUM(pret_total), 0) AS venituri_totale,
                COALESCE(SUM(comision_platforma), 0) AS comisioane_totale,
                COALESCE(SUM(suma_hotel), 0) AS sume_hoteluri
            FROM Rezervari
            WHERE status_rezervare = 'confirmata'
            AND stripe_session_id IS NOT NULL
        `, (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json(results[0]);
        });
    });

    app.post('/api/admin/marketing/email', verificaToken, adminMarketing, async (req, res) => {
        const { subiect, continut } = req.body;
        if (!subiect || !continut)
            return res.status(400).json({ eroare: 'Subiectul și conținutul sunt obligatorii.' });

        db.query('SELECT email, nume_complet FROM Utilizatori WHERE email_marketing = 1 AND rol = "client"', async (err, users) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            if (!users.length) return res.status(200).json({ mesaj: 'Nu există utilizatori abonați la newsletter.', trimise: 0 });

            let trimise = 0;
            for (const u of users) {
                try {
                    await emailTransporter.sendMail({
                        from: EMAIL_FROM,
                        to: u.email,
                        subject: subiect,
                        html: `
                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0A0E23">
                          <div style="background:#0A0E23;padding:30px 40px">
                            <h1 style="color:#C4A050;margin:0;font-size:26px">HoteluriRo</h1>
                            <p style="color:rgba(255,255,255,0.5);margin:6px 0 0;font-size:13px">Ofertă specială</p>
                          </div>
                          <div style="padding:32px 40px;background:#fff;border:1px solid #eee">
                            <p style="font-size:15px">Bună, <strong>${escapeHTML(u.nume_complet)}</strong>!</p>
                            <div style="font-size:15px;line-height:1.7">${continut.replace(/\n/g, '<br>')}</div>
                            <a href="${SITE_URL}/hoteluri" style="display:inline-block;background:#C4A050;color:#0A0E23;padding:12px 28px;text-decoration:none;border-radius:2px;font-weight:700;font-size:14px;margin-top:24px">
                              Vezi ofertele
                            </a>
                            <p style="font-size:11px;color:#aaa;margin-top:24px">
                              Ai primit acest email deoarece ești abonat la newsletter-ul HoteluriRo.<br>
                              Pentru dezabonare, accesează contul tău și dezactivează opțiunea de newsletter.
                            </p>
                          </div>
                          <div style="padding:20px 40px;background:#0A0E23;text-align:center">
                            <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0">HoteluriRo © ${new Date().getFullYear()}</p>
                          </div>
                        </div>`,
                    });
                    trimise++;
                } catch (e) {
                    console.error(`Email eșuat pentru ${u.email}:`, e.message);
                }
            }
            res.json({ mesaj: `Email trimis către ${trimise} utilizatori.`, trimise });
        });
    });
}

module.exports = { registerRoutes };
