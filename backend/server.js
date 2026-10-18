require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const express    = require('express');
const mysql      = require('mysql2');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const port = 5001;

const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// Adapt legacy local image URLs in responses without changing stored MySQL data.
app.set('json replacer', (_key, value) =>
    typeof value === 'string'
        ? value.replace(/^http:\/\/(?:localhost|127\.0\.0\.1):500[01]\/uploads\//, '/uploads/')
        : value
);

// ─── Upload poze hoteluri ──────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename:    (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `hotel_${req.params.id || 'nou'}_${Date.now()}${ext}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        allowed.includes(path.extname(file.originalname).toLowerCase())
            ? cb(null, true) : cb(new Error('Doar JPG, PNG sau WEBP.'));
    },
});
app.use('/uploads', express.static(uploadsDir));

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'licenta_booking'
});

db.connect((err) => {
    if (err) console.error('❌ Eroare MySQL:', err.message);
    else     console.log('✅ Conectat la licenta_booking!');
});

const verificaToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ eroare: 'Token lipsă.' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ eroare: 'Token invalid.' });
        req.user = user; next();
    });
};

app.get('/api/camere', (req, res) => {
    db.query('SELECT * FROM Camere', (err, r) => {
        if (err) return res.status(500).json({ eroare: 'Eroare camere' });
        res.json(r);
    });
});

app.get('/api/orase', (req, res) => {
    db.query(`SELECT o.id_oras, o.nume_oras, o.imagine_url,
              COUNT(h.id_hotel) AS numar_hoteluri
              FROM Orase o LEFT JOIN Hoteluri h ON o.id_oras = h.id_oras
              GROUP BY o.id_oras, o.nume_oras, o.imagine_url ORDER BY numar_hoteluri DESC`,
    (err, r) => {
        if (err) return res.status(500).json({ eroare: 'Eroare orase' });
        res.json(r);
    });
});

