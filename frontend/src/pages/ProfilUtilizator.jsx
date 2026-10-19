import { downloadReservation } from '../utils/downloadReservation';
import { useSession } from '../hooks/useSession';
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

import { API_URL } from "../api";

// ─── Helper formatare dată ─────────────────────────────────────────────────
const formatData = (str) => {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("ro-RO", {
    day: "numeric", month: "long", year: "numeric"
  });
};

// ─── Badge status ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    confirmata:   { label: "Confirmată",   bg: "rgba(29,158,117,0.1)",  color: "#0f6e56", border: "rgba(29,158,117,0.3)" },
    in_asteptare: { label: "În așteptare", bg: "rgba(196,160,80,0.1)",  color: "#8a6a10", border: "rgba(196,160,80,0.3)" },
    anulata:      { label: "Anulată",      bg: "rgba(220,50,50,0.08)",  color: "#aa2020", border: "rgba(220,50,50,0.2)" },
  };
  const c = config[status] || config.in_asteptare;
  return (
    <span style={{
      fontFamily: "'Jost',sans-serif", fontSize: "0.72rem",
      fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
      color: c.color, background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: "2px", padding: "3px 10px",
    }}>
      {c.label}
    </span>
  );
}

// ─── Skeleton card ─────────────────────────────────────────────────────────
const skSh = {
  background: "linear-gradient(90deg,#ede8df 25%,#f7f3ed 50%,#ede8df 75%)",
  backgroundSize: "200% 100%",
  animation: "skeletonShimmer 1.4s ease-in-out infinite",
  borderRadius: "2px",
};

