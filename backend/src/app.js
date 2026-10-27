const express = require('express');
const cors = require('cors');
const { runtime } = require('./config/runtime');
const { createAuth } = require('./middleware/auth');
const { errorHandler } = require('./services/errors');
const { integer } = require('./services/validation');
const { createUploads } = require('./services/uploads');
const { createEmailService } = require('./services/email');
const { createBookingService } = require('./services/bookings');
const { createPaymentService } = require('./services/payments');
const { createAssistantRouter } = require('./modules/assistant/routes');
const { createHoteluriRouter } = require('./modules/hoteluri/routes');
const { registerWebhook, registerPayments } = require('./modules/plati/routes');
const reservationRoutes = require('./modules/rezervari/routes');

function createApp(options = {}) {
    const config = options.config || runtime();
    if (!config.jwtSecret) throw new Error('Configurează JWT_SECRET înainte de pornire.');
    const db = options.db || require('./config/db');
    const stripe = options.stripe !== undefined ? options.stripe
        : config.stripeSecret ? require('stripe')(config.stripeSecret) : null;
    const app = express();
    app.use(cors({ origin: config.siteUrl }));
    for (const name of ['id', 'id_poza']) app.param(name, (req, res, next, value) => {
        try { integer(value); next(); } catch (error) { next(error); }
    });
    const auth = createAuth(db, config.jwtSecret);
    const uploads = createUploads({ uploadsDir: options.uploadsDir });
    const email = createEmailService({ db, config, transport: options.transport });
    const bookings = options.bookings || createBookingService(db);
    const notify = async reservation => {
        const [users] = await db.promise().execute('SELECT email,nume_complet FROM Utilizatori WHERE id_utilizator=?', [reservation.id_utilizator]);
        if (users.length) await email.trimiteEmailConfirmareRezervare({
            email: users[0].email, nume: users[0].nume_complet,
            numeHotel: reservation.nume_hotel, tipCamera: reservation.tip_camera,
            checkin: reservation.data_checkin, checkout: reservation.data_checkout,
            nopti: reservation.nopti, pretTotal: reservation.pret_total,
            idRezervare: reservation.id_rezervare, metodaPlata: reservation.metoda_plata,
            sumaAvans: reservation.suma_avans,
        });
    };
    const payments = createPaymentService({ stripe, bookings, db, config, notify });
    const dependencies = { db, config, ...auth, ...uploads, ...email, bookings, stripe, payments, notify };
    registerWebhook(app, dependencies); // Semnătura Stripe necesită corpul brut, înainte de JSON.
    app.use(express.json({ limit: '1mb' }));
    app.use((req, res, next) => { req.body ??= {}; next(); });
    app.set('json replacer', (_key, value) => typeof value === 'string'
        ? value.replace(/^http:\/\/(?:localhost|127\.0\.0\.1):500[01]\/uploads\//, '/uploads/') : value);
    app.use('/uploads', express.static(uploads.uploadsDir));
    app.use(createHoteluriRouter(db));
    app.use(createAssistantRouter({ db, config, fetchImpl: options.assistantFetch }));
    for (const domain of ['autentificare', 'administrare', 'oferte', 'recenzii']) {
        require(`./modules/${domain}/routes`).registerRoutes(app, dependencies);
    }
    reservationRoutes.registerRoutes(app, dependencies);
    reservationRoutes.registerCreation(app, dependencies);
    registerPayments(app, dependencies);
    app.use('/api', (req, res) => res.status(404).json({ eroare: 'Ruta nu există.' }));
    app.use(errorHandler);
    return app;
}
module.exports = { createApp };
