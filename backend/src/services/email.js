const { escapeHTML } = require('./html');
const nodemailer = require('nodemailer');
const { genereazaPDFBuffer } = require('./pdf');
function createEmailService({ db, config, transport }) {
        const emailTransporter = transport || nodemailer.createTransport({
            service: 'gmail', auth: { user: config.emailUser, pass: config.emailPass },
        });
        const EMAIL_FROM = config.emailFrom;
        const SITE_URL = config.siteUrl;
    const trimiteEmailConfirmareRezervare = async (date) => {
        date = { ...date, nume: escapeHTML(date.nume), numeHotel: escapeHTML(date.numeHotel), tipCamera: escapeHTML(date.tipCamera) };
        const { email, nume, numeHotel, tipCamera, checkin, checkout, nopti, pretTotal, idRezervare, metodaPlata, sumaAvans } = date;
        const formatD = (s) => new Date(s).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
        const metodaText = metodaPlata === 'cash_cazare'
            ? 'Plată cash la cazare'
            : metodaPlata === 'avans_online'
            ? `Avans online plătit: ${sumaAvans} RON — restul la cazare`
            : 'Plată integrală online';

        // Generăm PDF ca atașament
        let pdfAttachment = null;
        try {
            const queryPDF = `
                SELECT r.*, u.nume_complet, u.email, u.telefon,
                       h.nume_hotel, h.adresa AS adresa_hotel, h.stele,
                       o.nume_oras, cc.denumire AS tip_camera, cc.pret_pe_noapte
                FROM Rezervari r
                JOIN Utilizatori u   ON r.id_utilizator = u.id_utilizator
                JOIN Camere c        ON r.id_camera = c.id_camera
                JOIN Categorii_Camere cc ON c.id_categorie = cc.id_categorie
                JOIN Hoteluri h      ON cc.id_hotel = h.id_hotel
                JOIN Orase o         ON h.id_oras = o.id_oras
                WHERE r.id_rezervare = ?`;
            const rows = await new Promise((res, rej) =>
                db.query(queryPDF, [idRezervare], (err, r) => err ? rej(err) : res(r))
            );
            if (rows.length) {
                const buf = await genereazaPDFBuffer(rows[0]);
                pdfAttachment = { filename: `Factura_HoteluriRo_${idRezervare}.pdf`, content: buf, contentType: 'application/pdf' };
            }
        } catch (e) { console.error('PDF attach error:', e.message); }

        await emailTransporter.sendMail({
            from: EMAIL_FROM,
            to: email,
            subject: `✓ Rezervare confirmată — ${numeHotel}`,
            attachments: pdfAttachment ? [pdfAttachment] : [],
            html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0A0E23">
              <div style="background:#0A0E23;padding:30px 40px">
                <h1 style="color:#C4A050;margin:0;font-size:26px">HoteluriRo</h1>
                <p style="color:rgba(255,255,255,0.5);margin:6px 0 0;font-size:13px">Confirmare rezervare</p>
              </div>
              <div style="padding:32px 40px;background:#fff;border:1px solid #eee">
                <p style="font-size:15px">Bună, <strong>${nume}</strong>!</p>
                <p style="font-size:15px">Rezervarea ta a fost confirmată cu succes.</p>
                <div style="background:#f8f6f1;border-left:3px solid #C4A050;padding:20px 24px;margin:24px 0;border-radius:2px">
                  <table style="width:100%;font-size:14px;border-collapse:collapse">
                    <tr><td style="padding:5px 0;color:#888">Hotel</td><td style="padding:5px 0;font-weight:600">${numeHotel}</td></tr>
                    <tr><td style="padding:5px 0;color:#888">Tip cameră</td><td style="padding:5px 0">${tipCamera}</td></tr>
                    <tr><td style="padding:5px 0;color:#888">Check-in</td><td style="padding:5px 0">${formatD(checkin)}</td></tr>
                    <tr><td style="padding:5px 0;color:#888">Check-out</td><td style="padding:5px 0">${formatD(checkout)}</td></tr>
                    <tr><td style="padding:5px 0;color:#888">Nopți</td><td style="padding:5px 0">${nopti}</td></tr>
                    <tr><td style="padding:5px 0;color:#888">Total</td><td style="padding:5px 0;font-weight:700;color:#C4A050">${pretTotal} RON</td></tr>
                    <tr><td style="padding:5px 0;color:#888">Plată</td><td style="padding:5px 0">${metodaText}</td></tr>
                  </table>
                </div>
                <p style="font-size:13px;color:#888">Număr rezervare: <strong>#${idRezervare}</strong></p>
                <a href="${SITE_URL}/rezervarile-mele" style="display:inline-block;background:#C4A050;color:#0A0E23;padding:12px 28px;text-decoration:none;border-radius:2px;font-weight:700;font-size:14px;margin-top:8px">
                  Vezi rezervările mele
                </a>
              </div>
              <div style="padding:20px 40px;background:#0A0E23;text-align:center">
                <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0">HoteluriRo © ${new Date().getFullYear()} · Platformă de rezervări hoteliere</p>
              </div>
            </div>`,
        });
    };

    const trimiteEmailBunVenit = async (email, nume) => {
        nume = escapeHTML(nume);
        await emailTransporter.sendMail({
            from: EMAIL_FROM,
            to: email,
            subject: 'Bun venit pe HoteluriRo!',
            html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0A0E23">
              <div style="background:#0A0E23;padding:30px 40px">
                <h1 style="color:#C4A050;margin:0;font-size:26px">HoteluriRo</h1>
                <p style="color:rgba(255,255,255,0.5);margin:6px 0 0;font-size:13px">Cont nou creat</p>
              </div>
              <div style="padding:32px 40px;background:#fff;border:1px solid #eee">
                <p style="font-size:15px">Bună, <strong>${nume}</strong>!</p>
                <p style="font-size:15px">Contul tău pe <strong>HoteluriRo</strong> a fost creat cu succes. Acum poți rezerva camere la cele mai bune hoteluri din România.</p>
                <a href="${SITE_URL}/hoteluri" style="display:inline-block;background:#C4A050;color:#0A0E23;padding:12px 28px;text-decoration:none;border-radius:2px;font-weight:700;font-size:14px;margin-top:16px">
                  Explorează hoteluri
                </a>
              </div>
              <div style="padding:20px 40px;background:#0A0E23;text-align:center">
                <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0">HoteluriRo © ${new Date().getFullYear()}</p>
              </div>
            </div>`,
        });
    };


    return { emailTransporter, trimiteEmailBunVenit, trimiteEmailConfirmareRezervare };
}
module.exports = { createEmailService };
