import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/apiRequest';

export function useHotelData(id) {
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eroare, setEroare] = useState(null);
  const [galerie, setGalerie] = useState([]);
  const [galerieLoading, setGalerieLoading] = useState(true);
  const [facilitati, setFacilitati] = useState([]);
  const [recenzii, setRecenzii] = useState([]);
  const [sectionErrors, setSectionErrors] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const load = async () => {
      try { setHotel(await apiRequest(`/api/hoteluri/${id}`, { signal })); }
      catch (error) { if (!signal.aborted) setEroare(error.message || 'Hotelul nu a putut fi încărcat.'); }
      finally { if (!signal.aborted) setLoading(false); }
    };
    const optional = async (path, setter, message) => {
      try { setter(await apiRequest(`/api/hoteluri/${id}/${path}`, { signal })); }
      catch { if (!signal.aborted) setSectionErrors(previous => [...previous, message]); }
      finally { if (path === 'galerie' && !signal.aborted) setGalerieLoading(false); }
    };
    load();
    optional('galerie', setGalerie, 'Galeria nu a putut fi încărcată.');
    optional('facilitati', setFacilitati, 'Facilitățile nu au putut fi încărcate.');
    optional('recenzii', setRecenzii, 'Recenziile nu au putut fi încărcate.');
    return () => controller.abort();
  }, [id]);

  return { hotel, loading, eroare, galerie, galerieLoading, facilitati, recenzii, setRecenzii, sectionErrors };
}