app.get('/api/hoteluri', (req, res) => {
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

app.get('/api/hoteluri/harta', (req, res) => {
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

app.get('/api/hoteluri/search', (req, res) => {
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

app.get('/api/hoteluri/:id', (req, res) => {
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

// ══ REGISTER ══
const DOMENII_ACCEPTATE = [
    'gmail.com', 'yahoo.com', 'yahoo.ro', 'hotmail.com', 'outlook.com',
    'icloud.com', 'live.com', 'protonmail.com', 'proton.me', 'me.com',
    'mail.com', 'gmx.com', 'zoho.com', 'aol.com', 'ymail.com',
    'googlemail.com', 'hotmail.ro', 'live.ro', 'msn.com',
];

app.post('/api/auth/register', async (req, res) => {
    const { nume_complet, email, parola, telefon, email_marketing } = req.body;
    if (!nume_complet || !email || !parola)
        return res.status(400).json({ eroare: 'Câmpurile nume, email și parolă sunt obligatorii.' });
    if (parola.length < 6)
        return res.status(400).json({ eroare: 'Parola trebuie să aibă cel puțin 6 caractere.' });

    const domeniu = email.split('@')[1]?.toLowerCase();
    if (!domeniu || !DOMENII_ACCEPTATE.includes(domeniu))
        return res.status(400).json({ eroare: `Adresa de email nu este acceptată. Folosește un email de la: Gmail, Yahoo, Outlook, iCloud sau similare.` });
    db.query('SELECT id_utilizator FROM Utilizatori WHERE email=?', [email], async (err, r) => {
        if (err) return res.status(500).json({ eroare: 'Eroare server.' });
        if (r.length) return res.status(409).json({ eroare: 'Există deja un cont cu această adresă de email.' });
        const hash = await bcrypt.hash(parola, 10);
        db.query(
            `INSERT INTO Utilizatori (nume_complet,email,parola,telefon,rol,email_marketing) VALUES (?,?,?,?,'client',?)`,
            [nume_complet, email, hash, telefon || null, email_marketing ? 1 : 0],
            async (err2, result) => {
                if (err2) return res.status(500).json({ eroare: 'Eroare la crearea contului.' });
                trimiteEmailBunVenit(email, nume_complet).catch(e => console.error('Email bun venit:', e.message));
                res.status(201).json({ mesaj: 'Cont creat cu succes!', id_utilizator: result.insertId });
            }
        );
    });
});

// ══ LOGIN ══
app.post('/api/auth/login', (req, res) => {
    const { email, parola } = req.body;
    if (!email || !parola)
        return res.status(400).json({ eroare: 'Email și parola sunt obligatorii.' });
    db.query('SELECT * FROM Utilizatori WHERE email=?', [email], async (err, r) => {
        if (err) return res.status(500).json({ eroare: 'Eroare server.' });
        if (!r.length) return res.status(401).json({ eroare: 'Email sau parolă incorecte.' });
        const user = r[0];
        const ok = await bcrypt.compare(parola, user.parola);
        if (!ok) return res.status(401).json({ eroare: 'Email sau parolă incorecte.' });
        const token = jwt.sign(
            { id: user.id_utilizator, email: user.email, rol: user.rol },
            JWT_SECRET, { expiresIn: '7d' }
        );
        res.json({ token, utilizator: {
            id: user.id_utilizator, nume_complet: user.nume_complet,
            email: user.email, telefon: user.telefon, rol: user.rol
        }});
    });
});

// ══ CAMERĂ DISPONIBILĂ ══
//  GET /api/camere/disponibila?categorie_id=1&checkin=2025-07-10&checkout=2025-07-13
//  Returnează prima cameră activă din categoria respectivă care nu are rezervare în perioada dată
app.get('/api/camere/disponibila', (req, res) => {
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

// ══ CREARE REZERVARE ══
//  POST /api/rezervari  (protejat — necesită token)
//  Body: { id_camera, data_checkin, data_checkout, pret_total }
app.post('/api/rezervari', verificaToken, (req, res) => {
    const { id_camera, data_checkin, data_checkout, pret_total } = req.body;
    if (!id_camera || !data_checkin || !data_checkout || !pret_total)
        return res.status(400).json({ eroare: 'Câmpuri obligatorii lipsă.' });

    db.query(
        `INSERT INTO Rezervari (id_utilizator, id_camera, data_checkin, data_checkout, pret_total, status_rezervare)
         VALUES (?, ?, ?, ?, ?, 'confirmata')`,
        [req.user.id, id_camera, data_checkin, data_checkout, pret_total],
        (err, result) => {
            if (err) return res.status(500).json({ eroare: 'Eroare la salvarea rezervării.' });
            res.status(201).json({
                mesaj: 'Rezervare creată cu succes!',
                id_rezervare: result.insertId
            });
        }
    );
});

// ══ REZERVĂRILE USERULUI ══
//  GET /api/rezervari/mele  (protejat)
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

// ══ ANULARE REZERVARE ══
//  PATCH /api/rezervari/:id/anulare  (protejat)
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

        db.query("UPDATE Rezervari SET status_rezervare = 'anulata' WHERE id_rezervare = ?", [id], (err2) => {
            if (err2) return res.status(500).json({ eroare: 'Eroare la anulare.' });

            // Email confirmare anulare
            const fmtD = (s) => s ? new Date(s).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
            transporter.sendMail({
                from:    '"HoteluriRo" <balabanrobert2003@gmail.com>',
                to:      r.email,
                subject: `Rezervare #${r.id_rezervare} anulată — HoteluriRo`,
                html: `
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0d5c0">
                  <div style="background:#0A0E23;padding:28px 32px">
                    <h1 style="font-family:Georgia,serif;color:#C4A050;margin:0;font-size:1.6rem">HoteluriRo</h1>
                  </div>
                  <div style="padding:32px">
                    <h2 style="font-family:Georgia,serif;color:#0A0E23;margin:0 0 8px">Rezervare anulată</h2>
                    <p style="color:#666;margin:0 0 24px">Bună, <strong>${r.nume_complet}</strong>!</p>
                    <p style="color:#555;margin:0 0 20px">Rezervarea ta la <strong>${r.nume_hotel}</strong> (${r.nume_oras}) a fost anulată cu succes.</p>
                    <div style="background:#fdf8f0;border:1px solid #e8d9b0;border-radius:6px;padding:20px;margin-bottom:24px">
                      <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
                        <tr><td style="color:#888;padding:5px 0">Număr rezervare</td><td style="text-align:right;font-weight:600;color:#0A0E23">#${r.id_rezervare}</td></tr>
                        <tr><td style="color:#888;padding:5px 0">Hotel</td><td style="text-align:right;font-weight:600;color:#0A0E23">${r.nume_hotel}</td></tr>
                        <tr><td style="color:#888;padding:5px 0">Cameră</td><td style="text-align:right;color:#0A0E23">${r.tip_camera}</td></tr>
                        <tr><td style="color:#888;padding:5px 0">Check-in</td><td style="text-align:right;color:#0A0E23">${fmtD(r.data_checkin)}</td></tr>
                        <tr><td style="color:#888;padding:5px 0">Check-out</td><td style="text-align:right;color:#0A0E23">${fmtD(r.data_checkout)}</td></tr>
                      </table>
                    </div>
                    <p style="color:#555;font-size:0.88rem">Nicio sumă nu a fost reținută pentru această anulare. Dacă ai plătit online, rambursarea va fi procesată în 5-10 zile lucrătoare.</p>
                    <hr style="border:none;border-top:1px solid #e8d9b0;margin:24px 0">
                    <p style="color:#aaa;font-size:0.8rem;margin:0">© 2025 HoteluriRo</p>
                  </div>
                </div>`,
            }).catch(e => console.error('Email anulare:', e.message));

            res.json({ mesaj: 'Rezervare anulată cu succes.' });
        });
    });
});

// ══ ME (rută protejată) ══
app.get('/api/auth/me', verificaToken, (req, res) => {
    db.query('SELECT id_utilizator,nume_complet,email,telefon,rol,email_marketing FROM Utilizatori WHERE id_utilizator=?',
    [req.user.id], (err, r) => {
        if (err || !r.length) return res.status(404).json({ eroare: 'Utilizator negăsit.' });
        res.json(r[0]);
    });
});

// ══ ACTUALIZARE PROFIL ══
app.patch('/api/auth/profil', verificaToken, (req, res) => {
    const { nume_complet, telefon, email_marketing } = req.body;
    if (!nume_complet || !nume_complet.trim())
        return res.status(400).json({ eroare: 'Numele este obligatoriu.' });
    db.query(
        'UPDATE Utilizatori SET nume_complet=?, telefon=?, email_marketing=? WHERE id_utilizator=?',
        [nume_complet.trim(), telefon || null, email_marketing ? 1 : 0, req.user.id],
        (err) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            db.query('SELECT id_utilizator,nume_complet,email,telefon,rol,email_marketing FROM Utilizatori WHERE id_utilizator=?',
                [req.user.id], (e2, rows) => {
                if (e2 || !rows.length) return res.json({ mesaj: 'Profil actualizat.' });
                res.json({ mesaj: 'Profil actualizat.', utilizator: rows[0] });
            });
        }
    );
});

// ══════════════════════════════════════════════════════════════════════════════
//  RUTE ADMIN (necesită token + rol admin)
// ══════════════════════════════════════════════════════════════════════════════

const ADMIN_ROLES = ['super_admin', 'admin_hotel', 'admin_marketing', 'admin_booking'];

const verificaRol = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.rol))
        return res.status(403).json({ eroare: 'Acces neautorizat.' });
    next();
};

const oriceAdmin     = verificaRol(...ADMIN_ROLES);
const adminHotel     = verificaRol('super_admin', 'admin_hotel');
const adminBooking   = verificaRol('super_admin', 'admin_booking');
const adminMarketing = verificaRol('super_admin', 'admin_marketing');
const superAdmin     = verificaRol('super_admin');

// ── Statistici dashboard ───────────────────────────────────────────────────
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
        new Promise(r => db.query(queries.total_rezervari,   (e,d) => r(d?.[0]?.val ?? 0))),
        new Promise(r => db.query(queries.rezervari_active,  (e,d) => r(d?.[0]?.val ?? 0))),
        new Promise(r => db.query(queries.total_utilizatori, (e,d) => r(d?.[0]?.val ?? 0))),
        new Promise(r => db.query(queries.venituri_totale,   (e,d) => r(d?.[0]?.val ?? 0))),
        new Promise(r => db.query(queries.top_hoteluri,      (e,d) => r(d || []))),
    ]).then(([total_rezervari, rezervari_active, total_utilizatori, venituri_totale, top_hoteluri]) => {
        res.json({ total_rezervari, rezervari_active, total_utilizatori, venituri_totale, top_hoteluri });
    }).catch(() => res.status(500).json({ eroare: 'Eroare server.' }));
});

// ── Toate rezervările (admin) ──────────────────────────────────────────────
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

// ── Schimbare status rezervare (admin) ────────────────────────────────────
app.patch('/api/admin/rezervari/:id/status', verificaToken, verificaRol('super_admin', 'admin_hotel', 'admin_booking'), (req, res) => {
    const { status } = req.body;
    const statusValide = ['confirmata', 'in_asteptare', 'anulata'];
    if (!statusValide.includes(status))
        return res.status(400).json({ eroare: 'Status invalid.' });
    db.query('UPDATE Rezervari SET status_rezervare=? WHERE id_rezervare=?',
        [status, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json({ mesaj: 'Status actualizat.' });
        }
    );
});

