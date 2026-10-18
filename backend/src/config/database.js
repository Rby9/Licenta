require('./env');
function database(env = process.env) {
    return {
        host: env.DB_HOST || 'localhost', user: env.DB_USER || 'root',
        password: env.DB_PASSWORD, database: env.DB_NAME || 'licenta_booking',
        port: Number(env.DB_PORT || 3306), charset: 'utf8mb4',
        waitForConnections: true, connectionLimit: 10,
    };
}
module.exports = { database };
