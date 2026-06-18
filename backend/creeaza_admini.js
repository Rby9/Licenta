// Creează cele 3 tipuri noi de admin — rulează o singură dată: node creeaza_admini.js
const mysql  = require('mysql2');
const bcrypt = require('bcryptjs');

const db = mysql.createConnection({
    host: 'localhost', user: 'root',
    password: '1234',
    database: 'licenta_booking'
});

const admini = [
    { email: 'hotel@admin',     parola: 'hotel123',     numeComplet: 'Admin Hotel',     rol: 'admin_hotel' },
    { email: 'marketing@admin', parola: 'marketing123', numeComplet: 'Admin Marketing', rol: 'admin_marketing' },
    { email: 'booking@admin',   parola: 'booking123',   numeComplet: 'Admin Booking',   rol: 'admin_booking' },
];

async function creeazaAdmini() {
    for (const admin of admini) {
        const hash = await bcrypt.hash(admin.parola, 10);

        await new Promise((resolve) => {
            db.query('SELECT id_utilizator FROM Utilizatori WHERE email = ?', [admin.email], (err, results) => {
                if (results && results.length > 0) {
                    console.log(`⚠️  Contul ${admin.rol} (${admin.email}) există deja — sărit.`);
                    return resolve();
                }

                db.query(
                    `INSERT INTO Utilizatori (nume_complet, email, parola, rol) VALUES (?, ?, ?, ?)`,
                    [admin.numeComplet, admin.email, hash, admin.rol],
                    (err2, result) => {
                        if (err2) {
                            console.error(`❌ Eroare la crearea ${admin.rol}:`, err2.message);
                        } else {
                            console.log(`✅ Cont ${admin.rol} creat:`);
                            console.log(`   Email:  ${admin.email}`);
                            console.log(`   Parolă: ${admin.parola}`);
                            console.log(`   ID:     ${result.insertId}`);
                        }
                        resolve();
                    }
                );
            });
        });
    }
    db.end();
}

creeazaAdmini();
