const { createApp } = require('./src/app');
const { runtime } = require('./src/config/runtime');

async function start(options = {}) {
    const config = options.config || runtime();
    if (!config.jwtSecret) throw new Error('Configurează JWT_SECRET înainte de pornire.');
    const db = options.db || require('./src/config/db');
    try {
        await db.promise().query('SELECT 1');
        const app = createApp({ db, config });
        const server = app.listen(config.port, config.host);
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.once('listening', () => {
                server.removeListener('error', reject);
                resolve();
            });
        });
        console.log(`HoteluriRo API: http://${config.host}:${server.address().port}`);
        server.on('error', error => console.error('Eroare server:', error.code || 'Eroare'));
        const shutdown = () => server.close(async () => { await db.promise().end(); });
        process.once('SIGTERM', shutdown);
        process.once('SIGINT', shutdown);
        return server;
    } catch (error) { await db.promise().end(); throw error; }
}
if (require.main === module) start().catch(error => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Portul ${error.port} este deja ocupat. Oprește instanța existentă a backendului și încearcă din nou.`);
    } else {
        console.error('Pornire eșuată:', error.code || 'Verifică setările locale.');
    }
    process.exitCode = 1;
});
module.exports = { start };
