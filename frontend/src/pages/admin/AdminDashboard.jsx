import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

import { API_URL } from "../../api";

const ADMIN_ROLES = ["super_admin", "admin_hotel", "admin_marketing", "admin_booking"];

const ROL_LABEL = {
  super_admin:     "Super Admin",
  admin_hotel:     "Admin Hotel",
  admin_marketing: "Admin Marketing",
  admin_booking:   "Admin Booking",
  client:          "Client",
};

const ROL_STYLE = {
  super_admin:     { color: "#C4A050", bg: "rgba(196,160,80,0.1)",   border: "rgba(196,160,80,0.3)" },
  admin_hotel:     { color: "#0f6e56", bg: "rgba(29,158,117,0.1)",   border: "rgba(29,158,117,0.3)" },
  admin_marketing: { color: "#6a3dd1", bg: "rgba(106,61,209,0.08)", border: "rgba(106,61,209,0.2)" },
  admin_booking:   { color: "#1565c0", bg: "rgba(21,101,192,0.08)", border: "rgba(21,101,192,0.2)" },
  client:          { color: "#0A0E23", bg: "rgba(26,26,46,0.06)",   border: "rgba(26,26,46,0.1)" },
};

// ─── Helper formatare dată ─────────────────────────────────────────────────
const formatData = (str) => {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("ro-RO", {
    day: "numeric", month: "short", year: "numeric"
  });
};

// ─── Badge status ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    confirmata:   { label: "Confirmată",   color: "#0f6e56", bg: "rgba(29,158,117,0.1)",  border: "rgba(29,158,117,0.3)" },
    in_asteptare: { label: "În așteptare", color: "#8a6a10", bg: "rgba(196,160,80,0.1)",  border: "rgba(196,160,80,0.3)" },
    anulata:      { label: "Anulată",      color: "#aa2020", bg: "rgba(220,50,50,0.08)",  border: "rgba(220,50,50,0.2)" },
  };
  const c = cfg[status] || cfg.in_asteptare;
  return (
    <span style={{
      fontFamily: "'Jost',sans-serif", fontSize: "0.7rem", fontWeight: 500,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: "2px", padding: "2px 8px", whiteSpace: "nowrap",
    }}>{c.label}</span>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, gold }) {
  return (
    <div style={{
      background: "#fff", borderRadius: "4px", padding: "22px 24px",
      border: "1px solid rgba(196,160,80,0.12)",
      boxShadow: "0 4px 16px rgba(10,14,35,0.06)",
    }}>
      <div style={{
        fontFamily: "'Jost',sans-serif", fontSize: "0.68rem",
        letterSpacing: "0.15em", textTransform: "uppercase",
        color: "rgba(26,26,46,0.4)", marginBottom: "10px",
      }}>{label}</div>
      <div style={{
        fontFamily: "'Cormorant Garamond',serif",
        fontSize: "2.2rem", fontWeight: 700, lineHeight: 1,
        color: gold ? "#C4A050" : "#0A0E23",
      }}>{value ?? "—"}</div>
      {sub && <div style={{
        fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
        color: "rgba(26,26,46,0.35)", marginTop: "6px",
      }}>{sub}</div>}
    </div>
  );
}

