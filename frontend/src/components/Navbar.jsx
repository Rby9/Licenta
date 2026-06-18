import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useToast } from "./Toast";

const injectGlobalStyles = () => {
  if (document.getElementById("hoteluri-global-styles")) return;
  const style = document.createElement("style");
  style.id = "hoteluri-global-styles";
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Jost:wght@300;400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Jost', sans-serif; background: #F8F6F1; color: #1a1a2e; }
    @keyframes fadeDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeUp   { from { opacity:0; transform:translateY(30px); }  to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer  { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
    @keyframes heroScale { from { transform:scale(1.06); } to { transform:scale(1); } }
    @keyframes skeletonPulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    @keyframes skeletonShimmer { 0%{background-position:-200% center;} 100%{background-position:200% center;} }
    ::-webkit-scrollbar { width:6px; }
    ::-webkit-scrollbar-track { background:#F8F6F1; }
    ::-webkit-scrollbar-thumb { background:#C4A050; border-radius:3px; }
  `;
  document.head.appendChild(style);
};

export default function Navbar() {
  injectGlobalStyles();

  const [scrolled, setScrolled]     = useState(false);
  const [hoveredLink, setHovered]   = useState(null);
  const [userMenuOpen, setUserMenu] = useState(false);
  const [user, setUser]             = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const addToast = useToast();
  const isHome   = location.pathname === "/";
  const isTransparent = isHome && !scrolled;

  // ── Citește userul din localStorage (re-citește la fiecare schimbare de rută) ──
  useEffect(() => {
    try {
      const val = localStorage.getItem("utilizator");
      if (!val || val === "undefined") return setUser(null);
      setUser(JSON.parse(val));
    } catch { setUser(null); }
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Închide dropdown-ul când dai click în afară
  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest("#user-menu-wrap")) setUserMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
  const handler = () => {
    try {
      const val = localStorage.getItem("utilizator");
      if (!val || val === "undefined") return setUser(null);
      setUser(JSON.parse(val));
    } catch { setUser(null); }
  };
  window.addEventListener("utilizator-update", handler);
  return () => window.removeEventListener("utilizator-update", handler);
}, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("utilizator");
    setUser(null);
    setUserMenu(false);
    addToast("Ai fost deconectat cu succes.", "success");
    navigate("/");
  };

  const initiale = user?.nume_complet
    ?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  const s = {
    nav: {
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      padding: scrolled ? "14px 48px" : "22px 48px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: isTransparent
        ? "linear-gradient(to bottom, rgba(10,14,35,0.7) 0%, transparent 100%)"
        : "rgba(10,14,35,0.97)",
      backdropFilter: scrolled ? "blur(16px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(196,160,80,0.15)" : "none",
      transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
      animation: "fadeDown 0.6s ease both",
    },
    logo: {
      fontFamily: "'Cormorant Garamond',serif", fontSize: "1.7rem", fontWeight: 700,
      textDecoration: "none",
      background: "linear-gradient(90deg,#C4A050 0%,#F0D080 40%,#C4A050 80%)",
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      animation: "shimmer 3s linear infinite",
    },
    navLinks: { display: "flex", alignItems: "center", gap: "8px", listStyle: "none" },
    link: (name) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", fontWeight: 500,
      letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none",
      color: hoveredLink === name ? "#C4A050" : "rgba(255,255,255,0.75)",
      padding: "8px 16px", position: "relative", transition: "color .25s",
    }),
    linkLine: (name) => ({
      position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
      height: "1px", background: "#C4A050", transition: "width .3s",
      width: hoveredLink === name ? "60%" : "0%",
    }),
    authBtn: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", fontWeight: 500,
      letterSpacing: "0.14em", textTransform: "uppercase", textDecoration: "none",
      color: "#0A0E23",
      background: hoveredLink === "auth"
        ? "linear-gradient(135deg,#F0D080,#C4A050)"
        : "linear-gradient(135deg,#C4A050,#A8883C)",
      padding: "10px 26px", borderRadius: "2px", border: "none", cursor: "pointer",
      transition: "all .3s",
      transform: hoveredLink === "auth" ? "translateY(-1px)" : "none",
      boxShadow: hoveredLink === "auth"
        ? "0 6px 24px rgba(196,160,80,0.4)" : "0 2px 10px rgba(196,160,80,0.2)",
    },

    // User logat
    userWrap: { position: "relative" },
    avatarBtn: {
      display: "flex", alignItems: "center", gap: "10px",
      background: "none", border: "none", cursor: "pointer",
      padding: "6px 10px", borderRadius: "2px",
    },
    avatar: {
      width: "34px", height: "34px", borderRadius: "50%",
      background: "linear-gradient(135deg,#C4A050,#A8883C)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
      fontWeight: 500, color: "#0A0E23", flexShrink: 0,
    },
    avatarName: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
      color: "rgba(255,255,255,0.85)",
      maxWidth: "120px", overflow: "hidden",
      textOverflow: "ellipsis", whiteSpace: "nowrap",
    },
    dropdown: {
      position: "absolute", top: "calc(100% + 12px)", right: 0,
      background: "#fff", borderRadius: "4px", minWidth: "210px",
      boxShadow: "0 12px 40px rgba(10,14,35,0.2)",
      border: "1px solid rgba(196,160,80,0.15)",
      overflow: "hidden",
      opacity: userMenuOpen ? 1 : 0,
      pointerEvents: userMenuOpen ? "all" : "none",
      transform: userMenuOpen ? "translateY(0)" : "translateY(-8px)",
      transition: "all .2s ease",
    },
    dropHead: {
      padding: "14px 16px", background: "#0A0E23",
      borderBottom: "1px solid rgba(196,160,80,0.15)",
    },
    dropName: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.85rem",
      fontWeight: 500, color: "#fff", marginBottom: "2px",
    },
    dropEmail: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.72rem",
      color: "rgba(255,255,255,0.4)",
    },
    dropItem: {
      display: "block", width: "100%", padding: "11px 16px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.83rem",
      color: "#333", background: "#fff", border: "none",
      textAlign: "left", cursor: "pointer", textDecoration: "none",
      borderBottom: "1px solid rgba(196,160,80,0.06)",
      transition: "all .15s",
    },
    dropItemDanger: {
      display: "block", width: "100%", padding: "11px 16px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.83rem",
      color: "#888", background: "#fff", border: "none",
      textAlign: "left", cursor: "pointer",
      transition: "all .15s",
    },
  };

  const navItems = [
    { label: "Acasă",    to: "/" },
    { label: "Hoteluri", to: "/hoteluri" },
  ];

  return (
    <nav style={s.nav}>
      <Link to="/" style={s.logo}>HoteluriRo</Link>

      <ul style={s.navLinks}>
        {navItems.map(({ label, to }) => (
          <li key={label}>
            <Link to={to} style={s.link(label)}
              onMouseEnter={() => setHovered(label)}
              onMouseLeave={() => setHovered(null)}>
              {label}
              <span style={s.linkLine(label)} />
            </Link>
          </li>
        ))}

        <li style={{ marginLeft: "12px" }}>
          {user ? (
            <div id="user-menu-wrap" style={s.userWrap}>
              <button style={s.avatarBtn} onClick={() => setUserMenu(v => !v)}>
                <div style={s.avatar}>{initiale}</div>
                <span style={s.avatarName}>{user.nume_complet?.split(" ")[0]}</span>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem", marginLeft: "2px" }}>▼</span>
              </button>

              <div style={s.dropdown}>
                <div style={s.dropHead}>
                  <div style={s.dropName}>{user.nume_complet}</div>
                  <div style={s.dropEmail}>{user.email}</div>
                </div>

                <Link to="/profil" style={s.dropItem}
                  onMouseEnter={e => { e.currentTarget.style.color="#C4A050"; e.currentTarget.style.background="rgba(196,160,80,0.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color="#333"; e.currentTarget.style.background="#fff"; }}
                  onClick={() => setUserMenu(false)}>
                  👤 Profilul meu
                </Link>

                <Link to="/rezervarile-mele" style={s.dropItem}
                  onMouseEnter={e => { e.currentTarget.style.color="#C4A050"; e.currentTarget.style.background="rgba(196,160,80,0.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color="#333"; e.currentTarget.style.background="#fff"; }}
                  onClick={() => setUserMenu(false)}>
                  📋 Rezervările mele
                </Link>

                {["super_admin","admin_hotel","admin_marketing","admin_booking"].includes(user.rol) && (
                  <Link to="/admin" style={s.dropItem}
                    onMouseEnter={e => { e.currentTarget.style.color="#C4A050"; e.currentTarget.style.background="rgba(196,160,80,0.06)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color="#333"; e.currentTarget.style.background="#fff"; }}
                    onClick={() => setUserMenu(false)}>
                    ⚙️ Panou Admin
                  </Link>
                )}

                <button style={s.dropItemDanger} onClick={handleLogout}
                  onMouseEnter={e => { e.currentTarget.style.color="#cc2200"; e.currentTarget.style.background="rgba(220,50,50,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color="#888"; e.currentTarget.style.background="#fff"; }}>
                  ← Deconectare
                </button>
              </div>
            </div>
          ) : (
            <Link to="/autentificare" style={s.authBtn}
              onMouseEnter={() => setHovered("auth")}
              onMouseLeave={() => setHovered(null)}>
              Autentificare
            </Link>
          )}
        </li>
      </ul>
    </nav>
  );
}