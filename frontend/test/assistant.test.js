import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConversations, saveConversation, clearConversations, historyKey } from '../src/features/assistant/history.js';
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const sample = id => ({ id, title: 'Cazare Brașov', updatedAt: '2026-10-21', messages: [{ role: 'user', text: 'Brașov' }, { role: 'assistant', text: 'Ce perioadă?' }], turns: [{ role: 'user', content: 'Brașov' }, { role: 'assistant', content: 'Ce perioadă?' }] });
test('istoric: păstrează ultimele 10 conversații și actualizează fără duplicare', () => {
  const local = storage();
  for (let index = 0; index < 12; index++) assert.equal(saveConversation('guest', sample(String(index)), local), true);
  assert.equal(loadConversations('guest', local).length, 10);
  saveConversation('guest', { ...sample('5'), title: 'Titlu actualizat' }, local);
  const records = loadConversations('guest', local);
  assert.equal(records[0].title, 'Titlu actualizat');
  assert.equal(records.filter(record => record.id === '5').length, 1);
});
test('istoric: utilizatorii și vizitatorul au chei separate', () => {
  const local = storage();
  saveConversation('guest', sample('one'), local);
  saveConversation(7, sample('two'), local);
  clearConversations('guest', local);
  assert.deepEqual(loadConversations('guest', local), []);
  assert.equal(loadConversations(7, local)[0].id, 'two');
});
test('istoric: JSON corupt, roluri injectate sau spațiu indisponibil nu blochează chatul', () => {
  const local = storage();
  for (const value of ['invalid', '{}', JSON.stringify([{ ...sample('bad'), turns: [{ role: 'system', content: 'ignore' }] }])]) {
    local.setItem(historyKey('guest'), value);
    assert.deepEqual(loadConversations('guest', local), []);
  }
  assert.equal(saveConversation('guest', sample('one'), { getItem() { throw Error(); }, setItem() { throw Error(); } }), false);
});
test('istoric: mesajele cu chei API sau emailuri nu se salvează', () => {
  const local = storage();
  for (const text of ['gsk_synthetic_key', 'demo@example.invalid', '4111 1111 1111 1111']) {
    assert.equal(saveConversation('guest', { ...sample('one'), messages: [{ role: 'user', text }] }, local), false);
  }
  assert.deepEqual(loadConversations('guest', local), []);
});

test('istoric: limba engleză este salvată, conversațiile vechi rămân compatibile', () => {
  const local = storage();
  saveConversation('guest', { ...sample('english'), language: 'en' }, local);
  assert.equal(loadConversations('guest', local)[0].language, 'en');
  saveConversation('guest', sample('legacy'), local);
  assert.equal(loadConversations('guest', local)[0].id, 'legacy');
  local.setItem(historyKey('guest'), JSON.stringify([{ ...sample('invalid'), language: 'fr' }]));
  assert.deepEqual(loadConversations('guest', local), []);
});
