// node migratii/creare_tabele_noi.js
const mysql = require('mysql2');
const db = mysql.createConnection({ host: 'localhost', user: 'root', password: '1234', database: 'licenta_booking' });

db.connect(err => {
  if (err) { console.error(err.message); process.exit(1); }

  db.query(`CREATE TABLE IF NOT EXISTS Recenzii (
    id_recenzie   INT AUTO_INCREMENT PRIMARY KEY,
    id_hotel      INT NOT NULL,
    id_utilizator INT NOT NULL,
    rating        TINYINT NOT NULL,
    comentariu    TEXT,
    data_recenziei TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_hotel)      REFERENCES Hoteluri(id_hotel) ON DELETE CASCADE,
    FOREIGN KEY (id_utilizator) REFERENCES Utilizatori(id_utilizator) ON DELETE CASCADE,
    UNIQUE KEY unic_recenzie (id_hotel, id_utilizator)
  )`, (err) => {
    if (err) console.error('Recenzii:', err.message);
    else     console.log('✅ Tabel Recenzii creat');
  });

  // MySQL 5.x nu suportă IF NOT EXISTS pe ALTER, so ignore "already exists" errors
  db.query("ALTER TABLE Utilizatori ADD COLUMN reset_token VARCHAR(64) NULL", (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('reset_token:', err.message);
    else console.log('✅ Coloana reset_token adăugată');
  });

  db.query("ALTER TABLE Utilizatori ADD COLUMN reset_token_expires DATETIME NULL", (err) => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') console.error('reset_token_expires:', err.message);
    else console.log('✅ Coloana reset_token_expires adăugată');

    setTimeout(() => db.end(), 500);
  });
});
