import { hotelCover, demoHotelImage, demoImageNote, usesDemoImage } from '../utils/demoImages';
import { apiRequest } from '../utils/apiRequest';
import HotelImage from '../components/HotelImage';
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";


// ─── Stele vizuale ─────────────────────────────────────────────────────────
function Stele({ nr, size = 14 }) {
  return (
    <span style={{ color: "#C4A050", fontSize: size, letterSpacing: "1px" }}>
      {"★".repeat(nr)}{"☆".repeat(5 - nr)}
    </span>
  );
}

// ─── Skeleton card ─────────────────────────────────────────────────────────
const shimmerBg = {
  background: "linear-gradient(90deg,#ede8df 25%,#f7f3ed 50%,#ede8df 75%)",
  backgroundSize: "200% 100%",
  animation: "skeletonShimmer 1.4s ease-in-out infinite",
};

function SkeletonCard() {
  return (
    <div style={{
      background: "#fff", borderRadius: "4px", overflow: "hidden",
      border: "1px solid rgba(196,160,80,0.1)",
      boxShadow: "0 4px 20px rgba(10,14,35,0.06)",
      display: "flex", height: "200px",
    }}>
      <div style={{ width: "240px", flexShrink: 0, ...shimmerBg }} />
      <div style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ height: "22px", width: "55%", borderRadius: "2px", marginBottom: "10px", ...shimmerBg }} />
          <div style={{ height: "13px", width: "28%", borderRadius: "2px", marginBottom: "16px", ...shimmerBg }} />
          <div style={{ height: "13px", width: "75%", borderRadius: "2px", marginBottom: "7px", ...shimmerBg }} />
          <div style={{ height: "13px", width: "55%", borderRadius: "2px", ...shimmerBg }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ height: "28px", width: "90px", borderRadius: "2px", ...shimmerBg }} />
          <div style={{ height: "36px", width: "110px", borderRadius: "2px", ...shimmerBg }} />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
