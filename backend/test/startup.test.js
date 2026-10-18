const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { start } = require('../server');

test('port ocupat: nu anunță pornire reușită și închide pool-ul DB', async t => {
    const occupied = http.createServer();
    occupied.listen(0, '127.0.0.1');
    await new Promise(resolve => occupied.once('listening', resolve));
    t.after(() => new Promise(resolve => occupied.close(resolve)));
    let closed = false;
    const logs = [];
    t.mock.method(console, 'log', (...args) => logs.push(args));
    const db = { promise: () => ({ query: async sql => { assert.equal(sql, 'SELECT 1'); }, end: async () => { closed = true; } }) };
    await assert.rejects(start({ db, config: { jwtSecret: 'test-secret', siteUrl: 'http://localhost:5173',
        host: '127.0.0.1', port: occupied.address().port } }), error => error.code === 'EADDRINUSE');
    assert.equal(closed, true);
    assert.equal(logs.length, 0);
});
