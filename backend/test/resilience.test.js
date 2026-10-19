const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBookingService } = require('../src/services/bookings');
const { sendNotification } = require('../src/services/notifications');
const { registerCreation, registerRoutes } = require('../src/modules/rezervari/routes');

for (const failure of ['sync', 'async']) {
    test(`email ${failure}: rezervarea salvată răspunde în continuare 201`, async t => {
        const errors = [];
        t.mock.method(console, 'error', message => errors.push(message));
        const routes = {};
        const reservation = { id_rezervare: 7 };
        registerCreation({ post: (path, auth, handler) => { routes[path] = handler; } }, {
            verificaToken: () => {}, bookings: { book: async () => reservation },
            notify: () => {
                if (failure === 'sync') throw new Error('email privat');
                return Promise.reject(new Error('email privat'));
            },
        });
        let status, response;
        await routes['/api/rezervari']({ user: { id: 1 }, body: {} }, {
            status(code) { status = code; return this; }, json(body) { response = body; },
        });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(status, 201);
        assert.equal(response.id_rezervare, 7);
        assert.deepEqual(errors, ['Email confirmare indisponibil.']);
    });
}

test('notificarea reușită se execută o singură dată', async () => {
    let count = 0;
    await sendNotification(() => { count++; }, 'Eroare');
    assert.equal(count, 1);
});

for (const rollbackFails of [false, true]) {
    test(`tranzacția păstrează eroarea inițială și ${rollbackFails ? 'elimină conexiunea incertă' : 'eliberează conexiunea după rollback'}`, async () => {
        const initialError = new Error('Eroare interogare');
        const calls = [];
        const connection = {
            query: async () => {}, beginTransaction: async () => {},
            execute: async () => { throw initialError; },
            rollback: async () => { calls.push('rollback'); if (rollbackFails) throw new Error('Conexiune pierdută'); },
            release: () => calls.push('release'), destroy: () => calls.push('destroy'),
        };
        const bookings = createBookingService({ getConnection: async () => connection });
        await assert.rejects(bookings.quote({ id_camera: 1, data_checkin: '2090-11-10', data_checkout: '2090-11-12' }),
            error => error === initialError);
        assert.deepEqual(calls, ['rollback', rollbackFails ? 'destroy' : 'release']);
    });
}

test('o rezervare eliminată înainte de blocare produce 404 și rollback', async () => {
    let rolledBack = false;
    const connection = {
        query: async () => {}, beginTransaction: async () => {}, release() {},
        rollback: async () => { rolledBack = true; },
        execute: async sql => {
            if (sql.startsWith('SELECT id_camera FROM Rezervari')) return [[{ id_camera: 1 }]];
            if (sql.startsWith('SELECT * FROM Camere')) return [[{ id_camera: 1 }]];
            if (sql.includes('FROM Camere c JOIN')) return [[{ id_camera: 1 }]];
            if (sql.startsWith('SELECT * FROM Rezervari')) return [[]];
            assert.fail('Nu trebuie să actualizeze rezervarea');
        },
    };
    const bookings = createBookingService({ getConnection: async () => connection });
    await assert.rejects(bookings.changeStatus(7, 'anulata'), error => error.status === 404);
    assert.equal(rolledBack, true);
});

test('emailul de anulare eșuat nu schimbă anularea deja salvată', async t => {
    t.mock.method(console, 'error', () => {});
    let handler, saved = false, response;
    registerRoutes({ get() {}, patch(path, auth, fn) { handler = fn; } }, {
        db: { query(sql, params, callback) { callback(null, [{ id_rezervare: 7, data_checkin: '2090-11-10' }]); } },
        verificaToken() {}, ADMIN_ROLES: [], config: {},
        bookings: { changeStatus: async () => { saved = true; } },
        emailTransporter: { sendMail() { throw new Error('Email indisponibil'); } },
    });
    handler({ params: { id: 7 }, user: { id: 1 } }, { json(body) { response = body; } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(saved, true);
    assert.equal(response.mesaj, 'Rezervare anulată cu succes.');
});
