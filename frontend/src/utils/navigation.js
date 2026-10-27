// React Router primește o cale internă. Acceptăm și URL-urile locale salvate
// anterior de checkout, dar niciodată o redirecționare către alt site.
export function localReturnPath(value, origin) {
  if (typeof value !== 'string' || !value.trim()) return '/';
  try {
    const target = new URL(value, origin);
    if (target.origin !== new URL(origin).origin || target.pathname === '/autentificare') return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return '/'; }
}