export default function Hoteluri() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // ── State date ──────────────────────────────────────────────────────────
  const [hoteluri, setHoteluri]       = useState([]);
  const [orase, setOrase]             = useState([]);
  const [facilitatiLista, setFacLista] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [eroare, setEroare]           = useState(null);
  const [total, setTotal]             = useState(0);

  // ── State filtre ────────────────────────────────────────────────────────
  const [orasSelectat, setOras]     = useState(searchParams.get("oras") || "");
  const [steleMin, setSteleMin]     = useState(0);
  const [pretMax, setPretMax]       = useState(1000);
  const [sortare, setSortare]       = useState("stele_desc");
  const [cautare, setCautare]       = useState("");
  const [checkin, setCheckin]       = useState(searchParams.get("checkin") || "");
  const [checkout, setCheckout]     = useState(searchParams.get("checkout") || "");
  const [guests, setGuests]         = useState(searchParams.get("guests") || "");
  const [facilitatiSel, setFacSel]  = useState([]); // id-uri facilitate selectate

  // ── State UI ────────────────────────────────────────────────────────────
  const [hovCard, setHovCard]     = useState(null);
  const [hovBtn, setHovBtn]       = useState(null);
  const [listKey, setListKey]     = useState(0);

  // ── Fetch orașe pentru dropdown ─────────────────────────────────────────
  useEffect(() => {
    apiRequest("/api/orase")
      .then(setOrase)
      .catch(() => {});
  }, []);

  // ── Fetch facilități ─────────────────────────────────────────────────────
  useEffect(() => {
    apiRequest("/api/facilitati")
      .then(setFacLista)
      .catch(() => {});
  }, []);

  // ── Fetch hoteluri ori de câte ori se schimbă filtrele ──────────────────
  useEffect(() => {
    const controller = new AbortController();
    const fetchHoteluri = async () => {
      try {
        setLoading(true);
        setEroare(null);

        const params = new URLSearchParams();
        if (orasSelectat)         params.set("oras", orasSelectat);
        if (steleMin > 0)         params.set("stele_exact", steleMin);
        if (pretMax < 1000)       params.set("pret_max", pretMax);
        if (checkin)              params.set("checkin", checkin);
        if (checkout)             params.set("checkout", checkout);
        if (guests)               params.set("guests", guests);
        if (facilitatiSel.length) params.set("facilitati", facilitatiSel.join(","));
        params.set("sort", sortare);

        if (Boolean(checkin) !== Boolean(checkout)) throw new Error("Alege atât check-in, cât și check-out.");
        if (checkin && checkout <= checkin) throw new Error("Check-out trebuie să fie după check-in.");
        const data = await apiRequest(`/api/hoteluri/search?${params}`, { signal: controller.signal });

        const filtrate = cautare.trim()
          ? data.filter(h =>
              h.nume_hotel.toLowerCase().includes(cautare.toLowerCase()) ||
              h.descriere?.toLowerCase().includes(cautare.toLowerCase())
            )
          : data;

        setHoteluri(filtrate);
        setTotal(filtrate.length);
        setListKey(k => k + 1);
      } catch (error) {
        if (!controller.signal.aborted) setEroare(error.message || "Nu s-a putut conecta la server.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchHoteluri();
    const sp = {};
    if (orasSelectat) sp.oras = orasSelectat;
    if (checkin)      sp.checkin = checkin;
    if (checkout)     sp.checkout = checkout;
    if (guests)       sp.guests = guests;
    setSearchParams(sp, { replace: true });
    return () => controller.abort();
  }, [orasSelectat, steleMin, pretMax, sortare, cautare, checkin, checkout, guests, facilitatiSel, setSearchParams]);

  const resetFiltre = () => {
    setOras(""); setSteleMin(0); setPretMax(1000);
    setSortare("stele_desc"); setCautare("");
    setCheckin(""); setCheckout(""); setGuests("");
    setFacSel([]);
  };

  const toggleFacilitate = (id) => {
    setFacSel(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Grupăm facilitățile pe categorii
  const facilitatiGrupate = facilitatiLista.reduce((acc, f) => {
    if (!acc[f.categorie]) acc[f.categorie] = [];
    acc[f.categorie].push(f);
    return acc;
  }, {});

  const numeCategorii = {
    wellness:  '💆 Wellness & Spa',
    sport:     '🏊 Sport',
    servicii:  '🛎️ Servicii',
    transport: '🚗 Transport',
    mancare:   '🍽️ Mâncare',
  };

  // ── Stiluri ─────────────────────────────────────────────────────────────
  const s = {
    page: { minHeight: "100vh", background: "#F8F6F1", paddingTop: "80px" },

    // Header pagină
    header: {
      background: "#0A0E23",
      padding: "40px 48px 36px",
      borderBottom: "1px solid rgba(196,160,80,0.15)",
    },
    headerInner: { maxWidth: "1280px", margin: "0 auto" },
    breadcrumb: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "rgba(255,255,255,0.4)", marginBottom: "14px",
      display: "flex", alignItems: "center", gap: "8px",
    },
    breadcrumbLink: {
      color: "rgba(255,255,255,0.4)", textDecoration: "none",
      transition: "color .2s",
    },
    headerTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "clamp(1.8rem,3.5vw,2.6rem)",
      fontWeight: 700, color: "#fff", marginBottom: "6px",
    },
    headerSub: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.9rem",
      color: "rgba(255,255,255,0.45)",
    },

    // Layout principal
    layout: {
      maxWidth: "1280px", margin: "0 auto",
      padding: "36px 48px",
      display: "grid",
      gridTemplateColumns: "280px 1fr",
      gap: "32px",
      alignItems: "start",
    },

    // ── Sidebar filtre ────────────────────────────────────────────────────
    sidebar: {
      background: "#fff",
      borderRadius: "4px",
      border: "1px solid rgba(196,160,80,0.12)",
      boxShadow: "0 4px 20px rgba(10,14,35,0.06)",
      overflow: "hidden",
      position: "sticky",
      top: "100px",
      maxHeight: "calc(100vh - 120px)",
      overflowY: "auto",
    },
    sidebarHeader: {
      padding: "20px 22px 16px",
      borderBottom: "1px solid rgba(196,160,80,0.1)",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    },
    sidebarTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.15rem", fontWeight: 600, color: "#0A0E23",
    },
    resetBtn: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.72rem",
      fontWeight: 500, letterSpacing: "0.08em",
      color: "#C4A050", background: "none",
      border: "none", cursor: "pointer",
      textTransform: "uppercase",
    },
    filterGroup: {
      padding: "16px 20px",
      borderBottom: "1px solid rgba(196,160,80,0.08)",
    },
    filterLabel: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.7rem",
      fontWeight: 500, letterSpacing: "0.15em",
      textTransform: "uppercase", color: "#C4A050",
      marginBottom: "12px", display: "block",
    },
    searchInput: {
      width: "100%", fontFamily: "'Jost',sans-serif",
      fontSize: "0.88rem", color: "#0A0E23",
      border: "1px solid rgba(196,160,80,0.2)",
      borderRadius: "2px", padding: "9px 12px",
      outline: "none", background: "#FDFBF8",
      boxSizing: "border-box",
    },
    selectInput: {
      width: "100%", fontFamily: "'Jost',sans-serif",
      fontSize: "0.88rem", color: "#0A0E23",
      border: "1px solid rgba(196,160,80,0.2)",
      borderRadius: "2px", padding: "9px 12px",
      outline: "none", background: "#FDFBF8",
      cursor: "pointer", appearance: "none",
      boxSizing: "border-box",
    },
    rangeInput: {
      width: "100%", accentColor: "#C4A050", cursor: "pointer",
    },
    dateInput: {
      width: "100%", fontFamily: "'Jost',sans-serif",
      fontSize: "0.85rem", color: "#0A0E23",
      border: "1px solid rgba(196,160,80,0.2)",
      borderRadius: "2px", padding: "8px 10px",
      outline: "none", background: "#FDFBF8",
      boxSizing: "border-box",
    },
    facTag: (activ) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.72rem",
      fontWeight: 500, letterSpacing: "0.04em",
      padding: "5px 10px", borderRadius: "2px",
      cursor: "pointer", border: "1px solid",
      borderColor: activ ? "#C4A050" : "rgba(196,160,80,0.2)",
      background: activ ? "rgba(196,160,80,0.12)" : "#FDFBF8",
      color: activ ? "#C4A050" : "rgba(26,26,46,0.55)",
      transition: "all .15s", display: "inline-flex",
      alignItems: "center", gap: "4px",
      marginBottom: "5px", marginRight: "5px",
      boxShadow: activ ? "0 2px 8px rgba(196,160,80,0.15)" : "none",
    }),
    categorieLabel: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.65rem",
      fontWeight: 500, letterSpacing: "0.12em",
      textTransform: "uppercase", color: "rgba(26,26,46,0.35)",
      marginTop: "10px", marginBottom: "6px", display: "block",
    },
    disponibilitateBox: {
      background: "rgba(196,160,80,0.05)",
      border: "1px solid rgba(196,160,80,0.15)",
      borderRadius: "2px", padding: "10px 14px", marginBottom: "8px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "#0A0E23",
    },
    rangeLabel: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
      color: "#0A0E23", fontWeight: 500,
    },
    steleRow: {
      display: "flex", flexDirection: "column", gap: "8px",
    },
    steleOption: (activ) => ({
      display: "flex", alignItems: "center", gap: "8px",
      padding: "6px 10px", borderRadius: "2px",
      cursor: "pointer", transition: "all .15s",
      background: activ ? "rgba(196,160,80,0.1)" : "transparent",
      border: activ ? "1px solid rgba(196,160,80,0.3)" : "1px solid transparent",
      marginBottom: "4px",
    }),
    steleRadio: { accentColor: "#C4A050", cursor: "pointer" },

    // ── Conținut dreapta ──────────────────────────────────────────────────
    content: {},
    topBar: {
      display: "flex", justifyContent: "space-between",
      alignItems: "center", marginBottom: "20px",
    },
    topBarText: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.88rem",
      color: "rgba(26,26,46,0.55)",
    },
    topBarBold: { color: "#0A0E23", fontWeight: 500 },
    sortSelect: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
      color: "#0A0E23", border: "1px solid rgba(196,160,80,0.2)",
      borderRadius: "2px", padding: "7px 12px",
      outline: "none", background: "#fff", cursor: "pointer",
    },

    // ── Card hotel ────────────────────────────────────────────────────────
    cardList: { display: "flex", flexDirection: "column", gap: "16px" },
    card: (id) => ({
      background: "#fff", borderRadius: "4px", overflow: "hidden",
      border: "1px solid rgba(196,160,80,0.1)",
      boxShadow: hovCard === id
        ? "0 16px 48px rgba(10,14,35,0.14)"
        : "0 4px 20px rgba(10,14,35,0.06)",
      transform: hovCard === id ? "translateY(-3px)" : "none",
      transition: "all .3s cubic-bezier(.4,0,.2,1)",
      cursor: "pointer", display: "flex",
    }),
    cardImgWrap: {
      width: "240px", flexShrink: 0,
      position: "relative", overflow: "hidden",
    },
    cardImg: (hov) => ({
      width: "100%", height: "100%",
      objectFit: "cover", display: "block",
      transform: hov ? "scale(1.05)" : "scale(1)",
      transition: "transform .5s ease",
    }),
    steleOnImg: {
      position: "absolute", bottom: "10px", left: "12px",
      background: "rgba(10,14,35,0.65)",
      backdropFilter: "blur(4px)",
      padding: "3px 8px", borderRadius: "2px",
    },
    cardBody: {
      padding: "22px 24px", flex: 1,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
    },
    cardTop: {},
    cardNume: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.3rem", fontWeight: 600,
      color: "#0A0E23", marginBottom: "4px",
    },
    cardOras: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
      color: "#C4A050", letterSpacing: "0.1em",
      textTransform: "uppercase", marginBottom: "10px",
    },
    cardDesc: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.85rem",
      color: "rgba(26,26,46,0.55)", lineHeight: 1.6,
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    },
    cardBottom: {
      display: "flex", justifyContent: "space-between",
      alignItems: "flex-end", marginTop: "16px",
    },
    cardPretLabel: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.7rem",
      color: "rgba(26,26,46,0.4)", letterSpacing: "0.1em",
      textTransform: "uppercase", marginBottom: "2px",
    },
    cardPret: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.5rem", fontWeight: 700, color: "#0A0E23",
    },
    cardPretSuffix: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "rgba(26,26,46,0.4)", marginLeft: "4px",
    },
    cardBtn: (id) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      fontWeight: 500, letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: hovBtn === id ? "#fff" : "#0A0E23",
      background: hovBtn === id
        ? "linear-gradient(135deg,#C4A050,#A8883C)"
        : "transparent",
      border: "1px solid rgba(196,160,80,0.5)",
      borderRadius: "2px", padding: "9px 20px",
      cursor: "pointer", transition: "all .25s ease",
    }),

    // ── Gol / eroare ──────────────────────────────────────────────────────
    emptyBox: {
      textAlign: "center", padding: "80px 24px",
      fontFamily: "'Jost',sans-serif",
    },
    emptyIcon: {
      fontSize: "2.5rem", marginBottom: "16px",
      opacity: .35,
    },
    emptyTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.6rem", color: "#0A0E23", marginBottom: "8px",
    },
    emptyText: {
      fontSize: "0.88rem", color: "rgba(26,26,46,0.45)",
    },
    errorBox: {
      padding: "24px", background: "rgba(255,80,80,0.07)",
      border: "1px solid rgba(255,80,80,0.2)", borderRadius: "4px",
      fontFamily: "'Jost',sans-serif", color: "#cc2200", textAlign: "center",
    },
  };

  const titluPagina = orasSelectat
    ? `Hoteluri în ${orasSelectat}`
    : "Toate hotelurile";

  return (
    <div className="hotels-page" style={s.page}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="page-heading" style={s.header}>
        <div style={s.headerInner}>
          <div style={s.breadcrumb}>
            <Link to="/" style={s.breadcrumbLink}>Acasă</Link>
            <span>›</span>
            <span style={{ color: "rgba(255,255,255,0.7)" }}>Hoteluri</span>
            {orasSelectat && (
              <>
                <span>›</span>
                <span style={{ color: "#C4A050" }}>{orasSelectat}</span>
              </>
            )}
          </div>
          <h1 style={s.headerTitle}>{titluPagina}</h1>
          <p style={s.headerSub}>
            {loading ? "Se încarcă..." : `${total} ${total === 1 ? "hotel găsit" : "hoteluri găsite"}`}
          </p>
        </div>
      </div>

      {/* ── LAYOUT: SIDEBAR + CARDURI ────────────────────────────────────── */}
      <div className="page-layout hotels-layout" style={s.layout}>

        {/* ════ SIDEBAR FILTRE ════ */}
        <aside className="hotels-sidebar" style={s.sidebar}>
          <div style={s.sidebarHeader}>
            <span style={s.sidebarTitle}>Filtre</span>
            <button style={s.resetBtn} onClick={resetFiltre}>Resetează</button>
          </div>

          {/* Căutare text */}
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Caută hotel</label>
            <input
              style={s.searchInput}
              placeholder="Ex: Aro Palace..."
              value={cautare}
              onChange={e => setCautare(e.target.value)}
            />
          </div>

          {/* Oraș */}
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Oraș</label>
            <div style={{ position: "relative" }}>
              <select
                style={s.selectInput}
                value={orasSelectat}
                onChange={e => setOras(e.target.value)}
              >
                <option value="">Toate orașele</option>
                {orase.map(o => (
                  <option key={o.id_oras} value={o.nume_oras}>{o.nume_oras}</option>
                ))}
              </select>
              <span style={{
                position: "absolute", right: "12px", top: "50%",
                transform: "translateY(-50%)", pointerEvents: "none",
                color: "#C4A050", fontSize: "0.7rem",
              }}>▼</span>
            </div>
          </div>

          {/* Stele */}
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Clasificare</label>
            <div style={s.steleRow}>
              {[0, 1, 2, 3, 4, 5].map(nr => (
                <div
                  key={nr}
                  style={s.steleOption(steleMin === nr)}
                  onClick={() => setSteleMin(nr)}
                >
                  <input
                    type="radio" style={s.steleRadio}
                    checked={steleMin === nr}
                    onChange={() => setSteleMin(nr)}
                  />
                  {nr === 0
                    ? <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "#555" }}>Toate</span>
                    : <><Stele nr={nr} size={13} /><span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.5)", marginLeft: "4px" }}>{nr} {nr === 1 ? "stea" : "stele"}</span></>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Disponibilitate */}
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Disponibilitate</label>
            <div style={{ marginBottom: "8px" }}>
              <label style={{ ...s.filterLabel, fontSize: "0.62rem", marginBottom: "4px" }}>Check-in</label>
              <input type="date" style={s.dateInput}
                value={checkin} min={new Date().toISOString().split("T")[0]}
                onChange={e => setCheckin(e.target.value)} />
            </div>
            <div style={{ marginBottom: "8px" }}>
              <label style={{ ...s.filterLabel, fontSize: "0.62rem", marginBottom: "4px" }}>Check-out</label>
              <input type="date" style={s.dateInput}
                value={checkout} min={checkin || new Date().toISOString().split("T")[0]}
                onChange={e => setCheckout(e.target.value)} />
            </div>
            <div>
              <label style={{ ...s.filterLabel, fontSize: "0.62rem", marginBottom: "4px" }}>Persoane</label>
              <input type="number" style={s.dateInput}
                value={guests} min={1} max={10} placeholder="ex: 2"
                onChange={e => setGuests(e.target.value)} />
            </div>
            {checkin && checkout && (
              <div style={{ ...s.disponibilitateBox, marginTop: "8px" }}>
                ✓ Caută camere libere în perioada selectată
              </div>
            )}
          </div>

          {/* Preț maxim */}
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Preț maxim / noapte</label>
            <div style={{ marginBottom: "8px" }}>
              <span style={s.rangeLabel}>până la {pretMax} RON</span>
            </div>
            <input
              type="range" style={s.rangeInput}
              min={100} max={1000} step={50}
              value={pretMax}
              onChange={e => setPretMax(Number(e.target.value))}
            />
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontFamily: "'Jost',sans-serif", fontSize: "0.72rem",
              color: "rgba(26,26,46,0.35)", marginTop: "4px",
            }}>
              <span>100 RON</span>
              <span>1000 RON</span>
            </div>
          </div>

          {/* Facilități */}
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Facilități</label>
            {Object.entries(facilitatiGrupate).map(([cat, facs]) => (
              <div key={cat}>
                <span style={s.categorieLabel}>{numeCategorii[cat] || cat}</span>
                <div style={{ display: "flex", flexWrap: "wrap" }}>
                  {facs.map(f => (
                    <span key={f.id_facilitate}
                      style={s.facTag(facilitatiSel.includes(f.id_facilitate))}
                      onClick={() => toggleFacilitate(f.id_facilitate)}>
                      {f.icon} {f.nume}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {facilitatiSel.length > 0 && (
              <div style={{ ...s.disponibilitateBox, marginTop: "8px" }}>
                ✓ {facilitatiSel.length} {facilitatiSel.length === 1 ? "facilitate" : "facilități"} selectate
              </div>
            )}
          </div>

          {/* Rezultate live */}
          <div style={{ padding: "14px 22px", background: "rgba(196,160,80,0.05)" }}>
            <span style={{
              fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
              color: "rgba(26,26,46,0.5)",
            }}>
              {loading ? "Se caută..." : `${total} ${total === 1 ? "rezultat" : "rezultate"}`}
            </span>
          </div>
        </aside>

        {/* ════ LISTA HOTELURI ════ */}
        <div className="hotels-content" style={s.content}>

          {/* Bara de sortare */}
          <div className="hotels-toolbar" style={s.topBar}>
            <p style={s.topBarText}>
              {!loading && (
                <>
                  <span style={s.topBarBold}>{total}</span> {total === 1 ? "hotel găsit" : "hoteluri găsite"}
                  {orasSelectat && <> în <span style={s.topBarBold}>{orasSelectat}</span></>}
                </>
              )}
            </p>
            <select style={s.sortSelect} value={sortare} onChange={e => setSortare(e.target.value)}>
              <option value="stele_desc">Stele: descrescător</option>
              <option value="stele_asc">Stele: crescător</option>
              <option value="pret_asc">Preț: cel mai mic</option>
              <option value="pret_desc">Preț: cel mai mare</option>
              <option value="nume_asc">Nume: A → Z</option>
            </select>
          </div>

          {/* Eroare */}
          {eroare && <div style={s.errorBox}>⚠️ {eroare}</div>}

          {/* Skeleton loading */}
          {loading && !eroare && (
            <div style={s.cardList}>
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Niciun rezultat */}
          {!loading && !eroare && hoteluri.length === 0 && (
            <div style={s.emptyBox}>
              <div style={s.emptyIcon}>◈</div>
              <div style={s.emptyTitle}>Niciun hotel găsit</div>
              <p style={s.emptyText}>
                Încearcă să modifici filtrele sau să cauți alt oraș.
              </p>
              <button
                style={{ ...s.cardBtn("reset"), marginTop: "20px" }}
                onClick={resetFiltre}
                onMouseEnter={() => setHovBtn("reset")}
                onMouseLeave={() => setHovBtn(null)}
              >
                Resetează filtrele
              </button>
            </div>
          )}

          {/* Carduri hoteluri */}
          {!loading && !eroare && (
            <div style={s.cardList}>
              <style>{`@keyframes cardIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
              {hoteluri.map((h, idx) => (
                <div
                  key={`${listKey}-${h.id_hotel}`}
                  className="hotel-result-card" style={{ ...s.card(h.id_hotel), animation: "cardIn 0.5s ease both", animationDelay: `${idx * 65}ms` }}
                  onMouseEnter={() => setHovCard(h.id_hotel)}
                  onMouseLeave={() => setHovCard(null)}
                  onClick={() => navigate(`/hoteluri/${h.id_hotel}`)}
                >
                  {/* Imagine */}
                  <div className="hotel-card-image" style={s.cardImgWrap}>
                    <HotelImage
                      src={hotelCover(h)} fallback={demoHotelImage(h)}
                      alt={h.nume_hotel}
                      style={s.cardImg(hovCard === h.id_hotel)}
                    />
                    <div style={s.steleOnImg}>
                      <Stele nr={h.stele} size={11} />
                    </div>
                    {h.oferta_activa === 1 && (
                      <div style={{
                        position: "absolute", top: "10px", left: "10px",
                        background: "linear-gradient(135deg,#C4A050,#A8883C)",
                        color: "#0A0E23", fontFamily: "'Jost',sans-serif",
                        fontSize: "0.65rem", fontWeight: 700,
                        letterSpacing: "0.12em", textTransform: "uppercase",
                        padding: "4px 10px", borderRadius: "2px",
                        boxShadow: "0 2px 8px rgba(196,160,80,0.4)",
                      }}>
                        ★ Ofertă specială
                      </div>
                    )}
                  </div>

                  {/* Corp card */}
                  <div className="hotel-card-body" style={s.cardBody}>
                    {usesDemoImage(h) && <small className="demo-image-note">{demoImageNote}</small>}
                    <div style={s.cardTop}>
                      <div style={s.cardNume}>{h.nume_hotel}</div>
                      <div style={s.cardOras}>📍 {h.nume_oras} · {h.adresa}</div>
                      {(checkin && checkout) && (
                        <div style={{
                          display: "inline-block", marginTop: "4px",
                          fontFamily: "'Jost',sans-serif", fontSize: "0.72rem",
                          fontWeight: 500, padding: "3px 10px", borderRadius: "2px",
                          background: h.camere_disponibile > 0 ? "rgba(29,158,117,0.1)" : "rgba(220,50,50,0.08)",
                          color: h.camere_disponibile > 0 ? "#0f6e56" : "#aa2020",
                          border: `1px solid ${h.camere_disponibile > 0 ? "rgba(29,158,117,0.3)" : "rgba(220,50,50,0.2)"}`,
                        }}>
                          {h.camere_disponibile > 0
                            ? `✓ ${h.camere_disponibile} camere disponibile`
                            : "✗ Complet ocupat"}
                        </div>
                      )}
                      <div style={s.cardDesc}>{h.descriere}</div>
                    </div>
                    <div className="hotel-card-bottom" style={s.cardBottom}>
                      <div>
                        <div style={s.cardPretLabel}>De la</div>
                        <div>
                          <span style={s.cardPret}>
                            {h.pret_minim ? Math.round(h.pret_minim) : "—"}
                          </span>
                          {h.pret_minim && (
                            <span style={s.cardPretSuffix}>RON / noapte</span>
                          )}
                        </div>
                      </div>
                      <button
                        style={s.cardBtn(h.id_hotel)}
                        onMouseEnter={e => { e.stopPropagation(); setHovBtn(h.id_hotel); }}
                        onMouseLeave={e => { e.stopPropagation(); setHovBtn(null); }}
                        onClick={e => {
                          e.stopPropagation();
                          const p = new URLSearchParams();
                          if (checkin)  p.set('checkin', checkin);
                          if (checkout) p.set('checkout', checkout);
                          if (guests)   p.set('guests', guests);
                          navigate(`/hoteluri/${h.id_hotel}?${p}`);
                        }}
                      >
                        Vezi detalii
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}