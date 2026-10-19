const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');

const roles = ['client', 'super_admin', 'admin_hotel', 'admin_booking', 'admin_marketing'];
const cases = [
    ['/api/admin/stats', roles.slice(1)],
    ['/api/admin/rezervari', roles.slice(1)],
    ['/api/admin/utilizatori', ['super_admin', 'admin_booking', 'admin_marketing']],
    ['/api/admin/plati/lista', ['super_admin', 'admin_booking']],
    ['/api/admin/coduri', ['super_admin', 'admin_marketing']],
    ['/api/admin/oferte-sezon', ['super_admin', 'admin_marketing']],
];

test('API administrativ: rolurile sunt verificate pe server pentru toate listele', async t => {
    let role;
    let dataQueries = 0;
    const db = {
        promise: () => ({ execute: async () => [[{ id_utilizator: 1, rol: role }]] }),
        query(sql, params, callback) {
            dataQueries++;
            const cb = typeof params === 'function' ? params : callback;
            cb(null, /AS val|as val/.test(sql) ? [{ val: 0 }] : []);
        },
    };
    const app = createApp({ db, stripe: null,
        config: { jwtSecret: 'synthetic-secret', siteUrl: 'http://localhost:5173' },
        transport: { sendMail: async () => assert.fail('Nu trimite emailuri') },
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const token = jwt.sign({ id: 1 }, 'synthetic-secret');
    for (role of roles) {
        for (const [path, allowed] of cases) {
            const previousQueries = dataQueries;
            const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: { Authorization: `Bearer ${token}` } });
            assert.equal(response.status, allowed.includes(role) ? 200 : 403, `${role}: ${path}`);
            if (!allowed.includes(role)) assert.equal(dataQueries, previousQueries, 'Accesul refuzat nu citește datele administrative');
            await response.arrayBuffer();
        }
    }
});