// ── Toți utilizatorii ─────────────────────────────────────────────────────
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

// ── Schimbă rolul unui utilizator (doar super_admin) ──────────────────────
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

// ── Adaugă hotel ──────────────────────────────────────────────────────────
app.post('/api/admin/hoteluri', verificaToken, adminHotel, (req, res) => {
    const { id_oras, nume_hotel, adresa, stele, descriere, imagine_url, imagine_2, imagine_3 } = req.body;
    if (!id_oras || !nume_hotel)
        return res.status(400).json({ eroare: 'Orașul și numele sunt obligatorii.' });
    db.query(
        'INSERT INTO Hoteluri (id_oras,nume_hotel,adresa,stele,descriere,imagine_url,imagine_2,imagine_3) VALUES (?,?,?,?,?,?,?,?)',
        [id_oras, nume_hotel, adresa||null, stele||3, descriere||null, imagine_url||null, imagine_2||null, imagine_3||null],
        (err, result) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.status(201).json({ mesaj: 'Hotel adăugat.', id_hotel: result.insertId });
        }
    );
});

// ── Editează hotel ────────────────────────────────────────────────────────
app.put('/api/admin/hoteluri/:id', verificaToken, adminHotel, (req, res) => {
    const { id_oras, nume_hotel, adresa, stele, descriere, imagine_url, imagine_2, imagine_3 } = req.body;
    db.query(
        'UPDATE Hoteluri SET id_oras=?,nume_hotel=?,adresa=?,stele=?,descriere=?,imagine_url=?,imagine_2=?,imagine_3=? WHERE id_hotel=?',
        [id_oras, nume_hotel, adresa||null, stele||3, descriere||null, imagine_url||null, imagine_2||null, imagine_3||null, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json({ mesaj: 'Hotel actualizat.' });
        }
    );
});

// ── Upload poze hotel (multiple) ──────────────────────────────────────────
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

// ── Șterge hotel ──────────────────────────────────────────────────────────
app.delete('/api/admin/hoteluri/:id', verificaToken, adminHotel, (req, res) => {
    db.query('DELETE FROM Hoteluri WHERE id_hotel=?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ eroare: 'Eroare server.' });
        res.json({ mesaj: 'Hotel șters.' });
    });
});

// ── Adaugă oraș ───────────────────────────────────────────────────────────
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

// ── Adaugă categorie cameră ───────────────────────────────────────────────
app.post('/api/admin/categorii', verificaToken, adminHotel, (req, res) => {
    const { id_hotel, denumire, capacitate, pret_pe_noapte, descriere } = req.body;
    if (!id_hotel || !denumire || !pret_pe_noapte)
        return res.status(400).json({ eroare: 'Câmpuri obligatorii lipsă.' });
    db.query(
        'INSERT INTO Categorii_Camere (id_hotel,denumire,capacitate,pret_pe_noapte,descriere) VALUES (?,?,?,?,?)',
        [id_hotel, denumire, capacitate||2, pret_pe_noapte, descriere||null],
        (err, result) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.status(201).json({ mesaj: 'Categorie adăugată.', id_categorie: result.insertId });
        }
    );
});

// ── Editează categorie cameră ─────────────────────────────────────────────
app.put('/api/admin/categorii/:id', verificaToken, adminHotel, (req, res) => {
    const { denumire, capacitate, pret_pe_noapte, descriere } = req.body;
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

// ── Șterge categorie cameră ───────────────────────────────────────────────
app.delete('/api/admin/categorii/:id', verificaToken, adminHotel, (req, res) => {
    db.query('DELETE FROM Categorii_Camere WHERE id_categorie=?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ eroare: 'Eroare server.' });
        res.json({ mesaj: 'Categorie ștearsă.' });
    });
});

// ── Toggle ofertă hotel ───────────────────────────────────────────────────
app.patch('/api/admin/hoteluri/:id/oferta', verificaToken, verificaRol('super_admin', 'admin_hotel', 'admin_marketing'), (req, res) => {
    db.query('UPDATE Hoteluri SET oferta_activa = NOT oferta_activa WHERE id_hotel = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ eroare: 'Eroare server.' });
        res.json({ mesaj: 'Ofertă actualizată.' });
    });
});

