import { API_URL } from '../api';

export async function downloadReservation(id, token) {
  const response = await fetch(`${API_URL}/api/rezervari/${id}/factura`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.eroare || 'Documentul nu a putut fi descărcat.');
  }
  if (!response.headers.get('content-type')?.includes('application/pdf')) {
    throw new Error('Serverul nu a returnat un document PDF.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `Factura_HoteluriRo_${id}.pdf`;
  document.body.appendChild(link);
  try { link.click(); }
  finally { link.remove(); URL.revokeObjectURL(url); }
}