function SkeletonCard() {
  return (
    <div style={{
      background: "#fff", borderRadius: "4px", overflow: "hidden",
      border: "1px solid rgba(196,160,80,0.1)",
      boxShadow: "0 4px 20px rgba(10,14,35,0.05)",
      marginBottom: "16px",
    }}>
      <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid rgba(196,160,80,0.08)", display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ width: "200px", height: "20px", marginBottom: "8px", ...skSh }} />
          <div style={{ width: "100px", height: "13px", ...skSh }} />
        </div>
        <div style={{ width: "80px", height: "24px", borderRadius: "2px", ...skSh }} />
      </div>
      <div style={{ padding: "16px 24px 20px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px" }}>
        {[1,2,3,4].map(i => (
          <div key={i}>
            <div style={{ width: "60%", height: "11px", marginBottom: "6px", ...skSh }} />
            <div style={{ width: "85%", height: "16px", ...skSh }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
export default function ProfilUtilizator() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const esteRezervari = location.pathname === "/rezervarile-mele";

  // ── User ───────────────────────────────────────────────────────────────
  const { utilizator, token } = useSession();

  // ── State ──────────────────────────────────────────────────────────────
  const [rezervari, setRezervari]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [eroare, setEroare]             = useState(null);
  const [anulareId, setAnulareId]       = useState(null);
  const [confirmAnulare, setConfirm]    = useState(null);
  const [filtruStatus, setFiltru]       = useState("toate");
  const [hovCard, setHovCard]           = useState(null);
  const [hovBtn, setHovBtn]             = useState(null);

  // ── Editare profil ────────────────────────────────────────────────────
  const [profilForm, setProfilForm]     = useState(() => ({ nume_complet: utilizator?.nume_complet || "", telefon: utilizator?.telefon || "", email_marketing: !!utilizator?.email_marketing }));
  const [profilLoading, setProfilLoad]  = useState(false);
  const [profilMsg, setProfilMsg]       = useState(null); // { ok, text }

  // ── Redirect dacă nu e logat ───────────────────────────────────────────
  useEffect(() => {
    if (!utilizator || !token) {
      sessionStorage.setItem("returnTo", "/profil");
      navigate("/autentificare", { state: { from: "/profil" } });
    }
  }, [navigate, token, utilizator]);

  // ── Fetch rezervări ────────────────────────────────────────────────────
  const fetchRezervari = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setEroare(null);
      const res = await fetch(`${API_URL}/api/rezervari/mele`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRezervari(data);
    } catch {
      setEroare("Nu s-au putut încărca rezervările.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchRezervari(); }, [fetchRezervari]);

  // ── Salvează profil ───────────────────────────────────────────────────
  const handleSalvaProfil = async () => {
    if (!profilForm.nume_complet.trim()) {
      setProfilMsg({ ok: false, text: "Numele este obligatoriu." }); return;
    }
    try {
      setProfilLoad(true);
      setProfilMsg(null);
      const res = await fetch(`${API_URL}/api/auth/profil`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(profilForm),
      });
      const d = await res.json();
      if (!res.ok) { setProfilMsg({ ok: false, text: d.eroare || "Eroare." }); return; }
      // Actualizăm localStorage
      if (d.utilizator) {
        localStorage.setItem("utilizator", JSON.stringify({ ...utilizator, ...d.utilizator }));
        window.dispatchEvent(new Event("utilizator-update"));
      }
      setProfilMsg({ ok: true, text: "Profil actualizat cu succes!" });
    } catch {
      setProfilMsg({ ok: false, text: "Eroare de rețea." });
    } finally {
      setProfilLoad(false);
    }
  };

  // ── Descarcă factură PDF ──────────────────────────────────────────────
  const handleDescarcarFactura = async (idRezervare) => {
    try {
      await downloadReservation(idRezervare, token);
    } catch {
      setEroare("Nu s-a putut genera factura. Încearcă din nou.");
    }
  };

  // ── Anulare rezervare ──────────────────────────────────────────────────
  const handleAnulare = async (idRezervare) => {
    try {
      setAnulareId(idRezervare);
      const res = await fetch(`${API_URL}/api/rezervari/${idRezervare}/anulare`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      // Actualizăm local fără re-fetch
      setRezervari(prev => prev.map(r =>
        r.id_rezervare === idRezervare
          ? { ...r, status_rezervare: "anulata" }
          : r
      ));
      setConfirm(null);
    } catch {
      setEroare("Nu s-a putut anula rezervarea. Încearcă din nou.");
    } finally {
      setAnulareId(null);
    }
  };

  // ── Filtrare ───────────────────────────────────────────────────────────
  const rezervariFiltrate = rezervari.filter(r =>
    filtruStatus === "toate" || r.status_rezervare === filtruStatus
  );

  const numarPerStatus = {
    toate:        rezervari.length,
    confirmata:   rezervari.filter(r => r.status_rezervare === "confirmata").length,
    in_asteptare: rezervari.filter(r => r.status_rezervare === "in_asteptare").length,
    anulata:      rezervari.filter(r => r.status_rezervare === "anulata").length,
  };

  // ── Verifică dacă poate anula (cu 24h înainte de check-in) ────────────
  const poateAnula = (rezervare) => {
    if (rezervare.status_rezervare === "anulata") return false;
    const checkin = new Date(rezervare.data_checkin);
    const acum    = new Date();
    const diffOre = (checkin - acum) / (1000 * 60 * 60);
    return diffOre > 24;
  };

  // ── Stiluri ─────────────────────────────────────────────────────────────
  const s = {
    page: { minHeight: "100vh", background: "#F8F6F1", paddingTop: "80px" },

    // Header
    header: {
      background: "linear-gradient(135deg, #0A0E23 0%, #0f1530 60%, #0A0E23 100%)",
      padding: "40px 48px 36px",
      borderBottom: "1px solid rgba(196,160,80,0.15)",
      position: "relative", overflow: "hidden",
    },
    headerDecor: {
      position: "absolute", top: "-60px", right: "-60px",
      width: "280px", height: "280px", borderRadius: "50%",
      background: "radial-gradient(circle, rgba(196,160,80,0.06) 0%, transparent 70%)",
      pointerEvents: "none",
    },
    headerInner: { maxWidth: "1100px", margin: "0 auto", position: "relative" },
    breadcrumb: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "rgba(255,255,255,0.4)", marginBottom: "12px",
      display: "flex", alignItems: "center", gap: "8px",
    },
    breadLink: { color: "rgba(255,255,255,0.4)", textDecoration: "none" },
    headerTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
    headerTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "clamp(1.6rem,3vw,2.4rem)",
      fontWeight: 700, color: "#fff", marginBottom: "6px",
    },
    headerSub: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.85rem",
      color: "rgba(255,255,255,0.4)",
    },

    // Avatar
    avatar: {
      width: "64px", height: "64px", borderRadius: "50%",
      background: "linear-gradient(135deg,#C4A050,#F0D080)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.5rem", fontWeight: 700, color: "#0A0E23",
      flexShrink: 0,
      boxShadow: "0 0 0 3px rgba(196,160,80,0.2), 0 8px 24px rgba(196,160,80,0.25)",
    },

    // Layout
    layout: { maxWidth: "1100px", margin: "0 auto", padding: "36px 48px" },

    // Statistici
    statsRow: {
      display: "grid", gridTemplateColumns: "repeat(4,1fr)",
      gap: "16px", marginBottom: "32px",
    },
    statCard: (activ) => ({
      background: activ ? "#0A0E23" : "#fff",
      borderRadius: "4px", padding: "18px 20px",
      border: activ ? "1px solid rgba(196,160,80,0.3)" : "1px solid rgba(196,160,80,0.12)",
      boxShadow: "0 4px 16px rgba(10,14,35,0.06)",
      cursor: "pointer", transition: "all .2s ease",
    }),
    statNr: (activ) => ({
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "2rem", fontWeight: 700,
      color: activ ? "#C4A050" : "#0A0E23",
      lineHeight: 1,
    }),
    statLabel: (activ) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
      letterSpacing: "0.1em", textTransform: "uppercase",
      color: activ ? "rgba(255,255,255,0.5)" : "rgba(26,26,46,0.4)",
      marginTop: "6px",
    }),

    // Lista rezervări
    listaVida: {
      textAlign: "center", padding: "60px 24px",
      fontFamily: "'Jost',sans-serif",
    },
    listaVidaIcon: { fontSize: "2.5rem", opacity: .3, marginBottom: "16px" },
    listaVidaTitlu: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.5rem", color: "#0A0E23", marginBottom: "8px",
    },
    listaVidaText: { fontSize: "0.88rem", color: "rgba(26,26,46,0.45)", marginBottom: "24px" },

    // Card rezervare
    rezervareCard: (id, status) => ({
      background: "#fff", borderRadius: "4px",
      border: hovCard === id ? "1px solid rgba(196,160,80,0.4)" : "1px solid rgba(196,160,80,0.12)",
      boxShadow: hovCard === id ? "0 12px 40px rgba(10,14,35,0.1)" : "0 4px 16px rgba(10,14,35,0.05)",
      marginBottom: "16px", overflow: "hidden",
      transition: "all .25s ease",
      borderLeft: `4px solid ${
        status === "confirmata" ? "#1d9e75" :
        status === "anulata"   ? "#dc3232" : "#C4A050"
      }`,
    }),
    cardHead: {
      padding: "18px 24px 14px",
      borderBottom: "1px solid rgba(196,160,80,0.08)",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    },
    cardHeadLeft: {},
    numeHotel: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.25rem", fontWeight: 600, color: "#0A0E23",
      marginBottom: "2px",
    },
    orasHotel: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "#C4A050", letterSpacing: "0.1em", textTransform: "uppercase",
    },
    cardBody: {
      padding: "16px 24px 20px",
      display: "grid", gridTemplateColumns: "repeat(4,1fr)",
      gap: "16px",
    },
    infoItem: {},
    infoLabel: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.67rem",
      letterSpacing: "0.12em", textTransform: "uppercase",
      color: "rgba(26,26,46,0.35)", marginBottom: "4px",
    },
    infoValue: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.88rem",
      fontWeight: 500, color: "#0A0E23",
    },
    infoValueGold: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.1rem", fontWeight: 700, color: "#0A0E23",
    },
    cardFoot: {
      padding: "12px 24px",
      borderTop: "1px solid rgba(196,160,80,0.06)",
      background: "rgba(196,160,80,0.02)",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    },
    creataLa: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
      color: "rgba(26,26,46,0.3)",
    },
    facturaBtn: (id) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
      fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
      color: hovBtn === `fac-${id}` ? "#fff" : "#0A0E23",
      background: hovBtn === `fac-${id}`
        ? "linear-gradient(135deg,#C4A050,#A8883C)"
        : "transparent",
      border: "1px solid rgba(196,160,80,0.4)",
      borderRadius: "2px", padding: "6px 14px",
      cursor: "pointer", transition: "all .2s",
    }),
    anulareBtn: (id) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
      fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
      color: hovBtn === `an-${id}` ? "#aa2020" : "rgba(26,26,46,0.4)",
      background: "none", border: "1px solid",
      borderColor: hovBtn === `an-${id}` ? "rgba(220,50,50,0.3)" : "rgba(26,26,46,0.15)",
      borderRadius: "2px", padding: "6px 14px",
      cursor: "pointer", transition: "all .2s",
    }),
    detaliiBtn: (id) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
      fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
      color: hovBtn === `det-${id}` ? "#fff" : "#0A0E23",
      background: hovBtn === `det-${id}`
        ? "linear-gradient(135deg,#C4A050,#A8883C)"
        : "transparent",
      border: "1px solid rgba(196,160,80,0.4)",
      borderRadius: "2px", padding: "6px 14px",
      cursor: "pointer", transition: "all .2s",
      textDecoration: "none", display: "inline-block",
    }),

    // Dialog confirmare anulare
    overlay: {
      position: "fixed", inset: 0,
      background: "rgba(10,14,35,0.6)",
      backdropFilter: "blur(4px)",
      zIndex: 500, display: "flex",
      alignItems: "center", justifyContent: "center",
      padding: "24px",
    },
    dialog: {
      background: "#fff", borderRadius: "4px",
      maxWidth: "420px", width: "100%",
      boxShadow: "0 24px 80px rgba(10,14,35,0.3)",
      border: "1px solid rgba(196,160,80,0.15)",
      overflow: "hidden",
    },
    dialogHead: {
      background: "#0A0E23", padding: "20px 24px",
    },
    dialogTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.3rem", fontWeight: 600, color: "#fff",
    },
    dialogBody: { padding: "24px" },
    dialogText: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.88rem",
      color: "rgba(26,26,46,0.65)", lineHeight: 1.7, marginBottom: "24px",
    },
    dialogBtns: { display: "flex", gap: "12px" },
    dialogBtnPrimary: {
      flex: 1, padding: "11px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
      fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      color: "#fff", background: "#cc2200",
      border: "none", borderRadius: "2px", cursor: "pointer",
    },
    dialogBtnSecondary: {
      flex: 1, padding: "11px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
      fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      color: "#0A0E23", background: "transparent",
      border: "1px solid rgba(196,160,80,0.3)", borderRadius: "2px", cursor: "pointer",
    },

    // Eroare
    errorBox: {
      padding: "14px 18px", marginBottom: "20px",
      background: "rgba(255,80,80,0.07)",
      border: "1px solid rgba(255,80,80,0.2)",
      borderRadius: "2px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.83rem", color: "#cc2200",
    },
  };

  const initiale = utilizator?.nume_complet
    ?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div className="profile-page" style={s.page}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={s.header}>
        <div style={s.headerDecor} />
        <div className="page-heading" style={s.headerInner}>
          <div style={s.breadcrumb}>
            <Link to="/" style={s.breadLink}>Acasă</Link>
            <span>›</span>
            <span style={{ color: "#C4A050" }}>{esteRezervari ? "Rezervările mele" : "Profilul meu"}</span>
          </div>
          <div className="profile-header" style={s.headerTop}>
            <div>
              <h1 style={s.headerTitle}>{utilizator?.nume_complet}</h1>
              <p style={s.headerSub}>{utilizator?.email}
                {utilizator?.telefon && ` · ${utilizator.telefon}`}
              </p>
            </div>
            <div style={s.avatar}>{initiale}</div>
          </div>
        </div>
      </div>

      {/* ── LAYOUT ──────────────────────────────────────────────────────── */}
      <div className="page-layout" style={s.layout}>

        {/* ── TABS ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(196,160,80,0.15)", marginBottom: "32px" }}>
          {[
            { label: "Profilul meu", to: "/profil" },
            { label: "Rezervările mele", to: "/rezervarile-mele" },
          ].map(({ label, to }) => {
            const activ = location.pathname === to;
            return (
              <Link key={to} to={to} style={{
                fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
                fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase",
                color: activ ? "#C4A050" : "rgba(26,26,46,0.38)",
                textDecoration: "none", padding: "13px 24px",
                borderBottom: activ ? "2px solid #C4A050" : "2px solid transparent",
                marginBottom: "-1px", transition: "all .2s",
              }}>
                {label}
              </Link>
            );
          })}
        </div>

        {eroare && <div style={s.errorBox}>⚠ {eroare}</div>}

        {/* ── EDITARE PROFIL — doar pe /profil ──────────────────────── */}
        {!esteRezervari && (
          <div style={{
            background: "#fff", borderRadius: "4px", marginBottom: "28px",
            border: "1px solid rgba(196,160,80,0.12)",
            boxShadow: "0 4px 16px rgba(10,14,35,0.05)", overflow: "hidden",
          }}>
            <div style={{
              padding: "18px 24px",
              borderBottom: "1px solid rgba(196,160,80,0.1)",
            }}>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.15rem", fontWeight: 600, color: "#0A0E23" }}>
                Editează profilul
              </div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.4)", marginTop: "2px" }}>
                Nume, telefon, preferințe newsletter
              </div>
            </div>

            <div style={{ padding: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div>
                  <label style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C4A050", display: "block", marginBottom: "6px" }}>
                    Nume complet *
                  </label>
                  <input
                    value={profilForm.nume_complet}
                    onChange={e => setProfilForm(f => ({ ...f, nume_complet: e.target.value }))}
                    style={{ width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "#0A0E23", border: "1px solid rgba(196,160,80,0.25)", borderRadius: "2px", padding: "9px 12px", outline: "none", background: "#FDFBF8", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C4A050", display: "block", marginBottom: "6px" }}>
                    Telefon
                  </label>
                  <input
                    value={profilForm.telefon}
                    onChange={e => setProfilForm(f => ({ ...f, telefon: e.target.value }))}
                    placeholder="07xx xxx xxx"
                    style={{ width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "#0A0E23", border: "1px solid rgba(196,160,80,0.25)", borderRadius: "2px", padding: "9px 12px", outline: "none", background: "#FDFBF8", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C4A050", display: "block", marginBottom: "6px" }}>
                  Email (nu poate fi modificat)
                </label>
                <input
                  value={utilizator?.email || ""}
                  disabled
                  style={{ width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "rgba(26,26,46,0.4)", border: "1px solid rgba(196,160,80,0.1)", borderRadius: "2px", padding: "9px 12px", outline: "none", background: "#F5F3EE", boxSizing: "border-box", cursor: "not-allowed" }}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", color: "rgba(26,26,46,0.6)", marginBottom: "20px" }}>
                <input
                  type="checkbox"
                  checked={profilForm.email_marketing}
                  onChange={e => setProfilForm(f => ({ ...f, email_marketing: e.target.checked }))}
                  style={{ accentColor: "#C4A050", cursor: "pointer" }}
                />
                Doresc să primesc oferte speciale și promoții pe email
              </label>

              {profilMsg && (
                <div style={{
                  marginBottom: "14px", padding: "10px 14px", borderRadius: "2px",
                  fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
                  background: profilMsg.ok ? "rgba(30,160,100,0.08)" : "rgba(220,50,50,0.07)",
                  border: `1px solid ${profilMsg.ok ? "rgba(30,160,100,0.25)" : "rgba(220,50,50,0.2)"}`,
                  color: profilMsg.ok ? "#0f6e56" : "#bb2222",
                }}>
                  {profilMsg.ok ? "✓" : "⚠"} {profilMsg.text}
                </div>
              )}

              <button
                onClick={handleSalvaProfil}
                disabled={profilLoading}
                style={{
                  fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", fontWeight: 500,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "#0A0E23", border: "none", borderRadius: "2px",
                  padding: "11px 28px", cursor: profilLoading ? "not-allowed" : "pointer",
                  background: profilLoading ? "rgba(196,160,80,0.5)" : "linear-gradient(135deg,#C4A050,#A8883C)",
                }}
              >
                {profilLoading ? "Se salvează..." : "Salvează modificările"}
              </button>
            </div>
          </div>
        )}

        {/* ── REZERVĂRI — doar pe /rezervarile-mele ───────────────────── */}
        {esteRezervari && (
        <>

        {/* Statistici */}
        <div className="profile-stats" style={s.statsRow}>
          {[
            { key: "toate",        label: "Total" },
            { key: "confirmata",   label: "Confirmate" },
            { key: "in_asteptare", label: "În așteptare" },
            { key: "anulata",      label: "Anulate" },
          ].map(({ key, label }) => (
            <div key={key} style={s.statCard(filtruStatus === key)}
              onClick={() => setFiltru(key)}>
              <div style={s.statNr(filtruStatus === key)}>
                {loading ? "—" : numarPerStatus[key]}
              </div>
              <div style={s.statLabel(filtruStatus === key)}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── LISTA REZERVĂRI ─────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && rezervariFiltrate.length === 0 && (
          <div style={s.listaVida}>
            <div style={s.listaVidaIcon}>◈</div>
            <div style={s.listaVidaTitlu}>
              {filtruStatus === "toate"
                ? "Nu ai nicio rezervare încă"
                : `Nu ai rezervări ${filtruStatus === "anulata" ? "anulate" : filtruStatus === "confirmata" ? "confirmate" : "în așteptare"}`}
            </div>
            <p style={s.listaVidaText}>
              {filtruStatus === "toate"
                ? "Explorează hotelurile noastre și fă prima ta rezervare."
                : "Schimbă filtrul pentru a vedea alte rezervări."}
            </p>
            {filtruStatus === "toate" && (
              <Link to="/hoteluri" style={{
                display: "inline-block", padding: "11px 28px",
                fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
                fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
                color: "#0A0E23", background: "linear-gradient(135deg,#C4A050,#A8883C)",
                borderRadius: "2px", textDecoration: "none",
              }}>
                Explorează hoteluri
              </Link>
            )}
          </div>
        )}

        {!loading && rezervariFiltrate.map(r => {
          const nopti = Math.max(0, Math.floor(
            (new Date(r.data_checkout) - new Date(r.data_checkin)) / (1000 * 60 * 60 * 24)
          ));
          const zileCheckin = Math.ceil((new Date(r.data_checkin) - new Date()) / (1000 * 60 * 60 * 24));
          const esteViitor = zileCheckin > 0 && r.status_rezervare !== "anulata";

          return (
            <div key={r.id_rezervare}
              style={s.rezervareCard(r.id_rezervare, r.status_rezervare)}
              onMouseEnter={() => setHovCard(r.id_rezervare)}
              onMouseLeave={() => setHovCard(null)}>

              {/* Head */}
              <div className="reservation-header" style={s.cardHead}>
                <div style={s.cardHeadLeft}>
                  <div style={s.numeHotel}>{r.nume_hotel}</div>
                  <div style={s.orasHotel}>📍 {r.nume_oras}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                  <StatusBadge status={r.status_rezervare} />
                  {esteViitor && (
                    <span style={{
                      fontFamily: "'Jost',sans-serif", fontSize: "0.68rem",
                      color: "#C4A050", letterSpacing: "0.06em",
                    }}>
                      {zileCheckin === 1 ? "Mâine!" : `peste ${zileCheckin} zile`}
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="reservation-info" style={s.cardBody}>
                <div style={s.infoItem}>
                  <div style={s.infoLabel}>Tip cameră</div>
                  <div style={s.infoValue}>{r.tip_camera}</div>
                </div>
                <div style={s.infoItem}>
                  <div style={s.infoLabel}>Check-in</div>
                  <div style={s.infoValue}>{formatData(r.data_checkin)}</div>
                </div>
                <div style={s.infoItem}>
                  <div style={s.infoLabel}>Check-out</div>
                  <div style={s.infoValue}>{formatData(r.data_checkout)}</div>
                </div>
                <div style={s.infoItem}>
                  <div style={s.infoLabel}>Total / Plată</div>
                  <div>
                    <div style={s.infoValueGold}>
                      {Math.round(r.pret_total)} RON
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", color: "rgba(26,26,46,0.35)", fontWeight: 400, marginLeft: "4px" }}>
                        / {nopti} {nopti === 1 ? "noapte" : "nopți"}
                      </span>
                    </div>
                    {r.metoda_plata === "avans_online" && r.suma_avans && (
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", color: "#0f6e56", marginTop: "3px" }}>
                        Avans plătit: {Math.round(r.suma_avans)} RON
                      </div>
                    )}
                    {r.metoda_plata === "cash_cazare" && (
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", color: "rgba(26,26,46,0.4)", marginTop: "3px" }}>
                        Plată la cazare
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="reservation-footer" style={s.cardFoot}>
                <span style={s.creataLa}>
                  Rezervare #{r.id_rezervare} · creată pe {formatData(r.data_crearii)}
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {poateAnula(r) && (
                    <button
                      style={s.anulareBtn(r.id_rezervare)}
                      onMouseEnter={() => setHovBtn(`an-${r.id_rezervare}`)}
                      onMouseLeave={() => setHovBtn(null)}
                      onClick={() => setConfirm(r.id_rezervare)}
                    >
                      Anulează
                    </button>
                  )}
                  {r.status_rezervare !== "anulata" && (
                    <button
                      style={s.facturaBtn(r.id_rezervare)}
                      onMouseEnter={() => setHovBtn(`fac-${r.id_rezervare}`)}
                      onMouseLeave={() => setHovBtn(null)}
                      onClick={() => handleDescarcarFactura(r.id_rezervare)}
                    >
                      📄 Factură PDF
                    </button>
                  )}
                  <Link
                    to={`/hoteluri/${r.id_hotel || ""}`}
                    style={s.detaliiBtn(r.id_rezervare)}
                    onMouseEnter={() => setHovBtn(`det-${r.id_rezervare}`)}
                    onMouseLeave={() => setHovBtn(null)}
                  >
                    Vezi hotelul
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        </>
        )}
      </div>

      {/* ── DIALOG CONFIRMARE ANULARE ────────────────────────────────────── */}
      {confirmAnulare && (
        <div style={s.overlay} onClick={() => setConfirm(null)}>
          <div className="dialog-card" style={s.dialog} onClick={e => e.stopPropagation()}>
            <div style={s.dialogHead}>
              <div style={s.dialogTitle}>Confirmi anularea?</div>
            </div>
            <div style={s.dialogBody}>
              <p style={s.dialogText}>
                Ești sigur că vrei să anulezi rezervarea <strong>#{confirmAnulare}</strong>?
                Această acțiune nu poate fi anulată.
              </p>
              <div style={s.dialogBtns}>
                <button
                  style={s.dialogBtnPrimary}
                  onClick={() => handleAnulare(confirmAnulare)}
                  disabled={anulareId === confirmAnulare}
                >
                  {anulareId === confirmAnulare ? "Se anulează..." : "Da, anulează"}
                </button>
                <button style={s.dialogBtnSecondary} onClick={() => setConfirm(null)}>
                  Renunță
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}