// ── Validare cod reducere (utilizator autentificat) ───────────────────────
app.get('/api/coduri/valideaza', verificaToken, (req, res) => {
    const { cod, checkin } = req.query;
    if (!cod) return res.status(400).json({ eroare: 'Codul lipsă.' });
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

// ── Lista coduri reducere (admin marketing) ───────────────────────────────
app.get('/api/admin/coduri', verificaToken, adminMarketing, (req, res) => {
    db.query('SELECT * FROM Coduri_Reducere ORDER BY data_creare DESC', (err, results) => {
        if (err) return res.status(500).json({ eroare: 'Eroare server.' });
        res.json(results);
    });
});

// ── Creare cod reducere ───────────────────────────────────────────────────
app.post('/api/admin/coduri', verificaToken, adminMarketing, (req, res) => {
    const { cod, procent_reducere, descriere, data_start, data_expirare, utilizari_maxime } = req.body;
    if (!cod || !procent_reducere)
        return res.status(400).json({ eroare: 'Codul și procentul sunt obligatorii.' });
    if (procent_reducere < 1 || procent_reducere > 90)
        return res.status(400).json({ eroare: 'Procentul trebuie să fie între 1 și 90.' });
    const maxUt = utilizari_maxime ? parseInt(utilizari_maxime) : null;
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

// ── Activare / dezactivare cod reducere ──────────────────────────────────
app.patch('/api/admin/coduri/:id/toggle', verificaToken, adminMarketing, (req, res) => {
    db.query('UPDATE Coduri_Reducere SET activ = NOT activ WHERE id_cod = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ eroare: 'Eroare server.' });
        res.json({ mesaj: 'Status actualizat.' });
    });
});

// ── Ștergere cod reducere ─────────────────────────────────────────────────
app.delete('/api/admin/coduri/:id', verificaToken, adminMarketing, (req, res) => {
    db.query('DELETE FROM Coduri_Reducere WHERE id_cod = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ eroare: 'Eroare server.' });
        res.json({ mesaj: 'Cod șters.' });
    });
});

// ── Oferte de sezon ───────────────────────────────────────────────────────────
app.get('/api/oferte-sezon', (req, res) => {
    db.query('SELECT * FROM Oferte_Sezon WHERE activa = 1 ORDER BY data_start ASC', (err, r) => {
        if (err) return res.status(500).json({ eroare: 'Eroare oferte sezon' });
        res.json(r);
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
    db.query(
        'UPDATE Oferte_Sezon SET discount_procent=?, data_start=?, data_sfarsit=?, descriere=? WHERE id_oferta=?',
        [discount_procent, data_start, data_sfarsit, descriere, req.params.id],
        err => {
            if (err) return res.status(500).json({ eroare: 'Eroare actualizare' });
            res.json({ ok: true });
        }
    );
});

// ══════════════════════════════════════════════════════════════════════════════
//  GALERIE HOTEL
// ══════════════════════════════════════════════════════════════════════════════

// ── Obține galeria unui hotel ─────────────────────────────────────────────
app.get('/api/hoteluri/:id/galerie', (req, res) => {
    db.query(
        'SELECT * FROM Hoteluri_Galerie WHERE id_hotel=? ORDER BY ordine ASC, id_poza ASC',
        [req.params.id],
        (err, results) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            res.json(results);
        }
    );
});

// ── Upload poze galerie (admin, multiple) ─────────────────────────────────
const uploadGalerie = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `galerie_${req.params.id}_${Date.now()}_${Math.random().toString(36).slice(2,6)}${ext}`);
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        allowed.includes(path.extname(file.originalname).toLowerCase())
            ? cb(null, true) : cb(new Error('Doar JPG, PNG sau WEBP.'));
    },
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

// ── Șterge poză din galerie (admin) ──────────────────────────────────────
app.delete('/api/admin/galerie/:id_poza', verificaToken, adminHotel, (req, res) => {
    db.query('DELETE FROM Hoteluri_Galerie WHERE id_poza=?', [req.params.id_poza], (err) => {
        if (err) return res.status(500).json({ eroare: 'Eroare server.' });
        res.json({ mesaj: 'Poză ștearsă.' });
    });
});


// ══════════════════════════════════════════════════════════════════════════════
//  GENERARE FACTURĂ PDF
// ══════════════════════════════════════════════════════════════════════════════

const PDFDocument = require('pdfkit');

const genereazaPDFBuffer = (r) => new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const checkin_d  = new Date(r.data_checkin);
    const checkout_d = new Date(r.data_checkout);
    const nopti      = Math.max(1, Math.floor((checkout_d - checkin_d) / (1000 * 60 * 60 * 24)));
    const pretNoapte  = Number(r.pret_pe_noapte) || 0;
    const pretTotal   = Number(r.pret_total) || 0;
    const tva         = Math.round(pretTotal * 0.19 * 100) / 100;
    const pretFaraTVA = Math.round((pretTotal - tva) * 100) / 100;

    const fmtD = (d) => new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });

    doc.registerFont('R',  'C:/Windows/Fonts/arial.ttf');
    doc.registerFont('RB', 'C:/Windows/Fonts/arialbd.ttf');

    const GOLD  = '#C4A050';
    const DARK  = '#0A0E23';
    const GRAY  = '#888888';
    const LGRAY = '#f5f5f5';

    // Header
    doc.rect(0, 0, 595, 110).fill(DARK);
    doc.fontSize(28).font('RB').fillColor(GOLD).text('HoteluriRo', 50, 30);
    doc.fontSize(9).font('R').fillColor('rgba(255,255,255,0.6)')
       .text('Platforma nationala de rezervari hoteliere', 50, 65)
       .text('contact@hoteluriro.ro  ·  www.hoteluriro.ro', 50, 80);
    doc.fontSize(11).font('RB').fillColor(GOLD)
       .text(`FACTURA #${String(r.id_rezervare).padStart(6, '0')}`, 400, 35, { align: 'right', width: 145 });
    doc.fontSize(9).font('R').fillColor('rgba(255,255,255,0.6)')
       .text(`Data emiterii: ${fmtD(new Date())}`, 400, 58, { align: 'right', width: 145 })
       .text(`Rezervare #${r.id_rezervare}`, 400, 73, { align: 'right', width: 145 });

    doc.moveTo(50, 118).lineTo(545, 118).strokeColor(GOLD).lineWidth(1.5).stroke();

    // Client + Hotel
    let y = 135;
    doc.fontSize(8).font('RB').fillColor(GOLD).text('DATE CLIENT', 50, y, { characterSpacing: 1 });
    doc.moveTo(50, y + 12).lineTo(250, y + 12).strokeColor(GOLD).lineWidth(0.5).stroke();
    y += 20;
    doc.fontSize(10).font('RB').fillColor(DARK).text(r.nume_complet, 50, y);
    y += 15;
    doc.fontSize(9).font('R').fillColor(GRAY).text(r.email, 50, y);
    if (r.telefon) { y += 13; doc.text(r.telefon, 50, y); }

    let yH = 135;
    doc.fontSize(8).font('RB').fillColor(GOLD).text('HOTEL', 310, yH, { characterSpacing: 1 });
    doc.moveTo(310, yH + 12).lineTo(545, yH + 12).strokeColor(GOLD).lineWidth(0.5).stroke();
    yH += 20;
    doc.fontSize(10).font('RB').fillColor(DARK).text(r.nume_hotel, 310, yH);
    yH += 15;
    doc.fontSize(9).font('R').fillColor(GRAY)
       .text(r.adresa_hotel + ', ' + r.nume_oras, 310, yH)
       .text('★'.repeat(r.stele) + ` (${r.stele} stele)`, 310, yH + 13);

    // Detalii sejur
    y = Math.max(y, yH) + 45;
    doc.fontSize(8).font('RB').fillColor(GOLD).text('DETALII SEJUR', 50, y, { characterSpacing: 1 });
    doc.moveTo(50, y + 12).lineTo(545, y + 12).strokeColor(GOLD).lineWidth(0.5).stroke();
    y += 22;

    const cols    = [50, 180, 310, 420, 495];
    const headers = ['Tip camera', 'Check-in', 'Check-out', 'Nopti', 'Pret/noapte'];
    doc.rect(50, y, 495, 22).fill(DARK);
    headers.forEach((h, i) => {
        doc.fontSize(8).font('RB').fillColor('#fff')
           .text(h, cols[i] + 6, y + 7, { width: (cols[i+1] || 545) - cols[i] - 8 });
    });
    y += 22;

    doc.rect(50, y, 495, 24).fill(LGRAY);
    [r.tip_camera, fmtD(r.data_checkin), fmtD(r.data_checkout),
     `${nopti} ${nopti === 1 ? 'noapte' : 'nopti'}`, `${Math.round(pretNoapte)} RON`]
    .forEach((d, i) => {
        doc.fontSize(9).font('R').fillColor(DARK)
           .text(d, cols[i] + 6, y + 8, { width: (cols[i+1] || 545) - cols[i] - 8 });
    });
    y += 24;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').lineWidth(0.5).stroke();

    // Sumar pret
    y += 30;
    const addPretRow = (label, val, bold = false, color = DARK) => {
        doc.fontSize(bold ? 10 : 9).font(bold ? 'RB' : 'R')
           .fillColor(GRAY).text(label, 350, y)
           .fillColor(color).text(val, 460, y, { align: 'right', width: 85 });
        y += 18;
    };
    addPretRow('Subtotal (fara TVA):', `${pretFaraTVA.toFixed(2)} RON`);
    addPretRow('TVA (19%):', `${tva.toFixed(2)} RON`);
    doc.moveTo(350, y).lineTo(545, y).strokeColor(GOLD).lineWidth(0.8).stroke();
    y += 10;
    doc.rect(350, y, 195, 28).fill(DARK);
    doc.fontSize(11).font('RB')
       .fillColor('rgba(255,255,255,0.7)').text('TOTAL:', 360, y + 8)
       .fillColor(GOLD).text(`${pretTotal.toFixed(2)} RON`, 360, y + 8, { align: 'right', width: 175 });
    y += 45;

    // Metoda de plata
    const metoda = r.metoda_plata || 'online_total';
    if (metoda === 'avans_online' && r.suma_avans) {
        const avans   = Number(r.suma_avans);
        const restPl  = Math.round((pretTotal - avans) * 100) / 100;
        doc.fontSize(8).font('RB').fillColor(GOLD).text('DETALII PLATA', 50, y, { characterSpacing: 1 });
        doc.moveTo(50, y + 12).lineTo(300, y + 12).strokeColor(GOLD).lineWidth(0.5).stroke();
        y += 22;
        doc.fontSize(9).font('R').fillColor(GRAY).text('Metoda de plata:', 50, y);
        doc.fontSize(9).font('RB').fillColor(DARK).text('Avans online + rest la cazare', 200, y);
        y += 16;
        doc.fontSize(9).font('R').fillColor(GRAY).text('Avans achitat online:', 50, y);
        doc.fontSize(9).font('RB').fillColor('#0f6e56').text(`${avans.toFixed(2)} RON`, 200, y);
        y += 16;
        doc.fontSize(9).font('R').fillColor(GRAY).text('Rest de platit la cazare:', 50, y);
        doc.fontSize(9).font('RB').fillColor('#C4A050').text(`${restPl.toFixed(2)} RON`, 200, y);
        y += 20;
    } else {
        doc.fontSize(9).font('R').fillColor(GRAY).text('Metoda de plata:', 50, y);
        doc.fontSize(9).font('RB').fillColor(DARK).text(
            metoda === 'cash_cazare' ? 'Plata cash la cazare' : 'Plata integrala online', 200, y);
        y += 20;
    }

    // Status rezervare
    const sc = ({ confirmata: { bg: '#e6f4ef', text: '#0f6e56', label: 'CONFIRMATA' },
                   in_asteptare: { bg: '#fef9e7', text: '#8a6a10', label: 'IN ASTEPTARE' },
                   anulata: { bg: '#fde8e8', text: '#aa2020', label: 'ANULATA' } })[r.status_rezervare]
               || { bg: '#fef9e7', text: '#8a6a10', label: 'IN ASTEPTARE' };
    doc.fontSize(9).font('R').fillColor(GRAY).text('Status rezervare:', 50, y);
    doc.rect(160, y - 3, 90, 16).fill(sc.bg);
    doc.fontSize(8).font('RB').fillColor(sc.text).text(sc.label, 163, y + 1);

    // Footer
    const footerLine2 = metoda === 'avans_online'
        ? 'Avansul a fost platit online. Restul se achita la receptie la data check-in-ului.'
        : metoda === 'cash_cazare'
        ? 'Plata integrala se efectueaza la receptia hotelului la data check-in-ului.'
        : 'Plata a fost efectuata integral online.';
    doc.rect(0, 760, 595, 82).fill(DARK);
    doc.fontSize(8).font('R').fillColor('rgba(255,255,255,0.4)')
       .text('Aceasta factura a fost generata automat de platforma HoteluriRo.', 50, 775, { align: 'center', width: 495 })
       .text(footerLine2, 50, 790, { align: 'center', width: 495 });
    doc.fontSize(7).fillColor(GOLD)
       .text('HoteluriRo © ' + new Date().getFullYear() + '  ·  Proiect licenta', 50, 810, { align: 'center', width: 495 });

    doc.end();
});

