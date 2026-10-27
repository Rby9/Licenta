const prefix = 'hoteluriro-assistant-v1:';
export const historyKey = owner => `${prefix}${owner}`;
const sensitive = value => /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\d[ -]?){13,19}|\b(?:gsk_|sk_live_|sk_test_|eyJ)[\w.-]+/i.test(value);
const validTurn = turn => turn && ['user', 'assistant'].includes(turn.role) && typeof turn.content === 'string' && turn.content.length <= 1500;

export function loadConversations(owner, storage = localStorage) {
  try {
    const data = JSON.parse(storage.getItem(historyKey(owner)) || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string'
      && (item.language === undefined || ['ro', 'en'].includes(item.language))
      && typeof item.updatedAt === 'string' && Array.isArray(item.turns) && item.turns.length <= 24
      && item.turns.every((turn, index) => validTurn(turn) && turn.role === (index % 2 ? 'assistant' : 'user'))
      && item.turns.length % 2 === 0 && Array.isArray(item.messages) && item.messages.length <= 60
      && item.messages.every(message => message && ['user', 'assistant'].includes(message.role) && typeof message.text === 'string' && message.text.length <= 2000))
      .slice(0, 10);
  } catch { return []; }
}

export function saveConversation(owner, conversation, storage = localStorage) {
  try {
    if (conversation.messages.some(message => sensitive(message.text))) return false;
    const entries = loadConversations(owner, storage).filter(item => item.id !== conversation.id);
    storage.setItem(historyKey(owner), JSON.stringify([conversation, ...entries].slice(0, 10)));
    return true;
  } catch { return false; }
}

export function clearConversations(owner, storage = localStorage) {
  try { storage.removeItem(historyKey(owner)); return true; } catch { return false; }
}
