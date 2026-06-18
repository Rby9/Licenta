import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useToast } from "../components/Toast";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix pentru iconița implicită Leaflet în Vite/React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MarkerAutoPopup({ position, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.openPopup();
  }, []);
  return (
    <Marker position={position} ref={ref}>
      {children}
    </Marker>
  );
}

const API_URL = "http://localhost:5000";

// ─── Stele vizuale ─────────────────────────────────────────────────────────
function Stele({ nr, size = 16 }) {
  return (
    <span style={{ color: "#C4A050", fontSize: size, letterSpacing: "2px" }}>
      {"★".repeat(nr)}{"☆".repeat(5 - nr)}
    </span>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = "20px", mb = "10px" }) {
  return (
    <div style={{
      width: w, height: h, background: "#ede8df",
      borderRadius: "2px", marginBottom: mb,
    }} />
  );
}

// ──────────────────────────────────────────────────────────────────────────
export default function HotelDetalii() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── State date ──────────────────────────────────────────────────────────
  const [hotel, setHotel]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [eroare, setEroare]     = useState(null);

  // ── State UI ────────────────────────────────────────────────────────────
  const [hovCard, setHovCard]   = useState(null);
  const [hovBtn, setHovBtn]     = useState(null);
  const [imgError, setImgError]   = useState(false);
  const [pozaActiva, setPozaActiva] = useState(0); // index slider
  const [galerie, setGalerie]           = useState([]);
  const [galerieLoading, setGalLoading] = useState(true);
  const [galerieActiva, setGalActiva]   = useState(null);
  const [facilitati, setFacilitati]     = useState([]);
  const [disponibilitate, setDisp]      = useState(null);

  // ── Recenzii ──────────────────────────────────────────────────────────
  const addToast = useToast();
  const [recenzii, setRecenzii]         = useState([]);
  const [recenzieForm, setRecenzieForm] = useState({ rating: 0, comentariu: "" });
  const [recenzieLoading, setRecLoad]   = useState(false);
  const utilizatorCurent = (() => { try { const v = localStorage.getItem("utilizator"); return v ? JSON.parse(v) : null; } catch { return null; } })();
  const tokenCurent = localStorage.getItem("token");

  // ── Datele preluate din URL (dacă vine de la search) ───────────────────
  const checkinURL  = searchParams.get("checkin")  || "";
  const checkoutURL = searchParams.get("checkout") || "";
  const guestsURL   = searchParams.get("guests")   || "2";

  // ── Booking widget ─────────────────────────────────────────────────────
  const [wCheckin, setWCheckin]   = useState(checkinURL);
  const [wCheckout, setWCheckout] = useState(checkoutURL);
  const [wGuests, setWGuests]     = useState(guestsURL || "2");
  const [selectedCam, setSelectedCam] = useState(null);

  // ── Fetch hotel + categorii camere ─────────────────────────────────────
  useEffect(() => {
    const fetchHotel = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/hoteluri/${id}`);
        if (!res.ok) throw new Error(res.status === 404 ? "404" : "err");
        const data = await res.json();
        setHotel(data);
      } catch (err) {
        setEroare(err.message === "404"
          ? "Hotelul nu a fost găsit."
          : "Nu s-a putut conecta la server.");
      } finally {
        setLoading(false);
      }
    };

    const fetchGalerie = async () => {
      try {
        setGalLoading(true);
        const res = await fetch(`${API_URL}/api/hoteluri/${id}/galerie`);
        if (res.ok) setGalerie(await res.json());
      } catch {} finally { setGalLoading(false); }
    };

    const fetchFacilitati = async () => {
      try {
        const res = await fetch(`${API_URL}/api/hoteluri/${id}/facilitati`);
        if (res.ok) setFacilitati(await res.json());
      } catch {}
    };

    const fetchRecenzii = async () => {
      try {
        const res = await fetch(`${API_URL}/api/hoteluri/${id}/recenzii`);
        if (res.ok) setRecenzii(await res.json());
      } catch {}
    };

    fetchHotel();
    fetchGalerie();
    fetchFacilitati();
    fetchRecenzii();
  }, [id]);

  const handleAdaugaRecenzie = async () => {
    if (!recenzieForm.rating) { addToast("Selectează un rating înainte de a trimite.", "error"); return; }
    try {
      setRecLoad(true);
      const res = await fetch(`${API_URL}/api/hoteluri/${id}/recenzii`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tokenCurent}` },
        body: JSON.stringify(recenzieForm),
      });
      const d = await res.json();
      if (!res.ok) { addToast(d.eroare || "Eroare la trimitere.", "error"); return; }
      addToast("Recenzie adăugată! Mulțumim pentru feedback.", "success");
      setRecenzieForm({ rating: 0, comentariu: "" });
      const r2 = await fetch(`${API_URL}/api/hoteluri/${id}/recenzii`);
      if (r2.ok) setRecenzii(await r2.json());
    } catch { addToast("Eroare de rețea. Încearcă din nou.", "error"); }
    finally { setRecLoad(false); }
  };

  // ── Fetch disponibilitate când se schimbă datele ───────────────────────
  useEffect(() => {
    if (!checkinURL || !checkoutURL) return;
    const fetchDisp = async () => {
      try {
        const params = new URLSearchParams({ checkin: checkinURL, checkout: checkoutURL });
        if (guestsURL) params.set("guests", guestsURL);
        const res = await fetch(`${API_URL}/api/hoteluri/${id}/disponibilitate?${params}`);
        if (res.ok) setDisp(await res.json());
      } catch {}
    };
    fetchDisp();
  }, [id, checkinURL, checkoutURL, guestsURL]);

  // ── Calculează nr nopți dacă avem datele din URL ───────────────────────
  const calcNopti = (cin, cout) => {
    if (!cin || !cout) return 0;
    const diff = new Date(cout) - new Date(cin);
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };
  const nopti = calcNopti(checkinURL, checkoutURL);

  // ── Navighează spre rezervare ──────────────────────────────────────────
  const handleRezervare = (categorieId) => {
    const params = new URLSearchParams({
      hotel_id:    id,
      categorie_id: categorieId,
      checkin:     checkinURL,
      checkout:    checkoutURL,
      guests:      guestsURL,
    });
    navigate(`/rezervare?${params}`);
  };

  const handleWidgetSearch = () => {
    if (!wCheckin || !wCheckout) {
      addToast("Alege datele de check-in și check-out.", "error");
      return;
    }
    const categorii = hotel?.categorii_camere || [];
    const cheapest = categorii.slice().sort((a, b) => a.pret_pe_noapte - b.pret_pe_noapte)[0];
    const camTarget = selectedCam || cheapest;
    if (!camTarget) {
      addToast("Hotelul nu are camere configurate.", "error");
      return;
    }
    const p = new URLSearchParams();
    p.set("hotel_id", id);
    p.set("categorie_id", camTarget.id_categorie);
    p.set("checkin", wCheckin);
    p.set("checkout", wCheckout);
    navigate(`/rezervare?${p}`);
  };

  // ── Stiluri ─────────────────────────────────────────────────────────────
  const s = {
    page: { minHeight: "100vh", background: "#F8F6F1", paddingTop: "80px" },

    // Hero imagine hotel
    heroWrap: {
      position: "relative", height: "65vh", minHeight: "520px", overflow: "hidden",
      background: "#0A0E23",
    },
    heroImg: {
      width: "100%", height: "100%", objectFit: "cover",
      display: "block", opacity: imgError ? 0 : 1,
      transition: "opacity .3s",
    },
    heroOverlay: {
      position: "absolute", inset: 0,
      background: "linear-gradient(to top, rgba(10,14,35,0.85) 0%, rgba(10,14,35,0.3) 50%, transparent 100%)",
    },
    heroContent: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      padding: "32px 48px",
      maxWidth: "1280px", margin: "0 auto",
    },
    breadcrumb: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "rgba(255,255,255,0.45)", marginBottom: "12px",
      display: "flex", alignItems: "center", gap: "8px",
    },
    breadLink: { color: "rgba(255,255,255,0.45)", textDecoration: "none" },
    hotelNume: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "clamp(2rem,4vw,3rem)",
      fontWeight: 700, color: "#fff",
      marginBottom: "8px",
    },
    hotelMeta: {
      display: "flex", alignItems: "center", gap: "16px",
      flexWrap: "wrap",
    },
    metaTag: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
      color: "rgba(255,255,255,0.65)", display: "flex",
      alignItems: "center", gap: "6px",
    },
    metaGold: { color: "#C4A050" },

    // Layout principal
    layout: {
      maxWidth: "1280px", margin: "0 auto",
      padding: "40px 48px",
      display: "grid",
      gridTemplateColumns: "1fr 340px",
      gap: "40px",
      alignItems: "start",
    },

    // ── Coloana stângă ────────────────────────────────────────────────────
    sectionTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.6rem", fontWeight: 600,
      color: "#0A0E23", marginBottom: "6px",
    },
    sectionLine: {
      width: "40px", height: "2px",
      background: "linear-gradient(90deg,#C4A050,#F0D080)",
      borderRadius: "1px", marginBottom: "20px",
    },
    descriere: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.95rem",
      color: "rgba(26,26,46,0.65)", lineHeight: 1.8,
      marginBottom: "48px",
    },

    // Categorii camere
    camereGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))",
      gap: "20px", marginBottom: "48px",
    },
    cameraCard: (id, isSelected) => ({
      background: isSelected ? "rgba(196,160,80,0.04)" : "#fff",
      borderRadius: "4px",
      border: isSelected
        ? "2px solid #C4A050"
        : hovCard === id
          ? "1px solid rgba(196,160,80,0.5)"
          : "1px solid rgba(196,160,80,0.12)",
      boxShadow: isSelected
        ? "0 8px 32px rgba(196,160,80,0.18)"
        : hovCard === id
          ? "0 12px 40px rgba(10,14,35,0.12)"
          : "0 4px 16px rgba(10,14,35,0.06)",
      transform: hovCard === id && !isSelected ? "translateY(-4px)" : "none",
      transition: "all .3s ease",
      overflow: "hidden",
      cursor: "pointer",
    }),
    cameraHeader: {
      padding: "20px 22px 16px",
      borderBottom: "1px solid rgba(196,160,80,0.08)",
    },
    cameraDenumire: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.2rem", fontWeight: 600,
      color: "#0A0E23", marginBottom: "4px",
    },
    cameraCapacitate: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "rgba(26,26,46,0.45)", letterSpacing: "0.08em",
    },
    cameraBody: { padding: "16px 22px 20px" },
    cameraDescriere: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.83rem",
      color: "rgba(26,26,46,0.55)", lineHeight: 1.65,
      marginBottom: "16px",
    },
    cameraFooter: {
      display: "flex", justifyContent: "space-between",
      alignItems: "flex-end",
    },
    pretWrap: {},
    pretLabel: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.67rem",
      letterSpacing: "0.12em", textTransform: "uppercase",
      color: "rgba(26,26,46,0.35)", marginBottom: "2px",
    },
    pretValoare: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.5rem", fontWeight: 700, color: "#0A0E23",
    },
    pretNoapte: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
      color: "rgba(26,26,46,0.35)", marginLeft: "4px",
    },
    pretTotal: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "#C4A050", marginTop: "2px",
    },
    rezervaBtn: (id) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      fontWeight: 500, letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: hovBtn === id ? "#fff" : "#0A0E23",
      background: hovBtn === id
        ? "linear-gradient(135deg,#C4A050,#A8883C)"
        : "transparent",
      border: "1px solid rgba(196,160,80,0.5)",
      borderRadius: "2px", padding: "9px 18px",
      cursor: "pointer", transition: "all .25s ease",
      whiteSpace: "nowrap",
    }),

    // ── Sidebar dreapta ───────────────────────────────────────────────────
    sidebar: {
      background: "#fff", borderRadius: "4px",
      border: "1px solid rgba(196,160,80,0.12)",
      boxShadow: "0 4px 20px rgba(10,14,35,0.07)",
      overflow: "hidden", position: "sticky", top: "100px",
    },
    sidebarHead: {
      padding: "20px 22px 16px",
      background: "#0A0E23",
      borderBottom: "1px solid rgba(196,160,80,0.15)",
    },
    sidebarHeadTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.1rem", fontWeight: 600, color: "#fff",
      marginBottom: "4px",
    },
    sidebarHeadSub: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "rgba(255,255,255,0.45)",
    },
    sidebarBody: { padding: "20px 22px" },
    infoRow: {
      display: "flex", justifyContent: "space-between",
      alignItems: "center", padding: "10px 0",
      borderBottom: "1px solid rgba(196,160,80,0.07)",
    },
    infoLabel: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "rgba(26,26,46,0.45)", letterSpacing: "0.06em",
    },
    infoValue: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.88rem",
      fontWeight: 500, color: "#0A0E23", textAlign: "right",
      maxWidth: "180px",
    },
    infoValueGold: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.88rem",
      fontWeight: 500, color: "#C4A050",
    },
    sidebarNote: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
      color: "rgba(26,26,46,0.35)", lineHeight: 1.6,
      marginTop: "16px", padding: "12px",
      background: "rgba(196,160,80,0.04)",
      borderRadius: "2px",
      border: "1px solid rgba(196,160,80,0.1)",
    },

    // Eroare / loading
    errorBox: {
      maxWidth: "600px", margin: "80px auto", padding: "32px",
      background: "rgba(255,80,80,0.07)",
      border: "1px solid rgba(255,80,80,0.2)",
      borderRadius: "4px", textAlign: "center",
      fontFamily: "'Jost',sans-serif", color: "#cc2200",
    },
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) return (
    <div style={s.page}>
      <div style={{ ...s.heroWrap, background: "#ede8df" }} />
      <div style={s.layout}>
        <div>
          <Skeleton w="40%" h="36px" mb="16px" />
          <Skeleton w="60%" h="14px" mb="8px" />
          <Skeleton w="80%" h="14px" mb="8px" />
          <Skeleton w="50%" h="14px" mb="40px" />
          <div style={s.camereGrid}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: "#fff", borderRadius: "4px", padding: "22px", border: "1px solid rgba(196,160,80,0.1)" }}>
                <Skeleton w="60%" h="22px" mb="12px" />
                <Skeleton w="40%" h="12px" mb="10px" />
                <Skeleton w="90%" h="12px" mb="8px" />
                <Skeleton w="70%" h="12px" mb="20px" />
                <Skeleton w="50%" h="32px" />
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...s.sidebar, minHeight: "300px" }}>
          <div style={{ ...s.sidebarHead, minHeight: "70px" }} />
          <div style={s.sidebarBody}>
            {[1,2,3,4].map(i => <Skeleton key={i} h="14px" mb="14px" />)}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Eroare ─────────────────────────────────────────────────────────────
  if (eroare) return (
    <div style={s.page}>
      <div style={s.errorBox}>
        <strong>⚠️ {eroare}</strong>
        <br />
        <button
          onClick={() => navigate("/hoteluri")}
          style={{ marginTop: "16px", padding: "10px 24px", cursor: "pointer",
            fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
            background: "transparent", border: "1px solid #cc2200",
            borderRadius: "2px", color: "#cc2200" }}
        >
          ← Înapoi la hoteluri
        </button>
      </div>
    </div>
  );

  const DEFAULT_IMG = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80";

  // Colectăm toate pozele disponibile (filtrăm nullurile)
  const toatePoze = [hotel.imagine_url, hotel.imagine_2, hotel.imagine_3]
    .filter(Boolean);
  if (toatePoze.length === 0) toatePoze.push(DEFAULT_IMG);

  const pozaCurenta = toatePoze[pozaActiva] || DEFAULT_IMG;
  const pretMin = hotel.categorii_camere?.length
    ? Math.round(Math.min(...hotel.categorii_camere.map(c => c.pret_pe_noapte)))
    : null;
  const wNopti = calcNopti(wCheckin, wCheckout);

  return (
    <div style={s.page}>

      {/* ── HERO CU SLIDER POZE ────────────────────────────────────────── */}
      <div style={s.heroWrap}>
        <img
          src={pozaCurenta}
          alt={hotel.nume_hotel}
          style={s.heroImg}
          onError={e => { e.target.src = DEFAULT_IMG; }}
        />
        <div style={s.heroOverlay} />

        {/* Butoane slider — apar doar dacă există mai mult de 1 poză */}
        {toatePoze.length > 1 && (
          <>
            <button
              onClick={() => setPozaActiva(p => (p - 1 + toatePoze.length) % toatePoze.length)}
              style={{
                position: "absolute", left: "20px", top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(10,14,35,0.5)", backdropFilter: "blur(4px)",
                border: "1px solid rgba(196,160,80,0.3)", borderRadius: "2px",
                color: "#C4A050", fontSize: "1.2rem", cursor: "pointer",
                padding: "8px 14px", zIndex: 10, transition: "all .2s",
              }}>‹</button>
            <button
              onClick={() => setPozaActiva(p => (p + 1) % toatePoze.length)}
              style={{
                position: "absolute", right: "20px", top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(10,14,35,0.5)", backdropFilter: "blur(4px)",
                border: "1px solid rgba(196,160,80,0.3)", borderRadius: "2px",
                color: "#C4A050", fontSize: "1.2rem", cursor: "pointer",
                padding: "8px 14px", zIndex: 10, transition: "all .2s",
              }}>›</button>

            {/* Puncte indicator */}
            <div style={{
              position: "absolute", bottom: "80px", left: "50%",
              transform: "translateX(-50%)",
              display: "flex", gap: "8px", zIndex: 10,
            }}>
              {toatePoze.map((_, i) => (
                <button key={i} onClick={() => setPozaActiva(i)} style={{
                  width: i === pozaActiva ? "24px" : "8px",
                  height: "8px", borderRadius: "4px",
                  background: i === pozaActiva ? "#C4A050" : "rgba(255,255,255,0.5)",
                  border: "none", cursor: "pointer", padding: 0,
                  transition: "all .3s ease",
                }} />
              ))}
            </div>

            {/* Counter */}
            <div style={{
              position: "absolute", top: "120px", right: "20px",
              background: "rgba(10,14,35,0.6)", backdropFilter: "blur(4px)",
              border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px",
              padding: "4px 10px", zIndex: 10,
              fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
              color: "rgba(255,255,255,0.7)",
            }}>
              {pozaActiva + 1} / {toatePoze.length}
            </div>
          </>
        )}
        <div style={s.heroContent}>
          {/* Breadcrumb */}
          <div style={s.breadcrumb}>
            <Link to="/" style={s.breadLink}>Acasă</Link>
            <span>›</span>
            <Link to="/hoteluri" style={s.breadLink}>Hoteluri</Link>
            <span>›</span>
            <Link to={`/hoteluri?oras=${hotel.nume_oras}`} style={s.breadLink}>
              {hotel.nume_oras}
            </Link>
            <span>›</span>
            <span style={{ color: "#C4A050" }}>{hotel.nume_hotel}</span>
          </div>

          <h1 style={s.hotelNume}>{hotel.nume_hotel}</h1>

          <div style={s.hotelMeta}>
            <Stele nr={hotel.stele} size={18} />
            <span style={s.metaTag}>
              <span style={s.metaGold}>📍</span> {hotel.adresa}, {hotel.nume_oras}
            </span>
            <span style={s.metaTag}>
              <span style={s.metaGold}>◈</span>
              {hotel.categorii_camere?.length || 0} tipuri de camere
            </span>
          </div>
        </div>
      </div>

      {/* ── LAYOUT ────────────────────────────────────────────────────── */}
      <div style={s.layout}>

        {/* ════ COLOANA STÂNGĂ ════ */}
        <div>

          {/* Descriere */}
          <h2 style={s.sectionTitle}>Despre hotel</h2>
          <div style={s.sectionLine} />
          <p style={s.descriere}>{hotel.descriere}</p>

          {/* Facilități */}
          {facilitati.length > 0 && (
            <div style={{ marginBottom: "40px" }}>
              <h2 style={s.sectionTitle}>Facilități</h2>
              <div style={s.sectionLine} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {facilitati.map(f => (
                  <span key={f.id_facilitate} style={{
                    fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
                    padding: "6px 14px", borderRadius: "2px",
                    background: "rgba(196,160,80,0.07)",
                    border: "1px solid rgba(196,160,80,0.2)",
                    color: "#0A0E23", display: "inline-flex",
                    alignItems: "center", gap: "6px",
                  }}>
                    {f.icon} {f.nume}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Camere disponibile */}
          <h2 style={s.sectionTitle}>
            {checkinURL && checkoutURL ? "Camere disponibile în perioada selectată" : "Camere disponibile"}
          </h2>
          <div style={s.sectionLine} />

          {hotel.categorii_camere?.length === 0 ? (
            <p style={{ fontFamily: "'Jost',sans-serif", color: "rgba(26,26,46,0.45)", fontSize: "0.9rem" }}>
              Nu există camere configurate pentru acest hotel.
            </p>
          ) : (
            <div style={s.camereGrid}>
              {hotel.categorii_camere?.map(cam => {
                const pretTotal = nopti > 0
                  ? Math.round(cam.pret_pe_noapte * nopti)
                  : null;

                const isSelected = selectedCam?.id_categorie === cam.id_categorie;
                return (
                  <div
                    key={cam.id_categorie}
                    style={s.cameraCard(cam.id_categorie, isSelected)}
                    onMouseEnter={() => setHovCard(cam.id_categorie)}
                    onMouseLeave={() => setHovCard(null)}
                    onClick={() => setSelectedCam(cam)}
                  >
                    <div style={{ ...s.cameraHeader, position: "relative" }}>
                      <div style={s.cameraDenumire}>{cam.denumire}</div>
                      <div style={s.cameraCapacitate}>
                        👤 până la {cam.capacitate} {cam.capacitate === 1 ? "persoană" : "persoane"}
                      </div>
                      {isSelected && (
                        <div style={{ position: "absolute", top: "14px", right: "16px", background: "#C4A050", color: "#fff", fontSize: "0.62rem", fontFamily: "'Jost',sans-serif", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: "2px" }}>
                          ✓ Selectată
                        </div>
                      )}
                    </div>
                    <div style={s.cameraBody}>
                      <p style={s.cameraDescriere}>{cam.descriere}</p>
                      <div style={s.cameraFooter}>
                        <div style={s.pretWrap}>
                          <div style={s.pretLabel}>Preț</div>
                          <div>
                            <span style={s.pretValoare}>
                              {Math.round(cam.pret_pe_noapte)}
                            </span>
                            <span style={s.pretNoapte}>RON / noapte</span>
                          </div>
                          {pretTotal && (
                            <div style={s.pretTotal}>
                              Total {nopti} {nopti === 1 ? "noapte" : "nopți"}: {pretTotal} RON
                            </div>
                          )}
                          {/* Disponibilitate din API */}
                          {disponibilitate && (() => {
                            const d = disponibilitate.find(d => d.id_categorie === cam.id_categorie);
                            if (!d) return null;
                            return (
                              <div style={{
                                marginTop: "6px", fontSize: "0.72rem",
                                fontWeight: 500, fontFamily: "'Jost',sans-serif",
                                color: d.camere_libere > 0 ? "#0f6e56" : "#aa2020",
                              }}>
                                {d.camere_libere > 0
                                  ? `✓ ${d.camere_libere} ${d.camere_libere === 1 ? "cameră liberă" : "camere libere"}`
                                  : "✗ Ocupat în perioada selectată"}
                              </div>
                            );
                          })()}
                        </div>
                        <button
                          style={{
                            ...s.rezervaBtn(cam.id_categorie),
                            opacity: disponibilitate &&
                              disponibilitate.find(d => d.id_categorie === cam.id_categorie)?.camere_libere === 0
                              ? 0.4 : 1,
                          }}
                          disabled={disponibilitate &&
                            disponibilitate.find(d => d.id_categorie === cam.id_categorie)?.camere_libere === 0}
                          onMouseEnter={() => setHovBtn(cam.id_categorie)}
                          onMouseLeave={() => setHovBtn(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCam(cam);
                            if (wCheckin && wCheckout) {
                              const p = new URLSearchParams({ hotel_id: id, categorie_id: cam.id_categorie, checkin: wCheckin, checkout: wCheckout });
                              navigate(`/rezervare?${p}`);
                            } else {
                              window.scrollTo({ top: 0, behavior: "smooth" });
                              addToast("Alege datele de check-in și check-out în widget-ul din dreapta.", "info");
                            }
                          }}
                        >
                          {disponibilitate &&
                            disponibilitate.find(d => d.id_categorie === cam.id_categorie)?.camere_libere === 0
                            ? "Ocupat" : "Rezervă"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* ── HARTĂ HOTEL ── */}
          {hotel.latitudine && hotel.longitudine && (() => {
            const lat = parseFloat(hotel.latitudine);
            const lng = parseFloat(hotel.longitudine);
            const pretMin = hotel.categorii_camere?.length
              ? Math.round(Math.min(...hotel.categorii_camere.map(c => c.pret_pe_noapte)))
              : null;

            return (
              <div style={{ marginBottom: "40px" }}>
                <h2 style={s.sectionTitle}>Locație</h2>
                <div style={s.sectionLine} />
                <div style={{
                  borderRadius: "6px", overflow: "hidden",
                  border: "1px solid rgba(196,160,80,0.18)",
                  boxShadow: "0 4px 24px rgba(10,14,35,0.08)",
                }}>
                  <MapContainer
                    center={[lat, lng]}
                    zoom={15}
                    style={{ height: "360px", width: "100%" }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MarkerAutoPopup position={[lat, lng]}>
                      <Popup>
                        <div style={{ fontFamily: "'Jost',sans-serif", minWidth: "180px", padding: "2px 0" }}>
                          <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#0A0E23", marginBottom: "4px" }}>
                            {hotel.nume_hotel}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "rgba(26,26,46,0.5)", marginBottom: "8px", lineHeight: 1.4 }}>
                            📍 {hotel.adresa}, {hotel.nume_oras}
                          </div>
                          {pretMin && (
                            <div style={{
                              fontWeight: 700, color: "#C4A050", fontSize: "0.92rem",
                              borderTop: "1px solid rgba(196,160,80,0.15)", paddingTop: "8px",
                            }}>
                              De la {pretMin.toLocaleString()} RON
                              <span style={{ fontWeight: 400, color: "rgba(26,26,46,0.45)", fontSize: "0.78rem" }}> / noapte</span>
                            </div>
                          )}
                        </div>
                      </Popup>
                    </MarkerAutoPopup>
                  </MapContainer>
                  <div style={{
                    padding: "11px 16px",
                    background: "rgba(196,160,80,0.03)",
                    borderTop: "1px solid rgba(196,160,80,0.1)",
                    fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
                    color: "rgba(26,26,46,0.45)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span>📍 {hotel.adresa}, {hotel.nume_oras}</span>
                    <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ color: "#C4A050", textDecoration: "none", fontSize: "0.75rem", letterSpacing: "0.04em" }}>
                      Deschide în hartă →
                    </a>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── GALERIE FOTO ── */}
          {!galerieLoading && galerie.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h2 style={s.sectionTitle}>Galerie foto</h2>
              <div style={s.sectionLine} />
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "10px",
              }}>
                {galerie.map((poza, i) => (
                  <div key={poza.id_poza}
                    onClick={() => setGalActiva(i)}
                    style={{
                      borderRadius: "4px", overflow: "hidden", cursor: "pointer",
                      aspectRatio: "4/3", position: "relative",
                    }}>
                    <img src={poza.imagine_url} alt={poza.titlu || `Foto ${i+1}`}
                      style={{
                        width: "100%", height: "100%", objectFit: "cover",
                        transition: "transform .4s ease",
                      }}
                      onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
                      onMouseLeave={e => e.target.style.transform = "scale(1)"}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── LIGHTBOX ── */}
          {galerieActiva !== null && (
            <div
              onClick={() => setGalActiva(null)}
              style={{
                position: "fixed", inset: 0,
                background: "rgba(10,14,35,0.92)",
                backdropFilter: "blur(8px)",
                zIndex: 1000, display: "flex",
                alignItems: "center", justifyContent: "center",
                padding: "24px",
              }}>
              <button onClick={e => { e.stopPropagation(); setGalActiva(i => (i - 1 + galerie.length) % galerie.length); }}
                style={{
                  position: "absolute", left: "24px", top: "50%", transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fff", fontSize: "1.5rem", cursor: "pointer",
                  padding: "12px 18px", borderRadius: "2px",
                }}>‹</button>

              <img
                src={galerie[galerieActiva]?.imagine_url}
                alt="galerie"
                onClick={e => e.stopPropagation()}
                style={{
                  maxWidth: "90vw", maxHeight: "85vh",
                  objectFit: "contain", borderRadius: "4px",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                }}
              />

              <button onClick={e => { e.stopPropagation(); setGalActiva(i => (i + 1) % galerie.length); }}
                style={{
                  position: "absolute", right: "24px", top: "50%", transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fff", fontSize: "1.5rem", cursor: "pointer",
                  padding: "12px 18px", borderRadius: "2px",
                }}>›</button>

              <button onClick={() => setGalActiva(null)}
                style={{
                  position: "absolute", top: "20px", right: "20px",
                  background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fff", fontSize: "1rem", cursor: "pointer",
                  padding: "8px 14px", borderRadius: "2px",
                }}>✕ Închide</button>

              <div style={{
                position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)",
                fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
                color: "rgba(255,255,255,0.5)",
              }}>
                {galerieActiva + 1} / {galerie.length}
              </div>
            </div>
          )}
          {/* ── RECENZII ── */}
          {(() => {
            const ratingMediu = recenzii.length
              ? (recenzii.reduce((s, r) => s + r.rating, 0) / recenzii.length).toFixed(1)
              : null;
            const dist = [5,4,3,2,1].map(n => ({
              n, count: recenzii.filter(r => r.rating === n).length,
            }));
            const fmtDate = (s) => new Date(s).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });

            return (
              <div style={{ marginTop: "40px" }}>
                <h2 style={s.sectionTitle}>Recenzii clienți</h2>
                <div style={s.sectionLine} />

                {/* Sumar rating */}
                {recenzii.length > 0 && (
                  <div style={{ display: "flex", gap: "32px", alignItems: "center", marginBottom: "28px",
                    background: "#fff", border: "1px solid rgba(196,160,80,0.12)", borderRadius: "4px",
                    padding: "20px 24px", boxShadow: "0 4px 16px rgba(10,14,35,0.05)" }}>
                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "3rem", fontWeight: 700, color: "#C4A050", lineHeight: 1 }}>
                        {ratingMediu}
                      </div>
                      <div style={{ color: "#C4A050", fontSize: "1.1rem", margin: "4px 0" }}>
                        {"★".repeat(Math.round(ratingMediu))}{"☆".repeat(5 - Math.round(ratingMediu))}
                      </div>
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", color: "rgba(26,26,46,0.4)" }}>
                        {recenzii.length} {recenzii.length === 1 ? "recenzie" : "recenzii"}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      {dist.map(({ n, count }) => (
                        <div key={n} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                          <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", color: "rgba(26,26,46,0.5)", width: "20px" }}>{n}★</span>
                          <div style={{ flex: 1, height: "6px", background: "rgba(196,160,80,0.12)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: "3px", background: "linear-gradient(90deg,#C4A050,#A8883C)",
                              width: recenzii.length ? `${(count / recenzii.length) * 100}%` : "0%" }} />
                          </div>
                          <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", color: "rgba(26,26,46,0.4)", width: "20px", textAlign: "right" }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lista recenzii */}
                {recenzii.length === 0 && (
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "rgba(26,26,46,0.4)",
                    padding: "24px", textAlign: "center", background: "#fff",
                    border: "1px solid rgba(196,160,80,0.1)", borderRadius: "4px", marginBottom: "20px" }}>
                    Nu există recenzii pentru acest hotel încă. Fii primul!
                  </div>
                )}
                {recenzii.map(r => (
                  <div key={r.id_recenzie} style={{ background: "#fff", borderRadius: "4px", padding: "18px 22px",
                    border: "1px solid rgba(196,160,80,0.1)", marginBottom: "12px",
                    boxShadow: "0 2px 8px rgba(10,14,35,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div>
                        <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: "0.88rem", color: "#0A0E23", marginBottom: "2px" }}>
                          {r.nume_complet}
                        </div>
                        <div style={{ color: "#C4A050", fontSize: "0.9rem" }}>
                          {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                        </div>
                      </div>
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", color: "rgba(26,26,46,0.35)" }}>
                        {fmtDate(r.data_recenziei)}
                      </div>
                    </div>
                    {r.comentariu && (
                      <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "rgba(26,26,46,0.65)", margin: 0, lineHeight: 1.65 }}>
                        {r.comentariu}
                      </p>
                    )}
                  </div>
                ))}

                {/* Formular adaugare recenzie */}
                {utilizatorCurent ? (
                  <div style={{ background: "#fff", borderRadius: "4px", padding: "22px",
                    border: "1px solid rgba(196,160,80,0.15)", marginTop: "16px",
                    boxShadow: "0 4px 16px rgba(10,14,35,0.05)" }}>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.1rem", fontWeight: 600, color: "#0A0E23", marginBottom: "16px" }}>
                      Adaugă o recenzie
                    </div>

                    {/* Stele selectabile */}
                    <div style={{ marginBottom: "14px" }}>
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C4A050", marginBottom: "8px" }}>
                        Rating *
                      </div>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {[1,2,3,4,5].map(n => (
                          <button key={n} onClick={() => setRecenzieForm(f => ({ ...f, rating: n }))}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.6rem",
                              color: n <= recenzieForm.rating ? "#C4A050" : "rgba(26,26,46,0.2)",
                              padding: "0 2px", transition: "color .15s" }}>
                            ★
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C4A050", marginBottom: "6px" }}>
                        Comentariu (opțional)
                      </div>
                      <textarea
                        value={recenzieForm.comentariu}
                        onChange={e => setRecenzieForm(f => ({ ...f, comentariu: e.target.value }))}
                        placeholder="Spune-ne cum a fost experiența ta..."
                        rows={3}
                        style={{ width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.88rem",
                          color: "#0A0E23", border: "1px solid rgba(196,160,80,0.25)", borderRadius: "2px",
                          padding: "9px 12px", outline: "none", background: "#FDFBF8",
                          resize: "vertical", boxSizing: "border-box" }}
                      />
                    </div>

                    <button onClick={handleAdaugaRecenzie} disabled={recenzieLoading}
                      style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", fontWeight: 500,
                        letterSpacing: "0.12em", textTransform: "uppercase", color: "#0A0E23",
                        background: recenzieLoading ? "rgba(196,160,80,0.5)" : "linear-gradient(135deg,#C4A050,#A8883C)",
                        border: "none", borderRadius: "2px", padding: "10px 24px", cursor: recenzieLoading ? "not-allowed" : "pointer" }}>
                      {recenzieLoading ? "Se trimite..." : "Trimite recenzia"}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.85rem",
                    color: "rgba(26,26,46,0.5)", textAlign: "center", padding: "18px",
                    background: "#fff", border: "1px solid rgba(196,160,80,0.1)", borderRadius: "4px", marginTop: "16px" }}>
                    <Link to="/autentificare" style={{ color: "#C4A050", textDecoration: "none" }}>Autentifică-te</Link> pentru a lăsa o recenzie.
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* ════ SIDEBAR DREAPTA — BOOKING WIDGET ════ */}
        <aside style={s.sidebar}>

          {/* Price header */}
          <div style={{
            background: "linear-gradient(135deg, #0A0E23 0%, #0f1535 100%)",
            padding: "24px 22px 20px", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "140px", height: "140px", borderRadius: "50%", background: "radial-gradient(circle, rgba(196,160,80,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.6rem", fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>
              {selectedCam ? "Cameră selectată" : "Preț de la"}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: selectedCam ? "4px" : "10px" }}>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "2.6rem", fontWeight: 700, color: "#C4A050", lineHeight: 1 }}>
                {selectedCam ? Math.round(selectedCam.pret_pe_noapte) : (pretMin ?? "—")}
              </span>
              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(255,255,255,0.35)" }}>RON / noapte</span>
            </div>
            {selectedCam && (
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(255,255,255,0.65)", marginBottom: "8px", fontWeight: 400 }}>
                {selectedCam.denumire}
              </div>
            )}
            <div style={{ color: "#C4A050", fontSize: "0.88rem", letterSpacing: "2px", marginBottom: "4px" }}>
              {"★".repeat(hotel.stele)}{"☆".repeat(5 - hotel.stele)}
            </div>
            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", marginTop: "4px" }}>
              📍 {hotel.adresa}, {hotel.nume_oras}
            </div>
          </div>

          {/* Date inputs */}
          <div style={{ padding: "18px 20px 16px", borderBottom: "1px solid rgba(196,160,80,0.1)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.59rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C4A050", display: "block", marginBottom: "5px" }}>Check-in</label>
                <input type="date" value={wCheckin}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => setWCheckin(e.target.value)}
                  style={{ width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.79rem", color: "#0A0E23", border: "1px solid rgba(196,160,80,0.22)", borderRadius: "2px", padding: "7px 8px", outline: "none", background: "#FDFBF8", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.59rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C4A050", display: "block", marginBottom: "5px" }}>Check-out</label>
                <input type="date" value={wCheckout}
                  min={wCheckin || new Date().toISOString().split("T")[0]}
                  onChange={e => setWCheckout(e.target.value)}
                  style={{ width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.79rem", color: "#0A0E23", border: "1px solid rgba(196,160,80,0.22)", borderRadius: "2px", padding: "7px 8px", outline: "none", background: "#FDFBF8", boxSizing: "border-box" }} />
              </div>
            </div>
            {!selectedCam && (
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.71rem", color: "rgba(26,26,46,0.42)", lineHeight: 1.5, marginTop: "4px" }}>
                * Preț pentru camera de bază. Selectează o cameră din lista de mai jos.
              </div>
            )}
          </div>

          {/* Summary + CTA */}
          <div style={{ padding: "16px 20px 22px" }}>
            {wNopti > 0 && (selectedCam || pretMin) && (() => {
              const pretCam = selectedCam ? Math.round(selectedCam.pret_pe_noapte) : pretMin;
              return (
                <div style={{ background: "rgba(196,160,80,0.05)", border: "1px solid rgba(196,160,80,0.15)", borderRadius: "3px", padding: "12px 14px", marginBottom: "14px" }}>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.5)", marginBottom: "8px" }}>
                    {wNopti} {wNopti === 1 ? "noapte" : "nopți"} × {pretCam} RON
                    {selectedCam && <span style={{ color: "#C4A050", marginLeft: "6px" }}>· {selectedCam.denumire}</span>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(196,160,80,0.12)", paddingTop: "8px" }}>
                    <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(26,26,46,0.45)" }}>Total estimat</span>
                    <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.4rem", fontWeight: 700, color: "#C4A050" }}>
                      {(wNopti * pretCam).toLocaleString()} RON
                    </span>
                  </div>
                </div>
              );
            })()}

            <button
              onClick={handleWidgetSearch}
              style={{
                width: "100%", padding: "13px 16px", border: "none", borderRadius: "2px",
                fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
                fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase",
                color: "#0A0E23", cursor: "pointer",
                background: "linear-gradient(135deg,#C4A050,#A8883C)",
                boxShadow: "0 4px 16px rgba(196,160,80,0.28)",
                transition: "all .2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 28px rgba(196,160,80,0.45)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(196,160,80,0.28)"; e.currentTarget.style.transform = "none"; }}
            >
              {wNopti > 0 ? `Rezervă · ${wNopti} ${wNopti === 1 ? "noapte" : "nopți"} →` : "Rezervă acum →"}
            </button>

            {/* Trust badges */}
            <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "9px" }}>
              {[
                "Anulare gratuită (48h înainte)",
                "Plată securizată prin Stripe",
                "Suport Lun–Dum · 08:00–22:00",
              ].map((badge, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#C4A050", fontSize: "0.7rem", flexShrink: 0 }}>✓</span>
                  <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.74rem", color: "rgba(26,26,46,0.42)" }}>{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}