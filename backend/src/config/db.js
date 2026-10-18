require('./env');
const mysql = require('mysql2');

// O singură conexiune comună; pornirea și mesajele rămân în server.js.
module.exports = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'licenta_booking',
});