// ─── Mini bar chart (SVG) ──────────────────────────────────────────────────
function BarChart({ data, title }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 560, H = 180, padL = 40, padB = 30, padT = 10, padR = 10;
  const barW = Math.min(36, (W - padL - padR) / data.length - 6);
  const step = (W - padL - padR) / data.length;

  return (
    <div style={{
      background: "#fff", borderRadius: "4px", padding: "20px 24px",
      border: "1px solid rgba(196,160,80,0.12)",
      boxShadow: "0 4px 16px rgba(10,14,35,0.06)",
    }}>
      <div style={{
        fontFamily: "'Jost',sans-serif", fontSize: "0.7rem",
        letterSpacing: "0.15em", textTransform: "uppercase",
        color: "rgba(26,26,46,0.4)", marginBottom: "16px",
      }}>{title}</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H + padB + padT}`}>
        {/* Linii orizontale */}
        {[0.25, 0.5, 0.75, 1].map(f => {
          const y = padT + (1 - f) * H;
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W - padR} y2={y}
                stroke="rgba(196,160,80,0.1)" strokeWidth="1"/>
              <text x={padL - 4} y={y + 4} textAnchor="end"
                style={{ fontFamily: "'Jost',sans-serif", fontSize: "10px", fill: "rgba(26,26,46,0.3)" }}>
                {Math.round(max * f)}
              </text>
            </g>
          );
        })}
        {/* Bare */}
        {data.map((d, i) => {
          const barH = Math.max(2, (d.value / max) * H);
          const x = padL + i * step + step / 2 - barW / 2;
          const y = padT + H - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH}
                fill="#C4A050" rx="2" opacity="0.85"/>
              <text x={x + barW / 2} y={padT + H + 18} textAnchor="middle"
                style={{ fontFamily: "'Jost',sans-serif", fontSize: "10px", fill: "rgba(26,26,46,0.45)" }}>
                {d.label}
              </text>
              {d.value > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle"
                  style={{ fontFamily: "'Jost',sans-serif", fontSize: "10px", fill: "#C4A050", fontWeight: 500 }}>
                  {d.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();

  // ── Verificare admin ───────────────────────────────────────────────────
  const utilizator = (() => {
    try {
      const val = localStorage.getItem("utilizator");
      if (!val || val === "undefined") return null;
      return JSON.parse(val);
    } catch { return null; }
  })();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!utilizator || !token) { navigate("/autentificare"); return; }
    if (!ADMIN_ROLES.includes(utilizator.rol)) { navigate("/"); }
  }, []);

  // ── Helper paginare ────────────────────────────────────────────────────
  const PER_PAGE = 15;
  const [paginaRez,  setPaginaRez]  = useState(1);
  const [paginaUtil, setPaginaUtil] = useState(1);
  const [paginaPlati, setPaginaPlati] = useState(1);

  const Paginator = ({ total, pagina, setPagina }) => {
    const totalPag = Math.ceil(total / PER_PAGE);
    if (totalPag <= 1) return null;
    return (
      <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end", padding: "12px 16px", borderTop: "1px solid rgba(196,160,80,0.08)" }}>
        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", color: "rgba(26,26,46,0.4)", marginRight: "8px" }}>
          {(pagina - 1) * PER_PAGE + 1}–{Math.min(pagina * PER_PAGE, total)} din {total}
        </span>
        <button onClick={() => setPagina(1)} disabled={pagina === 1}
          style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", padding: "4px 9px", cursor: pagina === 1 ? "default" : "pointer", background: "none", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px", color: pagina === 1 ? "rgba(26,26,46,0.25)" : "#0A0E23" }}>«</button>
        <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
          style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", padding: "4px 9px", cursor: pagina === 1 ? "default" : "pointer", background: "none", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px", color: pagina === 1 ? "rgba(26,26,46,0.25)" : "#0A0E23" }}>‹</button>
        {Array.from({ length: totalPag }, (_, i) => i + 1)
          .filter(n => n === 1 || n === totalPag || Math.abs(n - pagina) <= 1)
          .reduce((acc, n, i, arr) => {
            if (i > 0 && n - arr[i - 1] > 1) acc.push("...");
            acc.push(n); return acc;
          }, [])
          .map((n, i) => n === "..." ? (
            <span key={`e${i}`} style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", color: "rgba(26,26,46,0.3)", padding: "0 2px" }}>…</span>
          ) : (
            <button key={n} onClick={() => setPagina(n)}
              style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", padding: "4px 10px", cursor: "pointer",
                background: n === pagina ? "linear-gradient(135deg,#C4A050,#A8883C)" : "none",
                border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px",
                color: n === pagina ? "#0A0E23" : "#0A0E23", fontWeight: n === pagina ? 600 : 400 }}>{n}</button>
          ))}
        <button onClick={() => setPagina(p => Math.min(totalPag, p + 1))} disabled={pagina === totalPag}
          style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", padding: "4px 9px", cursor: pagina === totalPag ? "default" : "pointer", background: "none", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px", color: pagina === totalPag ? "rgba(26,26,46,0.25)" : "#0A0E23" }}>›</button>
        <button onClick={() => setPagina(totalPag)} disabled={pagina === totalPag}
          style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", padding: "4px 9px", cursor: pagina === totalPag ? "default" : "pointer", background: "none", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px", color: pagina === totalPag ? "rgba(26,26,46,0.25)" : "#0A0E23" }}>»</button>
      </div>
    );
  };

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
  const [stats, setStats]           = useState(null);
  const [platiStats, setPlatiStats] = useState(null);
  const [platiLista, setPlatiLista] = useState([]);
  const [coduri, setCoduri]         = useState([]);
  const [formCod, setFormCod]         = useState({ cod: "", procent_reducere: 10, descriere: "", data_start: "", data_expirare: "", utilizari_maxime: "" });
  const [formNewsletter, setFormNewsletter] = useState({ subiect: "", continut: "" });
  const [newsletterRezultat, setNewsletterRezultat] = useState(null);
  const [rezervari, setRezervari]   = useState([]);
  const [hoteluri, setHoteluri]     = useState([]);
  const [orase, setOrase]           = useState([]);
  const [utilizatori, setUtilizatori] = useState([]);
  const [loading, setLoading]       = useState({});
  const [eroare, setEroare]         = useState("");
  const [succes, setSucces]         = useState("");

  // ── State formulare ────────────────────────────────────────────────────
  const [modalHotel, setModalHotel]   = useState(null);
  const [modalOras, setModalOras]     = useState(false);
  const [modalCategorie, setModalCategorie] = useState(null);
  const [formHotel, setFormHotel]     = useState({ id_oras: "", nume_hotel: "", adresa: "", stele: 3, descriere: "", imagine_url: "", imagine_2: "", imagine_3: "" });
  const [formOras, setFormOras]       = useState({ nume_oras: "", imagine_url: "" });
  const [formCategorie, setFormCategorie] = useState({ denumire: "", capacitate: 2, pret_pe_noapte: "", descriere: "" });
  const [editingCat, setEditingCat]   = useState(null);
  const [editingCatForm, setEditingCatForm] = useState({});
  const [focusField, setFocus]        = useState(null);
  const [hovBtn, setHovBtn]           = useState(null);
  const [filtruRez, setFiltruRez]     = useState("toate");
  const [cautareRez, setCautareRez]   = useState("");
  const [expandedHotel, setExpanded]  = useState(null);
  const [categorii, setCategorii]     = useState({});

  // ── Poze hoteluri ──────────────────────────────────────────────────────
  const [pozaProfilFisier, setPozaProfilFisier] = useState(null);
  const [pozaProfilPreview, setPozaProfilPreview] = useState(null);
  const [modPoza, setModPoza]             = useState("url");
  const [uploadingPoza, setUploadingPoza] = useState(false);

  // ── Galerie hotel ──────────────────────────────────────────────────────
  const [galeriFisiere, setGaleriFisiere] = useState([]);
  const [galeriPreview, setGaleriPreview] = useState([]);
  const [galerie, setGalerie]             = useState({}); // { id_hotel: [poze] }
  const [galeriHotelActiv, setGaleriHotelActiv] = useState(null);
  const [uploadingGalerie, setUploadingGalerie] = useState(false);

  // ── Filtru dashboard ───────────────────────────────────────────────────
  const [perioadaDashboard, setPerioadaDashboard] = useState("toate");

  // ── Oferte hoteluri expandate ──────────────────────────────────────────
  const [oferteExpandate, setOferteExpandate] = useState(false);
  const OFERTE_VIZIBILE = 5;

  // ── Oferte de sezon ────────────────────────────────────────────────────
  const [oferteSez, setOferteSez] = useState([]);
  const [editOferta, setEditOferta] = useState(null);

  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

  // ── Fetch date la mount (bazat pe rol) ────────────────────────────────
  useEffect(() => {
    const rol = utilizator?.rol;
    fetchStats();
    if (["super_admin", "admin_hotel", "admin_marketing"].includes(rol)) {
      fetchHoteluri();
      fetchOrase();
    }
    if (["super_admin", "admin_hotel", "admin_booking", "admin_marketing"].includes(rol)) {
      fetchRezervari();
    }
    if (["super_admin", "admin_booking"].includes(rol)) {
      fetchUtilizatori();
      fetchPlatiStats();
      fetchPlatiLista();
    }
    if (rol === "admin_marketing") {
      fetchUtilizatori();
    }
    if (["super_admin", "admin_marketing"].includes(rol)) {
      fetchCoduri();
      fetchOferteSez();
    }
  }, []);

  const fetchOferteSez = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/oferte-sezon`, { headers });
      if (res.ok) setOferteSez(await res.json());
    } catch {}
  };

  const handleToggleOfertaSez = async (id) => {
    try {
      await fetch(`${API_URL}/api/admin/oferte-sezon/${id}/toggle`, { method: "PATCH", headers });
      setOferteSez(prev => prev.map(o => o.id_oferta === id ? { ...o, activa: o.activa ? 0 : 1 } : o));
    } catch {}
  };

  const handleSaveOfertaSez = async (id, form) => {
    try {
      await fetch(`${API_URL}/api/admin/oferte-sezon/${id}`, {
        method: "PATCH", headers,
        body: JSON.stringify(form),
      });
      setOferteSez(prev => prev.map(o => o.id_oferta === id ? { ...o, ...form } : o));
      setEditOferta(null);
    } catch {}
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`, { headers });
      if (res.ok) setStats(await res.json());
    } catch {}
  };

  const fetchRezervari = async () => {
    setLoading(l => ({ ...l, rez: true }));
    try {
      const res = await fetch(`${API_URL}/api/admin/rezervari`, { headers });
      if (res.ok) setRezervari(await res.json());
    } catch {} finally { setLoading(l => ({ ...l, rez: false })); }
  };

  const fetchHoteluri = async () => {
    try {
      const res = await fetch(`${API_URL}/api/hoteluri`);
      if (res.ok) setHoteluri(await res.json());
    } catch {}
  };

  const fetchOrase = async () => {
    try {
      const res = await fetch(`${API_URL}/api/orase`);
      if (res.ok) setOrase(await res.json());
    } catch {}
  };

  const fetchUtilizatori = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/utilizatori`, { headers });
      if (res.ok) setUtilizatori(await res.json());
    } catch {}
  };

  const fetchPlatiStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/plati/stats`, { headers });
      if (res.ok) setPlatiStats(await res.json());
    } catch {}
  };

  const fetchPlatiLista = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/plati/lista`, { headers });
      if (res.ok) setPlatiLista(await res.json());
    } catch {}
  };

  const fetchCoduri = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/coduri`, { headers });
      if (res.ok) setCoduri(await res.json());
    } catch {}
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
      if (!res.ok) return;
      setCoduri(prev => prev.map(c => c.id_cod === id ? { ...c, activ: c.activ ? 0 : 1 } : c));
    } catch {}
  };

  const handleTrimiteNewsletter = async () => {
    if (!formNewsletter.subiect || !formNewsletter.continut) return showEroare("Completează subiectul și conținutul.");
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
    }
  };

  const handleStergeCod = async (id) => {
    if (!window.confirm("Ștergi acest cod de reducere?")) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/coduri/${id}`, { method: "DELETE", headers });
      if (!res.ok) return;
      setCoduri(prev => prev.filter(c => c.id_cod !== id));
      showSucces("Cod șters.");
    } catch {}
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
    } catch (err) {
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
    } catch {}
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
    if (!pozaProfilFisier) return;
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
    } catch {
      showEroare("Eroare la upload-ul pozei de profil.");
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
    } catch {}
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
    if (!formHotel.id_oras || !formHotel.nume_hotel)
      return showEroare("Completează câmpurile obligatorii.");
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

      // Upload poză profil dacă există
      if (pozaProfilFisier && hotelId) {
        await handleUploadPozaProfil(hotelId);
      }

      showSucces(isEdit ? "Hotel actualizat!" : "Hotel adăugat!");
      setModalHotel(null);
      setPozaProfilFisier(null); setPozaProfilPreview(null);
      fetchHoteluri();
    } catch { showEroare("Eroare server."); }
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
      fetchCategorii(id_hotel);
    } catch { showEroare("Eroare server."); }
  };

  const handleSalveazaCategorie = async () => {
    if (!formCategorie.denumire || !formCategorie.pret_pe_noapte)
      return showEroare("Completează denumirea și prețul.");
    try {
      const res = await fetch(`${API_URL}/api/admin/categorii`, {
        method: "POST", headers,
        body: JSON.stringify({ ...formCategorie, id_hotel: modalCategorie.id_hotel }),
      });
      if (!res.ok) { const d = await res.json(); return showEroare(d.eroare || "Eroare."); }
      showSucces("Categorie adăugată!");
      setModalCategorie(null);
      setFormCategorie({ denumire: "", capacitate: 2, pret_pe_noapte: "", descriere: "" });
      fetchCategorii(modalCategorie.id_hotel);
    } catch { showEroare("Eroare server."); }
  };

  const handleStergeCategorie = async (idCategorie, idHotel) => {
    if (!window.confirm("Ștergi această categorie de cameră?")) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/categorii/${idCategorie}`, { method: "DELETE", headers });
      if (!res.ok) { const d = await res.json(); return showEroare(d.eroare || "Eroare."); }
      showSucces("Categorie ștearsă!");
      fetchCategorii(idHotel);
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
  const graficLunar = (() => {
    const luni = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const counts = new Array(12).fill(0);
    rezervari.forEach(r => {
      const luna = new Date(r.data_crearii).getMonth();
      if (!isNaN(luna)) counts[luna]++;
    });
    return luni.map((label, i) => ({ label, value: counts[i] }));
  })();

  const graficVenituri = (() => {
    const luni = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const sume = new Array(12).fill(0);
    rezervari.filter(r => r.status_rezervare === "confirmata").forEach(r => {
      const luna = new Date(r.data_crearii).getMonth();
      if (!isNaN(luna)) sume[luna] += Number(r.pret_total) || 0;
    });
    return luni.map((label, i) => ({ label, value: Math.round(sume[i]) }));
  })();

  // ── Stiluri ─────────────────────────────────────────────────────────────
  const s = {
    page: { minHeight: "100vh", background: "#F8F6F1", paddingTop: "80px" },
    header: {
      background: "#0A0E23", padding: "28px 48px 0",
      borderBottom: "1px solid rgba(196,160,80,0.15)",
    },
    headerInner: { maxWidth: "1400px", margin: "0 auto" },
    headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "20px" },
    headerTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.8rem", fontWeight: 700, color: "#fff",
    },
    adminBadge: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.68rem",
      letterSpacing: "0.15em", textTransform: "uppercase",
      color: "#C4A050", background: "rgba(196,160,80,0.12)",
      border: "1px solid rgba(196,160,80,0.25)",
      borderRadius: "2px", padding: "3px 10px",
    },
    tabs: { display: "flex", gap: "0" },
    tabBtn: (activ) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
      fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      padding: "14px 24px", cursor: "pointer", border: "none",
      background: "transparent",
      color: activ ? "#C4A050" : "rgba(255,255,255,0.45)",
      borderBottom: activ ? "2px solid #C4A050" : "2px solid transparent",
      transition: "all .2s ease",
    }),
    layout: { maxWidth: "1400px", margin: "0 auto", padding: "32px 48px" },
    msgSucces: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.83rem",
      color: "#0f6e56", background: "rgba(29,158,117,0.08)",
      border: "1px solid rgba(29,158,117,0.25)",
      borderRadius: "2px", padding: "10px 16px", marginBottom: "20px",
    },
    msgEroare: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.83rem",
      color: "#cc2200", background: "rgba(255,80,80,0.07)",
      border: "1px solid rgba(255,80,80,0.2)",
      borderRadius: "2px", padding: "10px 16px", marginBottom: "20px",
    },

    // Grid statistici
    statsGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "28px" },
    graficeGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" },

    // Tabel
    tabelCard: {
      background: "#fff", borderRadius: "4px",
      border: "1px solid rgba(196,160,80,0.12)",
      boxShadow: "0 4px 16px rgba(10,14,35,0.06)", overflow: "hidden",
    },
    tabelHead: {
      padding: "16px 20px",
      borderBottom: "1px solid rgba(196,160,80,0.1)",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      background: "rgba(196,160,80,0.03)",
    },
    tabelTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.1rem", fontWeight: 600, color: "#0A0E23",
    },
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.67rem",
      fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      color: "rgba(26,26,46,0.4)", padding: "10px 16px",
      borderBottom: "1px solid rgba(196,160,80,0.1)",
      textAlign: "left", background: "rgba(196,160,80,0.02)",
    },
    td: (i) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "#0A0E23",
      padding: "12px 16px",
      borderBottom: "1px solid rgba(196,160,80,0.06)",
      background: i % 2 === 0 ? "#fff" : "rgba(196,160,80,0.015)",
    }),
    tdMuted: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
      color: "rgba(26,26,46,0.45)",
    },

    // Butoane acțiuni
    btnMic: (type) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.7rem",
      fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "5px 12px", cursor: "pointer", borderRadius: "2px",
      border: "1px solid",
      transition: "all .2s",
      ...(type === "edit"   ? { color: "#0A0E23", borderColor: "rgba(196,160,80,0.4)", background: "transparent" } : {}),
      ...(type === "del"    ? { color: "#cc2200", borderColor: "rgba(220,50,50,0.3)", background: "transparent" } : {}),
      ...(type === "add"    ? { color: "#0A0E23", background: "linear-gradient(135deg,#C4A050,#A8883C)", borderColor: "transparent" } : {}),
      ...(type === "confirm"? { color: "#0f6e56", borderColor: "rgba(29,158,117,0.4)", background: "transparent" } : {}),
      ...(type === "anulare"? { color: "#cc2200", borderColor: "rgba(220,50,50,0.3)", background: "transparent" } : {}),
    }),
    btnPrincipal: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      padding: "9px 20px", cursor: "pointer", borderRadius: "2px",
      color: "#0A0E23", background: "linear-gradient(135deg,#C4A050,#A8883C)",
      border: "none", transition: "all .2s",
    },

    // Filtre
    filtreRow: { display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center", flexWrap: "wrap" },
    filtruInput: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "#0A0E23",
      border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px",
      padding: "8px 12px", outline: "none", background: "#fff",
    },
    filtruSelect: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", color: "#0A0E23",
      border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px",
      padding: "8px 12px", outline: "none", background: "#fff", cursor: "pointer",
    },

    // Modal
    overlay: {
      position: "fixed", inset: 0, background: "rgba(10,14,35,0.65)",
      backdropFilter: "blur(4px)", zIndex: 500,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
    },
    modal: {
      background: "#fff", borderRadius: "4px", maxWidth: "520px", width: "100%",
      boxShadow: "0 24px 80px rgba(10,14,35,0.3)",
      border: "1px solid rgba(196,160,80,0.15)", overflow: "hidden",
      maxHeight: "90vh", overflowY: "auto",
    },
    modalHead: { background: "#0A0E23", padding: "18px 24px" },
    modalTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.25rem", fontWeight: 600, color: "#fff",
    },
    modalBody: { padding: "24px" },
    fieldWrap: { marginBottom: "18px" },
    label: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.68rem",
      fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase",
      color: "#C4A050", display: "block", marginBottom: "6px",
    },
    input: (f) => ({
      width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.9rem",
      color: "#0A0E23", background: "#FDFBF8",
      border: focusField === f ? "1px solid #C4A050" : "1px solid rgba(196,160,80,0.2)",
      borderRadius: "2px", padding: "10px 12px", outline: "none",
      transition: "border-color .2s", boxSizing: "border-box",
    }),
    select: (f) => ({
      width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.9rem",
      color: "#0A0E23", background: "#FDFBF8",
      border: focusField === f ? "1px solid #C4A050" : "1px solid rgba(196,160,80,0.2)",
      borderRadius: "2px", padding: "10px 12px", outline: "none",
      transition: "border-color .2s", boxSizing: "border-box", cursor: "pointer",
    }),
    textarea: (f) => ({
      width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.88rem",
      color: "#0A0E23", background: "#FDFBF8",
      border: focusField === f ? "1px solid #C4A050" : "1px solid rgba(196,160,80,0.2)",
      borderRadius: "2px", padding: "10px 12px", outline: "none",
      resize: "vertical", minHeight: "80px", boxSizing: "border-box",
    }),
    modalBtns: { display: "flex", gap: "12px", marginTop: "24px" },
    modalBtnPrim: {
      flex: 1, padding: "11px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
      fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      color: "#0A0E23", background: "linear-gradient(135deg,#C4A050,#A8883C)",
      border: "none", borderRadius: "2px", cursor: "pointer",
    },
    modalBtnSec: {
      flex: 1, padding: "11px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
      fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      color: "#0A0E23", background: "transparent",
      border: "1px solid rgba(196,160,80,0.3)", borderRadius: "2px", cursor: "pointer",
    },

    // Hotel row expandabil
    hotelRow: (hov) => ({
      background: hov ? "rgba(196,160,80,0.03)" : "#fff",
      transition: "background .15s",
    }),
    categorieRow: {
      background: "rgba(196,160,80,0.04)",
      borderTop: "1px solid rgba(196,160,80,0.08)",
    },
  };

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

  const renderDashboard = () => {
    const sf = getStatsFiltrate();
    return (
    <div>
      {/* Filtru perioadă */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", alignItems: "center" }}>
        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(26,26,46,0.4)" }}>
          Perioadă:
        </span>
        {[
          { key: "toate", label: "Toate timpurile" },
          { key: "an",    label: "Anul curent" },
          { key: "luna",  label: "Luna curentă" },
        ].map(p => (
          <button key={p.key} onClick={() => setPerioadaDashboard(p.key)} style={{
            fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", fontWeight: 500,
            letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
            padding: "6px 14px", borderRadius: "2px", border: "1px solid",
            borderColor: perioadaDashboard === p.key ? "#C4A050" : "rgba(196,160,80,0.2)",
            background: perioadaDashboard === p.key ? "rgba(196,160,80,0.1)" : "transparent",
            color: perioadaDashboard === p.key ? "#C4A050" : "rgba(26,26,46,0.5)",
            transition: "all .2s",
          }}>{p.label}</button>
        ))}
      </div>

      <div style={s.statsGrid}>
        <StatCard label="Total rezervări"  value={sf.total}    sub={perioadaDashboard === "luna" ? "luna aceasta" : perioadaDashboard === "an" ? "anul acesta" : "din toate timpurile"} />
        <StatCard label="Rezervări active" value={sf.active}   sub="confirmate" gold />
        <StatCard label="Total utilizatori" value={stats?.total_utilizatori} sub="conturi înregistrate" />
        <StatCard label="Venituri totale"  value={sf.venituri ? `${Math.round(sf.venituri).toLocaleString()} RON` : "—"} sub="din rezervări confirmate" gold />
      </div>

      <div style={s.graficeGrid}>
        <BarChart data={graficLunar} title="Rezervări pe luni (anul curent)" />
        <BarChart data={graficVenituri} title="Venituri pe luni — RON (confirmate)" />
      </div>

      {/* Top hoteluri */}
      <div style={s.tabelCard}>
        <div style={s.tabelHead}>
          <span style={s.tabelTitle}>Top hoteluri după rezervări</span>
        </div>
        <table style={s.table}>
          <thead>
            <tr>
              {["Hotel", "Oraș", "Stele", "Rezervări", "Venit total"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(stats?.top_hoteluri || []).map((h, i) => (
              <tr key={i}>
                <td style={s.td(i)}>{h.nume_hotel}</td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{h.nume_oras}</td>
                <td style={s.td(i)}>{"★".repeat(h.stele)}</td>
                <td style={s.td(i)}>{h.nr_rezervari}</td>
                <td style={{ ...s.td(i), color: "#C4A050", fontWeight: 500 }}>
                  {Math.round(h.venit_total).toLocaleString()} RON
                </td>
              </tr>
            ))}
            {(!stats?.top_hoteluri || !stats.top_hoteluri.length) && (
              <tr><td colSpan={5} style={{ ...s.td(0), textAlign: "center", color: "rgba(26,26,46,0.35)", padding: "32px" }}>
                Nu există date încă.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );};

  const renderHoteluri = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <button style={s.btnPrincipal} onClick={() => {
            setFormHotel({ id_oras: "", nume_hotel: "", adresa: "", stele: 3, descriere: "" });
            setModalHotel("nou");
          }}>+ Adaugă hotel</button>
          <button style={{ ...s.btnPrincipal, background: "transparent", color: "#C4A050", border: "1px solid rgba(196,160,80,0.4)" }}
            onClick={() => { setFormOras({ nume_oras: "" }); setModalOras(true); }}>
            + Adaugă oraș
          </button>
        </div>
        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(26,26,46,0.4)" }}>
          {hoteluri.length} hoteluri
        </span>
      </div>

      <div style={s.tabelCard}>
        <table style={s.table}>
          <thead>
            <tr>
              {["Hotel", "Oraș", "Stele", "Preț minim", "Ofertă", "Categorii", "Acțiuni"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hoteluri.map((h, i) => (
              <>
                <tr key={h.id_hotel} style={s.hotelRow(expandedHotel === h.id_hotel)}>
                  <td style={s.td(i)}>
                    <div style={{ fontWeight: 500 }}>{h.nume_hotel}</div>
                    <div style={{ ...s.tdMuted, fontSize: "0.75rem" }}>{h.adresa}</div>
                  </td>
                  <td style={{ ...s.td(i), ...s.tdMuted }}>{h.nume_oras}</td>
                  <td style={s.td(i)}>
                    <span style={{ color: "#C4A050" }}>{"★".repeat(h.stele)}</span>
                  </td>
                  <td style={s.td(i)}>
                    {h.pret_minim ? `${Math.round(h.pret_minim)} RON` : "—"}
                  </td>
                  <td style={s.td(i)}>
                    <button
                      onClick={(e) => handleToggleOferta(e, h.id_hotel)}
                      style={{
                        fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500,
                        letterSpacing: "0.06em", textTransform: "uppercase",
                        padding: "4px 10px", borderRadius: "2px", border: "1px solid", cursor: "pointer",
                        transition: "all .2s",
                        color: h.oferta_activa ? "#0f6e56" : "rgba(26,26,46,0.35)",
                        borderColor: h.oferta_activa ? "rgba(29,158,117,0.4)" : "rgba(26,26,46,0.15)",
                        background: h.oferta_activa ? "rgba(29,158,117,0.08)" : "transparent",
                      }}>
                      {h.oferta_activa ? "★ Activă" : "— Inactivă"}
                    </button>
                  </td>
                  <td style={s.td(i)}>
                    <button style={{ ...s.btnMic("add"), fontSize: "0.68rem" }} onClick={() => {
                      if (expandedHotel === h.id_hotel) { setExpanded(null); return; }
                      setExpanded(h.id_hotel);
                      if (!categorii[h.id_hotel]) fetchCategorii(h.id_hotel);
                    }}>
                      {expandedHotel === h.id_hotel ? "▲ Ascunde" : "▼ Vezi"}
                    </button>
                  </td>
                  <td style={s.td(i)}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button style={s.btnMic("edit")} onClick={() => {
                        setFormHotel({
                          id_oras: h.id_oras || orase.find(o => o.nume_oras === h.nume_oras)?.id_oras || "",
                          nume_hotel: h.nume_hotel, adresa: h.adresa || "",
                          stele: h.stele, descriere: h.descriere || "",
                          imagine_url: h.imagine_url || "",
                          imagine_2: h.imagine_2 || "",
                          imagine_3: h.imagine_3 || "",
                        });
                        setPozaProfilFisier(null); setPozaProfilPreview(null); setGaleriFisiere([]); setGaleriPreview([]);
                        setModPoza(h.imagine_url ? "url" : "url");
                        setModalHotel(h);
                      }}>Editează</button>
                      <button style={s.btnMic("del")} onClick={() => handleStergeHotel(h.id_hotel)}>Șterge</button>
                    </div>
                  </td>
                </tr>
                {/* Categorii expandate */}
                {expandedHotel === h.id_hotel && (
                  <tr key={`cat-${h.id_hotel}`}>
                    <td colSpan={7} style={{ padding: "0 16px 16px 32px", background: "rgba(196,160,80,0.03)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 8px" }}>
                        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4A050" }}>
                          Categorii camere
                        </span>
                        <button style={s.btnMic("add")} onClick={() => {
                          setFormCategorie({ denumire: "", capacitate: 2, pret_pe_noapte: "", descriere: "" });
                          setModalCategorie({ id_hotel: h.id_hotel });
                        }}>+ Adaugă categorie</button>
                      </div>
                      {(categorii[h.id_hotel] || []).length === 0 ? (
                        <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(26,26,46,0.35)", padding: "8px 0" }}>
                          Nu există categorii. Adaugă prima categorie.
                        </div>
                      ) : (
                        <table style={{ ...s.table, marginTop: "4px" }}>
                          <thead>
                            <tr>
                              {["Denumire", "Capacitate", "Preț/noapte (RON)", "Descriere", "Acțiuni"].map(col => (
                                <th key={col} style={{ ...s.th, padding: "6px 10px" }}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(categorii[h.id_hotel] || []).map((c, ci) => {
                              const inEdit = editingCat === c.id_categorie;
                              const inp = {
                                fontFamily: "'Jost',sans-serif", fontSize: "0.83rem",
                                color: "#0A0E23", background: "#FDFBF8",
                                border: "1px solid #C4A050", borderRadius: "2px",
                                padding: "4px 8px", outline: "none", width: "100%",
                                boxSizing: "border-box",
                              };
                              return (
                                <tr key={c.id_categorie}>
                                  <td style={{ ...s.td(ci), padding: "6px 10px" }}>
                                    {inEdit
                                      ? <input style={inp} value={editingCatForm.denumire}
                                          onChange={e => setEditingCatForm(f => ({ ...f, denumire: e.target.value }))} />
                                      : <span style={{ fontWeight: 500 }}>{c.denumire}</span>
                                    }
                                  </td>
                                  <td style={{ ...s.td(ci), padding: "6px 10px" }}>
                                    {inEdit
                                      ? <input type="number" style={{ ...inp, width: "70px" }}
                                          value={editingCatForm.capacitate} min={1} max={10}
                                          onChange={e => setEditingCatForm(f => ({ ...f, capacitate: parseInt(e.target.value) }))} />
                                      : <span style={s.tdMuted}>{c.capacitate} pers.</span>
                                    }
                                  </td>
                                  <td style={{ ...s.td(ci), padding: "6px 10px" }}>
                                    {inEdit
                                      ? <input type="number" style={{ ...inp, width: "110px" }}
                                          value={editingCatForm.pret_pe_noapte} min={0} step="0.01"
                                          onChange={e => setEditingCatForm(f => ({ ...f, pret_pe_noapte: e.target.value }))} />
                                      : <span style={{ color: "#C4A050", fontWeight: 600 }}>{Math.round(c.pret_pe_noapte)} RON</span>
                                    }
                                  </td>
                                  <td style={{ ...s.td(ci), padding: "6px 10px" }}>
                                    {inEdit
                                      ? <input style={inp} value={editingCatForm.descriere}
                                          placeholder="Descriere opțională"
                                          onChange={e => setEditingCatForm(f => ({ ...f, descriere: e.target.value }))} />
                                      : <span style={{ ...s.tdMuted, fontSize: "0.78rem" }}>{c.descriere || "—"}</span>
                                    }
                                  </td>
                                  <td style={{ ...s.td(ci), padding: "6px 10px" }}>
                                    <div style={{ display: "flex", gap: "6px" }}>
                                      {inEdit ? (
                                        <>
                                          <button style={s.btnMic("confirm")}
                                            onClick={() => handleSalveazaCategorieInline(c.id_categorie, h.id_hotel)}>
                                            ✓ Salvează
                                          </button>
                                          <button style={s.btnMic("edit")}
                                            onClick={() => setEditingCat(null)}>
                                            Anulează
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button style={s.btnMic("edit")}
                                            onClick={() => {
                                              setEditingCat(c.id_categorie);
                                              setEditingCatForm({
                                                denumire: c.denumire,
                                                capacitate: c.capacitate,
                                                pret_pe_noapte: c.pret_pe_noapte,
                                                descriere: c.descriere || "",
                                              });
                                            }}>
                                            Editează
                                          </button>
                                          <button style={s.btnMic("del")}
                                            onClick={() => handleStergeCategorie(c.id_categorie, h.id_hotel)}>
                                            Șterge
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRezervari = () => (
    <div>
      <div style={s.filtreRow}>
        <input style={s.filtruInput} placeholder="Caută hotel sau client..."
          value={cautareRez} onChange={e => { setCautareRez(e.target.value); setPaginaRez(1); }} />
        <select style={s.filtruSelect} value={filtruRez} onChange={e => { setFiltruRez(e.target.value); setPaginaRez(1); }}>
          <option value="toate">Toate statusurile</option>
          <option value="confirmata">Confirmate</option>
          <option value="in_asteptare">În așteptare</option>
          <option value="anulata">Anulate</option>
        </select>
        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(26,26,46,0.4)" }}>
          {rezervariFiltrate.length} rezervări
        </span>
      </div>

      <div style={s.tabelCard}>
        <table style={s.table}>
          <thead>
            <tr>
              {["#", "Client", "Hotel / Cameră", "Check-in", "Check-out", "Total", "Status", "Acțiuni"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rezervariFiltrate.slice((paginaRez - 1) * PER_PAGE, paginaRez * PER_PAGE).map((r, i) => (
              <tr key={r.id_rezervare}>
                <td style={{ ...s.td(i), ...s.tdMuted }}>#{r.id_rezervare}</td>
                <td style={s.td(i)}>
                  <div style={{ fontWeight: 500 }}>{r.nume_complet}</div>
                  <div style={{ ...s.tdMuted, fontSize: "0.75rem" }}>{r.email}</div>
                </td>
                <td style={s.td(i)}>
                  <div style={{ fontWeight: 500 }}>{r.nume_hotel}</div>
                  <div style={{ ...s.tdMuted, fontSize: "0.75rem" }}>{r.tip_camera}</div>
                </td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{formatData(r.data_checkin)}</td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{formatData(r.data_checkout)}</td>
                <td style={{ ...s.td(i), color: "#C4A050", fontWeight: 500 }}>
                  {Math.round(r.pret_total).toLocaleString()} RON
                </td>
                <td style={s.td(i)}><StatusBadge status={r.status_rezervare} /></td>
                <td style={s.td(i)}>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {r.status_rezervare !== "confirmata" && (
                      <button style={s.btnMic("confirm")}
                        onClick={() => handleSchimbaStatus(r.id_rezervare, "confirmata")}>
                        Confirmă
                      </button>
                    )}
                    {r.status_rezervare !== "anulata" && (
                      <button style={s.btnMic("anulare")}
                        onClick={() => handleSchimbaStatus(r.id_rezervare, "anulata")}>
                        Anulează
                      </button>
                    )}
                    {["super_admin", "admin_hotel"].includes(utilizator?.rol) && (
                      <a
                        href={`${API_URL}/api/rezervari/${r.id_rezervare}/factura`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ ...s.btnMic("edit"), textDecoration: "none", fontSize: "0.65rem" }}
                        onClick={e => {
                          e.stopPropagation();
                          const headers = new Headers({ Authorization: `Bearer ${token}` });
                          e.preventDefault();
                          fetch(`${API_URL}/api/rezervari/${r.id_rezervare}/factura`, { headers })
                            .then(res => res.blob())
                            .then(blob => {
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `Factura_${r.id_rezervare}.pdf`;
                              a.click();
                              URL.revokeObjectURL(url);
                            });
                        }}
                      >
                        ↓ Factură
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!rezervariFiltrate.length && (
              <tr><td colSpan={8} style={{ ...s.td(0), textAlign: "center", color: "rgba(26,26,46,0.35)", padding: "40px" }}>
                Nu există rezervări.
              </td></tr>
            )}
          </tbody>
        </table>
        <Paginator total={rezervariFiltrate.length} pagina={paginaRez} setPagina={setPaginaRez} />
      </div>
    </div>
  );

  const renderUtilizatori = () => (
    <div style={s.tabelCard}>
      <div style={s.tabelHead}>
        <span style={s.tabelTitle}>Utilizatori înregistrați</span>
        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(26,26,46,0.4)" }}>
          {utilizatori.length} conturi
        </span>
      </div>
      <table style={s.table}>
        <thead>
          <tr>
            {["#", "Nume", "Email", "Telefon", "Rol", "Rezervări",
              ...(utilizator?.rol === "super_admin" ? ["Schimbă rol"] : [])
            ].map(h => (
              <th key={h} style={s.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {utilizatori.slice((paginaUtil - 1) * PER_PAGE, paginaUtil * PER_PAGE).map((u, i) => {
            const rc = ROL_STYLE[u.rol] || ROL_STYLE.client;
            return (
              <tr key={u.id_utilizator}>
                <td style={{ ...s.td(i), ...s.tdMuted }}>#{u.id_utilizator}</td>
                <td style={s.td(i)}>{u.nume_complet}</td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{u.email}</td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{u.telefon || "—"}</td>
                <td style={s.td(i)}>
                  <span style={{
                    fontFamily: "'Jost',sans-serif", fontSize: "0.7rem",
                    fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: rc.color, background: rc.bg, border: `1px solid ${rc.border}`,
                    borderRadius: "2px", padding: "2px 8px", whiteSpace: "nowrap",
                  }}>{ROL_LABEL[u.rol] || u.rol}</span>
                </td>
                <td style={s.td(i)}>{u.nr_rezervari || 0}</td>
                {utilizator?.rol === "super_admin" && (
                  <td style={s.td(i)}>
                    <select
                      value={u.rol}
                      onChange={e => handleSchimbaRolUtilizator(u.id_utilizator, e.target.value)}
                      style={{
                        fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
                        color: "#0A0E23", border: "1px solid rgba(196,160,80,0.25)",
                        borderRadius: "2px", padding: "4px 8px", background: "#fff",
                        cursor: "pointer", outline: "none",
                      }}>
                      {Object.entries(ROL_LABEL).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Paginator total={utilizatori.length} pagina={paginaUtil} setPagina={setPaginaUtil} />
    </div>
  );

  // ── Tab Plăți ──────────────────────────────────────────────────────────
  const renderPlati = () => (
    <div>
      <div style={s.statsGrid}>
        <StatCard label="Total plăți procesate" value={platiStats?.total_rezervari ?? "—"} sub="prin Stripe" />
        <StatCard label="Venituri totale" value={platiStats ? `${Math.round(platiStats.venituri_totale || 0).toLocaleString()} RON` : "—"} sub="plăți confirmate" gold />
        <StatCard label="Comisioane platformă" value={platiStats ? `${Math.round(platiStats.comisioane_totale || 0).toLocaleString()} RON` : "—"} sub="10% din fiecare plată" />
        <StatCard label="Sume decontate hoteluri" value={platiStats ? `${Math.round(platiStats.sume_hoteluri || 0).toLocaleString()} RON` : "—"} sub="90% din fiecare plată" gold />
      </div>

      <div style={s.tabelCard}>
        <div style={s.tabelHead}>
          <span style={s.tabelTitle}>Plăți procesate prin Stripe</span>
          <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(26,26,46,0.4)" }}>
            {platiLista.length} tranzacții
          </span>
        </div>
        <table style={s.table}>
          <thead>
            <tr>
              {["#", "Client", "Hotel / Cameră", "Check-in", "Check-out", "Total", "Comision (10%)", "Hotel (90%)", "Status"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platiLista.slice((paginaPlati - 1) * PER_PAGE, paginaPlati * PER_PAGE).map((p, i) => (
              <tr key={p.id_rezervare}>
                <td style={{ ...s.td(i), ...s.tdMuted }}>#{p.id_rezervare}</td>
                <td style={s.td(i)}>
                  <div style={{ fontWeight: 500 }}>{p.nume_complet}</div>
                  <div style={{ ...s.tdMuted, fontSize: "0.75rem" }}>{p.email}</div>
                </td>
                <td style={s.td(i)}>
                  <div style={{ fontWeight: 500 }}>{p.nume_hotel}</div>
                  <div style={{ ...s.tdMuted, fontSize: "0.75rem" }}>{p.tip_camera} — {p.nume_oras}</div>
                </td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{formatData(p.data_checkin)}</td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{formatData(p.data_checkout)}</td>
                <td style={{ ...s.td(i), color: "#C4A050", fontWeight: 500 }}>
                  {Math.round(Number(p.pret_total)).toLocaleString()} RON
                </td>
                <td style={{ ...s.td(i), color: "#1565c0", fontWeight: 500 }}>
                  {p.comision_platforma ? `${Math.round(Number(p.comision_platforma)).toLocaleString()} RON` : "—"}
                </td>
                <td style={{ ...s.td(i), color: "#0f6e56", fontWeight: 500 }}>
                  {p.suma_hotel ? `${Math.round(Number(p.suma_hotel)).toLocaleString()} RON` : "—"}
                </td>
                <td style={s.td(i)}><StatusBadge status={p.status_rezervare} /></td>
              </tr>
            ))}
            {!platiLista.length && (
              <tr><td colSpan={9} style={{ ...s.td(0), textAlign: "center", color: "rgba(26,26,46,0.35)", padding: "40px" }}>
                Nu există plăți procesate prin Stripe încă.
              </td></tr>
            )}
          </tbody>
        </table>
        <Paginator total={platiLista.length} pagina={paginaPlati} setPagina={setPaginaPlati} />
      </div>
    </div>
  );

  // ── Tab Marketing ──────────────────────────────────────────────────────
  const renderMarketing = () => {
    const sLabel = { fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(26,26,46,0.4)", marginBottom: "14px" };

    const abonatiNewsletter = utilizatori.filter(u => u.email_marketing).length;
    const coduriActive      = coduri.filter(c => c.activ).length;
    const hoteluriFeatured  = hoteluri.filter(h => h.oferta_activa).length;
    const acum = new Date();
    const rezLunaAceasta = rezervari.filter(r => {
      const d = new Date(r.data_crearii);
      return d.getMonth() === acum.getMonth() && d.getFullYear() === acum.getFullYear();
    }).length;

    return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

      {/* ── 0. KPI-uri marketing ── */}
      <div>
        <div style={sLabel}>Statistici marketing</div>
        <div style={s.statsGrid}>
          <StatCard label="Abonați newsletter" value={abonatiNewsletter} sub="utilizatori cu notificări activate" gold />
          <StatCard label="Coduri promoționale" value={coduriActive} sub={coduri.length ? `active din ${coduri.length} total` : "active"} />
          <StatCard label="Hoteluri în ofertă" value={hoteluriFeatured} sub={hoteluri.length ? `din ${hoteluri.length} hoteluri` : "hoteluri"} />
          <StatCard label="Rezervări luna aceasta" value={rezLunaAceasta} sub={acum.toLocaleString("ro-RO", { month: "long", year: "numeric" })} />
        </div>
      </div>

      {/* ── 1. Coduri de reducere ── */}
      <div>
        <div style={sLabel}>Coduri de reducere</div>
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "16px", alignItems: "start" }}>

          {/* Formular */}
          <div style={{ ...s.tabelCard, padding: "22px" }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.1rem", fontWeight: 600, color: "#0A0E23", marginBottom: "18px" }}>
              Cod nou
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={s.label}>Cod *</label>
              <input style={s.input("cod_nou")} value={formCod.cod}
                onChange={e => setFormCod(f => ({ ...f, cod: e.target.value.toUpperCase() }))}
                onFocus={() => setFocus("cod_nou")} onBlur={() => setFocus(null)}
                placeholder="Ex: VARA2025" />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={s.label}>Reducere (%) *</label>
              <input type="number" style={s.input("proc_nou")} value={formCod.procent_reducere}
                onChange={e => setFormCod(f => ({ ...f, procent_reducere: parseInt(e.target.value) }))}
                onFocus={() => setFocus("proc_nou")} onBlur={() => setFocus(null)}
                min={1} max={90} />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={s.label}>Descriere (opțional)</label>
              <input style={s.input("desc_cod")} value={formCod.descriere}
                onChange={e => setFormCod(f => ({ ...f, descriere: e.target.value }))}
                onFocus={() => setFocus("desc_cod")} onBlur={() => setFocus(null)}
                placeholder="Ex: Reducere de vară 2025" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={s.label}>Valabil de la</label>
                <input type="date" style={s.input("start_cod")} value={formCod.data_start}
                  onChange={e => setFormCod(f => ({ ...f, data_start: e.target.value }))}
                  onFocus={() => setFocus("start_cod")} onBlur={() => setFocus(null)} />
              </div>
              <div>
                <label style={s.label}>Valabil până la</label>
                <input type="date" style={s.input("exp_cod")} value={formCod.data_expirare}
                  onChange={e => setFormCod(f => ({ ...f, data_expirare: e.target.value }))}
                  onFocus={() => setFocus("exp_cod")} onBlur={() => setFocus(null)} />
              </div>
            </div>
            <div style={{ marginBottom: "18px" }}>
              <label style={s.label}>Utilizări maxime (opțional — gol = nelimitat)</label>
              <input type="number" style={s.input("util_cod")} value={formCod.utilizari_maxime}
                onChange={e => setFormCod(f => ({ ...f, utilizari_maxime: e.target.value }))}
                onFocus={() => setFocus("util_cod")} onBlur={() => setFocus(null)}
                placeholder="Ex: 50" min={1} />
            </div>
            <button style={s.btnPrincipal} onClick={handleCreazaCod}>
              + Crează cod
            </button>
          </div>

          {/* Tabel coduri */}
          <div style={s.tabelCard}>
            <div style={{ ...s.tabelHead, borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={s.tabelTitle}>Coduri existente</span>
              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.4)" }}>{coduri.length} total</span>
            </div>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Cod", "Reducere", "Descriere", "Perioadă", "Utilizări", "Status", ""].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coduri.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...s.td(0), textAlign: "center", color: "rgba(26,26,46,0.35)", padding: "32px" }}>Nu există coduri create încă.</td></tr>
                ) : coduri.map((c, i) => {
                  const epuizat = c.utilizari_maxime && c.utilizari_curente >= c.utilizari_maxime;
                  return (
                  <tr key={c.id_cod} style={{ opacity: c.activ && !epuizat ? 1 : 0.45 }}>
                    <td style={s.td(i)}>
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", fontWeight: 600, color: "#0A0E23", letterSpacing: "0.06em" }}>{c.cod}</span>
                    </td>
                    <td style={s.td(i)}>
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", fontWeight: 600, color: "#C4A050", background: "rgba(196,160,80,0.1)", border: "1px solid rgba(196,160,80,0.25)", borderRadius: "2px", padding: "2px 8px" }}>
                        -{c.procent_reducere}%
                      </span>
                    </td>
                    <td style={{ ...s.td(i), ...s.tdMuted }}>{c.descriere || "—"}</td>
                    <td style={{ ...s.td(i), ...s.tdMuted, fontSize: "0.78rem" }}>
                      {c.data_start || c.data_expirare
                        ? `${c.data_start ? formatData(c.data_start) : "—"} → ${c.data_expirare ? formatData(c.data_expirare) : "∞"}`
                        : "Oricând"}
                    </td>
                    <td style={s.td(i)}>
                      {c.utilizari_maxime
                        ? <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", fontWeight: 500, color: epuizat ? "#aa2020" : "#0A0E23" }}>
                            {c.utilizari_curente} / {c.utilizari_maxime}
                          </span>
                        : <span style={{ ...s.tdMuted, fontSize: "0.78rem" }}>Nelimitat</span>
                      }
                    </td>
                    <td style={s.td(i)}>
                      <span style={{
                        fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        color: c.activ && !epuizat ? "#0f6e56" : "#888",
                        background: c.activ && !epuizat ? "rgba(29,158,117,0.08)" : "rgba(26,26,46,0.05)",
                        border: `1px solid ${c.activ && !epuizat ? "rgba(29,158,117,0.25)" : "rgba(26,26,46,0.12)"}`,
                        borderRadius: "2px", padding: "2px 8px",
                      }}>{c.activ ? (epuizat ? "Epuizat" : "Activ") : "Inactiv"}</span>
                    </td>
                    <td style={{ ...s.td(i), textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button style={{ ...s.btnMic(c.activ ? "edit" : "confirm"), fontSize: "0.65rem" }}
                          onClick={() => handleToggleCod(c.id_cod)}>
                          {c.activ ? "Dezactivează" : "Activează"}
                        </button>
                        <button style={s.btnMic("del")} onClick={() => handleStergeCod(c.id_cod)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 2. Oferte speciale hoteluri ── */}
      <div>
        <div style={sLabel}>Oferte speciale hoteluri</div>
        <div style={s.tabelCard}>
          <div style={{ ...s.tabelHead, borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={s.tabelTitle}>Gestionare badge "Ofertă specială"</span>
            <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.4)" }}>
              {hoteluri.filter(h => h.oferta_activa).length} active
            </span>
          </div>
          <table style={s.table}>
            <thead>
              <tr>
                {["Hotel", "Oraș", "Stele", "Preț de la", "Ofertă activă"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hoteluri.length === 0 ? (
                <tr><td colSpan={5} style={{ ...s.td(0), textAlign: "center", color: "rgba(26,26,46,0.35)", padding: "32px" }}>Se încarcă...</td></tr>
              ) : (oferteExpandate ? hoteluri : hoteluri.slice(0, OFERTE_VIZIBILE)).map((h, i) => (
                <tr key={h.id_hotel}>
                  <td style={s.td(i)}>
                    <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", fontWeight: 500, color: "#0A0E23" }}>{h.nume_hotel}</span>
                  </td>
                  <td style={{ ...s.td(i), ...s.tdMuted }}>{h.nume_oras}</td>
                  <td style={s.td(i)}>
                    <span style={{ color: "#C4A050" }}>{"★".repeat(h.stele)}</span>
                  </td>
                  <td style={{ ...s.td(i), ...s.tdMuted }}>
                    {h.pret_minim ? `${Math.round(h.pret_minim).toLocaleString()} RON` : "—"}
                  </td>
                  <td style={s.td(i)}>
                    <button
                      onClick={(e) => handleToggleOferta(e, h.id_hotel)}
                      style={{
                        fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500,
                        letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                        padding: "4px 12px", borderRadius: "2px", border: "1px solid",
                        transition: "all .15s",
                        background: h.oferta_activa ? "rgba(196,160,80,0.12)" : "rgba(26,26,46,0.04)",
                        borderColor: h.oferta_activa ? "rgba(196,160,80,0.5)" : "rgba(26,26,46,0.15)",
                        color: h.oferta_activa ? "#C4A050" : "rgba(26,26,46,0.45)",
                      }}>
                      {h.oferta_activa ? "★ Ofertă activă" : "Fără ofertă"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hoteluri.length > OFERTE_VIZIBILE && (
            <div style={{ borderTop: "1px solid rgba(196,160,80,0.08)", padding: "12px 20px", textAlign: "center" }}>
              <button
                onClick={() => setOferteExpandate(v => !v)}
                style={{
                  fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", fontWeight: 500,
                  letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                  background: "none", border: "1px solid rgba(196,160,80,0.25)",
                  borderRadius: "2px", padding: "7px 20px", color: "#C4A050",
                  transition: "all .2s",
                }}>
                {oferteExpandate
                  ? `▲ Restrânge lista`
                  : `▼ Arată toate hotelurile (${hoteluri.length - OFERTE_VIZIBILE} mai mult)`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Newsletter ── */}
      <div>
        <div style={sLabel}>Trimite newsletter</div>
        <div style={{ ...s.tabelCard, padding: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.05rem", fontWeight: 600, color: "#0A0E23", marginBottom: "4px" }}>
                Email promoțional
              </div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.4)", marginBottom: "18px", lineHeight: 1.5 }}>
                Trimite un email cu oferte speciale către toți utilizatorii care s-au abonat la newsletter.
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={s.label}>Subiect email *</label>
                <input style={s.input("nl_subj")}
                  value={formNewsletter?.subiect || ""}
                  onChange={e => setFormNewsletter(f => ({ ...f, subiect: e.target.value }))}
                  onFocus={() => setFocus("nl_subj")} onBlur={() => setFocus(null)}
                  placeholder="Ex: Oferte speciale de vară 2026" />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={s.label}>Conținut *</label>
                <textarea style={{ ...s.input("nl_body"), minHeight: "120px", resize: "vertical" }}
                  value={formNewsletter?.continut || ""}
                  onChange={e => setFormNewsletter(f => ({ ...f, continut: e.target.value }))}
                  onFocus={() => setFocus("nl_body")} onBlur={() => setFocus(null)}
                  placeholder="Scrie mesajul promoțional aici..." />
              </div>
              <button style={s.btnPrincipal} onClick={handleTrimiteNewsletter}>
                ✉ Trimite newsletter
              </button>
              {newsletterRezultat && (
                <div style={{
                  marginTop: "12px", padding: "10px 14px", borderRadius: "2px",
                  fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
                  background: newsletterRezultat.ok ? "rgba(30,160,100,0.08)" : "rgba(220,50,50,0.07)",
                  border: `1px solid ${newsletterRezultat.ok ? "rgba(30,160,100,0.25)" : "rgba(220,50,50,0.2)"}`,
                  color: newsletterRezultat.ok ? "#0f6e56" : "#bb2222",
                }}>
                  {newsletterRezultat.ok ? "✓" : "⚠"} {newsletterRezultat.mesaj}
                </div>
              )}
            </div>
            <div style={{ background: "rgba(196,160,80,0.04)", border: "1px solid rgba(196,160,80,0.1)", borderRadius: "4px", padding: "20px" }}>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(26,26,46,0.35)", marginBottom: "10px" }}>
                Abonați newsletter
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "2.4rem", fontWeight: 700, color: "#C4A050" }}>
                {utilizatori.filter ? utilizatori.filter(u => u.email_marketing).length : "—"}
              </div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.4)", marginTop: "4px" }}>
                utilizatori abonați din {utilizatori.length} total
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Oferte de sezon ── */}
      <div>
        <div style={sLabel}>Oferte de sezon</div>
        <div style={s.tabelCard}>
          <div style={{ ...s.tabelHead, borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={s.tabelTitle}>Gestionare oferte sezoniere</span>
            <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.4)" }}>
              {oferteSez.filter(o => o.activa).length} active din {oferteSez.length}
            </span>
          </div>

          {oferteSez.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "rgba(26,26,46,0.35)" }}>
              Se încarcă...
            </div>
          ) : oferteSez.map(o => {
            const SEZ_ICON = { paste: "🐣", craciun: "🎄", revelion: "🎆", vara: "☀️" };
            const SEZ_LABEL = { paste: "Paște", craciun: "Crăciun", revelion: "Revelion", vara: "Vară" };
            const isEdit = editOferta?.id_oferta === o.id_oferta;

            return (
              <div key={o.id_oferta} style={{
                borderBottom: "1px solid rgba(196,160,80,0.08)",
                padding: "18px 20px",
                background: o.activa ? "rgba(196,160,80,0.02)" : "transparent",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                  {/* Icon + color bar */}
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "4px", flexShrink: 0,
                    background: o.culoare + "22", border: `1px solid ${o.culoare}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.4rem",
                  }}>
                    {SEZ_ICON[o.tip] || "⭐"}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1rem", fontWeight: 600, color: "#0A0E23" }}>
                        {o.titlu}
                      </span>
                      <span style={{
                        fontFamily: "'Jost',sans-serif", fontSize: "0.65rem", fontWeight: 500,
                        letterSpacing: "0.1em", textTransform: "uppercase",
                        color: o.culoare, background: o.culoare + "18",
                        border: `1px solid ${o.culoare}40`,
                        borderRadius: "2px", padding: "2px 8px",
                      }}>
                        {SEZ_LABEL[o.tip] || o.tip}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.45)", marginBottom: "8px" }}>
                      {o.descriere}
                    </div>

                    {isEdit ? (
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end", marginTop: "10px" }}>
                        <div>
                          <label style={s.label}>Reducere %</label>
                          <input style={{ ...s.input(null), width: "90px" }}
                            type="number" min="0" max="100"
                            value={editOferta.discount_procent}
                            onChange={e => setEditOferta(f => ({ ...f, discount_procent: e.target.value }))} />
                        </div>
                        <div>
                          <label style={s.label}>Data start</label>
                          <input style={{ ...s.input(null), width: "140px" }}
                            type="date" value={editOferta.data_start?.slice(0,10) || ""}
                            onChange={e => setEditOferta(f => ({ ...f, data_start: e.target.value }))} />
                        </div>
                        <div>
                          <label style={s.label}>Data sfârșit</label>
                          <input style={{ ...s.input(null), width: "140px" }}
                            type="date" value={editOferta.data_sfarsit?.slice(0,10) || ""}
                            onChange={e => setEditOferta(f => ({ ...f, data_sfarsit: e.target.value }))} />
                        </div>
                        <button style={s.btnPrincipal} onClick={() => handleSaveOfertaSez(o.id_oferta, editOferta)}>
                          Salvează
                        </button>
                        <button style={{ ...s.btnSecundar, cursor: "pointer" }} onClick={() => setEditOferta(null)}>
                          Anulează
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "#C4A050", fontWeight: 600 }}>
                          {o.discount_procent}% reducere
                        </span>
                        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", color: "rgba(26,26,46,0.4)" }}>
                          {o.data_start ? new Date(o.data_start).toLocaleDateString("ro-RO", { day: "numeric", month: "short" }) : "—"}
                          {" — "}
                          {o.data_sfarsit ? new Date(o.data_sfarsit).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </span>
                        <button
                          onClick={() => setEditOferta({ ...o })}
                          style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", padding: "4px 12px", borderRadius: "2px", border: "1px solid rgba(196,160,80,0.3)", background: "transparent", color: "#C4A050" }}>
                          Editează
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Toggle buton */}
                  <button
                    onClick={() => handleToggleOfertaSez(o.id_oferta)}
                    style={{
                      flexShrink: 0, fontFamily: "'Jost',sans-serif", fontSize: "0.68rem",
                      fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
                      cursor: "pointer", padding: "6px 14px", borderRadius: "2px", border: "1px solid",
                      transition: "all .15s",
                      background: o.activa ? "rgba(29,158,117,0.1)" : "rgba(26,26,46,0.04)",
                      borderColor: o.activa ? "rgba(29,158,117,0.4)" : "rgba(26,26,46,0.15)",
                      color: o.activa ? "#0f6e56" : "rgba(26,26,46,0.45)",
                    }}>
                    {o.activa ? "✓ Activă" : "— Inactivă"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
  };

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={s.page}>

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div style={s.header}>
        <div style={s.headerInner}>
          <div style={s.headerTop}>
            <div>
              <h1 style={s.headerTitle}>Panou administrare</h1>
            </div>
            <span style={s.adminBadge}>{ROL_LABEL[utilizator?.rol] || "Admin"}</span>
          </div>
          <div style={s.tabs}>
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
      <div style={s.layout}>
        {succes && <div style={s.msgSucces}>✓ {succes}</div>}
        {eroare && <div style={s.msgEroare}>⚠ {eroare}</div>}

        {tab === "dashboard"   && renderDashboard()}
        {tab === "hoteluri"    && renderHoteluri()}
        {tab === "rezervari"   && renderRezervari()}
        {tab === "utilizatori" && renderUtilizatori()}
        {tab === "plati"       && renderPlati()}
        {tab === "marketing"   && renderMarketing()}
      </div>

      {/* ── MODAL HOTEL ───────────────────────────────────────────────── */}
      {modalHotel && (
        <div style={s.overlay} onClick={() => setModalHotel(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <div style={s.modalTitle}>
                {modalHotel === "nou" ? "Adaugă hotel nou" : `Editează: ${modalHotel.nume_hotel}`}
              </div>
            </div>
            <div style={s.modalBody}>
              <div style={s.fieldWrap}>
                <label style={s.label}>Oraș *</label>
                <select style={s.select("id_oras")} value={formHotel.id_oras}
                  onChange={e => setFormHotel({ ...formHotel, id_oras: e.target.value })}
                  onFocus={() => setFocus("id_oras")} onBlur={() => setFocus(null)}>
                  <option value="">Selectează orașul</option>
                  {orase.map(o => <option key={o.id_oras} value={o.id_oras}>{o.nume_oras}</option>)}
                </select>
              </div>
              <div style={s.fieldWrap}>
                <label style={s.label}>Nume hotel *</label>
                <input style={s.input("nume_hotel")} value={formHotel.nume_hotel}
                  onChange={e => setFormHotel({ ...formHotel, nume_hotel: e.target.value })}
                  onFocus={() => setFocus("nume_hotel")} onBlur={() => setFocus(null)}
                  placeholder="Ex: Hotel Aro Palace" />
              </div>
              <div style={s.fieldWrap}>
                <label style={s.label}>Adresă</label>
                <input style={s.input("adresa")} value={formHotel.adresa}
                  onChange={e => setFormHotel({ ...formHotel, adresa: e.target.value })}
                  onFocus={() => setFocus("adresa")} onBlur={() => setFocus(null)}
                  placeholder="Ex: Bd. Eroilor 27" />
              </div>
              <div style={s.fieldWrap}>
                <label style={s.label}>Clasificare (stele)</label>
                <select style={s.select("stele")} value={formHotel.stele}
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
                  {["url", "upload"].map(m => (
                    <button key={m} type="button" onClick={() => setModPoza(m)} style={{
                      fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", fontWeight: 500,
                      letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                      padding: "5px 14px", borderRadius: "2px", border: "1px solid",
                      borderColor: modPoza === m ? "#C4A050" : "rgba(196,160,80,0.2)",
                      background: modPoza === m ? "rgba(196,160,80,0.1)" : "transparent",
                      color: modPoza === m ? "#C4A050" : "rgba(26,26,46,0.5)",
                    }}>{m === "url" ? "Link URL" : "Upload fișier"}</button>
                  ))}
                </div>

                {modPoza === "url" ? (
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
                  <img src={formHotel.imagine_url} alt="preview"
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
                <button style={s.modalBtnPrim} onClick={handleSalveazaHotel}
                  disabled={uploadingPoza}>
                  {uploadingPoza ? "Se încarcă poza..." : modalHotel === "nou" ? "Adaugă hotel" : "Salvează modificările"}
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
        <div style={s.overlay} onClick={() => setModalCategorie(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <div style={s.modalTitle}>Adaugă categorie de cameră</div>
            </div>
            <div style={s.modalBody}>
              <div style={s.fieldWrap}>
                <label style={s.label}>Denumire *</label>
                <input style={s.input("den")} value={formCategorie.denumire}
                  onChange={e => setFormCategorie({ ...formCategorie, denumire: e.target.value })}
                  onFocus={() => setFocus("den")} onBlur={() => setFocus(null)}
                  placeholder="Ex: Camera Deluxe" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={s.fieldWrap}>
                  <label style={s.label}>Capacitate (persoane)</label>
                  <input type="number" style={s.input("cap")} value={formCategorie.capacitate}
                    onChange={e => setFormCategorie({ ...formCategorie, capacitate: parseInt(e.target.value) })}
                    onFocus={() => setFocus("cap")} onBlur={() => setFocus(null)}
                    min={1} max={10} />
                </div>
                <div style={s.fieldWrap}>
                  <label style={s.label}>Preț / noapte (RON) *</label>
                  <input type="number" style={s.input("pret")} value={formCategorie.pret_pe_noapte}
                    onChange={e => setFormCategorie({ ...formCategorie, pret_pe_noapte: e.target.value })}
                    onFocus={() => setFocus("pret")} onBlur={() => setFocus(null)}
                    placeholder="Ex: 350" min={0} />
                </div>
              </div>
              <div style={s.fieldWrap}>
                <label style={s.label}>Descriere</label>
                <textarea style={s.textarea("desc_cat")} value={formCategorie.descriere}
                  onChange={e => setFormCategorie({ ...formCategorie, descriere: e.target.value })}
                  onFocus={() => setFocus("desc_cat")} onBlur={() => setFocus(null)}
                  placeholder="Descriere scurtă a categoriei..." />
              </div>
              <div style={s.modalBtns}>
                <button style={s.modalBtnPrim} onClick={handleSalveazaCategorie}>Adaugă categorie</button>
                <button style={s.modalBtnSec} onClick={() => setModalCategorie(null)}>Anulează</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}