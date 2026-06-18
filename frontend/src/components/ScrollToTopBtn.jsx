import { useState, useEffect } from "react";

export default function ScrollToTopBtn() {
  const [visible, setVisible] = useState(false);
  const [hov, setHov] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "fixed", bottom: "32px", right: "32px", zIndex: 999,
        width: "44px", height: "44px", borderRadius: "50%",
        border: "1px solid rgba(196,160,80,0.4)",
        background: hov
          ? "linear-gradient(135deg,#C4A050,#A8883C)"
          : "rgba(255,255,255,0.95)",
        backdropFilter: "blur(8px)",
        boxShadow: hov
          ? "0 8px 28px rgba(196,160,80,0.4)"
          : "0 4px 16px rgba(10,14,35,0.15)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all .25s ease",
        color: hov ? "#0A0E23" : "#C4A050",
        fontSize: "1rem", fontWeight: 700,
        animation: "fadeUp 0.3s ease",
      }}
      aria-label="Înapoi sus"
    >
      ↑
    </button>
  );
}
