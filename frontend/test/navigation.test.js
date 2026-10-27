import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localReturnPath } from '../src/utils/navigation.js';
test('revenirea din login păstrează oferta, parametrii și ancora fără domeniul local', () => {
  const path = '/rezervare/grup?hotel_id=1&rooms=%5B%5D#oferta';
  assert.equal(localReturnPath(`http://localhost:5173${path}`, 'http://localhost:5173'), path);
  assert.equal(localReturnPath(path, 'http://localhost:5173'), path);
  assert.equal(localReturnPath('/profil', 'http://localhost:5173'), '/profil');
});
test('revenirea refuză site-uri externe, protocoale executabile și bucla spre login', () => {
  for (const value of ['https://example.invalid', '//example.invalid/checkout', 'javascript:alert(1)', '/autentificare', null, '', {}]) assert.equal(localReturnPath(value, 'http://localhost:5173'), '/');
});
