import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { apiRequest } from '../utils/apiRequest';
import '../styles/group-checkout.css';

function requestGroup(path, language, options = {}) {
  return apiRequest(path, { ...options, headers: { 'Accept-Language': language, ...options.headers } });
}

export default function RezervareGrup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { token, utilizator } = useSession();
  const language = params.get('lang') === 'en' ? 'en' : 'ro';
  const t = (ro, en) => language === 'en' ? en : ro;
  const amount = cents => `${(cents / 100).toLocaleString(language === 'en' ? 'en-GB' : 'ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON`;
  const [method, setMethod] = useState('online_total');
  const [quote, setQuote] = useState(null);
  const [group, setGroup] = useState(null);
  const [orders, setOrders] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [cancelAccepted, setCancelAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const actionRef = useRef(false);
  const returnToRef = useRef(window.location.href);
  const groupId = params.get('group_id'), lineId = params.get('line_id'), sessionId = params.get('session_id');
  const rooms = params.get('rooms'), hotelId = params.get('hotel_id'), checkin = params.get('checkin'), checkout = params.get('checkout');
  const owner = utilizator?.id_utilizator || utilizator?.id;
  useEffect(() => {
    if (!token || !owner) { sessionStorage.setItem('returnTo', returnToRef.current); navigate('/autentificare'); }
  }, [token, owner, navigate]);
  useEffect(() => {
    if (!token || !owner) return;
    const controller = new AbortController();
    setBusy(true); setError(''); setQuote(null); setGroup(null); setOrders(null); setAccepted(false); setCancelAccepted(false);
    async function load() {
      if (groupId || lineId) {
        const data = sessionId ? await requestGroup('/api/rezervari-grup/confirmare', language, { token, method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId }) })
          : await requestGroup(groupId ? `/api/rezervari-grup/${groupId}` : `/api/rezervari-grup/linie/${lineId}`, language, { token, signal: controller.signal });
        if (groupId && String(data.id_grup) !== groupId) throw new Error('Sesiunea nu corespunde grupului.');
        if (!controller.signal.aborted) setGroup(data);
      } else if (rooms && hotelId) {
        const data = await requestGroup('/api/rezervari-grup/oferta', language, { token, method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hotelId, checkin, checkout, rooms: JSON.parse(rooms), method }) });
        if (!controller.signal.aborted) setQuote(data);
      } else {
        const data = await requestGroup('/api/rezervari-grup', language, { token, signal: controller.signal });
        if (!controller.signal.aborted) setOrders(data);
      }
    }
    load().catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [token, owner, groupId, lineId, sessionId, rooms, hotelId, checkin, checkout, method, refresh, language]);

  async function approve(event) {
    event.preventDefault();
    if (!quote || !accepted || actionRef.current) return;
    actionRef.current = true; setBusy(true); setError('');
    try {
      const data = await requestGroup('/api/rezervari-grup/aprobare', language, { token, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteToken: quote.quoteToken, approved: true }) });
      if (data.url) window.location.assign(data.url);
      else if (data.group) navigate(`/rezervare/grup?group_id=${data.group.id_grup}&lang=${language}`, { replace: true });
    } catch (error) { setError(error.message); if (error.status === 409) { setQuote(null); setAccepted(false); } }
    finally { actionRef.current = false; setBusy(false); }
  }
  async function cancel() {
    if (!group || !cancelAccepted || actionRef.current) return;
    actionRef.current = true; setBusy(true); setError('');
    try { setGroup(await requestGroup(`/api/rezervari-grup/${group.id_grup}/anulare`, language, { token, method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approved: true }) })); setCancelAccepted(false); }
    catch (error) { setError(error.message); }
    finally { actionRef.current = false; setBusy(false); }
  }
  async function resumePayment() {
    if (!group || actionRef.current) return;
    actionRef.current = true; setBusy(true); setError('');
    try {
      const data = await requestGroup(`/api/rezervari-grup/${group.id_grup}/reia-plata`, language, { token, method: 'POST' });
      if (data.url) window.location.assign(data.url); else setGroup(data.group);
    } catch (error) { setError(error.message); }
    finally { actionRef.current = false; setBusy(false); }
  }
  const data = quote || group;
  const inactive = group && ['anulata', 'expirata'].includes(group.status);
  const paid = group && ['platita', 'avans_platit'].includes(group.paymentStatus);
  const policy = t('Poți anula întregul grup cu mai mult de 24 de ore înainte de check-in. Anularea nu rambursează automat plata; rambursarea se verifică separat cu administratorul.', 'You can cancel the whole group more than 24 hours before check-in. Cancellation does not automatically refund payment; contact the administrator to review a refund.');
  const states = { in_asteptare: t('În așteptarea plății — camerele nu sunt confirmate', 'Awaiting payment — rooms are not confirmed'), confirmata: t('Toate camerele sunt confirmate', 'All rooms are confirmed'), anulata: t('Rezervare de grup anulată', 'Group booking cancelled'), expirata: t('Checkout expirat', 'Checkout expired') };
  return <main className="group-checkout" lang={language}>
    <h1>{t('Rezervare asistată', 'Assisted booking')}</h1>
    <p>{t('Verifică oferta și aprobă rezervarea înainte de continuare.', 'Review the offer and approve the booking before continuing.')}</p>
    {error && <p role="alert" className="group-error">{error}</p>}
    {busy && <p role="status">{t('Se verifică…', 'Checking…')}</p>}
    {orders && <section><h2>{t('Rezervările tale de grup', 'Your group bookings')}</h2>{orders.length === 0 && <p>{t('Nu ai comenzi de grup.', 'You have no group orders.')}</p>}{orders.map(order => <p key={order.id_grup}><Link to={`/rezervare/grup?group_id=${order.id_grup}&lang=${language}`}>#{order.id_grup} · {order.nume_hotel} · {states[order.status_rezervare]} · {amount(order.totalCents)}</Link></p>)}</section>}
    {data && <section aria-label={t('Oferta de rezervare', 'Booking offer')}>
      <h2>{data.hotelName}</h2><p>{data.checkin} – {data.checkout} · {data.nights} {t('nopți', 'nights')}</p>
      <p>{data.rooms.length} {t('camere', 'rooms')} · {data.adults} {t('adulți în întregul grup', 'adults in the entire group')}</p>
      <ol>{data.rooms.map((room, index) => <li key={index}>{room.name} — {room.adults} {t(room.adults === 1 ? 'adult' : 'adulți', room.adults === 1 ? 'adult' : 'adults')} / {t('capacitate', 'capacity')} {room.capacity}<br />{amount(room.nightlyCents)} / {t('noapte', 'night')} · {amount(room.totalCents)} {t('pentru sejur', 'for the stay')}</li>)}</ol>
      <dl><dt>{inactive ? t('Valoarea ofertei aprobate', 'Approved offer value') : t('Total pentru toate camerele', 'Total for all rooms')}</dt><dd>{amount(data.totalCents)}</dd>{!inactive && <><dt>{paid ? t('Achitat online', 'Paid online') : t('De achitat online', 'Online amount')}</dt><dd>{amount(data.dueNowCents)}</dd><dt>{t('Rest de achitat la cazare', 'Balance due at the property')}</dt><dd>{amount(data.totalCents - data.dueNowCents)}</dd></>}</dl>
      {group && <><h3 aria-live="polite">{states[group.status]}</h3><p>{t('Starea plății', 'Payment status')}: {({ in_asteptare: t('neachitată online', 'not paid online'), avans_platit: t('avans plătit', 'deposit paid'), platita: t('plătită integral', 'paid in full'), rambursare_in_curs: t('rambursare în curs', 'refund pending'), rambursata: t('rambursare inițiată', 'refund initiated') })[group.paymentStatus]}</p>
        {group.status === 'anulata' && paid && <p>{t('Anularea nu rambursează automat plata. Pentru verificarea rambursării, contactează administratorul.', 'Cancellation does not automatically refund payment. Contact the administrator to review a refund.')}</p>}
        {group.status === 'in_asteptare' && <button disabled={busy} onClick={resumePayment}>{t('Continuă plata ofertei aprobate', 'Continue payment for the approved offer')}</button>}
        {group.status === 'confirmata' && <><p>{policy}</p><label><input type="checkbox" checked={cancelAccepted} onChange={event => setCancelAccepted(event.target.checked)} />{t('Doresc anularea tuturor camerelor din acest grup.', 'I want to cancel every room in this group.')}</label><button onClick={cancel} disabled={busy || !cancelAccepted}>{t('Confirmă anularea întregului grup', 'Confirm cancellation of the whole group')}</button></>}
      </>}
    </section>}
    {!groupId && !lineId && rooms && hotelId && <form onSubmit={approve}>
      <label>{t('Metoda de plată', 'Payment method')}<select aria-label={t('Metoda de plată', 'Payment method')} value={method} disabled={busy} onChange={event => setMethod(event.target.value)}>
        <option value="online_total">{t('Plată integrală online', 'Pay in full online')}</option><option value="avans_online">{t('Avans online 30%, restul la cazare', '30% online deposit, balance at the property')}</option><option value="cash_cazare">{t('Plată integrală la cazare — 0 RON online', 'Pay at the property — 0 RON online')}</option>
      </select></label>
      {quote && <><p>{policy}</p><p>{t('Oferta este valabilă 10 minute. Camerele nu sunt blocate pe durata plății. Dacă nu mai sunt disponibile după plata online, rambursarea întregii plăți este inițiată.', 'The offer is valid for 10 minutes. Rooms are not held during payment. If unavailable after online payment, a full refund is initiated.')}</p>
        <label><input type="checkbox" required checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)} />{t('Am verificat toate camerele, persoanele, datele, totalul și accept politica de anulare.', 'I have reviewed every room, guest, date and amount and accept the cancellation policy.')}</label>
        {!quote.onlineEnabled && method !== 'cash_cazare' && <p>{t('Plata online nu este configurată. Poți alege plata la cazare.', 'Online payment is not configured. You can choose to pay at the property.')}</p>}
        <button type="submit" disabled={!accepted || busy || (!quote.onlineEnabled && method !== 'cash_cazare')}>{method === 'cash_cazare' ? t('Confirmă rezervarea cu plata la cazare', 'Confirm booking with payment at the property') : t(`Aprobă și continuă la plata de ${amount(quote.dueNowCents)}`, `Approve and continue to pay ${amount(quote.dueNowCents)}`)}</button>
      </>}
    </form>}
    {!busy && error && <button onClick={() => setRefresh(value => value + 1)}>{t('Verifică din nou oferta / starea', 'Check the offer / status again')}</button>}
    <nav><Link to={`/rezervare/grup?lang=${language}`}>{t('Toate rezervările de grup', 'All group bookings')}</Link><Link to="/rezervarile-mele">{t('Rezervările mele', 'My bookings')}</Link><Link to="/hoteluri">{t('Înapoi la hoteluri', 'Back to hotels')}</Link></nav>
  </main>;
}
