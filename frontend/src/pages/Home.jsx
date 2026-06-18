import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Importuri poze locale ────────────────────────────────────────────────
import imgBucuresti from "../assets/Orase/bucuresti.jpg";
import imgCluj      from "../assets/Orase/cluj.jpg";
import imgBrasov    from "../assets/Orase/brasov.jpg";
import imgTimisoara from "../assets/Orase/timisoara.jpg";
import imgIasi      from "../assets/Orase/iasi.jpg";
import imgConstanta from "../assets/Orase/constanta.jpg";
import imgSibiu     from "../assets/Orase/sibiu.jpg";
import imgOradea    from "../assets/Orase/oradea.jpg";
import imgCraiova   from "../assets/Orase/craiova.jpg";
import imgArad      from "../assets/Orase/arad.jpg";

const API_URL = "http://localhost:5000";

const IMAGINI_FALLBACK = {
  "Bucuresti":   imgBucuresti,
  "Cluj-Napoca": imgCluj,
  "Brasov":      imgBrasov,
  "Timisoara":   imgTimisoara,
  "Iasi":        imgIasi,
  "Constanta":   imgConstanta,
  "Sibiu":       imgSibiu,
  "Oradea":      imgOradea,
  "Craiova":     imgCraiova,
  "Arad":        imgArad,
  default:       imgBucuresti,
};

const getImagineOras = (oras) =>
  oras.imagine_url || IMAGINI_FALLBACK[oras.nume_oras] || IMAGINI_FALLBACK.default;

