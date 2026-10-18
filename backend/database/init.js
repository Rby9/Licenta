const fs = require('node:fs');
const path = require('node:path');

async function initialize({ config, connect = options => require('mysql2/promise').createConnection(options), demo = false }) {
    const name = config.database;
    if (typeof name !== 'string' || !/^[A-Za-z0-9_]{1,64}$/.test(name)
        || ['mysql', 'sys', 'information_schema', 'performance_schema'].includes(name.toLowerCase())) {
        throw new Error('Nume de bază invalid.');
    }
    const connection = await connect({ ...config, database: undefined });
    try {
        const [tables] = await connection.execute('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=?', [name]);
        if (tables.length) throw new Error('Baza conține deja tabele. Inițializarea a fost refuzată; nu folosi acest utilitar pentru migrări.');
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
        await connection.changeUser({ database: name });
        for (const file of ['schema.sql', ...(demo ? ['demo.sql'] : [])]) {
            const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
            for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await connection.query(statement);
        }
    } finally { await connection.end(); }
}
async function main() {
    if (!process.argv.includes('--confirm-empty-database')) {
        console.error('Inițializarea necesită --confirm-empty-database și DB_NAME configurat pentru o bază NOUĂ sau goală.');
        process.exitCode = 1;
        return;
    }
    try {
        await initialize({ config: require('../src/config/database').database(), demo: process.argv.includes('--demo') });
        console.log('Schema a fost inițializată. Folosește creeaza_admin.js pentru un cont de administrare.');
    } catch (error) {
        console.error(error.code ? 'Inițializarea a eșuat. Verifică permisiunile MySQL și configurația.' : error.message);
        process.exitCode = 1;
    }
}
if (require.main === module) main();
module.exports = { initialize };
