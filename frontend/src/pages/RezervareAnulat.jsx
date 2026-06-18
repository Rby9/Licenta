import { Link } from "react-router-dom";

export default function RezervareAnulat() {
  return (
    <div style={{
      minHeight: "100vh", background: "#F8F6F1",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "100px 24px 60px",
    }}>
      <div style={{
        background: "#fff", borderRadius: "4px", padding: "52px 48px",
        maxWidth: "500px", width: "100%", textAlign: "center",
        boxShadow: "0 8px 40px rgba(10,14,35,0.1)",
        border: "1px solid rgba(196,160,80,0.15)",
      }}>
        {/* Icon */}
        <div style={{
          width: "72px", height: "72px", borderRadius: "50%", margin: "0 auto 24px",
          background: "rgba(220,50,50,0.06)", border: "2px solid rgba(220,50,50,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.8rem",
        }}>
          ✕
        </div>

        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "2rem", fontWeight: 700, color: "#0A0E23", marginBottom: "10px" }}>
          Plată anulată
        </h1>
        <div style={{ width: "40px", height: "2px", background: "linear-gradient(90deg,#C4A050,#F0D080)", margin: "0 auto 20px", borderRadius: "1px" }} />
        <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "rgba(26,26,46,0.5)", lineHeight: 1.7, marginBottom: "12px" }}>
          Ai anulat procesul de plată.
        </p>
        <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "rgba(26,26,46,0.5)", lineHeight: 1.7, marginBottom: "36px" }}>
          Rezervarea <strong style={{ color: "#0A0E23" }}>nu a fost efectuată</strong> și nu a fost debitată nicio sumă din contul tău.
        </p>

        {/* Info box */}
        <div style={{
          background: "rgba(196,160,80,0.04)", border: "1px solid rgba(196,160,80,0.15)",
          borderRadius: "3px", padding: "14px 18px", marginBottom: "28px",
          fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
          color: "rgba(26,26,46,0.5)", lineHeight: 1.6, textAlign: "left",
        }}>
          ◈ Dacă ai întâmpinat o problemă la plată, poți încerca din nou sau alege o altă metodă de plată la pasul următor.
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/hoteluri" style={{
            fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", fontWeight: 500,
            letterSpacing: "0.12em", textTransform: "uppercase", color: "#0A0E23",
            background: "linear-gradient(135deg,#C4A050,#A8883C)",
            padding: "12px 28px", borderRadius: "2px", textDecoration: "none",
          }}>
            Înapoi la hoteluri
          </Link>
          <Link to="/" style={{
            fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", fontWeight: 500,
            letterSpacing: "0.12em", textTransform: "uppercase", color: "#0A0E23",
            border: "1px solid rgba(196,160,80,0.35)", background: "transparent",
            padding: "12px 28px", borderRadius: "2px", textDecoration: "none",
          }}>
            Acasă
          </Link>
        </div>
      </div>
    </div>
  );
}
