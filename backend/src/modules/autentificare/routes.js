const { HttpError } = require('../../services/errors');
function validatePassword(password) {
    if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
        throw new HttpError(400, 'Parola trebuie să aibă minimum 6 caractere și maximum 72 de octeți UTF-8.');
    }
}
function validateCredentials(email, password, registering = true) {
    if (typeof email !== 'string' || email.trim().length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new HttpError(400, 'Email invalid.');
    if (registering) validatePassword(password);
    else if (typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) throw new HttpError(400, 'Parolă invalidă.');
}
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function registerRoutes(app, { db, verificaToken, trimiteEmailBunVenit, emailTransporter, config }) {

    const JWT_SECRET = config.jwtSecret;
    const EMAIL_FROM = config.emailFrom;
    const SITE_URL = config.siteUrl;

    app.post('/api/auth/register', async (req, res) => {
        const { nume_complet, email, parola, telefon, email_marketing } = req.body;
        validateCredentials(email, parola);
        if (typeof nume_complet !== 'string' || !nume_complet.trim() || nume_complet.trim().length > 100
            || (telefon != null && (typeof telefon !== 'string' || telefon.length > 20))) {
            throw new HttpError(400, 'Nume sau telefon invalid.');
        }
        const address = email.trim().toLowerCase();
        const hash = await bcrypt.hash(parola, 10);
        try {
            await db.promise().execute(`INSERT INTO Utilizatori (nume_complet,email,parola,telefon,rol,email_marketing)
                VALUES (?,?,?,?,'client',?)`, [nume_complet.trim(), address, hash, telefon || null, email_marketing ? 1 : 0]);
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Există deja un cont cu această adresă de email.');
            throw error;
        }
        trimiteEmailBunVenit(address, nume_complet.trim()).catch(() => console.error('Email bun venit indisponibil.'));
        res.status(201).json({ mesaj: 'Cont creat cu succes!' });
    });

    app.post('/api/auth/login', async (req, res) => {
        const { email, parola } = req.body;
        validateCredentials(email, parola, false);
        const [rows] = await db.promise().execute('SELECT * FROM Utilizatori WHERE email=?', [email.trim().toLowerCase()]);
        if (!rows.length || !await bcrypt.compare(parola, rows[0].parola)) throw new HttpError(401, 'Email sau parolă incorecte.');
        const user = rows[0];
        const token = jwt.sign({ id: user.id_utilizator }, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
        res.json({ token, utilizator: { id: user.id_utilizator, nume_complet: user.nume_complet,
            email: user.email, telefon: user.telefon, rol: user.rol } });
    });

    app.get('/api/auth/me', verificaToken, (req, res) => {
        db.query('SELECT id_utilizator,nume_complet,email,telefon,rol,email_marketing FROM Utilizatori WHERE id_utilizator=?',
        [req.user.id], (err, r) => {
            if (err || !r.length) return res.status(404).json({ eroare: 'Utilizator negăsit.' });
            res.json(r[0]);
        });
    });

    app.patch('/api/auth/profil', verificaToken, (req, res) => {
        const { nume_complet, telefon, email_marketing } = req.body;
        if (typeof nume_complet !== 'string' || !nume_complet.trim() || nume_complet.length > 100)
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

    app.post('/api/auth/forgot-password', async (req, res) => {
        const { email } = req.body;
        validateCredentials(email, 'unused-password');
        const address = email.trim().toLowerCase();
        const message = { mesaj: 'Dacă emailul există, vei primi un link de resetare.' };
        const [rows] = await db.promise().execute('SELECT id_utilizator,nume_complet FROM Utilizatori WHERE email=?', [address]);
        if (rows.length) {
            const token = crypto.randomBytes(32).toString('hex');
            const digest = crypto.createHash('sha256').update(token).digest('hex');
            await db.promise().execute('UPDATE Utilizatori SET reset_token=?,reset_token_expires=? WHERE id_utilizator=?',
                [digest, new Date(Date.now() + 3600000), rows[0].id_utilizator]);
            const link = `${SITE_URL}/resetare-parola?token=${token}`;
            try { await emailTransporter.sendMail({ from: EMAIL_FROM, to: address, subject: 'Resetare parolă — HoteluriRo',
                text: `Pentru resetarea parolei accesează ${link}. Linkul este valabil o oră.` }); }
            catch { console.error('Email resetare indisponibil.'); }
        }
        res.json(message);
    });

    app.post('/api/auth/reset-password', async (req, res) => {
        const { token, parola_noua } = req.body;
        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(400, 'Token invalid.');
        validatePassword(parola_noua);
        const digest = crypto.createHash('sha256').update(token).digest('hex');
        const hash = await bcrypt.hash(parola_noua, 10);
        const [result] = await db.promise().execute(`UPDATE Utilizatori SET parola=?,reset_token=NULL,reset_token_expires=NULL
            WHERE reset_token=? AND reset_token_expires>NOW()`, [hash, digest]);
        if (!result.affectedRows) throw new HttpError(400, 'Link expirat sau invalid. Solicită un nou link.');
        res.json({ mesaj: 'Parola a fost resetată cu succes! Te poți autentifica.' });
    });
}

module.exports = { registerRoutes };
