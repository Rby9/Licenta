import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";

import { API_URL } from "../api";

const LEFT_PANEL = {
  flex: "0 0 54%", position: "relative", overflow: "hidden",
  display: "flex", flexDirection: "column", justifyContent: "center",
  padding: "48px 56px",
};
const OVERLAY = {
  position: "absolute", inset: 0,
  background: "linear-gradient(160deg,rgba(10,14,35,0.92) 0%,rgba(10,14,35,0.72) 55%,rgba(10,14,35,0.88) 100%)",
};
const accent = {
  background: "linear-gradient(90deg,#C4A050,#F0D080,#C4A050)",
  backgroundSize: "200% auto",
  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  animation: "shimmer 3s linear infinite",
};

export default function ResetareParola() {
  const [searchParams] = useSearchParams();
  const navigate        = useNavigate();
  const token           = searchParams.get("token");

  const [parola, setParola]     = useState("");
  const [confirma, setConfirma] = useState("");
  const [loading, setLoading]   = useState(false);
  const [eroare, setEroare]     = useState("");
  const [succes, setSucces]     = useState(false);
  const [showP, setShowP]       = useState(false);

  useEffect(() => {
    if (!token) setEroare("Link invalid sau expirat.");
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!parola || parola.length < 6) { setEroare("Parola trebuie să aibă cel puțin 6 caractere."); return; }
    if (parola !== confirma)          { setEroare("Parolele nu coincid."); return; }
    try {
      setLoading(true); setEroare("");
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, parola_noua: parola }),
      });
      const d = await res.json();
      if (!res.ok) { setEroare(d.eroare || "Eroare."); return; }
      setSucces(true);
      setTimeout(() => navigate("/autentificare"), 3000);
    } catch {
      setEroare("Eroare de rețea. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.92rem",
    color: "#0A0E23", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px",
    padding: "11px 52px 11px 14px", outline: "none", background: "#FDFBF8",
    boxSizing: "border-box",
  };
  const labelStyle = {
    fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500,
    letterSpacing: "0.14em", textTransform: "uppercase", color: "#C4A050",
    display: "block", marginBottom: "6px",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", overflow: "hidden" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% center;} 100%{background-position:200% center;} }
        @keyframes heroScale { from{transform:scale(1.06);} to{transform:scale(1);} }
      `}</style>

      {/* ── PANEL STÂNGA ── */}
      <div style={LEFT_PANEL}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url('https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=85')", backgroundSize: "cover", backgroundPosition: "center", animation: "heroScale 12s ease forwards" }} />
        <div style={OVERLAY} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(1.9rem,3vw,2.8rem)", fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: "16px" }}>
            Parolă nouă,<br />
            <span style={accent}>cont securizat</span>
          </h2>
          <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.87rem", color: "rgba(255,255,255,0.48)", lineHeight: 1.8, marginBottom: "36px", maxWidth: "360px" }}>
            Alege o parolă puternică pentru a-ți proteja contul HoteluriRo și rezervările tale.
          </p>
          {["Minim 6 caractere", "Stocare criptată", "Sesiune securizată"].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(196,160,80,0.12)", border: "1px solid rgba(196,160,80,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: "#C4A050", fontSize: "0.62rem" }}>✓</span>
              </div>
              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.83rem", color: "rgba(255,255,255,0.58)" }}>{f}</span>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", bottom: "40px", left: "56px", zIndex: 1 }}>
          <div style={{ width: "40px", height: "1px", background: "rgba(196,160,80,0.3)", marginBottom: "14px" }} />
          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.7rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>
            © {new Date().getFullYear()} HoteluriRo · Proiect de licență
          </div>
        </div>
      </div>

      {/* ── PANEL DREAPTA ── */}
      <div style={{ flex: 1, background: "#F8F6F1", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 56px", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: "380px" }}>

          {succes ? (
            <>
              <div style={{ fontSize: "2.8rem", marginBottom: "20px" }}>✅</div>
              <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "2rem", fontWeight: 700, color: "#0A0E23", marginBottom: "8px" }}>Parolă resetată!</h1>
              <div style={{ width: "40px", height: "2px", background: "linear-gradient(90deg,#C4A050,#F0D080)", marginBottom: "20px", borderRadius: "1px" }} />
              <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "rgba(26,26,46,0.55)", lineHeight: 1.7, marginBottom: "28px" }}>
                Te redirecționăm spre pagina de autentificare în câteva secunde...
              </p>
              <Link to="/autentificare" style={{ display: "block", textAlign: "center", fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0A0E23", background: "linear-gradient(135deg,#C4A050,#A8883C)", padding: "13px", borderRadius: "2px", textDecoration: "none" }}>
                Autentifică-te acum
              </Link>
            </>
          ) : !token ? (
            <>
              <div style={{ fontSize: "2.8rem", marginBottom: "20px" }}>⚠️</div>
              <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "2rem", fontWeight: 700, color: "#cc2200", marginBottom: "8px" }}>Link invalid</h1>
              <div style={{ width: "40px", height: "2px", background: "rgba(220,50,50,0.4)", marginBottom: "20px", borderRadius: "1px" }} />
              <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "rgba(26,26,46,0.55)", lineHeight: 1.7, marginBottom: "28px" }}>
                Acest link de resetare nu este valid sau a expirat. Solicită un nou link.
              </p>
              <Link to="/uitare-parola" style={{ display: "block", textAlign: "center", fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0A0E23", background: "linear-gradient(135deg,#C4A050,#A8883C)", padding: "13px", borderRadius: "2px", textDecoration: "none" }}>
                Solicită resetare parolă
              </Link>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "2rem", fontWeight: 700, color: "#0A0E23", marginBottom: "6px" }}>Setează parola nouă</h1>
              <div style={{ width: "40px", height: "2px", background: "linear-gradient(90deg,#C4A050,#F0D080)", marginBottom: "16px", borderRadius: "1px" }} />
              <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "rgba(26,26,46,0.5)", marginBottom: "28px", lineHeight: 1.6 }}>
                Alege o parolă nouă de cel puțin 6 caractere.
              </p>

              <div style={{ background: "#fff", borderRadius: "4px", border: "1px solid rgba(196,160,80,0.15)", boxShadow: "0 20px 60px rgba(10,14,35,0.1)", padding: "32px" }}>
                {eroare && (
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", color: "#bb2222", background: "rgba(220,50,50,0.07)", border: "1px solid rgba(220,50,50,0.2)", borderRadius: "2px", padding: "9px 14px", marginBottom: "20px" }}>
                    ⚠ {eroare}
                  </div>
                )}
                <form onSubmit={handleSubmit}>
                  <label style={labelStyle}>Parolă nouă</label>
                  <div style={{ position: "relative", marginBottom: "16px" }}>
                    <input type={showP ? "text" : "password"} value={parola} onChange={e => setParola(e.target.value)} placeholder="••••••••" style={inputStyle} />
                    <button type="button" onClick={() => setShowP(v => !v)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", color: "#C4A050", letterSpacing: "0.06em" }}>
                      {showP ? "Ascunde" : "Arată"}
                    </button>
                  </div>

                  <label style={labelStyle}>Confirmă parola</label>
                  <div style={{ position: "relative", marginBottom: "24px" }}>
                    <input type={showP ? "text" : "password"} value={confirma} onChange={e => setConfirma(e.target.value)} placeholder="••••••••" style={inputStyle} />
                  </div>

                  <button type="submit" disabled={loading} style={{ width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0A0E23", background: loading ? "rgba(196,160,80,0.5)" : "linear-gradient(135deg,#C4A050,#A8883C)", border: "none", borderRadius: "2px", padding: "13px", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 16px rgba(196,160,80,0.3)" }}>
                    {loading ? "Se salvează..." : "Salvează parola nouă"}
                  </button>
                </form>
              </div>

              <Link to="/autentificare" style={{ display: "block", textAlign: "center", marginTop: "20px", fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.35)", textDecoration: "none", letterSpacing: "0.06em" }}>
                ← Înapoi la autentificare
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