//  GET /api/rezervari/:id/factura  (protejat — doar userul propriu sau admin)
app.get('/api/rezervari/:id/factura', verificaToken, (req, res) => {
    const query = `
        SELECT r.*, 
               u.nume_complet, u.email, u.telefon,
               h.nume_hotel, h.adresa AS adresa_hotel, h.stele,
               o.nume_oras,
               cc.denumire AS tip_camera, cc.pret_pe_noapte
        FROM Rezervari r
        JOIN Utilizatori u   ON r.id_utilizator = u.id_utilizator
        JOIN Camere c        ON r.id_camera = c.id_camera
        JOIN Categorii_Camere cc ON c.id_categorie = cc.id_categorie
        JOIN Hoteluri h      ON cc.id_hotel = h.id_hotel
        JOIN Orase o         ON h.id_oras = o.id_oras
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




// ══════════════════════════════════════════════════════════════════════════════
//  DISPONIBILITATE + FILTRARE AMPLĂ
// ══════════════════════════════════════════════════════════════════════════════

// ── Lista facilități disponibile ─────────────────────────────────────────
app.get('/api/facilitati', (req, res) => {
    db.query('SELECT * FROM Facilitati ORDER BY categorie, nume', (err, results) => {
        if (err) return res.status(500).json({ eroare: 'Eroare server.' });
        res.json(results);
    });
});

// ── Hoteluri cu filtrare completă + disponibilitate ───────────────────────
//  GET /api/hoteluri/cauta
//  Parametri:
//    ?oras=Cluj-Napoca
//    ?checkin=2026-05-01&checkout=2026-05-05
//    ?guests=2
//    ?stele_min=3
//    ?pret_max=500
//    ?facilitati=1,2,5   (id-uri separate prin virgulă)
//    ?sort=pret_asc
app.get('/api/hoteluri/cauta', (req, res) => {
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

// ── Disponibilitate camere per hotel ─────────────────────────────────────
//  GET /api/hoteluri/:id/disponibilitate?checkin=...&checkout=...&guests=2
app.get('/api/hoteluri/:id/disponibilitate', (req, res) => {
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

// ── Facilitățile unui hotel ───────────────────────────────────────────────
app.get('/api/hoteluri/:id/facilitati', (req, res) => {
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


// ══════════════════════════════════════════════════════════════════════════════
//  STRIPE PLĂȚI
// ══════════════════════════════════════════════════════════════════════════════

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const COMISION_PLATFORMA = 0.10; // 10% comision HoteluriRo

// ── Creare sesiune plată Stripe ───────────────────────────────────────────
app.post('/api/plati/creare-sesiune', verificaToken, async (req, res) => {
    const { id_camera, data_checkin, data_checkout, pret_total, nume_hotel, tip_camera, nopti, id_cod, metoda_plata, suma_avans } = req.body;

    if (!id_camera || !data_checkin || !data_checkout || !pret_total)
        return res.status(400).json({ eroare: 'Câmpuri obligatorii lipsă.' });

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'ron',
                    product_data: {
                        name: `${nume_hotel} — ${tip_camera}`,
                        description: `Check-in: ${data_checkin} | Check-out: ${data_checkout} | ${nopti} ${nopti === 1 ? 'noapte' : 'nopți'}`,
                        images: [],
                    },
                    unit_amount: Math.round(((metoda_plata === 'avans_online' && suma_avans) ? parseFloat(suma_avans) : parseFloat(pret_total)) * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `http://localhost:5173/rezervare/succes?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  `http://localhost:5173/rezervare/anulat`,
            metadata: {
                id_utilizator: String(req.user.id),
                id_camera:     String(id_camera),
                data_checkin,
                data_checkout,
                pret_total:    String(pret_total),
                id_cod:        id_cod ? String(id_cod) : '',
                metoda_plata:  metoda_plata || 'online_total',
                suma_avans:    suma_avans ? String(suma_avans) : '',
                nopti:         String(nopti),
                nume_hotel:    nume_hotel || '',
                tip_camera:    tip_camera || '',
            },
            locale: 'ro',
        });

        res.json({ url: session.url, session_id: session.id });
    } catch (err) {
        console.error('Eroare Stripe:', err.message);
        res.status(500).json({ eroare: 'Eroare la crearea sesiunii de plată.' });
    }
});

