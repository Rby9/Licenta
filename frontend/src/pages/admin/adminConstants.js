export const ADMIN_ROLES = ["super_admin", "admin_hotel", "admin_marketing", "admin_booking"];

export const ROL_LABEL = {
  super_admin:     "Super Admin",
  admin_hotel:     "Admin Hotel",
  admin_marketing: "Admin Marketing",
  admin_booking:   "Admin Booking",
  client:          "Client",
};

export const ROL_STYLE = {
  super_admin:     { color: "#C4A050", bg: "rgba(196,160,80,0.1)",   border: "rgba(196,160,80,0.3)" },
  admin_hotel:     { color: "#0f6e56", bg: "rgba(29,158,117,0.1)",   border: "rgba(29,158,117,0.3)" },
  admin_marketing: { color: "#6a3dd1", bg: "rgba(106,61,209,0.08)", border: "rgba(106,61,209,0.2)" },
  admin_booking:   { color: "#1565c0", bg: "rgba(21,101,192,0.08)", border: "rgba(21,101,192,0.2)" },
  client:          { color: "#0A0E23", bg: "rgba(26,26,46,0.06)",   border: "rgba(26,26,46,0.1)" },
};

// ─── Helper formatare dată ─────────────────────────────────────────────────
export const formatData = (str) => {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("ro-RO", {
    day: "numeric", month: "short", year: "numeric"
  });
};

export const PER_PAGE = 15;
