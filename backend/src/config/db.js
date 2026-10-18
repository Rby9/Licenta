const mysql = require('mysql2');
const { database } = require('./database');
module.exports = mysql.createPool(database());