// ── Confirmare plată după redirect ────────────────────────────────────────
app.post('/api/plati/confirmare', verificaToken, async (req, res) => {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ eroare: 'Session ID lipsă.' });

    try {
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== 'paid')
            return res.status(400).json({ eroare: 'Plata nu a fost finalizată.' });

        const { id_utilizator, id_camera, data_checkin, data_checkout, pret_total, id_cod,
                metoda_plata, suma_avans, nopti: noptiMeta, nume_hotel: numeHotelMeta, tip_camera: tipCameraMeta } = session.metadata;
        const pretTotal = parseFloat(pret_total);
        const comision  = Math.round(pretTotal * COMISION_PLATFORMA * 100) / 100;
        const sumHotel  = Math.round((pretTotal - comision) * 100) / 100;

        // Verificăm că nu s-a creat deja rezervarea (prevenire duplicate)
        db.query(
            'SELECT id_rezervare FROM Rezervari WHERE stripe_session_id = ?',
            [session_id],
            (err, existing) => {
                if (err) return res.status(500).json({ eroare: 'Eroare server.' });
                if (existing.length > 0) {
                    return db.query(
                        'SELECT id_rezervare, pret_total, comision_platforma AS comision, suma_hotel FROM Rezervari WHERE id_rezervare = ?',
                        [existing[0].id_rezervare],
                        (err2, rows) => {
                            if (err2 || !rows.length) return res.json({ mesaj: 'Rezervare deja confirmată.', id_rezervare: existing[0].id_rezervare });
                            const r = rows[0];
                            res.json({
                                mesaj: 'Rezervare deja confirmată.',
                                id_rezervare: r.id_rezervare,
                                pret_total: parseFloat(r.pret_total),
                                comision: parseFloat(r.comision),
                                suma_hotel: parseFloat(r.suma_hotel),
                            });
                        }
                    );
                }

                db.query(
                    `INSERT INTO Rezervari
                     (id_utilizator, id_camera, data_checkin, data_checkout, pret_total,
                      status_rezervare, stripe_session_id, comision_platforma, suma_hotel,
                      metoda_plata, suma_avans)
                     VALUES (?, ?, ?, ?, ?, 'confirmata', ?, ?, ?, ?, ?)`,
                    [id_utilizator, id_camera, data_checkin, data_checkout, pretTotal,
                     session_id, comision, sumHotel,
                     metoda_plata || 'online_total', suma_avans ? parseFloat(suma_avans) : null],
                    async (err2, result) => {
                        if (err2) {
                            console.error('Eroare INSERT rezervare:', err2.message);
                            return res.status(500).json({ eroare: 'Eroare la salvarea rezervării.' });
                        }
                        if (id_cod) {
                            db.query(
                                'UPDATE Coduri_Reducere SET utilizari_curente = utilizari_curente + 1 WHERE id_cod = ?',
                                [parseInt(id_cod)]
                            );
                        }
                        // Email confirmare
                        db.query('SELECT email, nume_complet FROM Utilizatori WHERE id_utilizator = ?',
                            [id_utilizator], async (e3, users) => {
                            if (!e3 && users.length) {
                                const noptiNr = noptiMeta ? parseInt(noptiMeta)
                                    : Math.max(1, Math.floor((new Date(data_checkout) - new Date(data_checkin)) / 86400000));
                                trimiteEmailConfirmareRezervare({
                                    email: users[0].email, nume: users[0].nume_complet,
                                    numeHotel: numeHotelMeta || '—', tipCamera: tipCameraMeta || '—',
                                    checkin: data_checkin, checkout: data_checkout,
                                    nopti: noptiNr, pretTotal: pretTotal,
                                    idRezervare: result.insertId,
                                    metodaPlata: metoda_plata || 'online_total',
                                    sumaAvans: suma_avans || null,
                                }).catch(e => console.error('Email error:', e.message));
                            }
                        });
                        const noptiNr2 = noptiMeta ? parseInt(noptiMeta)
                            : Math.max(1, Math.floor((new Date(data_checkout) - new Date(data_checkin)) / 86400000));
                        res.json({
                            mesaj: 'Rezervare confirmată!',
                            id_rezervare: result.insertId,
                            pret_total: parseFloat(pretTotal),
                            comision: parseFloat(comision),
                            suma_hotel: parseFloat(sumHotel),
                            nume_hotel: numeHotelMeta || '—',
                            tip_camera: tipCameraMeta || '—',
                            data_checkin,
                            data_checkout,
                            nopti: noptiNr2,
                            metoda_plata: metoda_plata || 'online_total',
                            suma_avans: suma_avans ? parseFloat(suma_avans) : null,
                        });
                    }
                );
            }
        );
    } catch (err) {
        console.error('Eroare confirmare:', err.message);
        res.status(500).json({ eroare: 'Eroare la confirmarea plății.' });
    }
});

