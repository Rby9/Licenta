import { downloadReservation } from '../utils/downloadReservation';
import { useToast } from '../components/ToastContext';
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";

import { API_URL } from "../api";

const fmtD = (s) => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
};

export default function RezervareSucces() {
  const [searchParams] = useSearchParams();
  const addToast = useToast();
  const sessionId = searchParams.get("session_id");

  const [rezervare, setRezervare] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [eroare, setEroare]       = useState("");
  const [descarcand, setDescarcand] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!sessionId) { setEroare("Session ID lipsă."); setLoading(false); return; }
    const confirma = async () => {
      try {
        const res = await fetch(`${API_URL}/api/plati/confirmare`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.eroare); }
        const data = await res.json();
        setRezervare(data);
      } catch (err) {
        setEroare(err.message || "Eroare la confirmarea rezervării.");
      } finally {
        setLoading(false);
      }
    };
    confirma();
  }, [sessionId, token]);

  const handleFactura = async () => {
    if (!rezervare?.id_rezervare) return;
    try {
      setDescarcand(true);
      await downloadReservation(rezervare.id_rezervare, token);
    } catch {
      addToast("Nu s-a putut genera factura. Încearcă din nou.", "error");
    } finally {
      setDescarcand(false);
    }
  };

  const s = {
    page: {
      minHeight: "100vh", background: "#F8F6F1", paddingTop: "80px",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "100px 24px 60px",
    },
    card: {
      background: "#fff", borderRadius: "4px", padding: "48px",
      maxWidth: "560px", width: "100%", textAlign: "center",
      boxShadow: "0 8px 40px rgba(10,14,35,0.1)",
      border: "1px solid rgba(196,160,80,0.15)",
    },
    iconWrap: {
      width: "64px", height: "64px", borderRadius: "50%",
      background: "rgba(29,158,117,0.1)", border: "2px solid rgba(29,158,117,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
      margin: "0 auto 20px", fontSize: "1.8rem",
    },
    title: {
      fontFamily: "'Cormorant Garamond',serif", fontSize: "2rem",
      fontWeight: 700, color: "#0A0E23", marginBottom: "8px",
    },
    sub: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.88rem",
      color: "rgba(26,26,46,0.5)", marginBottom: "32px", lineHeight: 1.6,
    },
    infoBox: {
      background: "rgba(196,160,80,0.05)", border: "1px solid rgba(196,160,80,0.15)",
      borderRadius: "4px", padding: "20px", marginBottom: "24px", textAlign: "left",
    },
    infoTitle: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.67rem", fontWeight: 500,
      letterSpacing: "0.14em", textTransform: "uppercase",
      color: "#C4A050", marginBottom: "14px",
    },
    infoRow: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontFamily: "'Jost',sans-serif", fontSize: "0.83rem",
      padding: "7px 0", borderBottom: "1px solid rgba(196,160,80,0.06)",
    },
    infoRowLast: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontFamily: "'Jost',sans-serif", fontSize: "0.83rem", padding: "7px 0 0",
    },
    infoLabel: { color: "rgba(26,26,46,0.45)" },
    infoValue: { fontWeight: 500, color: "#0A0E23" },
    totalBox: {
      background: "#0A0E23", borderRadius: "2px", padding: "14px 20px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: "8px",
    },
    totalLabel: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
      fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase",
      color: "rgba(255,255,255,0.6)",
    },
    totalValue: {
      fontFamily: "'Cormorant Garamond',serif", fontSize: "1.5rem",
      fontWeight: 700, color: "#C4A050",
    },
    avansBox: {
      background: "rgba(29,158,117,0.07)", border: "1px solid rgba(29,158,117,0.2)",
      borderRadius: "2px", padding: "10px 14px", marginBottom: "20px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", color: "#0f6e56",
      textAlign: "left", lineHeight: 1.6,
    },
    btnRow: { display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" },
    btnPrimary: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", fontWeight: 500,
      letterSpacing: "0.12em", textTransform: "uppercase", color: "#0A0E23",
      background: "linear-gradient(135deg,#C4A050,#A8883C)",
      padding: "12px 24px", borderRadius: "2px", textDecoration: "none",
      border: "none", cursor: "pointer",
    },
    btnSecondary: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", fontWeight: 500,
      letterSpacing: "0.12em", textTransform: "uppercase", color: "#0A0E23",
      border: "1px solid rgba(196,160,80,0.35)", background: "transparent",
      padding: "12px 24px", borderRadius: "2px", textDecoration: "none",
      cursor: "pointer",
    },
    numRez: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      color: "rgba(26,26,46,0.3)", marginTop: "20px",
    },
  };

  if (loading) return (
    <div style={s.page}>
      <div style={{ textAlign: "center" }}>
        <style>{`@keyframes spinR { to { transform: rotate(360deg); } } @keyframes pulseR { 0%,100%{opacity:1;} 50%{opacity:0.4;} }`}</style>
        <div style={{
          width: "56px", height: "56px", borderRadius: "50%",
          border: "3px solid rgba(196,160,80,0.15)",
          borderTop: "3px solid #C4A050",
          animation: "spinR 0.9s linear infinite",
          margin: "0 auto 20px",
        }} />
        <div style={{
          fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem",
          fontWeight: 600, color: "#0A0E23", marginBottom: "8px",
          animation: "pulseR 2s ease infinite",
        }}>
          Se confirmă rezervarea...
        </div>
        <div style={{
          fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
          color: "rgba(26,26,46,0.4)", letterSpacing: "0.04em",
        }}>
          Procesăm plata și generăm factura
        </div>
      </div>
    </div>
  );

  if (eroare) return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ ...s.iconWrap, background: "rgba(220,50,50,0.08)", border: "2px solid rgba(220,50,50,0.2)" }}>❌</div>
        <div style={s.title}>Eroare</div>
        <div style={s.sub}>{eroare}</div>
        <Link to="/hoteluri" style={s.btnPrimary}>Înapoi la hoteluri</Link>
      </div>
    </div>
  );

  const metodaText = rezervare?.metoda_plata === "avans_online"
    ? `Avans online (30%) — ${rezervare.suma_avans?.toLocaleString()} RON plătit acum`
    : rezervare?.metoda_plata === "cash_cazare"
    ? "Plată cash la cazare"
    : "Plată integrală online";

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.iconWrap}>✓</div>
        <div style={s.title}>Rezervare confirmată!</div>
        <div style={s.sub}>
          Plata a fost procesată cu succes.<br />
          Vei primi un email de confirmare cu factura atașată.
        </div>

        {rezervare && (
          <>
            {/* Detalii sejur */}
            <div style={s.infoBox}>
              <div style={s.infoTitle}>Detalii rezervare</div>
              {rezervare.nume_hotel && (
                <div style={s.infoRow}>
                  <span style={s.infoLabel}>Hotel</span>
                  <span style={s.infoValue}>{rezervare.nume_hotel}</span>
                </div>
              )}
              {rezervare.tip_camera && (
                <div style={s.infoRow}>
                  <span style={s.infoLabel}>Tip cameră</span>
                  <span style={s.infoValue}>{rezervare.tip_camera}</span>
                </div>
              )}
              {rezervare.data_checkin && (
                <div style={s.infoRow}>
                  <span style={s.infoLabel}>Check-in</span>
                  <span style={s.infoValue}>{fmtD(rezervare.data_checkin)}</span>
                </div>
              )}
              {rezervare.data_checkout && (
                <div style={s.infoRow}>
                  <span style={s.infoLabel}>Check-out</span>
                  <span style={s.infoValue}>{fmtD(rezervare.data_checkout)}</span>
                </div>
              )}
              {rezervare.nopti && (
                <div style={s.infoRow}>
                  <span style={s.infoLabel}>Durată</span>
                  <span style={s.infoValue}>{rezervare.nopti} {rezervare.nopti === 1 ? "noapte" : "nopți"}</span>
                </div>
              )}
              <div style={s.infoRowLast}>
                <span style={s.infoLabel}>Metodă de plată</span>
                <span style={s.infoValue}>{metodaText}</span>
              </div>
            </div>

            {/* Total */}
            <div style={s.totalBox}>
              <span style={s.totalLabel}>Total rezervare</span>
              <span style={s.totalValue}>{Number(rezervare.pret_total).toLocaleString()} RON</span>
            </div>

            {/* Avans info */}
            {rezervare.metoda_plata === "avans_online" && rezervare.suma_avans && (
              <div style={s.avansBox}>
                ✓ Avans plătit: <strong>{Number(rezervare.suma_avans).toLocaleString()} RON</strong><br />
                Rest de plătit la cazare: <strong>{(Number(rezervare.pret_total) - Number(rezervare.suma_avans)).toLocaleString()} RON</strong>
              </div>
            )}

            {/* Acțiuni */}
            <div style={s.btnRow}>
              <button style={s.btnPrimary} onClick={handleFactura} disabled={descarcand}>
                {descarcand ? "Se descarcă..." : "📄 Descarcă factura"}
              </button>
              <Link to="/rezervarile-mele" style={s.btnSecondary}>
                Rezervările mele
              </Link>
              <Link to="/hoteluri" style={s.btnSecondary}>
                Continuă explorarea
              </Link>
            </div>

            <div style={s.numRez}>Număr rezervare: #{rezervare.id_rezervare}</div>
          </>
        )}
      </div>
    </div>
  );
}
