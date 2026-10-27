const PDFDocument = require('pdfkit');
const path = require('path');

// Stelele sunt forme PDF, fără dependență de glifele disponibile în font.
function drawHotelStars(doc, x, y, rating, color) {
    const number = Number(rating);
    const count = Number.isInteger(number) && number >= 1 && number <= 5 ? number : 0;
    doc.save();
    for (let star = 0; star < count; star++) {
        const cx = x + star * 12 + 4.5, cy = y + 5;
        for (let point = 0; point < 10; point++) {
            const angle = -Math.PI / 2 + point * Math.PI / 5;
            const radius = point % 2 === 0 ? 4.5 : 2;
            const px = cx + Math.cos(angle) * radius, py = cy + Math.sin(angle) * radius;
            if (point === 0) doc.moveTo(px, py); else doc.lineTo(px, py);
        }
        doc.closePath().fill(color);
    }
    doc.restore();
    doc.font('R').fontSize(9).fillColor('#888888').text(count ? `(${count} ${count === 1 ? 'stea' : 'stele'})` : 'Clasificare neprecizata', x + count * 12, y);
}

function vatBreakdown(total, rate = 19) {
    const cents = Math.round(Number(total) * 100);
    if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isFinite(rate) || rate < 0) throw new Error('Valoare TVA invalidă.');
    const base = Math.round(cents / (1 + rate / 100));
    return { pretFaraTVA: base / 100, tva: (cents - base) / 100 };
}