// ── Lista plăți Stripe (admin booking) ───────────────────────────────────
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

// ── Statistici plăți (admin booking) ─────────────────────────────────────
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

// ══════════════════════════════════════════════════════════════════════════════
//  EMAIL SERVICE — Nodemailer + Gmail
// ══════════════════════════════════════════════════════════════════════════════

const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const EMAIL_FROM = '"HoteluriRo" <balabanrobert2003@gmail.com>';
const SITE_URL   = 'http://localhost:5173';

const trimiteEmailConfirmareRezervare = async (date) => {
    const { email, nume, numeHotel, tipCamera, checkin, checkout, nopti, pretTotal, idRezervare, metodaPlata, sumaAvans } = date;
    const formatD = (s) => new Date(s).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
    const metodaText = metodaPlata === 'cash_cazare'
        ? 'Plată cash la cazare'
        : metodaPlata === 'avans_online'
        ? `Avans online plătit: ${sumaAvans} RON — restul la cazare`
        : 'Plată integrală online';

    // Generăm PDF ca atașament
    let pdfAttachment = null;
    try {
        const queryPDF = `
            SELECT r.*, u.nume_complet, u.email, u.telefon,
                   h.nume_hotel, h.adresa AS adresa_hotel, h.stele,
                   o.nume_oras, cc.denumire AS tip_camera, cc.pret_pe_noapte
            FROM Rezervari r
            JOIN Utilizatori u   ON r.id_utilizator = u.id_utilizator
            JOIN Camere c        ON r.id_camera = c.id_camera
            JOIN Categorii_Camere cc ON c.id_categorie = cc.id_categorie
            JOIN Hoteluri h      ON cc.id_hotel = h.id_hotel
            JOIN Orase o         ON h.id_oras = o.id_oras
            WHERE r.id_rezervare = ?`;
        const rows = await new Promise((res, rej) =>
            db.query(queryPDF, [idRezervare], (err, r) => err ? rej(err) : res(r))
        );
        if (rows.length) {
            const buf = await genereazaPDFBuffer(rows[0]);
            pdfAttachment = { filename: `Factura_HoteluriRo_${idRezervare}.pdf`, content: buf, contentType: 'application/pdf' };
        }
    } catch (e) { console.error('PDF attach error:', e.message); }

    await emailTransporter.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: `✓ Rezervare confirmată — ${numeHotel}`,
        attachments: pdfAttachment ? [pdfAttachment] : [],
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0A0E23">
          <div style="background:#0A0E23;padding:30px 40px">
            <h1 style="color:#C4A050;margin:0;font-size:26px">HoteluriRo</h1>
            <p style="color:rgba(255,255,255,0.5);margin:6px 0 0;font-size:13px">Confirmare rezervare</p>
          </div>
          <div style="padding:32px 40px;background:#fff;border:1px solid #eee">
            <p style="font-size:15px">Bună, <strong>${nume}</strong>!</p>
            <p style="font-size:15px">Rezervarea ta a fost confirmată cu succes.</p>
            <div style="background:#f8f6f1;border-left:3px solid #C4A050;padding:20px 24px;margin:24px 0;border-radius:2px">
              <table style="width:100%;font-size:14px;border-collapse:collapse">
                <tr><td style="padding:5px 0;color:#888">Hotel</td><td style="padding:5px 0;font-weight:600">${numeHotel}</td></tr>
                <tr><td style="padding:5px 0;color:#888">Tip cameră</td><td style="padding:5px 0">${tipCamera}</td></tr>
                <tr><td style="padding:5px 0;color:#888">Check-in</td><td style="padding:5px 0">${formatD(checkin)}</td></tr>
                <tr><td style="padding:5px 0;color:#888">Check-out</td><td style="padding:5px 0">${formatD(checkout)}</td></tr>
                <tr><td style="padding:5px 0;color:#888">Nopți</td><td style="padding:5px 0">${nopti}</td></tr>
                <tr><td style="padding:5px 0;color:#888">Total</td><td style="padding:5px 0;font-weight:700;color:#C4A050">${pretTotal} RON</td></tr>
                <tr><td style="padding:5px 0;color:#888">Plată</td><td style="padding:5px 0">${metodaText}</td></tr>
              </table>
            </div>
            <p style="font-size:13px;color:#888">Număr rezervare: <strong>#${idRezervare}</strong></p>
            <a href="${SITE_URL}/rezervarile-mele" style="display:inline-block;background:#C4A050;color:#0A0E23;padding:12px 28px;text-decoration:none;border-radius:2px;font-weight:700;font-size:14px;margin-top:8px">
              Vezi rezervările mele
            </a>
          </div>
          <div style="padding:20px 40px;background:#0A0E23;text-align:center">
            <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0">HoteluriRo © ${new Date().getFullYear()} · Platformă de rezervări hoteliere</p>
          </div>
        </div>`,
    });
};

const trimiteEmailBunVenit = async (email, nume) => {
    await emailTransporter.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: 'Bun venit pe HoteluriRo!',
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0A0E23">
          <div style="background:#0A0E23;padding:30px 40px">
            <h1 style="color:#C4A050;margin:0;font-size:26px">HoteluriRo</h1>
            <p style="color:rgba(255,255,255,0.5);margin:6px 0 0;font-size:13px">Cont nou creat</p>
          </div>
          <div style="padding:32px 40px;background:#fff;border:1px solid #eee">
            <p style="font-size:15px">Bună, <strong>${nume}</strong>!</p>
            <p style="font-size:15px">Contul tău pe <strong>HoteluriRo</strong> a fost creat cu succes. Acum poți rezerva camere la cele mai bune hoteluri din România.</p>
            <a href="${SITE_URL}/hoteluri" style="display:inline-block;background:#C4A050;color:#0A0E23;padding:12px 28px;text-decoration:none;border-radius:2px;font-weight:700;font-size:14px;margin-top:16px">
              Explorează hoteluri
            </a>
          </div>
          <div style="padding:20px 40px;background:#0A0E23;text-align:center">
            <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0">HoteluriRo © ${new Date().getFullYear()}</p>
          </div>
        </div>`,
    });
};

// ── Trimite email promoțional (admin marketing) ───────────────────────────
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
                        <p style="font-size:15px">Bună, <strong>${u.nume_complet}</strong>!</p>
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

