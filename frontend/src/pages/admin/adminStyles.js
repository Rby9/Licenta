export function createAdminStyles(focusField) {
  return {
    page: { minHeight: "100vh", background: "#F8F6F1", paddingTop: "80px" },
    header: {
      background: "#0A0E23", padding: "28px 48px 0",
      borderBottom: "1px solid rgba(196,160,80,0.15)",
    },
    headerInner: { maxWidth: "1400px", margin: "0 auto" },
    headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "20px" },
    headerTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.8rem", fontWeight: 700, color: "#fff",
    },
    adminBadge: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.68rem",
      letterSpacing: "0.15em", textTransform: "uppercase",
      color: "#C4A050", background: "rgba(196,160,80,0.12)",
      border: "1px solid rgba(196,160,80,0.25)",
      borderRadius: "2px", padding: "3px 10px",
    },
    tabs: { display: "flex", gap: "0" },
    tabBtn: (activ) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
      fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      padding: "14px 24px", cursor: "pointer", border: "none",
      background: "transparent",
      color: activ ? "#C4A050" : "rgba(255,255,255,0.45)",
      borderBottom: activ ? "2px solid #C4A050" : "2px solid transparent",
      transition: "all .2s ease",
    }),
    layout: { maxWidth: "1400px", margin: "0 auto", padding: "32px 48px" },
    msgSucces: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.83rem",
      color: "#0f6e56", background: "rgba(29,158,117,0.08)",
      border: "1px solid rgba(29,158,117,0.25)",
      borderRadius: "2px", padding: "10px 16px", marginBottom: "20px",
    },
    msgEroare: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.83rem",
      color: "#cc2200", background: "rgba(255,80,80,0.07)",
      border: "1px solid rgba(255,80,80,0.2)",
      borderRadius: "2px", padding: "10px 16px", marginBottom: "20px",
    },

    // Grid statistici
    statsGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "28px" },
    graficeGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" },

    // Tabel
    tabelCard: {
      background: "#fff", borderRadius: "4px",
      border: "1px solid rgba(196,160,80,0.12)",
      boxShadow: "0 4px 16px rgba(10,14,35,0.06)", overflow: "hidden",
    },
    tabelHead: {
      padding: "16px 20px",
      borderBottom: "1px solid rgba(196,160,80,0.1)",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      background: "rgba(196,160,80,0.03)",
    },
    tabelTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.1rem", fontWeight: 600, color: "#0A0E23",
    },
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.67rem",
      fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      color: "rgba(26,26,46,0.4)", padding: "10px 16px",
      borderBottom: "1px solid rgba(196,160,80,0.1)",
      textAlign: "left", background: "rgba(196,160,80,0.02)",
    },
    td: (i) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "#0A0E23",
      padding: "12px 16px",
      borderBottom: "1px solid rgba(196,160,80,0.06)",
      background: i % 2 === 0 ? "#fff" : "rgba(196,160,80,0.015)",
    }),
    tdMuted: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
      color: "rgba(26,26,46,0.45)",
    },

    // Butoane acțiuni
    btnMic: (type) => ({
      fontFamily: "'Jost',sans-serif", fontSize: "0.7rem",
      fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "5px 12px", cursor: "pointer", borderRadius: "2px",
      border: "1px solid",
      transition: "all .2s",
      ...(type === "edit"   ? { color: "#0A0E23", borderColor: "rgba(196,160,80,0.4)", background: "transparent" } : {}),
      ...(type === "del"    ? { color: "#cc2200", borderColor: "rgba(220,50,50,0.3)", background: "transparent" } : {}),
      ...(type === "add"    ? { color: "#0A0E23", background: "linear-gradient(135deg,#C4A050,#A8883C)", borderColor: "transparent" } : {}),
      ...(type === "confirm"? { color: "#0f6e56", borderColor: "rgba(29,158,117,0.4)", background: "transparent" } : {}),
      ...(type === "anulare"? { color: "#cc2200", borderColor: "rgba(220,50,50,0.3)", background: "transparent" } : {}),
    }),
    btnPrincipal: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
      fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      padding: "9px 20px", cursor: "pointer", borderRadius: "2px",
      color: "#0A0E23", background: "linear-gradient(135deg,#C4A050,#A8883C)",
      border: "none", transition: "all .2s",
    },

    // Filtre
    filtreRow: { display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center", flexWrap: "wrap" },
    filtruInput: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "#0A0E23",
      border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px",
      padding: "8px 12px", outline: "none", background: "#fff",
    },
    filtruSelect: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", color: "#0A0E23",
      border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px",
      padding: "8px 12px", outline: "none", background: "#fff", cursor: "pointer",
    },

    // Modal
    overlay: {
      position: "fixed", inset: 0, background: "rgba(10,14,35,0.65)",
      backdropFilter: "blur(4px)", zIndex: 2000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
    },
    modal: {
      background: "#fff", borderRadius: "4px", maxWidth: "520px", width: "100%",
      boxShadow: "0 24px 80px rgba(10,14,35,0.3)",
      border: "1px solid rgba(196,160,80,0.15)", overflow: "hidden",
      maxHeight: "90vh", overflowY: "auto",
    },
    modalHead: { background: "#0A0E23", padding: "18px 24px" },
    modalTitle: {
      fontFamily: "'Cormorant Garamond',serif",
      fontSize: "1.25rem", fontWeight: 600, color: "#fff",
    },
    modalBody: { padding: "24px" },
    fieldWrap: { marginBottom: "18px" },
    label: {
      fontFamily: "'Jost',sans-serif", fontSize: "0.68rem",
      fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase",
      color: "#C4A050", display: "block", marginBottom: "6px",
    },
    input: (f) => ({
      width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.9rem",
      color: "#0A0E23", background: "#FDFBF8",
      border: focusField === f ? "1px solid #C4A050" : "1px solid rgba(196,160,80,0.2)",
      borderRadius: "2px", padding: "10px 12px", outline: "none",
      transition: "border-color .2s", boxSizing: "border-box",
    }),
    select: (f) => ({
      width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.9rem",
      color: "#0A0E23", background: "#FDFBF8",
      border: focusField === f ? "1px solid #C4A050" : "1px solid rgba(196,160,80,0.2)",
      borderRadius: "2px", padding: "10px 12px", outline: "none",
      transition: "border-color .2s", boxSizing: "border-box", cursor: "pointer",
    }),
    textarea: (f) => ({
      width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.88rem",
      color: "#0A0E23", background: "#FDFBF8",
      border: focusField === f ? "1px solid #C4A050" : "1px solid rgba(196,160,80,0.2)",
      borderRadius: "2px", padding: "10px 12px", outline: "none",
      resize: "vertical", minHeight: "80px", boxSizing: "border-box",
    }),
    modalBtns: { display: "flex", gap: "12px", marginTop: "24px" },
    modalBtnPrim: {
      flex: 1, padding: "11px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
      fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      color: "#0A0E23", background: "linear-gradient(135deg,#C4A050,#A8883C)",
      border: "none", borderRadius: "2px", cursor: "pointer",
    },
    modalBtnSec: {
      flex: 1, padding: "11px",
      fontFamily: "'Jost',sans-serif", fontSize: "0.8rem",
      fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase",
      color: "#0A0E23", background: "transparent",
      border: "1px solid rgba(196,160,80,0.3)", borderRadius: "2px", cursor: "pointer",
    },

    // Hotel row expandabil
    hotelRow: (hov) => ({
      background: hov ? "rgba(196,160,80,0.03)" : "#fff",
      transition: "background .15s",
    }),
    categorieRow: {
      background: "rgba(196,160,80,0.04)",
      borderTop: "1px solid rgba(196,160,80,0.08)",
    },
  };
}
