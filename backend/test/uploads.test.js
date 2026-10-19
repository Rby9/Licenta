const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');

async function fixture(t) {
    const uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hoteluriro-upload-test-'));
    const writes = [];
    const db = {
        promise: () => ({ execute: async () => [[{ id_utilizator: 1, rol: 'admin_hotel' }]] }),
        query: (sql, params, callback) => { writes.push({ sql, params }); callback(null, { affectedRows: 1 }); },
    };
    const app = createApp({ db, uploadsDir, stripe: null,
        config: { jwtSecret: 'upload-test-secret', siteUrl: 'http://localhost:5173' },
        transport: { sendMail: async () => {} },
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        await fs.rm(uploadsDir, { recursive: true, force: true });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const token = jwt.sign({ id: 1 }, 'upload-test-secret');
    return { uploadsDir, writes, base, upload: (suffix, body, authenticated = true) => fetch(`${base}/api/admin/hoteluri/1/${suffix}`, {
        method: 'POST', body, headers: authenticated ? { Authorization: `Bearer ${token}` } : {},
    }) };
}

for (const [endpoint, field, count] of [['poze', 'poze', 3], ['galerie', 'galerie', 10]]) {
    test(`upload ${endpoint}: fișierele simultane rămân distincte și pot fi descărcate`, async t => {
        const app = await fixture(t);
        const form = new FormData();
        const bodies = Array.from({ length: count }, (_, i) => Buffer.from(`synthetic-image-${i}`));
        for (const bytes of bodies) form.append(field, new Blob([bytes], { type: 'image/png' }), 'same-name.png');
        // Reproduce requests whose files all reach storage in the same millisecond.
        t.mock.method(Date, 'now', () => 1800000000000);
        const response = await app.upload(endpoint, form);
        assert.equal(response.status, endpoint === 'poze' ? 200 : 201);
        const result = await response.json();
        const urls = endpoint === 'poze'
            ? [result.imagine_url, result.imagine_2, result.imagine_3]
            : app.writes[0].params[0].map(row => row[1]);
        assert.equal(new Set(urls).size, count);
        assert.equal((await fs.readdir(app.uploadsDir)).length, count);
        for (const [index, url] of urls.entries()) {
            const image = await fetch(`${app.base}${url}`);
            assert.equal(image.status, 200);
            assert.equal(image.headers.get('content-type'), 'image/png');
            assert.deepEqual(Buffer.from(await image.arrayBuffer()), bodies[index]);
        }
    });
}

test('upload: extensiile refuzate și accesul neautentificat nu scriu fișiere sau DB', async t => {
    const app = await fixture(t);
    for (const [name, authenticated, status] of [['payload.html', true, 400], ['image.png', false, 401]]) {
        const form = new FormData();
        form.append('poze', new Blob(['synthetic']), name);
        assert.equal((await app.upload('poze', form, authenticated)).status, status);
    }
    assert.deepEqual(await fs.readdir(app.uploadsDir), []);
    assert.equal(app.writes.length, 0);
});

test('upload: un fișier peste 5 MB este refuzat și nu rămâne salvat', async t => {
    const app = await fixture(t);
    const form = new FormData();
    form.append('poze', new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]), 'large.png');
    assert.equal((await app.upload('poze', form)).status, 413);
    assert.deepEqual(await fs.readdir(app.uploadsDir), []);
    assert.equal(app.writes.length, 0);
});
