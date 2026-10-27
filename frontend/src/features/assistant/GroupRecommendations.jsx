import { Link } from 'react-router-dom';
import HotelImage from '../../components/HotelImage';
import { hotelCover } from '../../utils/demoImages';
import { translate } from './language';

export default function GroupRecommendations({ result, language, onClose, busy, onSeparate }) {
  const t = (text, values) => translate(text, language, values);
  const money = cents => (cents / 100).toLocaleString(language === 'en' ? 'en-GB' : 'ro-RO', { maximumFractionDigits: 2 });
  const plural = (count, singular, multiple) => `${count} ${t(count === 1 ? singular : multiple)}`;
  const { criteria } = result;
  return <section className="assistant-results" aria-label={t('Repartizări pentru grup')}>
    {result.hotels.map(({ hotel, plans }) => <article className="assistant-hotel" key={hotel.id_hotel}>
      <HotelImage src={hotelCover(hotel)} alt={hotel.nume_hotel} loading="lazy" />
      <div><h3>{hotel.nume_hotel}</h3><p>{hotel.nume_oras} · {t('Toate camerele la același hotel')}</p>
        {plans.map(plan => <section className="assistant-room" key={plan.kind} aria-label={t(plan.kind === 'cheapest' ? 'Costul cel mai mic' : 'Cele mai puține camere')}>
          <h4>{t(plan.kind === 'cheapest' ? 'Costul cel mai mic' : 'Cele mai puține camere')}</h4>
          <p>{plural(plan.roomCount, 'cameră', 'camere')} · {plural(criteria.adults, 'adult', 'adulți')} · {plural(result.nights, 'noapte', 'nopți')}</p>
          <ol>{plan.rooms.map((room, index) => <li key={index}>{room.name} — {plural(room.adults, 'adult', 'adulți')}, {t('capacitate {capacity}', { capacity: room.capacity })}</li>)}</ol>
          <p>{t('{price} RON / noapte pentru întregul grup', { price: money(plan.nightlyCents) })}</p>
          <strong>{t('{price} RON total sejur pentru întregul grup', { price: money(plan.totalCents) })}</strong>
          {plan.requiresSeparateConsent && <><p>{t('Grupul nu încape într-o singură cameră disponibilă în buget. Aceasta este o alternativă în camere separate.')}</p>
            <button type="button" disabled={busy} onClick={onSeparate}>{t('Accept camere separate')}</button></>}
          {!plan.requiresSeparateConsent && <Link to={`/rezervare/grup?${new URLSearchParams({ hotel_id: hotel.id_hotel, checkin: criteria.checkin, checkout: criteria.checkout, rooms: JSON.stringify(plan.rooms.map(room => ({ categoryId: room.categoryId, adults: room.adults }))), lang: language })}`} onClick={onClose}>{t('Verifică oferta și aprobă rezervarea')}</Link>}

        </section>)}
      </div>
    </article>)}
    {result.totalHotels > 5 && <p>{t('Primele 5 hoteluri, în ordinea prețului.')}</p>}
    {result.hotels.length > 0 && <p>{t('Camerele nu sunt blocate. Disponibilitatea și prețul se verifică din nou înainte de rezervare.')}</p>}
  </section>;
}
