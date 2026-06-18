import { useState } from "react";
import { Link } from "react-router-dom";

const API_URL = "http://localhost:5000";

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

export default function UitareParola() {
  const [email, setEmail]     = useState("");
  const [trimis, setTrimis]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [eroare, setEroare]   = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setEroare("Introdu adresa de email."); return; }
    try {
      setLoading(true); setEroare("");
      await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setTrimis(true);
    } catch {
      setEroare("Eroare de rețea. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
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
            Resetează accesul<br />
            <span style={accent}>la contul tău</span>
          </h2>
          <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.87rem", color: "rgba(255,255,255,0.48)", lineHeight: 1.8, marginBottom: "36px", maxWidth: "360px" }}>
            Îți trimitem un link securizat pentru a seta o parolă nouă. Procesul durează mai puțin de un minut.
          </p>
          {["Link securizat prin email", "Expiră în 1 oră", "Cont protejat"].map((f, i) => (
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

          {trimis ? (
            <>
              <div style={{ fontSize: "2.8rem", marginBottom: "20px" }}>📧</div>
              <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "2rem", fontWeight: 700, color: "#0A0E23", marginBottom: "8px" }}>Email trimis!</h1>
              <div style={{ width: "40px", height: "2px", background: "linear-gradient(90deg,#C4A050,#F0D080)", marginBottom: "20px", borderRadius: "1px" }} />
              <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "rgba(26,26,46,0.55)", lineHeight: 1.7, marginBottom: "28px" }}>
                Dacă adresa <strong style={{ color: "#0A0E23" }}>{email}</strong> există în sistem, vei primi un link de resetare. Verifică și folderul <strong style={{ color: "#0A0E23" }}>Spam</strong>.
              </p>
              <Link to="/autentificare" style={{ display: "block", textAlign: "center", fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0A0E23", background: "linear-gradient(135deg,#C4A050,#A8883C)", padding: "13px", borderRadius: "2px", textDecoration: "none" }}>
                Înapoi la autentificare
              </Link>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "2rem", fontWeight: 700, color: "#0A0E23", marginBottom: "6px" }}>Ai uitat parola?</h1>
              <div style={{ width: "40px", height: "2px", background: "linear-gradient(90deg,#C4A050,#F0D080)", marginBottom: "16px", borderRadius: "1px" }} />
              <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "rgba(26,26,46,0.5)", marginBottom: "28px", lineHeight: 1.6 }}>
                Introdu adresa de email și îți trimitem un link pentru a seta o parolă nouă.
              </p>

              <div style={{ background: "#fff", borderRadius: "4px", border: "1px solid rgba(196,160,80,0.15)", boxShadow: "0 20px 60px rgba(10,14,35,0.1)", padding: "32px" }}>
                <form onSubmit={handleSubmit}>
                  <label style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C4A050", display: "block", marginBottom: "6px" }}>
                    Adresa de email
                  </label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="adresa@email.com"
                    style={{ width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.92rem", color: "#0A0E23", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px", padding: "11px 14px", outline: "none", background: "#FDFBF8", boxSizing: "border-box", marginBottom: "16px" }}
                  />
                  {eroare && (
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", color: "#bb2222", background: "rgba(220,50,50,0.07)", border: "1px solid rgba(220,50,50,0.2)", borderRadius: "2px", padding: "9px 14px", marginBottom: "16px" }}>
                      ⚠ {eroare}
                    </div>
                  )}
                  <button type="submit" disabled={loading} style={{ width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0A0E23", background: loading ? "rgba(196,160,80,0.5)" : "linear-gradient(135deg,#C4A050,#A8883C)", border: "none", borderRadius: "2px", padding: "13px", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 16px rgba(196,160,80,0.3)" }}>
                    {loading ? "Se trimite..." : "Trimite link de resetare"}
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
