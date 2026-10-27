import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/apiRequest';
import HotelImage from '../../components/HotelImage';
import { hotelCover, usesDemoImage, demoImageNote } from '../../utils/demoImages';
import { translate, savedLanguage } from './language';
import { loadConversations, saveConversation, clearConversations } from './history';

const welcome = 'Salut! Te ajut să descoperi hotelurile din catalog și să alegi o cameră. Ce ai vrea să afli sau unde vrei să te cazezi?';
const empty = { city: null, checkin: null, checkout: null, adults: null, children: null, budget: null, budget_unit: null, room_preference: null };

export default function AiConversation({ onClose, active, owner, expanded, onToggleSize, onLanguageChange }) {
  const [initial] = useState(() => loadConversations(owner));
  const [language, setLanguage] = useState(savedLanguage(initial[0]));
  const t = (text, values) => translate(text, language, values);
  const money = value => Number(value).toLocaleString(language === 'en' ? 'en-GB' : 'ro-RO', { maximumFractionDigits: 2 });
  const dateLabel = value => value ? (language === 'en' ? new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : value.split('-').reverse().join('.')) : t('neprecizat');
  const preferences = { together: t('O singură cameră'), separate: t('Camere separate'), cheapest: t('Cea mai ieftină configurație') };
  useEffect(() => { onLanguageChange(language); }, [language, onLanguageChange]);
  const [conversationId, setConversationId] = useState(initial[0]?.id || crypto.randomUUID());
  const [messages, setMessages] = useState(initial[0]?.messages || [{ role: 'assistant', text: welcome }]);
  const [turns, setTurns] = useState(initial[0]?.turns || []);
  const [input, setInput] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(null);
  const [results, setResults] = useState(null);
  const [selection, setSelection] = useState(null);
  const [cities, setCities] = useState([]);
  const [history, setHistory] = useState(initial);
  const [view, setView] = useState('chat');
  const [storageError, setStorageError] = useState(false);
  const requestRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const latestReplyRef = useRef(null);
  const selectionRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/api/assistant/status', { signal: controller.signal }).then(data => setEnabled(data.enabled === true)).catch(error => {
      if (error.name !== 'AbortError') setEnabled(false);
    });
    apiRequest('/api/orase', { signal: controller.signal }).then(data => { if (Array.isArray(data)) setCities(data); }).catch(() => {});
    return () => { controller.abort(); requestRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!turns.length) return;
    const saved = saveConversation(owner, { id: conversationId, language, messages: messages.slice(-60), turns,
      title: messages.find(message => message.role === 'user')?.text.slice(0, 70) || translate('Căutare cazare', language), updatedAt: new Date().toISOString() });
    if (!saved) setStorageError(true);
  }, [owner, conversationId, messages, turns, language]);

  useEffect(() => {
    const log = endRef.current?.parentElement;
    const reply = latestReplyRef.current;
    if (active && view === 'chat' && log && reply) log.scrollTop = messages.at(-1)?.role === 'assistant' ? Math.max(0, reply.offsetTop - 16) : log.scrollHeight;
  }, [messages, active, view]);
  useEffect(() => {
    const log = endRef.current?.parentElement;
    const target = selection ? selectionRef.current : null;
    if (active && view === 'chat' && log && target) log.scrollTop = Math.max(0, target.offsetTop - 16);
  }, [selection, active, view]);
  useEffect(() => { if (active && view === 'chat' && status === 'idle') inputRef.current?.focus({ preventScroll: true }); }, [status, active, view]);

  function restart() {
    requestRef.current?.abort();
    setLanguage('ro'); setConversationId(crypto.randomUUID()); setTurns([]); setMessages([{ role: 'assistant', text: welcome }]);
    setAnalysis(null); setResults(null); setSelection(null); setInput(''); setError(''); setStatus('idle');
  }

  function resume(item) {
    requestRef.current?.abort();
    setLanguage(savedLanguage(item)); setConversationId(item.id); setMessages(item.messages); setTurns(item.turns);
    setAnalysis(null); setResults(null); setSelection(null); setInput(''); setError(''); setStatus('idle'); setView('chat');
  }

  async function send(event, preset) {
    event?.preventDefault();
    const text = (preset || input).trim();
    if (!text || status !== 'idle') return;
    const nextTurns = [...turns.slice(-20), { role: 'user', content: text }];
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    setStatus('thinking'); setError(''); setAnalysis(previous => previous ? { ...previous, canSearch: false } : null); setResults(null); setSelection(null);
    setMessages(previous => previous.at(-1)?.role === 'user' && previous.at(-1).text === text ? previous : [...previous, { role: 'user', text }]);
    try {
      const data = await apiRequest('/api/assistant/chat', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turns: nextTurns, language }) });
      if (controller.signal.aborted) return;
      if (data.language === 'en' || data.language === 'ro') setLanguage(data.language);
      setTurns([...nextTurns, { role: 'assistant', content: data.reply.slice(0, 1500) }]);
      setMessages(previous => [...previous, { role: 'assistant', text: data.reply }]);
      setAnalysis(data); setInput('');
    } catch (error) { if (!controller.signal.aborted) setError(language === 'en' ? t('Nu am putut finaliza cererea. Reîncearcă.') : error.message); }
    finally { if (!controller.signal.aborted) setStatus('idle'); }
  }

  async function requestCatalog(intent, city, hotel) {
    if (status !== 'idle') return;
    const label = intent === 'cities' ? t('Ce orașe sunt disponibile?') : intent === 'hotels' ? t('Ce hoteluri sunt{location}?', { location: city ? t(' în {city}', { city }) : t(' în catalog') }) : intent === 'capabilities' ? t('Cu ce mă poți ajuta?') : t('Detalii despre {hotel}', { hotel });
    const text = intent === 'cities' ? t('Ce orașe sunt disponibile?') : label;
    const controller = new AbortController(); requestRef.current = controller;
    setStatus('thinking'); setError(''); setView('chat'); setResults(null); setSelection(null);
    setMessages(previous => [...previous, { role: 'user', text }]);
    try {
      const data = await apiRequest('/api/assistant/chat', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language, catalog: { intent, ...(city ? { city } : {}), ...(hotel ? { hotel } : {}) } }) });
      if (controller.signal.aborted) return;
      if (data.language === 'en' || data.language === 'ro') setLanguage(data.language);
      setAnalysis(data);
      setMessages(previous => [...previous, { role: 'assistant', text: data.reply }]);
      setTurns(previous => [...previous.slice(-20), { role: 'user', content: text }, { role: 'assistant', content: data.reply.slice(0, 1500) }]);
    } catch (error) { if (!controller.signal.aborted) setError(language === 'en' ? t('Nu am putut finaliza cererea. Reîncearcă.') : error.message); }
    finally { if (!controller.signal.aborted) setStatus('idle'); }
  }

  async function updateCriteria(patch, label) {
    if (status !== 'idle') return;
    const values = { ...(analysis?.criteria || empty), ...patch };
    const controller = new AbortController(); requestRef.current = controller;
    setStatus('thinking'); setError(''); setResults(null); setSelection(null);
    try {
      const data = await apiRequest('/api/assistant/chat', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ criteria: values, language }) });
      if (controller.signal.aborted) return;
      if (data.language === 'en' || data.language === 'ro') setLanguage(data.language);
      setAnalysis(data); setView('chat');
      setMessages(previous => [...previous, { role: 'user', text: label }, { role: 'assistant', text: data.reply }]);
      setTurns(previous => [...previous.slice(-20), { role: 'user', content: t('Criterii confirmate de mine: {criteria}', { criteria: JSON.stringify(data.criteria) }) }, { role: 'assistant', content: data.reply.slice(0, 1500) }]);
    } catch (error) { if (!controller.signal.aborted) setError(language === 'en' ? t('Nu am putut finaliza cererea. Reîncearcă.') : error.message); }
    finally { if (!controller.signal.aborted) setStatus('idle'); }
  }

  function submitCriteria(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ages = String(form.get('children')).trim();
    const values = { city: form.get('city') || null, checkin: form.get('checkin') || null, checkout: form.get('checkout') || null,
      adults: Number(form.get('adults')) || null, children: ages ? ages.split(',').map(value => Number(value.trim())) : [],
      budget_unit: form.get('budget_unit') || null, budget: Number(form.get('budget')) || null, room_preference: form.get('room_preference') || null };
    if (values.budget_unit === 'unlimited') values.budget = null;
    updateCriteria(values, t('Am completat criteriile de cazare.'));
  }

  async function search() {
    if (!analysis?.canSearch || status !== 'idle') return;
    const controller = new AbortController(); requestRef.current = controller;
    setStatus('searching'); setError(''); setResults(null); setSelection(null);
    const criteria = analysis.criteria;
    const params = new URLSearchParams({ oras: criteria.city, checkin: criteria.checkin, checkout: criteria.checkout, guests: criteria.adults, sort: 'pret_asc' });
    if (analysis.nightlyBudget !== null) params.set('pret_max', analysis.nightlyBudget);
    try {
      const data = await apiRequest(`/api/hoteluri/search?${params}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!Array.isArray(data)) throw new Error(t('Rezultatele nu au putut fi citite.'));
      setResults(data);
      setMessages(previous => [...previous, { role: 'assistant', text: data.length ? t('Am găsit {count} hoteluri pentru criteriile confirmate. Alege un hotel din lista de mai jos, apoi categoria camerei.', { count: data.length }) : t('Nu am găsit camere pentru aceste criterii. Putem schimba orașul, perioada sau bugetul.') }]);
    } catch (error) { if (!controller.signal.aborted) setError(language === 'en' ? t('Nu am putut finaliza cererea. Reîncearcă.') : error.message); }
    finally { if (!controller.signal.aborted) setStatus('idle'); }
  }

  async function chooseHotel(hotel) {
    if (status !== 'idle') return;
    const controller = new AbortController(); requestRef.current = controller;
    setStatus('rooms'); setError(''); setSelection(null);
    const criteria = analysis.criteria;
    const params = new URLSearchParams({ checkin: criteria.checkin, checkout: criteria.checkout, guests: criteria.adults });
    try {
      const rooms = await apiRequest(`/api/hoteluri/${hotel.id_hotel}/disponibilitate?${params}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!Array.isArray(rooms)) throw new Error(t('Disponibilitatea camerelor nu a putut fi citită.'));
      setSelection({ hotel, rooms: rooms.filter(room => Number(room.camere_libere) > 0 && Number(room.capacitate) >= criteria.adults
        && (analysis.nightlyBudget === null || Number(room.pret_pe_noapte) <= analysis.nightlyBudget)) });
    } catch (error) { if (!controller.signal.aborted) setError(language === 'en' ? t('Nu am putut finaliza cererea. Reîncearcă.') : error.message); }
    finally { if (!controller.signal.aborted) setStatus('idle'); }
  }

  const criteria = analysis?.criteria || empty;
  const lastAssistant = messages.findLastIndex(message => message.role === 'assistant');
  const catalog = analysis?.catalog;
  const busy = status !== 'idle';
  return <>
    <header className="assistant-header">
      <div><h2 id="assistant-title">{view === 'history' ? t('Istoric conversații') : view === 'criteria' ? t('Criterii de cazare') : view === 'help' ? t('Cu ce te pot ajuta?') : t('Asistent HoteluriRo')}</h2><p>{view === 'chat' ? t('Descoperă, compară și rezervă') : t('Asistent HoteluriRo')}</p></div>
      <div className="assistant-toolbar">
        {view !== 'chat' && <button type="button" onClick={() => setView('chat')} aria-label={t('Înapoi la conversație')} title={t('Înapoi la conversație')}>←</button>}
        <button type="button" onClick={() => { restart(); setView('chat'); }} aria-label={t('Conversație nouă')} title={t('Conversație nouă')}>＋</button>
        <button type="button" aria-pressed={view === 'history'} onClick={() => { setHistory(loadConversations(owner)); setView(view === 'history' ? 'chat' : 'history'); }} aria-label={t('Istoric conversații')} title={t('Istoric conversații')}>◷</button>
        <button type="button" onClick={onToggleSize} aria-label={expanded ? t('Micșorează panoul') : t('Mărește panoul')} title={expanded ? t('Micșorează panoul') : t('Mărește panoul')}>{expanded ? '↙' : '↗'}</button>
        <button type="button" onClick={onClose} aria-label={t('Închide panoul')} title={t('Închide panoul')}>×</button>
      </div>
    </header>
    {view === 'chat' && <>
    <div className="assistant-messages" role="log" aria-label={t('Conversația AI')} aria-live="polite" aria-relevant="additions">
      {messages.map((message, index) => <p ref={index === lastAssistant ? latestReplyRef : null} key={index} className={`assistant-message assistant-message-${message.role}`}>
        <span className="assistant-speaker">{message.role === 'user' ? t('Tu') : t('Asistent')}</span>{message.text}
      </p>)}
      {busy && <p role="status">{status === 'thinking' ? t('Verific cererea…') : t('Verific camerele disponibile…')}</p>}
      {messages.length === 1 && <div className="assistant-suggestions">
        <button type="button" disabled={busy} onClick={() => requestCatalog('cities')}>{t('Ce orașe sunt disponibile?')}</button>
        <button type="button" disabled={busy} onClick={() => requestCatalog('hotels')}>{t('Descoperă hotelurile')}</button>
        <button type="button" onClick={() => setView('criteria')}>{t('Caută o cameră')}</button>
      </div>}
      {catalog?.type === 'cities' && <div className="assistant-city-list" aria-label={t('Orașe din catalog')}>{catalog.cities.map(city => <button type="button" key={city.id_oras} disabled={busy} onClick={() => requestCatalog('hotels', city.nume_oras)}>{city.nume_oras}<span>{city.numar_hoteluri} {Number(city.numar_hoteluri) === 1 ? 'hotel' : t('hoteluri')}</span></button>)}</div>}
      {catalog?.type === 'hotels' && <div className="assistant-results" aria-label={t('Hoteluri din catalog')}>{catalog.hotels.map(hotel => <article className="assistant-hotel assistant-catalog-hotel" key={hotel.id_hotel}>
        <HotelImage src={hotelCover(hotel)} alt={hotel.nume_hotel} loading="lazy" /><div><h3>{hotel.nume_hotel}</h3><p>{hotel.nume_oras} · {hotel.stele} {Number(hotel.stele) === 1 ? t('stea') : t('stele')}</p>
        {hotel.pret_minim !== null && <p>{t('De la {price} RON/cameră/noapte', { price: money(hotel.pret_minim) })}</p>}
        <button type="button" disabled={busy} onClick={() => requestCatalog('hotel_details', null, hotel.nume_hotel)}>{t('Detalii despre {hotel}', { hotel: hotel.nume_hotel })}</button>
        <Link to={`/hoteluri/${hotel.id_hotel}`} onClick={onClose}>{t('Deschide hotelul')}</Link></div>
      </article>)}</div>}
      {catalog?.type === 'hotel_details' && <div className="assistant-summary"><Link to={`/hoteluri/${catalog.hotel.id_hotel}`} onClick={onClose}>{t('Vezi {hotel}', { hotel: catalog.hotel.nume_hotel })}</Link><p>{t('Spune-mi perioada și numărul persoanelor pentru a căuta o cameră disponibilă.')}</p></div>}
      {analysis?.criteria && <section className="assistant-summary" aria-label={t('Rezumatul căutării')}>
        <details className="assistant-criteria-summary"><summary>{t('Rezumatul căutării')} · {criteria.city || t('oraș neprecizat')}</summary>
        <dl>
          <dt>{t('Oraș')}</dt><dd>{criteria.city || t('neprecizat')}</dd>
          <dt>{t('Perioadă')}</dt><dd>{dateLabel(criteria.checkin)} – {dateLabel(criteria.checkout)}{analysis.nights ? t(' · {count} nopți', { count: analysis.nights }) : ''}</dd>
          <dt>{t('Grup')}</dt><dd>{t('{count} adulți; ', { count: criteria.adults ?? '?' })}{criteria.children === null ? t('copii: neprecizat') : criteria.children.length ? t('copii: {ages}', { ages: criteria.children.map(age => t('{age} ani', { age })).join(', ') }) : t('fără copii')}</dd>
          <dt>{t('Camere')}</dt><dd>{preferences[criteria.room_preference] || t('preferință neprecizată')}</dd>
          <dt>{t('Buget pentru întregul grup')}</dt><dd>{criteria.budget_unit === 'unlimited' ? t('Fără limită') : criteria.budget && criteria.budget_unit ? `${money(criteria.budget)} RON ${criteria.budget_unit === 'stay' ? t('pentru tot sejurul') : t('pe noapte')}` : t('de clarificat')}</dd>
        </dl>
        <button type="button" onClick={() => setView('criteria')}>{t('Modifică criteriile')}</button></details>
        {!criteria.room_preference && <div className="assistant-actions">{Object.entries(preferences).map(([value, label]) => <button key={value} type="button" disabled={busy} onClick={() => updateCriteria({ room_preference: value }, label)}>{label}</button>)}</div>}
        {criteria.children === null && <div className="assistant-actions"><button type="button" disabled={busy} onClick={() => updateCriteria({ children: [] }, t('Fără copii'))}>{t('Fără copii')}</button></div>}
        {!criteria.budget_unit && <div className="assistant-actions">{[['stay', t('Buget pentru tot sejurul')], ['nightly', t('Buget pe noapte')], ['unlimited', t('Fără limită de buget')]].map(([value, label]) => <button key={value} type="button" disabled={busy} onClick={() => updateCriteria({ budget_unit: value }, label)}>{label}</button>)}</div>}

        {analysis.canSearch && <button type="button" onClick={search} disabled={busy}>{t('Confirmă și caută camere')}</button>}
      </section>}
      {results && <div className="assistant-results">
        <p>{results.length ? t('Alege un hotel, apoi o categorie disponibilă. Nu se încasează bani în conversație.') : t('Nu există camere pentru aceste criterii. Poți modifica perioada, bugetul sau orașul.')}</p>
        {results.slice(0, 5).map(hotel => <article className="assistant-hotel" key={hotel.id_hotel}>
          <HotelImage src={hotelCover(hotel)} alt={hotel.nume_hotel} loading="lazy" />
          <div>{usesDemoImage(hotel) && <small>{language === 'en' ? t('Imagine demonstrativă generată') : demoImageNote}</small>}<h3>{hotel.nume_hotel}</h3>
            <p>{t('{city} · O cameră pentru {count} adulți', { city: hotel.nume_oras, count: criteria.adults })}</p>
            <strong>{t('De la {price} RON / {count} nopți', { price: money(hotel.pret_minim * analysis.nights), count: analysis.nights })}</strong>
            <p>{t('{price} RON / cameră / noapte', { price: money(hotel.pret_minim) })}</p>
            <button type="button" disabled={busy} onClick={() => chooseHotel(hotel)}>{t('Alege camera la {hotel}', { hotel: hotel.nume_hotel })}</button>
          </div>
        </article>)}
        {results.length > 5 && <p>{t('Primele 5 hoteluri, în ordinea prețului.')}</p>}
      </div>}
      {selection && <section ref={selectionRef} className="assistant-summary" aria-label={t('Camere de rezervat')}>
        <h3>{t('{hotel} — alege camera', { hotel: selection.hotel.nume_hotel })}</h3>
        {selection.rooms.length === 0 && <p>{t('Nu mai există o cameră potrivită în buget. Reia căutarea sau modifică criteriile.')}</p>}
        {selection.rooms.map(room => <article className="assistant-room" key={room.id_categorie}>
          <h4>{room.denumire}</h4><p>{t('1 cameră · {count} adulți · capacitate maximă {capacity}', { count: criteria.adults, capacity: room.capacitate })}</p>
          <p>{dateLabel(criteria.checkin)} – {dateLabel(criteria.checkout)}{t(' · {count} nopți', { count: analysis.nights })}</p>
          <strong>{t('{price} RON total cazare', { price: money(room.pret_pe_noapte * analysis.nights) })}</strong>
          <p>{t('{price} RON × {count} nopți. Metoda de plată și suma de achitat acum se aleg în checkout.', { price: money(room.pret_pe_noapte), count: analysis.nights })}</p>
          <Link reloadDocument to={`/rezervare?${new URLSearchParams({ hotel_id: selection.hotel.id_hotel, categorie_id: room.id_categorie, checkin: criteria.checkin, checkout: criteria.checkout, guests: criteria.adults, rooms: '1' })}`} onClick={onClose}>{t('Continuă la checkout — 1 cameră')}</Link>
        </article>)}
        <p>{t('Disponibilitatea și prețul se verifică din nou la rezervare. Dacă nu ești autentificat, te întorci la checkout după conectare.')}</p>
      </section>}
      <div ref={endRef} />
    </div>
    <div className="assistant-controls">
      {error && <p className="assistant-error" role="alert">{error}</p>}
      {enabled === false && <p className="assistant-note" role="status">{t('Limbajul liber nu este disponibil momentan. Orașele, hotelurile și formularul pot fi folosite în continuare.')}</p>}
      <form onSubmit={send} className="assistant-form">
        <button type="button" className="assistant-options" onClick={() => setView('help')} aria-label={t('Opțiuni și întrebări')} title={t('Opțiuni și întrebări')}>＋</button>
        <label className="assistant-sr-only" htmlFor="assistant-ai-message">{t('Mesajul tău')}</label>
        <input ref={inputRef} id="assistant-ai-message" value={input} maxLength={1000} autoComplete="off" required
          placeholder={t('Întreabă despre cazare…')} disabled={busy} onChange={event => setInput(event.target.value)} />
        <button type="submit" disabled={busy} aria-label={t('Trimite mesajul')} title={t('Trimite mesajul')}>↑</button>
      </form>
      <p className="assistant-note">{language === 'en' ? 'AI via Groq' : 'AI prin Groq'} · {storageError ? t('Istoricul nu poate fi salvat') : t('Istoric pe acest dispozitiv')}</p>
    </div>
    </>}
    {view === 'history' && <section className="assistant-page assistant-history" aria-label={t('Istoric conversații')}>
      <p className="assistant-page-intro">{t('Ultimele 10 conversații de pe acest dispozitiv. Selectează una pentru a continua.')}</p>
      {history.length === 0 && <p>{t('Nicio conversație salvată.')}</p>}
      {history.map(item => <button className="assistant-history-item" key={item.id} type="button" onClick={() => resume(item)}><strong>{item.title}</strong><span>{new Date(item.updatedAt).toLocaleString(language === 'en' ? 'en-GB' : 'ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></button>)}
      {history.length > 0 && <button className="assistant-clear-history" type="button" onClick={() => { if (clearConversations(owner)) { restart(); setHistory([]); setStorageError(false); } else setStorageError(true); }}>{t('Șterge istoricul local')}</button>}
      {storageError && <p role="status">{t('Browserul nu permite salvarea istoricului.')}</p>}
    </section>}
    {view === 'criteria' && <section className="assistant-page" aria-label={t('Criterii de cazare')}>
      <p className="assistant-page-intro">{t('Bugetul acoperă toate persoanele și camerele. Verifică perioada și persoanele înainte de căutare.')}</p>
      {error && <p className="assistant-error" role="alert">{error}</p>}
        <form key={JSON.stringify(criteria)} onSubmit={submitCriteria} className="assistant-criteria-form">
          <label>{t('Oraș')}<select aria-label={t('Oraș')} name="city" defaultValue={criteria.city || ''} required><option value="">{t('Alege orașul')}</option>{cities.map(city => <option key={city.id_oras} value={city.nume_oras}>{city.nume_oras}</option>)}</select></label>
          <label>Check-in<input aria-label="Check-in" name="checkin" type="date" defaultValue={criteria.checkin || ''} required /></label>
          <label>Check-out<input aria-label="Check-out" name="checkout" type="date" defaultValue={criteria.checkout || ''} required /></label>
          <label>{t('Adulți')}<input aria-label={t('Adulți')} name="adults" type="number" min="1" max="100" defaultValue={criteria.adults || ''} required /></label>
          <label>{t('Vârste copii, separate prin virgulă (gol = fără copii)')}<input aria-label={t('Vârste copii, separate prin virgulă (gol = fără copii)')} name="children" defaultValue={criteria.children?.join(', ') || ''} placeholder={t('De exemplu: 4, 8')} /></label>
          <label>{t('Buget pentru întregul grup')}<select aria-label={t('Buget pentru întregul grup')} name="budget_unit" defaultValue={criteria.budget_unit || ''} required><option value="">{t('Alege baza bugetului')}</option><option value="stay">{t('Pentru tot sejurul')}</option><option value="nightly">{t('Pe noapte')}</option><option value="unlimited">{t('Fără limită')}</option></select></label>
          <label>{t('Suma în RON (ignorată la „Fără limită”)')}<input aria-label={t('Suma în RON (ignorată la „Fără limită”)')} name="budget" type="number" min="0.01" step="0.01" max="1000000" defaultValue={criteria.budget || ''} /></label>
          <label>{t('Preferința camerelor')}<select aria-label={t('Preferința camerelor')} name="room_preference" defaultValue={criteria.room_preference || ''} required><option value="">{t('Alege preferința')}</option>{Object.entries(preferences).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button type="submit" disabled={busy}>{t('Aplică criteriile')}</button>
        </form>
    </section>}
    {view === 'help' && <section className="assistant-page" aria-label={t('Opțiuni și întrebări')}>
      <p className="assistant-page-intro">{t('Descoperă catalogul sau pregătește o rezervare.')}</p>
      <div className="assistant-menu">
        <button type="button" disabled={busy} onClick={() => requestCatalog('cities')}>{t('Ce orașe sunt disponibile?')}<span>{t('Orașele care au hoteluri în catalog')}</span></button>
        <button type="button" disabled={busy} onClick={() => requestCatalog('hotels')}>{t('Ce hoteluri pot alege?')}<span>{t('Prezentare, prețuri de catalog și facilități')}</span></button>
        <button type="button" onClick={() => setView('criteria')}>{t('Criterii de cazare')}<span>{t('Perioadă, persoane, camere și buget')}</span></button>
        {[t('Ce metode de plată există?'), t('Cum anulez rezervarea?'), t('Primesc banii înapoi?')].map(text => <button key={text} type="button" disabled={busy} onClick={() => { setView('chat'); send(null, text); }}>{text}</button>)}
      </div>
    </section>}
  </>;
}