// ─── Custom dot marker icon ───────────────────────────────────────────────
const makeDotIcon = (highlight = false) => L.divIcon({
  className: "",
  html: `<div style="
    width:16px;height:16px;
    background:${highlight ? "#C4A050" : "#0A0E23"};
    border:2.5px solid ${highlight ? "rgba(10,14,35,0.7)" : "#C4A050"};
    border-radius:50%;
    box-shadow:0 2px 10px rgba(0,0,0,${highlight ? "0.5" : "0.32"}), 0 0 0 3px ${highlight ? "rgba(196,160,80,0.25)" : "rgba(196,160,80,0.15)"};
    cursor:pointer;
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// ─── Map pan controller ───────────────────────────────────────────────────
function MapController({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 12, { duration: 1.2 });
  }, [target, map]);
  return null;
}

// ─── Skeleton cards ───────────────────────────────────────────────────────
function SkeletonCity() {
  return (
    <div style={{ display: "flex", gap: "10px", padding: "10px", borderRadius: "4px", background: "rgba(196,160,80,.05)", border: "1px solid rgba(196,160,80,.08)" }}>
      <div style={{ width: "70px", height: "60px", borderRadius: "4px", background: "#ede8df", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: "16px", width: "60%", background: "#ede8df", borderRadius: "2px", marginBottom: "8px" }} />
        <div style={{ height: "12px", width: "40%", background: "#ede8df", borderRadius: "2px" }} />
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: "◈", title: "Prețuri garantate", desc: "Găsim cel mai bun tarif disponibil, fără taxe ascunse." },
  { icon: "◉", title: "Anulare gratuită",  desc: "Flexibilitate totală — modifici sau anulezi oricând." },
  { icon: "◆", title: "Suport 24/7",       desc: "Echipa noastră îți este alături în orice moment." },
];

// ─── Scroll-triggered visibility hook ────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// ─── Animated counter ─────────────────────────────────────────────────────
function Counter({ target, suffix = "" }) {
  const [ref, inView] = useInView(0.4);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const duration = 1600;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);
  return <span ref={ref}>{count}{suffix}</span>;
}

// ─── Coordonate centru pentru fiecare oraș ────────────────────────────────
const CENTRU_ORAS = {
  "Bucuresti":   [44.4268, 26.1025],
  "Cluj-Napoca": [46.7712, 23.6236],
  "Brasov":      [45.6579, 25.6012],
  "Timisoara":   [45.7489, 21.2087],
  "Iasi":        [47.1585, 27.6014],
  "Constanta":   [44.1598, 28.6348],
  "Sibiu":       [45.7983, 24.1256],
  "Oradea":      [47.0458, 21.9189],
  "Craiova":     [44.3302, 23.7949],
  "Arad":        [46.1866, 21.3123],
};

// ──────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();

  const [orase, setOrase]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [eroare, setEroare]           = useState(null);
  const [city, setCity]               = useState("");
  const [checkin, setIn]              = useState("");
  const [checkout, setOut]            = useState("");
  const [guests, setGuests]           = useState(2);
  const [hoveredFeat, setHovFeat]     = useState(null);
  const [searchFocus, setSearchFocus] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg]       = useState(false);

  // Scroll animation refs
  const [statsRef, statsInView] = useInView(0.2);
  const [destRef,  destInView]  = useInView(0.08);
  const [featRef,  featInView]  = useInView(0.08);

  // Oferte de sezon
  const [oferteSez, setOferteSez]     = useState([]);

  // Map state
  const [hoteluri, setHoteluri]       = useState([]);
  const [orasActiv, setOrasActiv]     = useState(null);
  const [mapTarget, setMapTarget]     = useState(null);
  const [hotelHighlight, setHotelHL] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [resOrase, resHarta, resOferte] = await Promise.all([
          fetch(`${API_URL}/api/orase`),
          fetch(`${API_URL}/api/hoteluri/harta`),
          fetch(`${API_URL}/api/oferte-sezon`),
        ]);
        if (!resOrase.ok) throw new Error("Server offline");
        const dataOrase = await resOrase.json();
        const dataHarta = resHarta.ok ? await resHarta.json() : [];
        const dataOferte = resOferte.ok ? await resOferte.json() : [];
        setOrase(dataOrase);
        setHoteluri(dataHarta);
        setOferteSez(dataOferte);
      } catch (err) {
        console.error("Eroare fetch:", err);
        setEroare("Nu s-a putut conecta la server.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    if (city.length < 2) { setSuggestions([]); return; }
    setSuggestions(orase.filter(o => o.nume_oras.toLowerCase().includes(city.toLowerCase())).slice(0, 5));
  }, [city, orase]);

  const handleSearch = () => {
    if (!city.trim()) return;
    setShowSugg(false);
    navigate(`/hoteluri?oras=${encodeURIComponent(city)}&checkin=${checkin}&checkout=${checkout}&guests=${guests}`);
  };

  const handleOrasClick = (oras) => {
    setOrasActiv(oras.id_oras);
    const centru = CENTRU_ORAS[oras.nume_oras];
    if (centru) setMapTarget(centru);
  };

  // Hoteluri pentru orașul activ (sau toate dacă nimic selectat)
  const hoteluriFiltrate = orasActiv
    ? hoteluri.filter(h => h.id_oras === orasActiv)
    : hoteluri;

  const s = {
    page: { minHeight: "100vh", background: "#F8F6F1", overflowX: "hidden" },

    hero: {
      position: "relative", height: "100vh", minHeight: "700px",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden", padding: "0 24px",
    },
    heroBg: {
      position: "absolute", inset: 0,
      background: "url('https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&q=85') center/cover no-repeat",
      animation: "heroScale 8s ease forwards", zIndex: 0,
    },
    heroOverlay: {
      position: "absolute", inset: 0,
      background: "linear-gradient(160deg,rgba(10,14,35,.82) 0%,rgba(10,14,35,.52) 60%,rgba(10,14,35,.75) 100%)",
      zIndex: 1,
    },
    heroContent: {
      position: "relative", zIndex: 2,
      textAlign: "center", maxWidth: "820px", width: "100%",
      animation: "fadeUp 0.9s ease both",
    },
    eyebrow: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", fontWeight: 400,
      letterSpacing: "0.35em", textTransform: "uppercase",
      color: "#C4A050", marginBottom: "20px", display: "block",
    },
    heroTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "clamp(3rem,7vw,5.2rem)",
      fontWeight: 700, lineHeight: 1.08, color: "#fff", marginBottom: "20px",
    },
    accent: {
      background: "linear-gradient(90deg,#C4A050,#F0D080,#C4A050)",
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      animation: "shimmer 3s linear infinite",
    },
    heroSub: {
      fontFamily: "'Jost',sans-serif", fontSize: "1.05rem", fontWeight: 300,
      color: "rgba(255,255,255,.7)", marginBottom: "48px", lineHeight: 1.7,
    },

    searchWrap: { position: "relative", width: "100%", maxWidth: "820px" },
    searchBox: {
      width: "100%", background: "rgba(255,255,255,.97)",
      backdropFilter: "blur(20px)", borderRadius: "4px",
      padding: "6px 6px 6px 0", display: "flex", alignItems: "stretch",
      boxShadow: "0 20px 60px rgba(0,0,0,.35)",
      border: "1px solid rgba(196,160,80,.2)",
    },
    field: {
      flex: 1, display: "flex", flexDirection: "column",
      padding: "10px 16px", borderRight: "1px solid rgba(0,0,0,.07)",
    },
    flabel: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.67rem", fontWeight: 500,
      letterSpacing: "0.12em", textTransform: "uppercase",
      color: "#C4A050", marginBottom: "3px",
    },
    finput: (f) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.92rem", fontWeight: 400,
      color: "#1a1a2e", border: "none", outline: "none",
      background: "transparent", padding: 0, width: "100%",
      borderBottom: searchFocus === f ? "1px solid #C4A050" : "1px solid transparent",
      transition: "border-color .2s",
    }),
    searchBtn: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", fontWeight: 500,
      letterSpacing: "0.14em", textTransform: "uppercase",
      color: "#0A0E23",
      background: "linear-gradient(135deg,#C4A050,#A8883C)",
      border: "none", borderRadius: "2px",
      padding: "0 32px", cursor: "pointer", margin: "4px",
      whiteSpace: "nowrap",
    },
    dropdown: {
      position: "absolute", top: "calc(100% + 8px)", left: 0, width: "280px",
      background: "#fff", borderRadius: "4px",
      boxShadow: "0 12px 40px rgba(10,14,35,.18)",
      border: "1px solid rgba(196,160,80,.15)", zIndex: 100, overflow: "hidden",
    },
    dropItem: {
      padding: "12px 16px", cursor: "pointer",
      fontFamily: "'Jost',sans-serif", fontSize: "0.9rem", color: "#333",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      transition: "background .15s",
    },
    dropBadge: {
      fontSize: "0.72rem", color: "#C4A050",
      background: "rgba(196,160,80,.1)", padding: "2px 8px", borderRadius: "2px",
    },

    section: { padding: "100px 48px", maxWidth: "1360px", margin: "0 auto" },
    secEyebrow: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", fontWeight: 500,
      letterSpacing: "0.3em", textTransform: "uppercase",
      color: "#C4A050", marginBottom: "14px", display: "block", textAlign: "center",
    },
    secTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "clamp(2rem,4vw,3rem)",
      fontWeight: 700, color: "#0A0E23", textAlign: "center", marginBottom: "8px",
    },
    secLine: {
      width: "48px", height: "2px",
      background: "linear-gradient(90deg,#C4A050,#F0D080)",
      margin: "0 auto 60px", borderRadius: "1px",
    },

    // Split layout
    splitWrap: { display: "flex", gap: "32px", alignItems: "flex-start" },
    cityList: {
      flex: "0 0 340px", display: "flex", flexDirection: "column", gap: "10px",
      maxHeight: "560px", overflowY: "auto",
      paddingRight: "8px",
    },
    cityItem: (activ) => ({
      display: "flex", gap: "12px", alignItems: "center",
      padding: "12px 14px", borderRadius: "4px", cursor: "pointer",
      border: `1px solid ${activ ? "rgba(196,160,80,.5)" : "rgba(196,160,80,.12)"}`,
      background: activ ? "rgba(196,160,80,.08)" : "#fff",
      boxShadow: activ ? "0 4px 20px rgba(196,160,80,.15)" : "0 2px 8px rgba(10,14,35,.05)",
      transform: activ ? "translateX(4px)" : "translateX(0)",
      transition: "all .25s ease",
    }),
    cityThumb: {
      width: "72px", height: "60px", borderRadius: "3px",
      objectFit: "cover", flexShrink: 0,
    },
    cityName: {
      fontFamily: "'Cormorant Garamond',serif", fontSize: "1.1rem",
      fontWeight: 600, color: "#0A0E23", marginBottom: "4px",
    },
    cityCount: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
      color: "#C4A050", letterSpacing: "0.05em",
    },
    cityArrow: (activ) => ({
      marginLeft: "auto", color: activ ? "#C4A050" : "rgba(10,14,35,.2)",
      fontSize: "1.1rem", transition: "color .2s",
    }),

    mapWrap: {
      flex: 1, height: "560px", borderRadius: "4px", overflow: "hidden",
      border: "1px solid rgba(196,160,80,.2)",
      boxShadow: "0 8px 40px rgba(10,14,35,.12)",
      position: "sticky", top: "120px",
    },

    errorBox: {
      margin: "40px auto", maxWidth: "600px", padding: "24px 32px",
      background: "rgba(255,80,80,.08)", border: "1px solid rgba(255,80,80,.2)",
      borderRadius: "4px", textAlign: "center",
      fontFamily: "'Jost',sans-serif", color: "#cc2200",
    },

    featSec: { padding: "80px 48px", background: "#0A0E23" },
    featGrid: {
      maxWidth: "960px", margin: "60px auto 0",
      display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "40px",
    },
    featCard: (i) => ({
      textAlign: "center", padding: "40px 24px",
      border: "1px solid rgba(196,160,80,.15)", borderRadius: "4px",
      background: hoveredFeat === i ? "rgba(196,160,80,.06)" : "transparent",
      transition: "all .3s ease",
    }),
    featIcon:  { fontSize: "2rem", color: "#C4A050", marginBottom: "20px" },
    featTitle: { fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem", fontWeight: 600, color: "#fff", marginBottom: "12px" },
    featDesc:  { fontFamily: "'Jost',sans-serif", fontSize: "0.87rem", fontWeight: 300, color: "rgba(255,255,255,.5)", lineHeight: 1.7 },

    footer: {
      background: "#0A0E23", borderTop: "1px solid rgba(196,160,80,.1)",
      padding: "28px 48px", textAlign: "center",
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "rgba(255,255,255,.3)", letterSpacing: "0.08em",
    },
  };

  const popupStyle = "";

  return (
    <div style={s.page}>
      <style>{`
        @keyframes heroScale { from { transform:scale(1); } to { transform:scale(1.06); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { to { background-position:200% center; } }
        .city-list-scroll::-webkit-scrollbar { width:4px; }
        .city-list-scroll::-webkit-scrollbar-track { background:transparent; }
        .city-list-scroll::-webkit-scrollbar-thumb { background:rgba(196,160,80,.3); border-radius:2px; }
        .hotel-tip { background:#0A0E23 !important; border:1px solid rgba(196,160,80,.35) !important; border-radius:4px !important; padding:8px 12px !important; box-shadow:0 6px 20px rgba(0,0,0,.35) !important; }
        .hotel-tip::before { border-top-color:rgba(196,160,80,.35) !important; }
        ${popupStyle}
      `}</style>

      {/* ═══════════════════════════ HERO ════════════════════════════════ */}
      <section style={s.hero}>
        <div style={s.heroBg} />
        <div style={s.heroOverlay} />

        <div style={s.heroContent}>
          <span style={s.eyebrow}>Platformă oficială de rezervări hoteliere</span>

          <h1 style={s.heroTitle}>
            Descoperă România<br />
            <span style={s.accent}>cu stil &amp; eleganță</span>
          </h1>

          <p style={s.heroSub}>
            Alege din cele mai bune hoteluri din toată România.<br />
            Rezervare simplă, prețuri transparente, experiențe memorabile.
          </p>

          {/* ── Search Bar ── */}
          <div style={s.searchWrap}>
            <div style={s.searchBox}>
              <div style={{ ...s.field, flex: 2, position: "relative" }}>
                <label style={s.flabel}>Destinație</label>
                <input
                  style={s.finput("city")}
                  placeholder="Oraș, ex: Brașov..."
                  value={city}
                  onChange={e => { setCity(e.target.value); setShowSugg(true); }}
                  onFocus={() => { setSearchFocus("city"); setShowSugg(true); }}
                  onBlur={() => { setSearchFocus(null); setTimeout(() => setShowSugg(false), 160); }}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                />
                {showSugg && suggestions.length > 0 && (
                  <div style={s.dropdown}>
                    {suggestions.map(o => (
                      <div key={o.id_oras} style={s.dropItem}
                        onMouseDown={() => { setCity(o.nume_oras); setShowSugg(false); }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(196,160,80,.09)"}
                        onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                        {o.nume_oras}
                        <span style={s.dropBadge}>{o.numar_hoteluri} hoteluri</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={s.field}>
                <label style={s.flabel}>Check-in</label>
                <input type="date" style={s.finput("in")} value={checkin}
                  onChange={e => setIn(e.target.value)}
                  onFocus={() => setSearchFocus("in")} onBlur={() => setSearchFocus(null)} />
              </div>

              <div style={s.field}>
                <label style={s.flabel}>Check-out</label>
                <input type="date" style={s.finput("out")} value={checkout}
                  onChange={e => setOut(e.target.value)}
                  onFocus={() => setSearchFocus("out")} onBlur={() => setSearchFocus(null)} />
              </div>

              <div style={{ ...s.field, borderRight: "none", flex: "0 0 90px" }}>
                <label style={s.flabel}>Persoane</label>
                <input type="number" style={s.finput("g")} value={guests}
                  min={1} max={10} onChange={e => setGuests(e.target.value)}
                  onFocus={() => setSearchFocus("g")} onBlur={() => setSearchFocus(null)} />
              </div>

              <button style={s.searchBtn} onClick={handleSearch}>Caută</button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ STATS STRIP ════════════════════════════ */}
      <div ref={statsRef} style={{ background: "#0A0E23", borderBottom: "1px solid rgba(196,160,80,0.1)" }}>
        <div style={{
          maxWidth: "960px", margin: "0 auto", padding: "36px 48px",
          display: "grid", gridTemplateColumns: "repeat(4,1fr)",
          opacity: statsInView ? 1 : 0,
          transform: statsInView ? "translateY(0)" : "translateY(28px)",
          transition: "opacity 0.75s ease, transform 0.75s ease",
        }}>
          {[
            { target: 64,  suffix: "",  label: "Hoteluri partenere" },
            { target: 10,  suffix: "",  label: "Orașe în România"   },
            { target: 500, suffix: "+", label: "Recenzii verificate" },
            { target: 98,  suffix: "%", label: "Clienți mulțumiți"  },
          ].map((st, i) => (
            <div key={i} style={{
              textAlign: "center",
              borderRight: i < 3 ? "1px solid rgba(196,160,80,.1)" : "none",
              padding: "8px 0",
            }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "2.6rem", fontWeight: 700, color: "#C4A050", lineHeight: 1 }}>
                <Counter target={st.target} suffix={st.suffix} />
              </div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", color: "rgba(255,255,255,0.38)", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: "8px" }}>
                {st.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════ OFERTE DE SEZON ════════════════════════════ */}
      {oferteSez.length > 0 && (() => {
        const SEZ_ICON  = { paste: "🐣", craciun: "🎄", revelion: "🎆", vara: "☀️" };
        const fmtPeriod = (s, e) => {
          const os = new Date(s).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
          const oe = new Date(e).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
          return `${os} — ${oe}`;
        };
        return (
          <div style={{ background: "#0A0E23", padding: "72px 48px", borderTop: "1px solid rgba(196,160,80,0.1)" }}>
            <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.3em", textTransform: "uppercase", color: "#C4A050", display: "block", textAlign: "center", marginBottom: "12px" }}>
                Rezervă acum
              </span>
              <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 700, color: "#fff", textAlign: "center", marginBottom: "8px" }}>
                Oferte de sezon
              </h2>
              <div style={{ width: "48px", height: "2px", background: "linear-gradient(90deg,#C4A050,#F0D080)", margin: "0 auto 52px", borderRadius: "1px" }} />

              <div style={{ display: "grid", gridTemplateColumns: `repeat(${oferteSez.length},1fr)`, gap: "24px" }}>
                {oferteSez.map(o => (
                  <div key={o.id_oferta} style={{
                    borderRadius: "6px", overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    transition: "transform .35s ease, box-shadow .35s ease",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = `0 20px 60px ${o.culoare}30`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {/* Top color band */}
                    <div style={{ height: "5px", background: `linear-gradient(90deg, ${o.culoare}, ${o.culoare}aa)` }} />

                    <div style={{ padding: "28px 28px 24px" }}>
                      {/* Icon + discount badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
                        <div style={{ fontSize: "2.4rem", lineHeight: 1 }}>{SEZ_ICON[o.tip] || "⭐"}</div>
                        <div style={{
                          fontFamily: "'Cormorant Garamond',serif", fontSize: "1.5rem", fontWeight: 700,
                          color: o.culoare, background: o.culoare + "18",
                          border: `1px solid ${o.culoare}40`,
                          borderRadius: "4px", padding: "4px 14px", lineHeight: 1.3,
                        }}>
                          -{Math.round(o.discount_procent)}%
                        </div>
                      </div>

                      {/* Title */}
                      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.35rem", fontWeight: 600, color: "#fff", marginBottom: "10px", lineHeight: 1.3 }}>
                        {o.titlu}
                      </div>

                      {/* Desc */}
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.65, marginBottom: "20px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {o.descriere}
                      </div>

                      {/* Period */}
                      {o.data_start && o.data_sfarsit && (
                        <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", letterSpacing: "0.08em", color: o.culoare, marginBottom: "20px" }}>
                          📅 {fmtPeriod(o.data_start, o.data_sfarsit)}
                        </div>
                      )}

                      {/* CTA */}
                      <button
                        onClick={() => navigate("/hoteluri")}
                        style={{
                          width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
                          fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase",
                          color: "#0A0E23", background: `linear-gradient(135deg, ${o.culoare}, ${o.culoare}cc)`,
                          border: "none", borderRadius: "3px", padding: "11px",
                          cursor: "pointer", transition: "opacity .2s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                      >
                        Rezervă acum →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════ DESTINAȚII + HARTĂ ═════════════════════════ */}
      <section ref={destRef} style={{ ...s.section, opacity: destInView ? 1 : 0, transform: destInView ? "translateY(0)" : "translateY(36px)", transition: "opacity 0.8s ease, transform 0.8s ease" }}>
        <span style={s.secEyebrow}>Explorează</span>
        <h2 style={s.secTitle}>Destinații populare</h2>
        <div style={s.secLine} />

        {eroare && (
          <div style={s.errorBox}>
            <strong>⚠️ {eroare}</strong>
            <br />
            <small style={{ opacity: .8, marginTop: "8px", display: "block" }}>
              Rulează în terminal: <code>cd backend &amp;&amp; node server.js</code>
            </small>
          </div>
        )}

        {!eroare && (
          <div style={s.splitWrap}>
            {/* ── Lista de orașe ── */}
            <div style={s.cityList} className="city-list-scroll">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonCity key={i} />)
                : orase.map(oras => {
                    const activ = orasActiv === oras.id_oras;
                    return (
                      <div key={oras.id_oras} style={s.cityItem(activ)}
                        onClick={() => {
                          if (activ) { setOrasActiv(null); setMapTarget(null); }
                          else handleOrasClick(oras);
                        }}>
                        <img
                          src={getImagineOras(oras)}
                          alt={oras.nume_oras}
                          style={s.cityThumb}
                          onError={e => { e.target.src = IMAGINI_FALLBACK.default; }}
                        />
                        <div>
                          <div style={s.cityName}>{oras.nume_oras}</div>
                          <div style={s.cityCount}>
                            {oras.numar_hoteluri} {oras.numar_hoteluri === 1 ? "hotel" : "hoteluri"}
                          </div>
                        </div>
                        <span style={s.cityArrow(activ)}>›</span>
                      </div>
                    );
                  })
              }

              {orasActiv && (
                <button
                  onClick={() => { setOrasActiv(null); setMapTarget(null); }}
                  style={{
                    marginTop: "4px", width: "100%", padding: "8px",
                    fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    color: "#C4A050", background: "transparent",
                    border: "1px solid rgba(196,160,80,.3)", borderRadius: "2px",
                    cursor: "pointer",
                  }}
                >
                  ✕ Resetează filtrul
                </button>
              )}
            </div>

            {/* ── Harta Leaflet ── */}
            <div style={s.mapWrap}>
              {!loading && (
                <MapContainer
                  center={[45.9432, 24.9668]}
                  zoom={7}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={true}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  />
                  <MapController target={mapTarget} />

                  {hoteluri.map(h => (
                    <Marker
                      key={h.id_hotel}
                      position={[parseFloat(h.latitudine), parseFloat(h.longitudine)]}
                      icon={makeDotIcon(hotelHighlight === h.id_hotel)}
                      eventHandlers={{
                        mouseover: () => setHotelHL(h.id_hotel),
                        mouseout:  () => setHotelHL(null),
                        click:     () => navigate(`/hoteluri/${h.id_hotel}`),
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -8]} opacity={1} className="hotel-tip">
                        <div style={{ fontFamily: "'Jost',sans-serif", minWidth: "140px" }}>
                          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "0.95rem", fontWeight: 600, color: "#fff", marginBottom: "5px" }}>
                            {h.nume_hotel}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "0.72rem", color: "#C4A050", letterSpacing: "0.04em" }}>
                              {"★".repeat(h.stele)}
                            </span>
                            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#C4A050" }}>
                              {h.pret_minim ? `de la ${Math.round(h.pret_minim)} RON` : "—"}
                            </span>
                          </div>
                        </div>
                      </Tooltip>
                    </Marker>
                  ))}
                </MapContainer>
              )}
              {loading && (
                <div style={{ height: "100%", background: "#ede8df", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontFamily: "'Jost',sans-serif", color: "#C4A050", fontSize: "0.9rem" }}>Se încarcă harta...</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CTA sub secțiune ── */}
        {!loading && !eroare && (
          <div style={{ textAlign: "center", marginTop: "48px" }}>
            <button
              onClick={() => navigate("/hoteluri")}
              style={{
                fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", fontWeight: 500,
                letterSpacing: "0.14em", textTransform: "uppercase",
                color: "#0A0E23", background: "linear-gradient(135deg,#C4A050,#A8883C)",
                border: "none", borderRadius: "2px", padding: "14px 40px",
                cursor: "pointer",
              }}
            >
              Vezi toate hotelurile
            </button>
          </div>
        )}
      </section>

      {/* ═══════════════════════ DE CE NOI ═══════════════════════════════ */}
      <section ref={featRef} style={{ ...s.featSec, opacity: featInView ? 1 : 0, transform: featInView ? "translateY(0)" : "translateY(36px)", transition: "opacity 0.8s ease, transform 0.8s ease" }}>
        <span style={{ ...s.secEyebrow, color: "#C4A050" }}>De ce HoteluriRo</span>
        <h2 style={{ ...s.secTitle, color: "#fff" }}>Rezervă cu încredere</h2>
        <div style={{ ...s.secLine, margin: "0 auto" }} />

        <div style={s.featGrid}>
          {FEATURES.map((f, i) => (
            <div key={i} style={s.featCard(i)}
              onMouseEnter={() => setHovFeat(i)} onMouseLeave={() => setHovFeat(null)}>
              <div style={s.featIcon}>{f.icon}</div>
              <div style={s.featTitle}>{f.title}</div>
              <div style={s.featDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
