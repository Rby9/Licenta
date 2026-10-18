const db = require('../src/config/db');

db.connect(err => {
  if (err) { console.error('Conexiune esuata:', err); process.exit(1); }
  console.log('Conectat.');

  const queries = [
    `CREATE TABLE IF NOT EXISTS Oferte_Sezon (
      id_oferta INT AUTO_INCREMENT PRIMARY KEY,
      tip VARCHAR(50) NOT NULL,
      titlu VARCHAR(200) NOT NULL,
      descriere TEXT,
      discount_procent DECIMAL(5,2) DEFAULT 0,
      data_start DATE,
      data_sfarsit DATE,
      activa TINYINT(1) DEFAULT 1,
      culoare VARCHAR(20) DEFAULT '#C4A050',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `INSERT INTO Oferte_Sezon (tip, titlu, descriere, discount_procent, data_start, data_sfarsit, activa, culoare) VALUES
      ('paste',   'Ofertă Paște 2026',        'Celebrează sărbătorile pascale în cele mai frumoase hoteluri din România. Reduceri exclusive la sejururi de 2+ nopți.', 20.00, '2026-04-17', '2026-04-20', 0, '#4CAF50')`,
    `INSERT INTO Oferte_Sezon (tip, titlu, descriere, discount_procent, data_start, data_sfarsit, activa, culoare) VALUES
      ('craciun', 'Ofertă Crăciun 2025',      'Petrece Crăciunul în atmosferă magică. Pachete speciale cu mic dejun inclus și decorațiuni festive în toate hotelurile partenere.', 15.00, '2025-12-20', '2025-12-26', 0, '#E53935')`,
    `INSERT INTO Oferte_Sezon (tip, titlu, descriere, discount_procent, data_start, data_sfarsit, activa, culoare) VALUES
      ('revelion', 'Ofertă Revelion 2025/2026', 'Întâmpină Noul An în stil! Cină festivă, muzică live și artificii incluse. Locuri limitate — rezervă acum.', 25.00, '2025-12-30', '2026-01-01', 1, '#7B1FA2')`,
  ];

  let i = 0;
  const next = () => {
    if (i >= queries.length) { console.log('Gata! Oferte de sezon create.'); db.end(); return; }
    db.query(queries[i], err => {
      if (err) console.error(`Query ${i+1} eroare:`, err.message);
      else console.log(`Query ${i+1} OK`);
      i++; next();
    });
  };
  next();
});
