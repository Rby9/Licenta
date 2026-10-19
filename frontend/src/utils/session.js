const SESSION_EVENT = 'utilizator-update';

export function parseUser(raw) {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

export function subscribeSession(callback) {
  const onStorage = event => {
    if (event.key === null || ['utilizator', 'token'].includes(event.key)) callback();
  };
  window.addEventListener(SESSION_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(SESSION_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

export function saveSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('utilizator', JSON.stringify(user));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('utilizator');
  window.dispatchEvent(new Event(SESSION_EVENT));
}