// ── Rezervare cash (fără Stripe) ──────────────────────────────────────────
app.post('/api/rezervari/cash', verificaToken, async (req, res) => {
    const { id_camera, data_checkin, data_checkout, pret_total, metoda_plata, suma_avans } = req.body;
    if (!id_camera || !data_checkin || !data_checkout || !pret_total || !metoda_plata)
        return res.status(400).json({ eroare: 'Câmpuri obligatorii lipsă.' });

    db.query(
        `INSERT INTO Rezervari (id_utilizator, id_camera, data_checkin, data_checkout, pret_total, status_rezervare, metoda_plata, suma_avans)
         VALUES (?, ?, ?, ?, ?, 'confirmata', ?, ?)`,
        [req.user.id, id_camera, data_checkin, data_checkout, pret_total, metoda_plata, suma_avans || null],
        async (err, result) => {
            if (err) return res.status(500).json({ eroare: 'Eroare la salvarea rezervării.' });

            // Trimite email confirmare
            try {
                const q = `SELECT u.email, u.nume_complet, h.nume_hotel, cc.denumire AS tip_camera
                           FROM Utilizatori u, Camere c, Categorii_Camere cc, Hoteluri h
                           WHERE u.id_utilizator = ? AND c.id_camera = ? AND c.id_categorie = cc.id_categorie AND cc.id_hotel = h.id_hotel`;
                db.query(q, [req.user.id, id_camera], async (e2, rows) => {
                    if (!e2 && rows.length) {
                        const r = rows[0];
                        const nopti = Math.max(1, Math.floor((new Date(data_checkout) - new Date(data_checkin)) / 86400000));
                        await trimiteEmailConfirmareRezervare({
                            email: r.email, nume: r.nume_complet,
                            numeHotel: r.nume_hotel, tipCamera: r.tip_camera,
                            checkin: data_checkin, checkout: data_checkout,
                            nopti, pretTotal: pret_total,
                            idRezervare: result.insertId,
                            metodaPlata: metoda_plata, sumaAvans: suma_avans,
                        }).catch(console.error);
                    }
                });
            } catch (e) { console.error('Email error:', e.message); }

            res.status(201).json({ mesaj: 'Rezervare creată!', id_rezervare: result.insertId });
        }
    );
});

// ══════════════════════════════════════════════════════════════════════════
// RECENZII
// ══════════════════════════════════════════════════════════════════════════

// GET /api/hoteluri/:id/recenzii  — publice
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

// POST /api/hoteluri/:id/recenzii  — autentificat, condiție: rezervare confirmată
app.post('/api/hoteluri/:id/recenzii', verificaToken, (req, res) => {
    const idHotel = req.params.id;
    const idUser  = req.user.id;
    const { rating, comentariu } = req.body;

    if (!rating || rating < 1 || rating > 5)
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

// ══════════════════════════════════════════════════════════════════════════
// RESET PAROLĂ
// ══════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ eroare: 'Email obligatoriu.' });

    db.query('SELECT id_utilizator, nume_complet FROM Utilizatori WHERE email = ?', [email], async (err, rows) => {
        if (err) return res.status(500).json({ eroare: 'Eroare server.' });

        // Răspundem mereu OK (securitate — nu dezvăluim dacă emailul există)
        if (!rows.length) return res.json({ mesaj: 'Dacă emailul există, vei primi un link de resetare.' });

        const user = rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 oră

        db.query(
            'UPDATE Utilizatori SET reset_token=?, reset_token_expires=? WHERE id_utilizator=?',
            [token, expires, user.id_utilizator],
            async (err2) => {
                if (err2) return res.status(500).json({ eroare: 'Eroare server.' });

                const resetLink = `http://localhost:5173/resetare-parola?token=${token}`;
                try {
                    await transporter.sendMail({
                        from:    '"HoteluriRo" <balabanrobert2003@gmail.com>',
                        to:      email,
                        subject: 'Resetare parolă — HoteluriRo',
                        html: `
                        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0d5c0">
                          <div style="background:#0A0E23;padding:28px 32px">
                            <h1 style="font-family:Georgia,serif;color:#C4A050;margin:0;font-size:1.6rem">HoteluriRo</h1>
                          </div>
                          <div style="padding:32px">
                            <h2 style="font-family:Georgia,serif;color:#0A0E23;margin:0 0 16px">Resetare parolă</h2>
                            <p style="color:#555;margin:0 0 8px">Bună, <strong>${user.nume_complet}</strong>!</p>
                            <p style="color:#555;margin:0 0 24px">Ai solicitat resetarea parolei. Apasă butonul de mai jos pentru a seta o parolă nouă. Link-ul este valabil 1 oră.</p>
                            <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#C4A050,#A8883C);color:#0A0E23;text-decoration:none;padding:13px 28px;border-radius:4px;font-weight:600;font-size:0.95rem">Resetează parola</a>
                            <p style="color:#aaa;font-size:0.8rem;margin:24px 0 0">Dacă nu ai solicitat resetarea parolei, ignoră acest email.</p>
                            <hr style="border:none;border-top:1px solid #e8d9b0;margin:20px 0">
                            <p style="color:#aaa;font-size:0.8rem;margin:0">© 2025 HoteluriRo</p>
                          </div>
                        </div>`,
                    });
                } catch (e) { console.error('Email reset:', e.message); }

                res.json({ mesaj: 'Dacă emailul există, vei primi un link de resetare.' });
            }
        );
    });
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, parola_noua } = req.body;
    if (!token || !parola_noua) return res.status(400).json({ eroare: 'Token și parola sunt obligatorii.' });
    if (parola_noua.length < 6) return res.status(400).json({ eroare: 'Parola trebuie să aibă cel puțin 6 caractere.' });

    db.query(
        'SELECT id_utilizator FROM Utilizatori WHERE reset_token=? AND reset_token_expires > NOW()',
        [token],
        async (err, rows) => {
            if (err) return res.status(500).json({ eroare: 'Eroare server.' });
            if (!rows.length) return res.status(400).json({ eroare: 'Link expirat sau invalid. Solicită un nou link.' });

            const hash = await bcrypt.hash(parola_noua, 10);
            db.query(
                'UPDATE Utilizatori SET parola=?, reset_token=NULL, reset_token_expires=NULL WHERE id_utilizator=?',
                [hash, rows[0].id_utilizator],
                (err2) => {
                    if (err2) return res.status(500).json({ eroare: 'Eroare server.' });
                    res.json({ mesaj: 'Parola a fost resetată cu succes! Te poți autentifica.' });
                }
            );
        }
    );
});

app.listen(port, '127.0.0.1', () => console.log(`🚀 Serverul rulează pe http://localhost:${port}`));