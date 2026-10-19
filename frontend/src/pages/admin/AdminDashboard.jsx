import HotelLocationPicker from '../../components/HotelLocationPicker';
import HotelImage from '../../components/HotelImage';
import { demoImageChoices, hotelCover, demoHotelImage } from '../../utils/demoImages';
import { monthlyBookings } from './adminData';
import { createAdminStyles } from './adminStyles';
import { useAdminData } from './useAdminData';
import { ADMIN_ROLES, ROL_LABEL } from './adminConstants';
import OverviewTab from './OverviewTab';
import HotelsTab from './HotelsTab';
import ReservationsTab from './ReservationsTab';
import UsersTab from './UsersTab';
import PaymentsTab from './PaymentsTab';
import MarketingTab from './MarketingTab';
import { useSession } from '../../hooks/useSession';
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { API_URL } from "../../api";

// ──────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();

  // ── Verificare admin ───────────────────────────────────────────────────
  const { utilizator, token } = useSession();

  useEffect(() => {
    if (!utilizator || !token) { navigate("/autentificare"); return; }
    if (!ADMIN_ROLES.includes(utilizator.rol)) { navigate("/"); }
  }, [navigate, token, utilizator]);

  // ── Helper paginare ────────────────────────────────────────────────────
  const [paginaRez,  setPaginaRez]  = useState(1);
  const [paginaUtil, setPaginaUtil] = useState(1);
  const [paginaPlati, setPaginaPlati] = useState(1);

  // ── Tab activ (implicit bazat pe rol) ─────────────────────────────────
  const tabDefault = () => {
    const r = utilizator?.rol;
    if (r === "admin_hotel")     return "hoteluri";
    if (r === "admin_marketing") return "marketing";
    if (r === "admin_booking")   return "rezervari";
    return "dashboard";
  };
  const [tab, setTab] = useState(tabDefault);

  // ── State date ─────────────────────────────────────────────────────────
  const [formCod, setFormCod]         = useState({ cod: "", procent_reducere: 10, descriere: "", data_start: "", data_expirare: "", utilizari_maxime: "" });
  const [formNewsletter, setFormNewsletter] = useState({ subiect: "", continut: "" });
  const [newsletterRezultat, setNewsletterRezultat] = useState(null);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const newsletterPending = useRef(false);
  const savePending = useRef({ hotel: false, category: false });
  const [savingHotel, setSavingHotel] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [eroare, setEroare]         = useState("");
  const [succes, setSucces]         = useState("");

  // ── State formulare ────────────────────────────────────────────────────
  const [modalHotel, setModalHotel]   = useState(null);
  const [modalOras, setModalOras]     = useState(false);
  const [modalCategorie, setModalCategorie] = useState(null);
  const [formHotel, setFormHotel]     = useState({ latitudine: "", longitudine: "", id_oras: "", nume_hotel: "", adresa: "", stele: 3, descriere: "", imagine_url: "", imagine_2: "", imagine_3: "" });
  const [formOras, setFormOras]       = useState({ nume_oras: "", imagine_url: "" });
  const [formCategorie, setFormCategorie] = useState({ denumire: "", capacitate: 2, pret_pe_noapte: "", descriere: "", numar_camere: 1 });
  const [editingCat, setEditingCat]   = useState(null);
  const [editingCatForm, setEditingCatForm] = useState({});
  const [focusField, setFocus]        = useState(null);
  const [filtruRez, setFiltruRez]     = useState("toate");
  const [cautareRez, setCautareRez]   = useState("");
  const [expandedHotel, setExpanded]  = useState(null);
  const [categorii, setCategorii]     = useState({});

  // ── Poze hoteluri ──────────────────────────────────────────────────────
  const [pozaProfilFisier, setPozaProfilFisier] = useState(null);
  const [pozaProfilPreview, setPozaProfilPreview] = useState(null);
  const [modPoza, setModPoza]             = useState("demo");
  const [uploadingPoza, setUploadingPoza] = useState(false);

  // ── Galerie hotel ──────────────────────────────────────────────────────
  const [galeriFisiere, setGaleriFisiere] = useState([]);
  const [galeriPreview, setGaleriPreview] = useState([]);
  const [galerie, setGalerie]             = useState({}); // { id_hotel: [poze] }
  const [uploadingGalerie, setUploadingGalerie] = useState(false);

  // ── Filtru dashboard ───────────────────────────────────────────────────
  const [perioadaDashboard, setPerioadaDashboard] = useState("toate");

  // ── Oferte hoteluri expandate ──────────────────────────────────────────
  const [oferteExpandate, setOferteExpandate] = useState(false);
  const OFERTE_VIZIBILE = 5;

  // ── Oferte de sezon ────────────────────────────────────────────────────
  const [editOferta, setEditOferta] = useState(null);

  const { stats, platiStats, platiLista, coduri, rezervari, hoteluri, orase, utilizatori, oferteSez, setCoduri, setRezervari, setHoteluri, setUtilizatori, setOferteSez, fetchCoduri, fetchHoteluri, fetchOrase, fetchStats, fetchPlatiStats, fetchPlatiLista, loading: loadingData } = useAdminData(token, utilizator?.rol, setEroare);

  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

  const handleToggleOfertaSez = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/oferte-sezon/${id}/toggle`, { method: "PATCH", headers });
      if (!res.ok) return showEroare("Oferta nu a putut fi actualizată.");
      setOferteSez(prev => prev.map(o => o.id_oferta === id ? { ...o, activa: o.activa ? 0 : 1 } : o));
    } catch { showEroare("Operația nu a reușit. Verifică conexiunea și încearcă din nou."); }
  };

  const handleSaveOfertaSez = async (id, form) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/oferte-sezon/${id}`, {
        method: "PATCH", headers,
        body: JSON.stringify(form),
      });
      if (!res.ok) return showEroare("Oferta nu a putut fi salvată.");
      setOferteSez(prev => prev.map(o => o.id_oferta === id ? { ...o, ...form } : o));
      setEditOferta(null);
    } catch { showEroare("Operația nu a reușit. Verifică conexiunea și încearcă din nou."); }
  };

  const handleCreazaCod = async () => {
    if (!formCod.cod || !formCod.procent_reducere) return showEroare("Completează codul și procentul.");
    try {
      const res = await fetch(`${API_URL}/api/admin/coduri`, {
        method: "POST", headers,
        body: JSON.stringify(formCod),
      });
      if (!res.ok) { const d = await res.json(); return showEroare(d.eroare || "Eroare."); }
      showSucces("Cod creat!");
      setFormCod({ cod: "", procent_reducere: 10, descriere: "", data_start: "", data_expirare: "", utilizari_maxime: "" });
      fetchCoduri();
    } catch { showEroare("Eroare server."); }
  };

  const handleToggleCod = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/coduri/${id}/toggle`, { method: "PATCH", headers });
      if (!res.ok) return showEroare("Operația nu a fost acceptată de server.");
      setCoduri(prev => prev.map(c => c.id_cod === id ? { ...c, activ: c.activ ? 0 : 1 } : c));
    } catch { showEroare("Operația nu a reușit. Verifică conexiunea și încearcă din nou."); }
  };

  const handleTrimiteNewsletter = async () => {
    if (newsletterPending.current) return;
    if (!formNewsletter.subiect || !formNewsletter.continut) return showEroare("Completează subiectul și conținutul.");
    newsletterPending.current = true;
    setNewsletterLoading(true);
    setNewsletterRezultat(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/marketing/email`, {
        method: "POST", headers,
        body: JSON.stringify(formNewsletter),
      });
      const d = await res.json();
      if (!res.ok) {
        setNewsletterRezultat({ ok: false, mesaj: d.eroare || "Eroare la trimitere." });
        return;
      }
      setNewsletterRezultat({ ok: true, mesaj: d.mesaj });
      setFormNewsletter({ subiect: "", continut: "" });
    } catch {
      setNewsletterRezultat({ ok: false, mesaj: "Eroare de rețea — nu s-a putut trimite newsletter-ul." });
    } finally { newsletterPending.current = false; setNewsletterLoading(false); }
  };

  const handleStergeCod = async (id) => {
    if (!window.confirm("Ștergi acest cod de reducere?")) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/coduri/${id}`, { method: "DELETE", headers });
      if (!res.ok) return showEroare("Operația nu a fost acceptată de server.");
      setCoduri(prev => prev.filter(c => c.id_cod !== id));
      showSucces("Cod șters.");
    } catch { showEroare("Operația nu a reușit. Verifică conexiunea și încearcă din nou."); }
  };

  const handleToggleOferta = async (e, idHotel) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_URL}/api/admin/hoteluri/${idHotel}/oferta`, { method: "PATCH", headers });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return showEroare(d.eroare || `Eroare ${res.status} la actualizarea ofertei.`);
      }
      setHoteluri(prev => prev.map(h => h.id_hotel === idHotel ? { ...h, oferta_activa: h.oferta_activa ? 0 : 1 } : h));
      showSucces("Ofertă actualizată!");
    } catch {
      showEroare("Eroare de rețea la actualizarea ofertei.");
    }
  };

  const handleSchimbaRolUtilizator = async (idUtilizator, rolNou) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/utilizatori/${idUtilizator}/rol`, {
        method: "PATCH", headers,
        body: JSON.stringify({ rol: rolNou }),
      });
      if (!res.ok) { const d = await res.json(); return showEroare(d.eroare || "Eroare."); }
      showSucces("Rol actualizat!");
      setUtilizatori(prev => prev.map(u =>
        u.id_utilizator === idUtilizator ? { ...u, rol: rolNou } : u
      ));
    } catch { showEroare("Eroare server."); }
  };

  const fetchCategorii = async (hotelId) => {
    try {
      const res = await fetch(`${API_URL}/api/hoteluri/${hotelId}`);
      if (res.ok) {
        const data = await res.json();
        setCategorii(prev => ({ ...prev, [hotelId]: data.categorii_camere }));
      }
    } catch { showEroare("Operația nu a reușit. Verifică conexiunea și încearcă din nou."); }
  };

  // ── Mesaj helper ──────────────────────────────────────────────────────
  const showSucces = (msg) => {
    setSucces(msg); setEroare("");
    setTimeout(() => setSucces(""), 3000);
  };
  const showEroare = (msg) => {
    setEroare(msg); setSucces("");
    setTimeout(() => setEroare(""), 4000);
  };

  // ── Upload poză profil ────────────────────────────────────────────────
  const handleSelectPozaProfil = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPozaProfilFisier(file);
    const reader = new FileReader();
    reader.onload = ev => setPozaProfilPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleUploadPozaProfil = async (hotelId) => {
    if (!pozaProfilFisier) return true;
    try {
      setUploadingPoza(true);
      const fd = new FormData();
      fd.append("poze", pozaProfilFisier);
      const res = await fetch(`${API_URL}/api/admin/hoteluri/${hotelId}/poze`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.imagine_url) setFormHotel(prev => ({ ...prev, imagine_url: data.imagine_url }));
      return true;
    } catch {
      showEroare("Eroare la upload-ul pozei de profil.");
      return false;
    } finally {
      setUploadingPoza(false);
    }
  };

  // ── Galerie hotel ─────────────────────────────────────────────────────
  const fetchGalerie = async (hotelId) => {
    try {
      const res = await fetch(`${API_URL}/api/hoteluri/${hotelId}/galerie`);
      if (res.ok) {
        const data = await res.json();
        setGalerie(prev => ({ ...prev, [hotelId]: data }));
      }
    } catch { showEroare("Operația nu a reușit. Verifică conexiunea și încearcă din nou."); }
  };

  const handleSelectGalerie = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setGaleriFisiere(files);
    const previews = [];
    let loaded = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        previews.push(ev.target.result);
        loaded++;
        if (loaded === files.length) setGaleriPreview([...previews]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUploadGalerie = async (hotelId) => {
    if (!galeriFisiere.length) return;
    try {
      setUploadingGalerie(true);
      const fd = new FormData();
      galeriFisiere.forEach(f => fd.append("galerie", f));
      const res = await fetch(`${API_URL}/api/admin/hoteluri/${hotelId}/galerie`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error();
      showSucces("Poze adăugate în galerie!");
      setGaleriFisiere([]); setGaleriPreview([]);
      fetchGalerie(hotelId);
    } catch {
      showEroare("Eroare la upload-ul galeriei.");
    } finally {
      setUploadingGalerie(false);
    }
  };

  const handleStergePozaGalerie = async (idPoza, hotelId) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/galerie/${idPoza}`, {
        method: "DELETE", headers,
      });
      if (!res.ok) throw new Error();
      setGalerie(prev => ({
        ...prev,
        [hotelId]: prev[hotelId].filter(p => p.id_poza !== idPoza)
      }));
      showSucces("Poză ștearsă din galerie!");
    } catch {
      showEroare("Eroare la ștergerea pozei.");
    }
  };

  // ── CRUD Hotel ────────────────────────────────────────────────────────
  const handleSalveazaHotel = async () => {
    if (savePending.current.hotel) return;
    if (!formHotel.id_oras || !formHotel.nume_hotel)
      return showEroare("Completează câmpurile obligatorii.");
    if (formHotel.latitudine == null || formHotel.latitudine === "" || formHotel.longitudine == null || formHotel.longitudine === "")
      return showEroare("Alege poziția hotelului pe hartă.");
    savePending.current.hotel = true; setSavingHotel(true);
    try {
      const isEdit = modalHotel !== "nou";
      const url = isEdit ? `${API_URL}/api/admin/hoteluri/${modalHotel.id_hotel}` : `${API_URL}/api/admin/hoteluri`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers,
        body: JSON.stringify(formHotel),
      });
      if (!res.ok) { const d = await res.json(); return showEroare(d.eroare || "Eroare."); }
      const savedData = await res.json();
      const hotelId = isEdit ? modalHotel.id_hotel : savedData.id_hotel;

      const uploaded = !pozaProfilFisier || !hotelId || await handleUploadPozaProfil(hotelId);
      if (uploaded) showSucces(isEdit ? "Hotel actualizat!" : "Hotel adăugat!");
      else showEroare("Hotelul a fost salvat, dar fotografia nu a putut fi încărcată. Poți reîncerca din editare.");
      setModalHotel(null);
      setPozaProfilFisier(null); setPozaProfilPreview(null);
      fetchHoteluri();
    } catch { showEroare("Eroare server."); }
    finally { savePending.current.hotel = false; setSavingHotel(false); }
  };

  const handleStergeHotel = async (id) => {
    if (!window.confirm("Ești sigur că vrei să ștergi acest hotel? Toate camerele și rezervările asociate vor fi șterse!")) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/hoteluri/${id}`, { method: "DELETE", headers });
      if (!res.ok) { const d = await res.json(); return showEroare(d.eroare || "Eroare."); }
      showSucces("Hotel șters!");
      fetchHoteluri();
    } catch { showEroare("Eroare server."); }
  };

  // ── CRUD Oraș ─────────────────────────────────────────────────────────
  const handleSalveazaOras = async () => {
    if (!formOras.nume_oras) return showEroare("Introdu numele orașului.");
    try {
      const res = await fetch(`${API_URL}/api/admin/orase`, {
        method: "POST", headers,
        body: JSON.stringify(formOras),
      });
      if (!res.ok) { const d = await res.json(); return showEroare(d.eroare || "Eroare."); }
      showSucces("Oraș adăugat!");
      setModalOras(false);
      setFormOras({ nume_oras: "" });
      fetchOrase();
    } catch { showEroare("Eroare server."); }
  };

  // ── CRUD Categorie ────────────────────────────────────────────────────
  const handleSalveazaCategorieInline = async (id_categorie, id_hotel) => {
    if (!editingCatForm.denumire || !editingCatForm.pret_pe_noapte)
      return showEroare("Completează denumirea și prețul.");
    try {
      const res = await fetch(`${API_URL}/api/admin/categorii/${id_categorie}`, {
        method: "PUT", headers,
        body: JSON.stringify(editingCatForm),
      });
      if (!res.ok) { const d = await res.json(); return showEroare(d.eroare || "Eroare."); }
      showSucces("Categorie actualizată!");
      setEditingCat(null);
      fetchCategorii(id_hotel); fetchHoteluri();
    } catch { showEroare("Eroare server."); }
  };

  const handleSalveazaCategorie = async () => {
    if (savePending.current.category) return;
    if (!formCategorie.denumire || !formCategorie.pret_pe_noapte)
      return showEroare("Completează denumirea și prețul.");
    savePending.current.category = true; setSavingCategory(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/categorii`, {
        method: "POST", headers,
        body: JSON.stringify({ ...formCategorie, id_hotel: modalCategorie.id_hotel }),
      });
      if (!res.ok) { const d = await res.json(); return showEroare(d.eroare || "Eroare."); }
      showSucces("Categoria și camerele rezervabile au fost adăugate!");
      setModalCategorie(null);
      setFormCategorie({ denumire: "", capacitate: 2, pret_pe_noapte: "", descriere: "", numar_camere: 1 });
      fetchCategorii(modalCategorie.id_hotel);
      fetchHoteluri();
    } catch { showEroare("Eroare server."); }
    finally { savePending.current.category = false; setSavingCategory(false); }
  };

  const handleStergeCategorie = async (idCategorie, idHotel) => {
    if (!window.confirm("Ștergi această categorie de cameră?")) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/categorii/${idCategorie}`, { method: "DELETE", headers });
      if (!res.ok) { const d = await res.json(); return showEroare(d.eroare || "Eroare."); }
      showSucces("Categorie ștearsă!");
      fetchCategorii(idHotel); fetchHoteluri();
    } catch { showEroare("Eroare server."); }
  };

  // ── Schimbare status rezervare ─────────────────────────────────────────
  const handleSchimbaStatus = async (id, status) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/rezervari/${id}/status`, {
        method: "PATCH", headers,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json(); return showEroare(d.eroare || "Eroare."); }
      setRezervari(prev => prev.map(r =>
        r.id_rezervare === id ? { ...r, status_rezervare: status } : r
      ));
      fetchStats();
      if (["super_admin", "admin_booking"].includes(utilizator?.rol)) { fetchPlatiStats(); fetchPlatiLista(); }
      showSucces("Status actualizat!");
    } catch { showEroare("Eroare server."); }
  };

  // ── Filtrare rezervări ─────────────────────────────────────────────────
  const rezervariFiltrate = rezervari.filter(r => {
    const matchStatus = filtruRez === "toate" || r.status_rezervare === filtruRez;
    const matchCautare = !cautareRez ||
      r.nume_hotel?.toLowerCase().includes(cautareRez.toLowerCase()) ||
      r.nume_complet?.toLowerCase().includes(cautareRez.toLowerCase());
    return matchStatus && matchCautare;
  });

  // ── Date grafic lunar ──────────────────────────────────────────────────
  const { counts: graficLunar, revenue: graficVenituri } = monthlyBookings(rezervari);

  // ── Stiluri ─────────────────────────────────────────────────────────────
  const s = createAdminStyles(focusField);

  // ════════════════════════════════════════════════════════════════════════
  //  RENDER TABS
  // ════════════════════════════════════════════════════════════════════════

  // ── Filtrare date dashboard ───────────────────────────────────────────
  const getStatsFiltrate = () => {
    const acum = new Date();
    let rez = rezervari;
    if (perioadaDashboard === "luna") {
      rez = rezervari.filter(r => {
        const d = new Date(r.data_crearii);
        return d.getMonth() === acum.getMonth() && d.getFullYear() === acum.getFullYear();
      });
    } else if (perioadaDashboard === "an") {
      rez = rezervari.filter(r => new Date(r.data_crearii).getFullYear() === acum.getFullYear());
    }
    return {
      total: rez.length,
      active: rez.filter(r => r.status_rezervare === "confirmata").length,
      venituri: rez.filter(r => r.status_rezervare === "confirmata").reduce((s, r) => s + Number(r.pret_total), 0),
    };
  };

  // ── Tab Plăți ──────────────────────────────────────────────────────────
  // ── Tab Marketing ──────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="admin-page" style={s.page}>

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="page-heading" style={s.header}>
        <div style={s.headerInner}>
          <div style={s.headerTop}>
            <div>
              <h1 style={s.headerTitle}>Panou administrare</h1>
            </div>
            <span style={s.adminBadge}>{ROL_LABEL[utilizator?.rol] || "Admin"}</span>
          </div>
          <div className="admin-tabs" style={s.tabs}>
            {[
              { key: "dashboard",   label: "Dashboard",   roluri: ["super_admin", "admin_marketing"] },
              { key: "hoteluri",    label: "Hoteluri",    roluri: ["super_admin", "admin_hotel"] },
              { key: "rezervari",   label: "Rezervări",   roluri: ["super_admin", "admin_hotel", "admin_booking"] },
              { key: "utilizatori", label: "Utilizatori", roluri: ["super_admin", "admin_booking"] },
              { key: "plati",       label: "Plăți",       roluri: ["super_admin", "admin_booking"] },
              { key: "marketing",   label: "Marketing",   roluri: ["super_admin", "admin_marketing"] },
            ].filter(t => t.roluri.includes(utilizator?.rol)).map(t => (
              <button key={t.key} style={s.tabBtn(tab === t.key)} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONȚINUT ──────────────────────────────────────────────────── */}
      <div className="page-layout" style={s.layout}>
        {loadingData && <p role="status">Se încarcă datele panoului…</p>}
        {succes && <div role="status" style={s.msgSucces}>✓ {succes}</div>}
        {eroare && !modalHotel && !modalCategorie && !modalOras && <div role="alert" style={s.msgEroare}>⚠ {eroare}</div>}

        {tab === "dashboard"   && <OverviewTab
          getStatsFiltrate={getStatsFiltrate}
          setPerioadaDashboard={setPerioadaDashboard}
          perioadaDashboard={perioadaDashboard}
          s={s}
          stats={stats}
          graficLunar={graficLunar}
          graficVenituri={graficVenituri}
        />}
        {tab === "hoteluri"    && <HotelsTab
          s={s}
          setFormHotel={setFormHotel}
          setModalHotel={value => { setEroare(""); setSucces(""); setModalHotel(value); }}
          setFormOras={setFormOras}
          setModalOras={value => { setEroare(""); setSucces(""); setModalOras(value); }}
          hoteluri={hoteluri}
          expandedHotel={expandedHotel}
          handleToggleOferta={handleToggleOferta}
          setExpanded={setExpanded}
          categorii={categorii}
          fetchCategorii={fetchCategorii}
          orase={orase}
          setPozaProfilFisier={setPozaProfilFisier}
          setPozaProfilPreview={setPozaProfilPreview}
          setGaleriFisiere={setGaleriFisiere}
          setGaleriPreview={setGaleriPreview}
          setModPoza={setModPoza}
          handleStergeHotel={handleStergeHotel}
          setFormCategorie={setFormCategorie}
          setModalCategorie={value => { setEroare(""); setSucces(""); setModalCategorie(value); }}
          editingCat={editingCat}
          editingCatForm={editingCatForm}
          setEditingCatForm={setEditingCatForm}
          handleSalveazaCategorieInline={handleSalveazaCategorieInline}
          setEditingCat={setEditingCat}
          handleStergeCategorie={handleStergeCategorie}
        />}
        {tab === "rezervari"   && <ReservationsTab
          s={s}
          cautareRez={cautareRez}
          setCautareRez={setCautareRez}
          setPaginaRez={setPaginaRez}
          filtruRez={filtruRez}
          setFiltruRez={setFiltruRez}
          rezervariFiltrate={rezervariFiltrate}
          paginaRez={paginaRez}
          handleSchimbaStatus={handleSchimbaStatus}
          utilizator={utilizator}
          token={token}
          showEroare={showEroare}
        />}
        {tab === "utilizatori" && <UsersTab
          s={s}
          utilizatori={utilizatori}
          utilizator={utilizator}
          paginaUtil={paginaUtil}
          handleSchimbaRolUtilizator={handleSchimbaRolUtilizator}
          setPaginaUtil={setPaginaUtil}
        />}
        {tab === "plati"       && <PaymentsTab
          s={s}
          platiStats={platiStats}
          platiLista={platiLista}
          paginaPlati={paginaPlati}
          setPaginaPlati={setPaginaPlati}
        />}
        {tab === "marketing"   && <MarketingTab
          utilizatori={utilizatori}
          coduri={coduri}
          hoteluri={hoteluri}
          rezervari={rezervari}
          s={s}
          formCod={formCod}
          setFormCod={setFormCod}
          setFocus={setFocus}
          handleCreazaCod={handleCreazaCod}
          handleToggleCod={handleToggleCod}
          handleStergeCod={handleStergeCod}
          oferteExpandate={oferteExpandate}
          OFERTE_VIZIBILE={OFERTE_VIZIBILE}
          handleToggleOferta={handleToggleOferta}
          setOferteExpandate={setOferteExpandate}
          formNewsletter={formNewsletter}
          setFormNewsletter={setFormNewsletter}
          handleTrimiteNewsletter={handleTrimiteNewsletter}
          newsletterRezultat={newsletterRezultat}
          newsletterLoading={newsletterLoading}
          oferteSez={oferteSez}
          editOferta={editOferta}
          setEditOferta={setEditOferta}
          handleSaveOfertaSez={handleSaveOfertaSez}
          handleToggleOfertaSez={handleToggleOfertaSez}
        />}
      </div>

      {/* ── MODAL HOTEL ───────────────────────────────────────────────── */}
      {modalHotel && (
        <div style={s.overlay} onClick={() => { if (!savingHotel) setModalHotel(null); }}>
          <div role="dialog" aria-modal="true" style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <div style={s.modalTitle}>
                {modalHotel === "nou" ? "Adaugă hotel nou" : `Editează: ${modalHotel.nume_hotel}`}
              </div>
            </div>
            <div style={s.modalBody}>
              {eroare && <p role="alert" style={s.msgEroare}>{eroare}</p>}
              <div style={s.fieldWrap}>
                <label htmlFor="hotel-city" style={s.label}>Oraș *</label>
                <select id="hotel-city" style={s.select("id_oras")} value={formHotel.id_oras}
                  onChange={e => setFormHotel({ ...formHotel, id_oras: e.target.value })}
                  onFocus={() => setFocus("id_oras")} onBlur={() => setFocus(null)}>
                  <option value="">Selectează orașul</option>
                  {orase.map(o => <option key={o.id_oras} value={o.id_oras}>{o.nume_oras}</option>)}
                </select>
              </div>
              <div style={s.fieldWrap}>
                <label htmlFor="hotel-name" style={s.label}>Nume hotel *</label>
                <input id="hotel-name" style={s.input("nume_hotel")} value={formHotel.nume_hotel}
                  onChange={e => setFormHotel({ ...formHotel, nume_hotel: e.target.value })}
                  onFocus={() => setFocus("nume_hotel")} onBlur={() => setFocus(null)}
                  placeholder="Ex: Hotel Demonstrativ" />
              </div>
              <div style={s.fieldWrap}>
                <label htmlFor="hotel-address" style={s.label}>Adresă</label>
                <input id="hotel-address" style={s.input("adresa")} value={formHotel.adresa}
                  onChange={e => setFormHotel({ ...formHotel, adresa: e.target.value })}
                  onFocus={() => setFocus("adresa")} onBlur={() => setFocus(null)}
                  placeholder="Ex: Bd. Eroilor 27" />
              </div>
              <div style={s.fieldWrap}>
                <label style={s.label}>Poziție pe hartă *</label>
                <HotelLocationPicker value={formHotel} onChange={({ lat, lng }) => setFormHotel(previous => ({
                  ...previous, latitudine: Number(lat.toFixed(8)), longitudine: Number(lng.toFixed(8)),
                }))} />
              </div>
              <div style={s.fieldWrap}>
                <label htmlFor="hotel-stars" style={s.label}>Clasificare (stele)</label>
                <select id="hotel-stars" style={s.select("stele")} value={formHotel.stele}
                  onChange={e => setFormHotel({ ...formHotel, stele: parseInt(e.target.value) })}
                  onFocus={() => setFocus("stele")} onBlur={() => setFocus(null)}>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} stele</option>)}
                </select>
              </div>
              <div style={s.fieldWrap}>
                <label style={s.label}>Descriere</label>
                <textarea style={s.textarea("descriere")} value={formHotel.descriere}
                  onChange={e => setFormHotel({ ...formHotel, descriere: e.target.value })}
                  onFocus={() => setFocus("descriere")} onBlur={() => setFocus(null)}
                  placeholder="Descriere scurtă a hotelului..." />
              </div>

              {/* ── POZE ── */}
              <div style={s.fieldWrap}>
                <label style={s.label}>Imagine hotel</label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                  {["demo", "url", "upload"].map(m => (
                    <button key={m} type="button" onClick={() => { setModPoza(m); if (m !== "upload") { setPozaProfilFisier(null); setPozaProfilPreview(null); } }} style={{
                      fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", fontWeight: 500,
                      letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                      padding: "5px 14px", borderRadius: "2px", border: "1px solid",
                      borderColor: modPoza === m ? "#C4A050" : "rgba(196,160,80,0.2)",
                      background: modPoza === m ? "rgba(196,160,80,0.1)" : "transparent",
                      color: modPoza === m ? "#C4A050" : "rgba(26,26,46,0.5)",
                    }}>{m === "demo" ? "Imagini demonstrative" : m === "url" ? "Link URL" : "Upload fișier"}</button>
                  ))}
                </div>

                {modPoza === "demo" ? (
                  <div>
                    <div className="demo-image-choices">
                      {Object.entries(demoImageChoices).map(([key, src]) => (
                        <button type="button" key={key} aria-label={`Imagine ${key}`} aria-pressed={formHotel.imagine_url === `demo:${key}`}
                          onClick={() => { setPozaProfilFisier(null); setPozaProfilPreview(null); setFormHotel(previous => ({ ...previous, imagine_url: `demo:${key}` })); }}>
                          <img src={src} alt={`Hotel demonstrativ ${key}`} />
                        </button>
                      ))}
                    </div>
                    <p className="demo-image-note">Imagini generate, reutilizabile. Dacă nu alegi una, hotelul primește automat o imagine demonstrativă.</p>
                  </div>
                ) : modPoza === "url" ? (
                  <input style={s.input("imagine_url")} value={formHotel.imagine_url}
                    onChange={e => setFormHotel({ ...formHotel, imagine_url: e.target.value })}
                    onFocus={() => setFocus("imagine_url")} onBlur={() => setFocus(null)}
                    placeholder="https://images.unsplash.com/..." />
                ) : (
                  <div>
                    <input type="file" accept="image/*"
                      onChange={handleSelectPozaProfil}
                      style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "#0A0E23", width: "100%" }} />
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", color: "rgba(26,26,46,0.4)", marginTop: "4px" }}>
                      Selectează o singură poză — aceasta va apărea pe card și în hero
                    </div>
                    {pozaProfilPreview && (
                      <img src={pozaProfilPreview} alt="preview profil" style={{
                        width: "100%", height: "120px", objectFit: "cover",
                        borderRadius: "2px", marginTop: "8px",
                        border: "1px solid rgba(196,160,80,0.2)",
                      }} />
                    )}
                  </div>
                )}

                {/* Preview URL */}
                {modPoza === "url" && formHotel.imagine_url && (
                  <HotelImage src={hotelCover(formHotel)} fallback={demoHotelImage(formHotel)} alt="preview"
                    onError={e => e.target.style.display = "none"}
                    style={{
                      width: "100%", height: "120px", objectFit: "cover",
                      borderRadius: "2px", marginTop: "8px",
                      border: "1px solid rgba(196,160,80,0.2)",
                    }} />
                )}
              </div>

              {/* ── GALERIE HOTEL ── */}
              {modalHotel !== "nou" && (
                <div style={s.fieldWrap}>
                  <label style={s.label}>Galerie foto hotel</label>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", color: "rgba(26,26,46,0.4)", marginBottom: "10px" }}>
                    Poze cu camerele, restaurantul, piscinele etc. — apar în pagina hotelului
                  </div>

                  {/* Upload galerie */}
                  <input type="file" accept="image/*" multiple
                    onChange={handleSelectGalerie}
                    style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "#0A0E23", width: "100%", marginBottom: "6px" }} />

                  {galeriPreview.length > 0 && (
                    <div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                        {galeriPreview.map((src, i) => (
                          <img key={i} src={src} alt={`preview ${i+1}`} style={{
                            width: "70px", height: "70px", objectFit: "cover",
                            borderRadius: "2px", border: "1px solid rgba(196,160,80,0.3)",
                          }} />
                        ))}
                      </div>
                      <button type="button" style={{ ...s.btnMic("add"), marginBottom: "12px" }}
                        disabled={uploadingGalerie}
                        onClick={() => handleUploadGalerie(modalHotel.id_hotel)}>
                        {uploadingGalerie ? "Se încarcă..." : `Adaugă ${galeriFisiere.length} poze în galerie`}
                      </button>
                    </div>
                  )}

                  {/* Poze existente în galerie */}
                  {!galerie[modalHotel?.id_hotel] && (
                    <button type="button" style={{ ...s.btnMic("edit"), fontSize: "0.72rem" }}
                      onClick={() => fetchGalerie(modalHotel.id_hotel)}>
                      Încarcă galeria existentă
                    </button>
                  )}
                  {galerie[modalHotel?.id_hotel]?.length > 0 && (
                    <div>
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(26,26,46,0.4)", marginBottom: "8px" }}>
                        Poze în galerie ({galerie[modalHotel.id_hotel].length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {galerie[modalHotel.id_hotel].map(poza => (
                          <div key={poza.id_poza} style={{ position: "relative", width: "70px" }}>
                            <img src={poza.imagine_url} alt="galerie" style={{
                              width: "70px", height: "70px", objectFit: "cover",
                              borderRadius: "2px", border: "1px solid rgba(196,160,80,0.15)",
                            }} />
                            <button type="button"
                              onClick={() => handleStergePozaGalerie(poza.id_poza, modalHotel.id_hotel)}
                              style={{
                                position: "absolute", top: "2px", right: "2px",
                                background: "rgba(200,30,30,0.85)", border: "none",
                                borderRadius: "2px", color: "#fff", fontSize: "0.6rem",
                                cursor: "pointer", padding: "1px 4px", lineHeight: 1.4,
                              }}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {galerie[modalHotel?.id_hotel]?.length === 0 && (
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(26,26,46,0.35)" }}>
                      Galeria este goală. Adaugă poze mai sus.
                    </div>
                  )}
                </div>
              )}

              <div style={s.modalBtns}>
                <button disabled={savingHotel} style={s.modalBtnPrim} onClick={handleSalveazaHotel}
                  disabled={uploadingPoza}>
                  {uploadingPoza ? "Se încarcă poza..." : savingHotel ? "Se salvează..." : modalHotel === "nou" ? "Adaugă hotel" : "Salvează modificările"}
                </button>
                <button style={s.modalBtnSec} onClick={() => { setModalHotel(null); setPozaProfilFisier(null); setPozaProfilPreview(null); setGaleriFisiere([]); setGaleriPreview([]); }}>Anulează</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ORAȘ ────────────────────────────────────────────────── */}
      {modalOras && (
        <div style={s.overlay} onClick={() => setModalOras(false)}>
          <div style={{ ...s.modal, maxWidth: "380px" }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <div style={s.modalTitle}>Adaugă oraș nou</div>
            </div>
            <div style={s.modalBody}>
              {eroare && <p role="alert" style={s.msgEroare}>{eroare}</p>}
              <div style={s.fieldWrap}>
                <label style={s.label}>Nume oraș *</label>
                <input style={s.input("nume_oras")} value={formOras.nume_oras}
                  onChange={e => setFormOras({ ...formOras, nume_oras: e.target.value })}
                  onFocus={() => setFocus("nume_oras")} onBlur={() => setFocus(null)}
                  placeholder="Ex: Ploiești" />
              </div>
              <div style={s.fieldWrap}>
                <label style={s.label}>Imagine oraș <span style={{ color: "rgba(26,26,46,0.3)", textTransform: "none", letterSpacing: 0 }}>(opțional)</span></label>
                <input style={s.input("oras_img")} value={formOras.imagine_url}
                  onChange={e => setFormOras({ ...formOras, imagine_url: e.target.value })}
                  onFocus={() => setFocus("oras_img")} onBlur={() => setFocus(null)}
                  placeholder="https://images.unsplash.com/..." />
                {formOras.imagine_url && (
                  <img src={formOras.imagine_url} alt="preview"
                    onError={e => e.target.style.display = "none"}
                    style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "2px", marginTop: "6px", border: "1px solid rgba(196,160,80,0.2)" }} />
                )}
              </div>
              <div style={s.modalBtns}>
                <button style={s.modalBtnPrim} onClick={handleSalveazaOras}>Adaugă oraș</button>
                <button style={s.modalBtnSec} onClick={() => setModalOras(false)}>Anulează</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CATEGORIE ───────────────────────────────────────────── */}
      {modalCategorie && (
        <div style={s.overlay} onClick={() => { if (!savingCategory) setModalCategorie(null); }}>
          <div role="dialog" aria-modal="true" style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <div style={s.modalTitle}>Adaugă categorie de cameră</div>
            </div>
            <div style={s.modalBody}>
              {eroare && <p role="alert" style={s.msgEroare}>{eroare}</p>}
              <div style={s.fieldWrap}>
                <label htmlFor="category-name" style={s.label}>Denumire *</label>
                <input id="category-name" style={s.input("den")} value={formCategorie.denumire}
                  onChange={e => setFormCategorie({ ...formCategorie, denumire: e.target.value })}
                  onFocus={() => setFocus("den")} onBlur={() => setFocus(null)}
                  placeholder="Ex: Camera Deluxe" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={s.fieldWrap}>
                  <label htmlFor="category-capacity" style={s.label}>Capacitate (persoane)</label>
                  <input id="category-capacity" type="number" style={s.input("cap")} value={formCategorie.capacitate}
                    onChange={e => setFormCategorie({ ...formCategorie, capacitate: parseInt(e.target.value) })}
                    onFocus={() => setFocus("cap")} onBlur={() => setFocus(null)}
                    min={1} max={10} />
                </div>
                <div style={s.fieldWrap}>
                  <label style={s.label}>Preț / noapte (RON) *</label>
                  <input id="category-price" type="number" style={s.input("pret")} value={formCategorie.pret_pe_noapte}
                    onChange={e => setFormCategorie({ ...formCategorie, pret_pe_noapte: e.target.value })}
                    onFocus={() => setFocus("pret")} onBlur={() => setFocus(null)}
                    placeholder="Ex: 350" min={0} />
                </div>
              </div>
              <div style={s.fieldWrap}>
                <label htmlFor="category-room-count" style={s.label}>Număr de camere rezervabile *</label>
                <input id="category-room-count" type="number" min="1" max="500" value={formCategorie.numar_camere ?? 1}
                  style={s.input("numar_camere")} onChange={event => setFormCategorie(previous => ({ ...previous, numar_camere: event.target.value }))} />
              </div>
              <div style={s.fieldWrap}>
                <label style={s.label}>Descriere</label>
                <textarea style={s.textarea("desc_cat")} value={formCategorie.descriere}
                  onChange={e => setFormCategorie({ ...formCategorie, descriere: e.target.value })}
                  onFocus={() => setFocus("desc_cat")} onBlur={() => setFocus(null)}
                  placeholder="Descriere scurtă a categoriei..." />
              </div>
              <div style={s.modalBtns}>
                <button disabled={savingCategory} style={s.modalBtnPrim} onClick={handleSalveazaCategorie}>Adaugă categorie</button>
                <button style={s.modalBtnSec} onClick={() => { if (!savingCategory) setModalCategorie(null); }}>Anulează</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}