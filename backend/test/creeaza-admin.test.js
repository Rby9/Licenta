const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createAdmin, validateAdmin } = require('../creeaza_admin');

const input = {
    numeComplet: "Administrator O'Connor",
    email: 'admin@example.invalid',
    rol: 'admin_hotel',
    parola: 'parola-fictiva-pentru-test',
};

function database({ existing = [], failure } = {}) {
    const calls = [];
    let closed = false;
    return {
        calls,
        get closed() { return closed; },
        async execute(sql, params) {
            calls.push({ sql, params });
            if (failure) throw failure;
            if (sql.startsWith('SELECT')) return [existing];
            return [{ insertId: 42 }];
        },
        async end() { closed = true; },
    };
}

test('crearea folosește parametri SQL și un hash bcrypt, fără parola în rezultat', async () => {
    const db = database();
    const result = await createAdmin(input, { connect: async () => db });
    assert.deepEqual(result, { created: true, id: 42 });
    assert.equal(db.calls.length, 2);
    assert.deepEqual(db.calls[0].params, [input.email]);
    const insertion = db.calls[1];
    assert.match(insertion.sql, /INSERT INTO Utilizatori \(nume_complet, email, parola, rol\)/);
    assert.equal(insertion.params[0], input.numeComplet);
    assert.equal(insertion.params[1], input.email);
    assert.equal(insertion.params[3], input.rol);
    assert.ok(await bcrypt.compare(input.parola, insertion.params[2]));
    assert.notEqual(insertion.params[2], input.parola);
    assert.ok(!insertion.sql.includes(input.numeComplet));
    assert.ok(!JSON.stringify(result).includes(input.parola));
    assert.equal(db.closed, true);
});

test('un cont existent nu este inserat, actualizat sau rehashat', async () => {
    const db = database({ existing: [{ id_utilizator: 7 }] });
    const result = await createAdmin(input, {
        connect: async () => db,
        hash: async () => assert.fail('Nu trebuie creat hash pentru un cont existent'),
    });
    assert.deepEqual(result, { created: false });
    assert.equal(db.calls.length, 1);
    assert.match(db.calls[0].sql, /^SELECT /);
    assert.equal(db.closed, true);
});

test('datele incomplete sau rolurile nepermise sunt respinse înainte de conectare', async () => {
    for (const invalid of [
        { numeComplet: '' }, { email: 'invalid' }, { rol: 'client' },
        { rol: 'admin' }, { parola: '' }, { parola: 'a'.repeat(73) },
        { parola: 'ă'.repeat(37) },
    ]) {
        await assert.rejects(createAdmin({ ...input, ...invalid }, {
            connect: async () => assert.fail('Datele invalide nu trebuie să acceseze DB'),
        }));
    }
});

test('numele și emailul sunt normalizate, parola rămâne exact cea introdusă', () => {
    const result = validateAdmin({ ...input, numeComplet: ' Admin ', email: ' ADMIN@example.invalid ', parola: ' parola cu spații ' });
    assert.equal(result.numeComplet, 'Admin');
    assert.equal(result.email, 'admin@example.invalid');
    assert.equal(result.parola, ' parola cu spații ');
});

test('eroarea la verificarea contului oprește orice inserare și închide conexiunea', async () => {
    const failure = Object.assign(new Error('Eroare DB simulată'), { code: 'ER_TEST' });
    const db = database({ failure });
    await assert.rejects(createAdmin(input, { connect: async () => db }), failure);
    assert.equal(db.calls.length, 1);
    assert.equal(db.closed, true);
});

test('eroarea la hash oprește inserarea și închide conexiunea', async () => {
    const db = database();
    await assert.rejects(createAdmin(input, {
        connect: async () => db,
        hash: async () => { throw new Error('Hash indisponibil'); },
    }), /Hash indisponibil/);
    assert.equal(db.calls.length, 1);
    assert.equal(db.closed, true);
});
