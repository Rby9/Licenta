// Rulează o singură dată: node migratii/adauga_poze_hoteluri.js
const mysql = require('mysql2');
const db = mysql.createConnection({ host: 'localhost', user: 'root', password: '1234', database: 'licenta_booking' });

const U = (id, w = 1200, q = 85) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}`;

// Fiecare hotel: [imagine_url, imagine_2, imagine_3]
const photos = {
  // ── 5★ LUXURY ────────────────────────────────────────────────────────────
  // ID 1 = Grand Hotel Bucharest (are deja poze locale, skip)
  5:  [U('1571896349842-33c89424de2d'), U('1578683010236-d716f9a3f461'), U('1566073771259-6a8506099945')], // Aro Palace Brasov
  10: [U('1551882547-ff40c63fe2fa'), U('1584132967334-10e028bd69f7'), U('1618773928121-c32242e63f39')],   // Pleiada Boutique
  11: [U('1542314831-068cd1dbfeeb'), U('1582719478250-c89cae4dc85b'), U('1455587734955-081b22074882')],   // Hotel Vega
  15: [U('1566073771259-6a8506099945'), U('1578683010236-d716f9a3f461'), U('1551882547-ff40c63fe2fa')],   // DoubleTree Hilton
  28: [U('1596436889106-be35e843f974'), U('1455587734955-081b22074882'), U('1582719478250-c89cae4dc85b')],// JW Marriott
  33: [U('1551882547-ff40c63fe2fa'), U('1578683010236-d716f9a3f461'), U('1571896349842-33c89424de2d')],   // Radisson Blu Cluj
  38: [U('1464822759023-fed622ff2c3b'), U('1571896349842-33c89424de2d'), U('1506905925346-21bda4d32df4')], // Cheile Gradistei (munte)
  42: [U('1542314831-068cd1dbfeeb'), U('1566073771259-6a8506099945'), U('1618773928121-c32242e63f39')],   // Hilton Timisoara
  47: [U('1596436889106-be35e843f974'), U('1582719478250-c89cae4dc85b'), U('1551882547-ff40c63fe2fa')],   // Grand Hotel Traian Iasi
  52: [U('1520250497591-112f2f40a3f4'), U('1507525428034-b723cf961d3e'), U('1533104816931-20fa691ff6ca')], // Hotel Phoenicia Mamaia (litoral)

  // ── 4★ ──────────────────────────────────────────────────────────────────
  2:  [U('1564501049412-61c2a3083791'), U('1582719478250-c89cae4dc85b'), U('1587874522487-fe10e954d035')], // Novotel
  3:  [U('1549294413-26f195200c16'), U('1631049307264-da0ec9d70304'), U('1600011689032-8b628b8a8747')],   // Grand Hotel Napoca
  7:  [U('1602002418082-a4443978a623'), U('1489171078254-c3365d6e359f'), U('1529290130-4ca3753253ae')],   // Hotel Timisoara
  9:  [U('1564501049412-61c2a3083791'), U('1582719478250-c89cae4dc85b'), U('1629140087-2a3b00e18a37')],   // Hotel International
  12: [U('1549294413-26f195200c16'), U('1631049307264-da0ec9d70304'), U('1600011689032-8b628b8a8747')],   // Continental Forum
  13: [U('1615460549969-36fa19521a4f'), U('1582719478250-c89cae4dc85b'), U('1529290130-4ca3753253ae')],   // Ramada Sibiu
  17: [U('1564501049412-61c2a3083791'), U('1489171078254-c3365d6e359f'), U('1602002418082-a4443978a623')], // Ramada Plaza
  18: [U('1549294413-26f195200c16'), U('1631049307264-da0ec9d70304'), U('1587874522487-fe10e954d035')],   // Hotel Splendid 1900
  19: [U('1602002418082-a4443978a623'), U('1582719478250-c89cae4dc85b'), U('1489171078254-c3365d6e359f')], // Continental Forum Arad
  21: [U('1615460549969-36fa19521a4f'), U('1631049307264-da0ec9d70304'), U('1549294413-26f195200c16')],   // Hotel Galati
  26: [U('1564501049412-61c2a3083791'), U('1582719478250-c89cae4dc85b'), U('1600011689032-8b628b8a8747')], // Radisson Blu Bucharest
  27: [U('1549294413-26f195200c16'), U('1631049307264-da0ec9d70304'), U('1587874522487-fe10e954d035')],   // Hilton Garden Inn
  32: [U('1602002418082-a4443978a623'), U('1489171078254-c3365d6e359f'), U('1615460549969-36fa19521a4f')], // Hotel Verso Cluj
  37: [U('1615460549969-36fa19521a4f'), U('1582719478250-c89cae4dc85b'), U('1464822759023-fed622ff2c3b')], // Hotel Ambient Brasov
  41: [U('1564501049412-61c2a3083791'), U('1631049307264-da0ec9d70304'), U('1602002418082-a4443978a623')], // Hotel Timisoara Luxury
  46: [U('1549294413-26f195200c16'), U('1582719478250-c89cae4dc85b'), U('1600011689032-8b628b8a8747')],   // Hotel Astoria Iasi
  51: [U('1520250497591-112f2f40a3f4'), U('1522798514-97ceb8c4f1c8'), U('1507525428034-b723cf961d3e')],   // Hotel Iaki Mamaia (litoral)
  55: [U('1615460549969-36fa19521a4f'), U('1582719478250-c89cae4dc85b'), U('1489171078254-c3365d6e359f')], // Hotel Am Ring Sibiu
  58: [U('1602002418082-a4443978a623'), U('1631049307264-da0ec9d70304'), U('1587874522487-fe10e954d035')], // Hotel Ramada Oradea
  61: [U('1564501049412-61c2a3083791'), U('1489171078254-c3365d6e359f'), U('1549294413-26f195200c16')],   // Hotel Select Craiova
  64: [U('1602002418082-a4443978a623'), U('1582719478250-c89cae4dc85b'), U('1615460549969-36fa19521a4f')], // Hotel Miky Arad

  // ── 3★ ──────────────────────────────────────────────────────────────────
  4:  [U('1445019980597-93fa8acb246c'), U('1595576508898-0ad5c879a061'), U('1612108887372-3e3c7e0a6f20')], // Hotel Transilvania
  6:  [U('1586023492125-27b2c045efd7'), U('1595576508898-0ad5c879a061'), U('1445019980597-93fa8acb246c')], // Pensiunea Luiza
  8:  [U('1612108887372-3e3c7e0a6f20'), U('1445019980597-93fa8acb246c'), U('1595576508898-0ad5c879a061')], // Ibis Timisoara
  14: [U('1445019980597-93fa8acb246c'), U('1489171078254-c3365d6e359f'), U('1612108887372-3e3c7e0a6f20')], // Imparatul Romanilor
  16: [U('1586023492125-27b2c045efd7'), U('1612108887372-3e3c7e0a6f20'), U('1445019980597-93fa8acb246c')], // Hotel Continental
  24: [U('1595576508898-0ad5c879a061'), U('1586023492125-27b2c045efd7'), U('1489171078254-c3365d6e359f')], // Hotel Minerva
  25: [U('1445019980597-93fa8acb246c'), U('1595576508898-0ad5c879a061'), U('1612108887372-3e3c7e0a6f20')], // Hotel Intercontinental Jr.
  31: [U('1612108887372-3e3c7e0a6f20'), U('1586023492125-27b2c045efd7'), U('1445019980597-93fa8acb246c')], // Hotel Melody Cluj
  36: [U('1445019980597-93fa8acb246c'), U('1489171078254-c3365d6e359f'), U('1595576508898-0ad5c879a061')], // Hotel Coroana Brasov
  40: [U('1586023492125-27b2c045efd7'), U('1612108887372-3e3c7e0a6f20'), U('1445019980597-93fa8acb246c')], // Hotel Central Timisoara
  45: [U('1595576508898-0ad5c879a061'), U('1445019980597-93fa8acb246c'), U('1586023492125-27b2c045efd7')], // Hotel Unirea Iasi
  50: [U('1612108887372-3e3c7e0a6f20'), U('1445019980597-93fa8acb246c'), U('1595576508898-0ad5c879a061')], // Hotel Ibis Constanta
  54: [U('1586023492125-27b2c045efd7'), U('1445019980597-93fa8acb246c'), U('1612108887372-3e3c7e0a6f20')], // Pensiunea Casa Luxemburg
  57: [U('1612108887372-3e3c7e0a6f20'), U('1586023492125-27b2c045efd7'), U('1489171078254-c3365d6e359f')], // Hotel Dacia Oradea
  60: [U('1445019980597-93fa8acb246c'), U('1595576508898-0ad5c879a061'), U('1586023492125-27b2c045efd7')], // Hotel Parc Craiova
  63: [U('1586023492125-27b2c045efd7'), U('1612108887372-3e3c7e0a6f20'), U('1445019980597-93fa8acb246c')], // Hotel Ardealul Arad

  // ── 2★ ──────────────────────────────────────────────────────────────────
  23: [U('1595576508898-0ad5c879a061'), U('1612108887372-3e3c7e0a6f20'), U('1586023492125-27b2c045efd7')], // Hotel Cismigiu
  30: [U('1612108887372-3e3c7e0a6f20'), U('1595576508898-0ad5c879a061'), U('1445019980597-93fa8acb246c')], // Hotel Pax Cluj
  35: [U('1586023492125-27b2c045efd7'), U('1595576508898-0ad5c879a061'), U('1612108887372-3e3c7e0a6f20')], // Pensiunea Coroana
  44: [U('1595576508898-0ad5c879a061'), U('1586023492125-27b2c045efd7'), U('1612108887372-3e3c7e0a6f20')], // Hotel Moldova Iasi
  49: [U('1612108887372-3e3c7e0a6f20'), U('1595576508898-0ad5c879a061'), U('1507525428034-b723cf961d3e')], // Hotel Constanta (litoral)

  // ── 1★ HOSTELURI ─────────────────────────────────────────────────────────
  22: [U('1555854877-bab0e564b8d5'), U('1517449374996-80dff23c3b16'), U('1586023492125-27b2c045efd7')],   // Hostel Tineretului
  29: [U('1517449374996-80dff23c3b16'), U('1555854877-bab0e564b8d5'), U('1586023492125-27b2c045efd7')],   // Hostel Retro Cluj
  34: [U('1555854877-bab0e564b8d5'), U('1464822759023-fed622ff2c3b'), U('1517449374996-80dff23c3b16')],   // Hostel Centrum Brasov
  39: [U('1517449374996-80dff23c3b16'), U('1555854877-bab0e564b8d5'), U('1586023492125-27b2c045efd7')],   // Hostel Costel Timisoara
  43: [U('1555854877-bab0e564b8d5'), U('1517449374996-80dff23c3b16'), U('1595576508898-0ad5c879a061')],   // Hostel Iasi Central
  48: [U('1517449374996-80dff23c3b16'), U('1555854877-bab0e564b8d5'), U('1507525428034-b723cf961d3e')],   // Hostel Marea Neagra
  53: [U('1555854877-bab0e564b8d5'), U('1517449374996-80dff23c3b16'), U('1586023492125-27b2c045efd7')],   // Hostel Centrum Sibiu
  56: [U('1517449374996-80dff23c3b16'), U('1555854877-bab0e564b8d5'), U('1595576508898-0ad5c879a061')],   // Hostel Oradea Central
  59: [U('1555854877-bab0e564b8d5'), U('1517449374996-80dff23c3b16'), U('1586023492125-27b2c045efd7')],   // Hostel Craiova Central
  62: [U('1517449374996-80dff23c3b16'), U('1555854877-bab0e564b8d5'), U('1595576508898-0ad5c879a061')],   // Hostel Arad Central
};

db.connect(err => {
  if (err) { console.error('❌ DB error:', err.message); process.exit(1); }
  console.log('✅ Conectat la DB\n');

  const ids = Object.keys(photos).map(Number);
  let done = 0;

  ids.forEach(id => {
    const [i1, i2, i3] = photos[id];
    db.query(
      'UPDATE Hoteluri SET imagine_url=?, imagine_2=?, imagine_3=? WHERE id_hotel=?',
      [i1, i2, i3, id],
      (err, result) => {
        if (err) { console.error(`  ❌ Hotel ${id}:`, err.message); }
        else if (result.affectedRows) { console.log(`  ✅ Hotel ${id} actualizat`); }
        else { console.log(`  ⚠️  Hotel ${id} — nu a fost găsit`); }
        done++;
        if (done === ids.length) { console.log('\n🏁 Gata!'); db.end(); }
      }
    );
  });
});
