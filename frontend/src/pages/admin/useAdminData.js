import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../utils/apiRequest';
import { ADMIN_ROLES } from './adminConstants';

export function useAdminData(token, role, onError) {
  const [stats, setStats] = useState(null);
  const [platiStats, setPlatiStats] = useState(null);
  const [platiLista, setPlatiLista] = useState([]);
  const [coduri, setCoduri] = useState([]);
  const [rezervari, setRezervari] = useState([]);
  const [hoteluri, setHoteluri] = useState([]);
  const [orase, setOrase] = useState([]);
  const [utilizatori, setUtilizatori] = useState([]);
  const [oferteSez, setOferteSez] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (path, setter, signal) => {
    try { setter(await apiRequest(path, { token, signal })); }
    catch (error) { if (error.name !== 'AbortError') onError(error.message || 'Datele nu au putut fi încărcate.'); }
  }, [token, onError]);
  const fetchStats = useCallback(signal => load('/api/admin/stats', setStats, signal), [load]);
  const fetchPlatiStats = useCallback(signal => load('/api/admin/plati/stats', setPlatiStats, signal), [load]);
  const fetchPlatiLista = useCallback(signal => load('/api/admin/plati/lista', setPlatiLista, signal), [load]);
  const fetchCoduri = useCallback(signal => load('/api/admin/coduri', setCoduri, signal), [load]);
  const fetchRezervari = useCallback(signal => load('/api/admin/rezervari', setRezervari, signal), [load]);
  const fetchHoteluri = useCallback(signal => load('/api/hoteluri', setHoteluri, signal), [load]);
  const fetchOrase = useCallback(signal => load('/api/orase', setOrase, signal), [load]);
  const fetchUtilizatori = useCallback(signal => load('/api/admin/utilizatori', setUtilizatori, signal), [load]);
  const fetchOferteSez = useCallback(signal => load('/api/admin/oferte-sezon', setOferteSez, signal), [load]);

  useEffect(() => {
    if (!token || !ADMIN_ROLES.includes(role)) return;
    const controller = new AbortController();
    const tasks = [fetchStats];
    if (['super_admin', 'admin_hotel', 'admin_marketing'].includes(role)) tasks.push(fetchHoteluri, fetchOrase);
    tasks.push(fetchRezervari);
    if (['super_admin', 'admin_booking', 'admin_marketing'].includes(role)) tasks.push(fetchUtilizatori);
    if (['super_admin', 'admin_booking'].includes(role)) tasks.push(fetchPlatiStats, fetchPlatiLista);
    if (['super_admin', 'admin_marketing'].includes(role)) tasks.push(fetchCoduri, fetchOferteSez);
    Promise.all(tasks.map(task => task(controller.signal))).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [token, role, fetchStats, fetchPlatiStats, fetchPlatiLista, fetchCoduri, fetchRezervari, fetchHoteluri, fetchOrase, fetchUtilizatori, fetchOferteSez]);
  return { stats, platiStats, platiLista, coduri, rezervari, hoteluri, orase, utilizatori, oferteSez, setStats, setPlatiStats, setPlatiLista, setCoduri, setRezervari, setHoteluri, setOrase, setUtilizatori, setOferteSez, fetchStats, fetchPlatiStats, fetchPlatiLista, fetchCoduri, fetchRezervari, fetchHoteluri, fetchOrase, fetchUtilizatori, fetchOferteSez, loading };
}
