const bcrypt = require('bcryptjs');
const readline = require('node:readline/promises');
const { Writable } = require('node:stream');

const ADMIN_ROLES = ['super_admin', 'admin_hotel', 'admin_booking', 'admin_marketing'];

function validateAdmin({ numeComplet, email, rol, parola }) {
    if (typeof numeComplet !== 'string' || !numeComplet.trim()) {
        throw new Error('Numele este obligatoriu.');
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw new Error('Adresa de email nu este validă.');
    }
    if (!ADMIN_ROLES.includes(rol)) {
        throw new Error('Alege unul dintre rolurile afișate.');
    }
    if (typeof parola !== 'string' || !parola.trim() || Buffer.byteLength(parola, 'utf8') > 72) {
        throw new Error('Parola este obligatorie și poate avea cel mult 72 de octeți UTF-8 (limita bcrypt).');
    }
    return { numeComplet: numeComplet.trim(), email: email.trim().toLowerCase(), rol, parola };
}

// Conectarea se face numai după validare. Importul fișierului nu accesează DB.
async function createAdmin(input, {
    connect = () => require('./src/config/db').promise(),
    hash = password => bcrypt.hash(password, 10),
} = {}) {
    const admin = validateAdmin(input);
    const db = await connect();
    try {
        const [existing] = await db.execute(
            'SELECT id_utilizator FROM Utilizatori WHERE email = ?', [admin.email]
        );
        if (existing.length) return { created: false };

        const passwordHash = await hash(admin.parola);
        const [result] = await db.execute(
            `INSERT INTO Utilizatori (nume_complet, email, parola, rol)
             VALUES (?, ?, ?, ?)`,
            [admin.numeComplet, admin.email, passwordHash, admin.rol]
        );
        return { created: true, id: result.insertId };
    } finally {
        await db.end();
    }
}

async function runCLI() {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.error('Rulează node backend/creeaza_admin.js într-un terminal interactiv.');
        process.exitCode = 1;
        return;
    }

    let hidden = false;
    const output = new Writable({
        write(chunk, encoding, done) {
            if (!hidden) process.stdout.write(chunk, encoding);
            done();
        },
    });
    const rl = readline.createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
    const abort = new AbortController();
    rl.on('SIGINT', () => abort.abort());
    const ask = label => rl.question(label, { signal: abort.signal });
    const askPassword = async label => {
        process.stdout.write(label);
        hidden = true;
        try { return await ask(''); }
        finally { hidden = false; process.stdout.write('\n'); }
    };

    try {
        console.log('Creează un administrator nou. Conturile existente nu sunt modificate.');
        const numeComplet = await ask('Nume complet: ');
        const email = await ask('Email: ');
        console.log(`Roluri: ${ADMIN_ROLES.join(', ')}`);
        const rol = (await ask('Rol: ')).trim();
        const parola = await askPassword('Parolă (ascunsă): ');
        const confirmare = await askPassword('Repetă parola: ');
        if (parola !== confirmare) throw new Error('Parolele nu coincid.');
        validateAdmin({ numeComplet, email, rol, parola });

        const confirmation = await ask('Creezi acest cont în baza configurată în backend/.env? [da/nu]: ');
        if (confirmation.trim().toLowerCase() !== 'da') {
            console.log('Operație anulată.');
            return;
        }
        const result = await createAdmin({ numeComplet, email, rol, parola });
        console.log(result.created
            ? 'Administrator creat cu succes.'
            : 'Există deja un cont cu acest email. Nu a fost modificat.');
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Operație anulată.');
            process.exitCode = 130;
        } else {
            // Erorile DB pot include SQL sau date de conectare; nu le afișăm.
            console.error(error.code
                ? 'Operația nu a reușit. Verifică accesul MySQL și schema bazei.'
                : error.message);
            process.exitCode = 1;
        }
    } finally {
        rl.close();
    }
}

if (require.main === module) runCLI();

module.exports = { createAdmin, validateAdmin };
