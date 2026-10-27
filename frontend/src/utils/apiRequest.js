import { API_URL } from '../api';

export async function apiRequest(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(data?.eroare || `Cererea nu a reușit (${response.status}).`), { status: response.status });
  if (data === null) throw new Error('Serverul a returnat un răspuns neașteptat.');
  return data;
}
