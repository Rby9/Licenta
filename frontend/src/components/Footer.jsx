import { Link, useLocation } from "react-router-dom";

const HIDE_ON = ["/admin"];

export default function Footer() {
  const { pathname } = useLocation();
  if (HIDE_ON.some(p => pathname.startsWith(p))) return null;

  const col = {
    title: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.65rem", fontWeight: 500,
      letterSpacing: "0.2em", textTransform: "uppercase",
      color: "#C4A050", marginBottom: "16px",
    },
    link: {
      display: "block", fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
      color: "rgba(255,255,255,0.45)", textDecoration: "none",
      marginBottom: "10px", transition: "color .2s",
    },
  };

  return (
    <footer style={{ background: "#0A0E23", borderTop: "1px solid rgba(196,160,80,0.12)", paddingTop: "56px" }}>
      <div className="footer-grid" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 48px 48px", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "48px" }}>

        {/* Brand */}
        <div>
          <div style={{
            fontFamily: "'Cormorant Garamond',serif", fontSize: "1.8rem", fontWeight: 700,
            background: "linear-gradient(90deg,#C4A050,#F0D080,#C4A050)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: "14px",
          }}>
            HoteluriRo
          </div>
          <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.83rem", color: "rgba(255,255,255,0.35)", lineHeight: 1.8, maxWidth: "260px" }}>
            Platforma națională de rezervări hoteliere premium. Descoperă România cu stil și eleganță.
          </p>
        </div>

        {/* Navigare */}
        <div>
          <div style={col.title}>Navigare</div>
          {[
            { label: "Acasă",    to: "/" },
            { label: "Hoteluri", to: "/hoteluri" },
            { label: "Profilul meu",    to: "/profil" },
            { label: "Rezervările mele", to: "/rezervarile-mele" },
          ].map(({ label, to }) => (
            <Link key={to} to={to} style={col.link}
              onMouseEnter={e => e.currentTarget.style.color = "#C4A050"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.45)"}>
              {label}
            </Link>
          ))}
        </div>

        {/* Informații */}
        <div>
          <div style={col.title}>Informații</div>
          <span style={{ ...col.link, cursor: "default" }}>Rezervare gratuită</span>
          <span style={{ ...col.link, cursor: "default" }}>Anulare flexibilă</span>
          <span style={{ ...col.link, cursor: "default" }}>Plată securizată</span>
          <span style={{ ...col.link, cursor: "default" }}>Suport 7/7</span>
        </div>

        {/* Contact */}
        <div>
          <div style={col.title}>Contact</div>
          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", display: "flex", flexDirection: "column", gap: "10px" }}>
            <a href="mailto:balabanrobert2003@gmail.com"
              style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: "rgba(255,255,255,0.4)", textDecoration: "none", transition: "color .2s", lineHeight: 1.4 }}
              onMouseEnter={e => e.currentTarget.style.color = "#C4A050"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>
              <span style={{ marginTop: "1px", flexShrink: 0 }}>✉</span>
              <span>balabanrobert2003@gmail.com</span>
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ flexShrink: 0 }}>◉</span>
              <span>România, București</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ flexShrink: 0 }}>☎</span>
              <span>+40 700 000 000</span>
            </div>
          </div>
          <div style={{
            marginTop: "20px", padding: "10px 14px",
            background: "rgba(196,160,80,0.06)", borderRadius: "3px",
            border: "1px solid rgba(196,160,80,0.15)",
            fontFamily: "'Jost',sans-serif", fontSize: "0.72rem",
            color: "rgba(255,255,255,0.35)", lineHeight: 1.6,
          }}>
            Program suport:<br />
            <span style={{ color: "#C4A050" }}>Lun – Dum · 08:00 – 22:00</span>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        borderTop: "1px solid rgba(196,160,80,0.08)", padding: "18px 48px",
        maxWidth: "1280px", margin: "0 auto",
        display: "flex", justifyContent: "center", alignItems: "center",
      }}>
        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>
          © {new Date().getFullYear()} HoteluriRo — Platformă națională de rezervări hoteliere · Proiect de licență
        </span>
      </div>
    </footer>
  );
}
