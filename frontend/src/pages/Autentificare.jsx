import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

const API_URL = "http://localhost:5000";

export default function Autentificare() {
  const navigate = useNavigate();
  const location = useLocation();

  // Citim returnTo din: state (router) → sessionStorage → fallback "/"
  const returnTo = location.state?.from
    || sessionStorage.getItem("returnTo")
    || "/";

  // ── State ──────────────────────────────────────────────────────────────
  const [tab, setTab]         = useState("login");
  const [loading, setLoading] = useState(false);
  const [eroare, setEroare]   = useState("");
  const [succes, setSucces]   = useState("");

  // Login
  const [loginEmail, setLoginEmail]   = useState("");
  const [loginParola, setLoginParola] = useState("");

  // Register
  const [regNume, setRegNume]       = useState("");
  const [regEmail, setRegEmail]     = useState("");
  const [regParola, setRegParola]   = useState("");
  const [regParola2, setRegParola2] = useState("");
  const [regTelefon, setRegTelefon]       = useState("");
  const [regMarketing, setRegMarketing]   = useState(false);

  // UI
  const [showPass, setShowPass]     = useState(false);
  const [focusField, setFocusField] = useState(null);

  // ── Login ──────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setEroare(""); setSucces("");
    if (!loginEmail || !loginParola) {
      setEroare("Completează toate câmpurile."); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, parola: loginParola }),
      });
      const data = await res.json();
      if (!res.ok) { setEroare(data.eroare || "Date incorecte."); return; }

      localStorage.setItem("token", data.token);
      localStorage.setItem("utilizator", JSON.stringify(data.utilizator));
      window.dispatchEvent(new Event("utilizator-update"));

      // Curățăm sessionStorage după login reușit
      sessionStorage.removeItem("returnTo");

      setSucces(`Bine ai venit, ${data.utilizator.nume_complet}!`);
      setTimeout(() => navigate(returnTo, { replace: true }), 1000);
    } catch {
      setEroare("Nu s-a putut conecta la server.");
    } finally {
      setLoading(false);
    }
  };

  const DOMENII_ACCEPTATE = [
    'gmail.com','yahoo.com','yahoo.ro','hotmail.com','outlook.com',
    'icloud.com','live.com','protonmail.com','proton.me','me.com',
    'mail.com','gmx.com','zoho.com','aol.com','ymail.com',
    'googlemail.com','hotmail.ro','live.ro','msn.com',
  ];

  // ── Register ───────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setEroare(""); setSucces("");
    if (!regNume || !regEmail || !regParola || !regParola2) {
      setEroare("Completează toate câmpurile obligatorii."); return;
    }
    if (regParola !== regParola2) {
      setEroare("Parolele nu coincid."); return;
    }
    if (regParola.length < 6) {
      setEroare("Parola trebuie să aibă cel puțin 6 caractere."); return;
    }
    const domeniu = regEmail.split('@')[1]?.toLowerCase();
    if (!domeniu || !DOMENII_ACCEPTATE.includes(domeniu)) {
      setEroare("Folosește o adresă de email reală: Gmail, Yahoo, Outlook, iCloud etc."); return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nume_complet: regNume,
          email: regEmail,
          parola: regParola,
          telefon: regTelefon,
          email_marketing: regMarketing,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEroare(data.eroare || "Eroare la înregistrare."); return; }

      setSucces("Cont creat cu succes! Acum te poți autentifica.");
      setTimeout(() => { setTab("login"); setSucces(""); setEroare(""); }, 1800);
    } catch {
      setEroare("Nu s-a putut conecta la server.");
    } finally {
      setLoading(false);
    }
  };

  // ── Stiluri ────────────────────────────────────────────────────────────
  const s = {
    logoText: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "2rem", fontWeight: 700,
      background: "linear-gradient(90deg,#C4A050,#F0D080,#C4A050)",
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      animation: "shimmer 3s linear infinite",
      textDecoration: "none", display: "inline-block",
    },
    accent: {
      background: "linear-gradient(90deg,#C4A050,#F0D080,#C4A050)",
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      animation: "shimmer 3s linear infinite",
    },
    card: {
      background: "#fff", borderRadius: "4px",
      border: "1px solid rgba(196,160,80,0.15)",
      boxShadow: "0 20px 60px rgba(10,14,35,0.1)", overflow: "hidden",
    },
    tabs: { display: "flex", borderBottom: "1px solid rgba(196,160,80,0.12)" },
    tab: (activ) => ({
      flex: 1, padding: "16px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
      fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase",
      cursor: "pointer", border: "none", outline: "none",
      background: activ ? "#fff" : "#FDFBF8",
      color: activ ? "#0A0E23" : "rgba(26,26,46,0.4)",
      borderBottom: activ ? "2px solid #C4A050" : "2px solid transparent",
      transition: "all .2s ease",
    }),
    body: { padding: "32px" },
    fieldWrap: { marginBottom: "20px" },
    label: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.7rem",
      fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase",
      color: "#C4A050", display: "block", marginBottom: "6px",
    },
    inputWrap: { position: "relative" },
    input: (field) => ({
      width: "100%", fontFamily: "'Jost',sans-serif",
      fontSize: "0.92rem", color: "#0A0E23", background: "#FDFBF8",
      border: focusField === field ? "1px solid #C4A050" : "1px solid rgba(196,160,80,0.2)",
      borderRadius: "2px", padding: "11px 14px", outline: "none",
      transition: "border-color .2s", boxSizing: "border-box",
    }),
    inputPass: (field) => ({
      width: "100%", fontFamily: "'Jost',sans-serif",
      fontSize: "0.92rem", color: "#0A0E23", background: "#FDFBF8",
      border: focusField === field ? "1px solid #C4A050" : "1px solid rgba(196,160,80,0.2)",
      borderRadius: "2px", padding: "11px 52px 11px 14px", outline: "none",
      transition: "border-color .2s", boxSizing: "border-box",
    }),
    showPassBtn: {
      position: "absolute", right: "12px", top: "50%",
      transform: "translateY(-50%)", background: "none", border: "none",
      cursor: "pointer", fontSize: "0.72rem", letterSpacing: "0.06em",
      color: "rgba(26,26,46,0.35)", fontFamily: "'Jost',sans-serif",
    },
    row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
    eroareBox: {
      background: "rgba(220,50,50,0.07)", border: "1px solid rgba(220,50,50,0.2)",
      borderRadius: "2px", padding: "10px 14px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.83rem",
      color: "#bb2222", marginBottom: "20px",
    },
    succesBox: {
      background: "rgba(30,160,100,0.08)", border: "1px solid rgba(30,160,100,0.25)",
      borderRadius: "2px", padding: "10px 14px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.83rem",
      color: "#0f6e56", marginBottom: "20px",
    },
    submitBtn: {
      width: "100%", padding: "13px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.85rem",
      fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase",
      color: "#0A0E23",
      background: loading ? "rgba(196,160,80,0.5)" : "linear-gradient(135deg,#C4A050,#A8883C)",
      border: "none", borderRadius: "2px",
      cursor: loading ? "not-allowed" : "pointer",
      boxShadow: "0 4px 16px rgba(196,160,80,0.3)",
    },
    switchText: {
      textAlign: "center", marginTop: "20px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
      color: "rgba(26,26,46,0.45)",
    },
    switchLink: {
      color: "#C4A050", cursor: "pointer", textDecoration: "underline",
      background: "none", border: "none",
      fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
    },
    backLink: {
      display: "block", textAlign: "center", marginTop: "20px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "rgba(26,26,46,0.35)", textDecoration: "none", letterSpacing: "0.06em",
    },
  };

  const fProps = (field, setter, value, type = "text") => ({
    style: type === "password" ? s.inputPass(field) : s.input(field),
    type, value,
    onChange: e => setter(e.target.value),
    onFocus: () => setFocusField(field),
    onBlur: () => setFocusField(null),
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", overflow: "hidden" }}>

      {/* ── PANEL STÂNGA — imagine + branding ── */}
      <div style={{ flex: "0 0 54%", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 56px" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url('https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=85')", backgroundSize: "cover", backgroundPosition: "center", animation: "heroScale 12s ease forwards" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(10,14,35,0.92) 0%, rgba(10,14,35,0.72) 55%, rgba(10,14,35,0.88) 100%)" }} />

        {/* Tagline + features */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(1.9rem,3vw,2.8rem)", fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: "18px" }}>
            Descoperă România<br />
            <span style={s.accent}>cu stil &amp; eleganță</span>
          </h2>
          <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.87rem", color: "rgba(255,255,255,0.48)", lineHeight: 1.8, marginBottom: "36px", maxWidth: "360px" }}>
            Platforma premium de rezervări hoteliere. Alege din cele mai bune hoteluri din toată România.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[
              "Rezervare gratuită, fără taxe ascunse",
              "Anulare flexibilă — rambursare 100%",
              "Plată securizată prin Stripe",
            ].map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(196,160,80,0.12)", border: "1px solid rgba(196,160,80,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#C4A050", fontSize: "0.62rem" }}>✓</span>
                </div>
                <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.83rem", color: "rgba(255,255,255,0.58)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div style={{ position: "absolute", bottom: "40px", left: "56px", right: "56px", zIndex: 1 }}>
          <div style={{ width: "40px", height: "1px", background: "rgba(196,160,80,0.3)", marginBottom: "14px" }} />
          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.7rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>
            © {new Date().getFullYear()} HoteluriRo · Proiect de licență
          </div>
        </div>
      </div>

      {/* ── PANEL DREAPTA — formular ── */}
      <div style={{ flex: 1, background: "#F8F6F1", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 56px", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>

          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.9rem", fontWeight: 700, color: "#0A0E23", marginBottom: "6px" }}>
              {tab === "login" ? "Bine ai revenit" : "Creează un cont"}
            </h1>
            <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", color: "rgba(26,26,46,0.42)" }}>
              {tab === "login" ? "Intră în contul tău HoteluriRo" : "Înregistrează-te gratuit în câteva secunde"}
            </p>
          </div>

          <div style={s.card}>
          <div style={s.tabs}>
            <button style={s.tab(tab === "login")}
              onClick={() => { setTab("login"); setEroare(""); setSucces(""); }}>
              Autentificare
            </button>
            <button style={s.tab(tab === "register")}
              onClick={() => { setTab("register"); setEroare(""); setSucces(""); }}>
              Cont nou
            </button>
          </div>

          <div style={s.body}>
            {eroare && <div style={s.eroareBox}>⚠ {eroare}</div>}
            {succes && <div style={s.succesBox}>✓ {succes}</div>}

            {/* ══ LOGIN ══ */}
            {tab === "login" && (
              <form onSubmit={handleLogin}>
                <div style={s.fieldWrap}>
                  <label style={s.label}>Email</label>
                  <input {...fProps("lemail", setLoginEmail, loginEmail, "email")}
                    placeholder="adresa@email.com" />
                </div>
                <div style={s.fieldWrap}>
                  <label style={s.label}>Parolă</label>
                  <div style={s.inputWrap}>
                    <input {...fProps("lpass", setLoginParola, loginParola,
                      showPass ? "text" : "password")}
                      placeholder="••••••••" />
                    <button type="button" style={s.showPassBtn}
                      onClick={() => setShowPass(v => !v)}>
                      {showPass ? "Ascunde" : "Arată"}
                    </button>
                  </div>
                </div>
                <button type="submit" style={s.submitBtn} disabled={loading}>
                  {loading ? "Se procesează..." : "Intră în cont"}
                </button>
                <div style={{ textAlign: "center", marginTop: "14px" }}>
                  <a href="/uitare-parola" style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(196,160,80,0.8)", textDecoration: "none" }}
                    onMouseEnter={e => e.target.style.color = "#C4A050"}
                    onMouseLeave={e => e.target.style.color = "rgba(196,160,80,0.8)"}>
                    Ai uitat parola?
                  </a>
                </div>
              </form>
            )}

            {/* ══ REGISTER ══ */}
            {tab === "register" && (
              <form onSubmit={handleRegister}>
                <div style={s.fieldWrap}>
                  <label style={s.label}>Nume complet *</label>
                  <input {...fProps("rnume", setRegNume, regNume)}
                    placeholder="Ion Popescu" />
                </div>
                <div style={s.fieldWrap}>
                  <label style={s.label}>Email *</label>
                  <input {...fProps("remail", setRegEmail, regEmail, "email")}
                    placeholder="adresa@email.com" />
                </div>
                <div style={s.fieldWrap}>
                  <label style={s.label}>Telefon <span style={{ color: "rgba(26,26,46,0.3)" }}>(opțional)</span></label>
                  <input {...fProps("rtel", setRegTelefon, regTelefon, "tel")}
                    placeholder="07xx xxx xxx" />
                </div>
                <div style={s.row}>
                  <div style={s.fieldWrap}>
                    <label style={s.label}>Parolă *</label>
                    <input {...fProps("rpass", setRegParola, regParola,
                      showPass ? "text" : "password")}
                      placeholder="min. 6 caractere" />
                  </div>
                  <div style={s.fieldWrap}>
                    <label style={s.label}>Confirmă *</label>
                    <input {...fProps("rpass2", setRegParola2, regParola2,
                      showPass ? "text" : "password")}
                      placeholder="repetă parola" />
                  </div>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    cursor: "pointer", fontFamily: "'Jost',sans-serif",
                    fontSize: "0.78rem", color: "rgba(26,26,46,0.5)",
                  }}>
                    <input type="checkbox" checked={showPass}
                      onChange={() => setShowPass(v => !v)}
                      style={{ accentColor: "#C4A050", cursor: "pointer" }} />
                    Arată parolele
                  </label>
                </div>
                <div style={{ marginBottom: "20px" }}>
                  <label style={{
                    display: "flex", alignItems: "flex-start", gap: "8px",
                    cursor: "pointer", fontFamily: "'Jost',sans-serif",
                    fontSize: "0.78rem", color: "rgba(26,26,46,0.6)", lineHeight: 1.5,
                  }}>
                    <input type="checkbox" checked={regMarketing}
                      onChange={() => setRegMarketing(v => !v)}
                      style={{ accentColor: "#C4A050", cursor: "pointer", marginTop: "2px", flexShrink: 0 }} />
                    Doresc să primesc oferte speciale și promoții de la HoteluriRo pe email.
                  </label>
                </div>
                <button type="submit" style={s.submitBtn} disabled={loading}>
                  {loading ? "Se procesează..." : "Creează cont"}
                </button>
              </form>
            )}

            <p style={s.switchText}>
              {tab === "login" ? (
                <>Nu ai cont?{" "}
                  <button style={s.switchLink}
                    onClick={() => { setTab("register"); setEroare(""); }}>
                    Înregistrează-te
                  </button>
                </>
              ) : (
                <>Ai deja cont?{" "}
                  <button style={s.switchLink}
                    onClick={() => { setTab("login"); setEroare(""); }}>
                    Autentifică-te
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

          <Link to="/" style={{ display: "block", textAlign: "center", marginTop: "18px", fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.32)", textDecoration: "none", letterSpacing: "0.06em" }}>
            ← Înapoi la pagina principală
          </Link>
        </div>
      </div>
    </div>
  );
}