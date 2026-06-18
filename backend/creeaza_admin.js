// ─── Rulează o singură dată: node creeaza_admin.js ────────────────────────
const mysql  = require('mysql2');
const bcrypt = require('bcryptjs');

const db = mysql.createConnection({
    host: 'localhost', user: 'root',
    password: '1234',            // ← parola ta MySQL
    database: 'licenta_booking'
});

async function creeazaAdmin() {
    const email       = 'test@admin';
    const parola      = '123456';
    const numeComplet = 'Administrator';

    const hash = await bcrypt.hash(parola, 10);

    db.query('SELECT id_utilizator FROM Utilizatori WHERE email = ?', [email], (err, results) => {
        if (results && results.length > 0) {
            console.log('✅ Contul admin există deja!');
            db.end();
            return;
        }

        db.query(
            `INSERT INTO Utilizatori (nume_complet, email, parola, rol) VALUES (?, ?, ?, 'super_admin')`,
            [numeComplet, email, hash],
            (err2, result) => {
                if (err2) {
                    console.error('❌ Eroare:', err2.message);
                } else {
                    console.log('✅ Cont admin creat cu succes!');
                    console.log('   Email:  ', email);
                    console.log('   Parolă: ', parola);
                    console.log('   ID:     ', result.insertId);
                }
                db.end();
            }
        );
    });
}

creeazaAdmin();