const genereazaPDFBuffer = (r) => new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const checkin_d  = new Date(r.data_checkin);
    const checkout_d = new Date(r.data_checkout);
    const nopti      = Math.max(1, Math.floor((checkout_d - checkin_d) / (1000 * 60 * 60 * 24)));
    const pretNoapte  = Number(r.pret_pe_noapte) || 0;
    const pretTotal   = Number(r.pret_total) || 0;
    const { tva, pretFaraTVA } = vatBreakdown(pretTotal);

    const fmtD = (d) => new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });

    doc.registerFont('R',  path.join(__dirname, '../../fonts/Roboto-Regular.ttf'));
    doc.registerFont('RB', path.join(__dirname, '../../fonts/Roboto-Bold.ttf'));

    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

    const GOLD  = '#C4A050';
    const DARK  = '#0A0E23';
    const GRAY  = '#888888';
    const LGRAY = '#f5f5f5';

    // Header
    doc.rect(0, 0, 595, 110).fill(DARK);
    doc.fontSize(28).font('RB').fillColor(GOLD).text('HoteluriRo', 50, 30);
    doc.fontSize(9).font('R').fillColor('#BDBECA')
       .text('Platforma nationala de rezervari hoteliere', 50, 65)
       .text('contact@hoteluriro.ro  ·  www.hoteluriro.ro', 50, 80);
    doc.fontSize(11).font('RB').fillColor(GOLD)
       .text(`FACTURA #${String(r.id_rezervare).padStart(6, '0')}`, 400, 35, { align: 'right', width: 145 });
    doc.fontSize(9).font('R').fillColor('#BDBECA')
       .text(`Data emiterii: ${fmtD(new Date())}`, 400, 58, { align: 'right', width: 145 })
       .text(`Rezervare #${r.id_rezervare}`, 400, 73, { align: 'right', width: 145 });

    doc.moveTo(50, 118).lineTo(545, 118).strokeColor(GOLD).lineWidth(1.5).stroke();

    // Client + Hotel
    let y = 135;
    doc.fontSize(8).font('RB').fillColor(GOLD).text('DATE CLIENT', 50, y, { characterSpacing: 1 });
    doc.moveTo(50, y + 12).lineTo(250, y + 12).strokeColor(GOLD).lineWidth(0.5).stroke();
    y += 20;
    doc.fontSize(10).font('RB').fillColor(DARK).text(r.nume_complet, 50, y);
    y += 15;
    doc.fontSize(9).font('R').fillColor(GRAY).text(r.email, 50, y);
    if (r.telefon) { y += 13; doc.text(r.telefon, 50, y); }

    let yH = 135;
    doc.fontSize(8).font('RB').fillColor(GOLD).text('HOTEL', 310, yH, { characterSpacing: 1 });
    doc.moveTo(310, yH + 12).lineTo(545, yH + 12).strokeColor(GOLD).lineWidth(0.5).stroke();
    yH += 20;
    doc.fontSize(10).font('RB').fillColor(DARK).text(r.nume_hotel, 310, yH);
    yH += 15;
    doc.fontSize(9).font('R').fillColor(GRAY)
       .text(r.adresa_hotel + ', ' + r.nume_oras, 310, yH);
    drawHotelStars(doc, 310, yH + 13, r.stele, GOLD);

    // Detalii sejur
    y = Math.max(y, yH) + 45;
    doc.fontSize(8).font('RB').fillColor(GOLD).text('DETALII SEJUR', 50, y, { characterSpacing: 1 });
    doc.moveTo(50, y + 12).lineTo(545, y + 12).strokeColor(GOLD).lineWidth(0.5).stroke();
    y += 22;

    const cols    = [50, 180, 310, 420, 478];
    const headers = ['Tip camera', 'Check-in', 'Check-out', 'Nopti', 'Pret/noapte'];
    doc.rect(50, y, 495, 22).fill(DARK);
    headers.forEach((h, i) => {
        doc.fontSize(8).font('RB').fillColor('#fff')
           .text(h, cols[i] + 6, y + 7, { width: (cols[i+1] || 545) - cols[i] - 8 });
    });
    y += 22;

    doc.rect(50, y, 495, 24).fill(LGRAY);
    [r.tip_camera, fmtD(r.data_checkin), fmtD(r.data_checkout),
     `${nopti} ${nopti === 1 ? 'noapte' : 'nopti'}`, `${pretNoapte.toFixed(2)} RON`]
    .forEach((d, i) => {
        doc.fontSize(9).font('R').fillColor(DARK)
           .text(d, cols[i] + 6, y + 8, { width: (cols[i+1] || 545) - cols[i] - 8 });
    });
    y += 24;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').lineWidth(0.5).stroke();

    // Sumar pret
    y += 30;
    const addPretRow = (label, val, bold = false, color = DARK) => {
        doc.fontSize(bold ? 10 : 9).font(bold ? 'RB' : 'R')
           .fillColor(GRAY).text(label, 350, y)
           .fillColor(color).text(val, 460, y, { align: 'right', width: 85 });
        y += 18;
    };
    addPretRow('Subtotal (fara TVA):', `${pretFaraTVA.toFixed(2)} RON`);
    addPretRow('TVA (19%):', `${tva.toFixed(2)} RON`);
    doc.moveTo(350, y).lineTo(545, y).strokeColor(GOLD).lineWidth(0.8).stroke();
    y += 10;
    doc.rect(350, y, 195, 28).fill(DARK);
    doc.fontSize(11).font('RB')
       .fillColor('#D3D3DD').text('TOTAL:', 360, y + 8)
       .fillColor(GOLD).text(`${pretTotal.toFixed(2)} RON`, 360, y + 8, { align: 'right', width: 175 });
    y += 45;

    // Metoda de plata
    const metoda = r.metoda_plata || 'online_total';
    if (metoda === 'avans_online' && r.suma_avans) {
        const avans   = Number(r.suma_avans);
        const restPl  = Math.round((pretTotal - avans) * 100) / 100;
        doc.fontSize(8).font('RB').fillColor(GOLD).text('DETALII PLATA', 50, y, { characterSpacing: 1 });
        doc.moveTo(50, y + 12).lineTo(300, y + 12).strokeColor(GOLD).lineWidth(0.5).stroke();
        y += 22;
        doc.fontSize(9).font('R').fillColor(GRAY).text('Metoda de plata:', 50, y);
        doc.fontSize(9).font('RB').fillColor(DARK).text('Avans online + rest la cazare', 200, y);
        y += 16;
        doc.fontSize(9).font('R').fillColor(GRAY).text('Avans achitat online:', 50, y);
        doc.fontSize(9).font('RB').fillColor('#0f6e56').text(`${avans.toFixed(2)} RON`, 200, y);
        y += 16;
        doc.fontSize(9).font('R').fillColor(GRAY).text('Rest de platit la cazare:', 50, y);
        doc.fontSize(9).font('RB').fillColor('#C4A050').text(`${restPl.toFixed(2)} RON`, 200, y);
        y += 20;
    } else {
        doc.fontSize(9).font('R').fillColor(GRAY).text('Metoda de plata:', 50, y);
        doc.fontSize(9).font('RB').fillColor(DARK).text(
            metoda === 'cash_cazare' ? 'Plata cash la cazare' : 'Plata integrala online', 200, y);
        y += 20;
    }

    // Status rezervare
    const sc = ({ confirmata: { bg: '#e6f4ef', text: '#0f6e56', label: 'CONFIRMATA' },
                   in_asteptare: { bg: '#fef9e7', text: '#8a6a10', label: 'IN ASTEPTARE' },
                   anulata: { bg: '#fde8e8', text: '#aa2020', label: 'ANULATA' } })[r.status_rezervare]
               || { bg: '#fef9e7', text: '#8a6a10', label: 'IN ASTEPTARE' };
    doc.fontSize(9).font('R').fillColor(GRAY).text('Status rezervare:', 50, y);
    doc.rect(160, y - 3, 90, 16).fill(sc.bg);
    doc.fontSize(8).font('RB').fillColor(sc.text).text(sc.label, 163, y + 1);

    // Footer
    const footerLine2 = metoda === 'avans_online'
        ? 'Avansul a fost platit online. Restul se achita la receptie la data check-in-ului.'
        : metoda === 'cash_cazare'
        ? 'Plata integrala se efectueaza la receptia hotelului la data check-in-ului.'
        : 'Plata a fost efectuata integral online.';
    doc.rect(0, 760, 595, 82).fill(DARK);
    doc.fontSize(8).font('R').fillColor('#9293A0')
       .text('Aceasta factura a fost generata automat de platforma HoteluriRo.', 50, 775, { align: 'center', width: 495 })
       .text(footerLine2, 50, 790, { align: 'center', width: 495 });
    doc.fontSize(7).fillColor(GOLD)
       .text('HoteluriRo © ' + new Date().getFullYear() + '  ·  Platforma de rezervari hoteliere', 50, 810, { align: 'center', width: 495 });

    doc.end();
});

module.exports = { genereazaPDFBuffer, vatBreakdown };
