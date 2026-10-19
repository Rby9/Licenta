// ─── Badge status ──────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const cfg = {
    confirmata:   { label: "Confirmată",   color: "#0f6e56", bg: "rgba(29,158,117,0.1)",  border: "rgba(29,158,117,0.3)" },
    in_asteptare: { label: "În așteptare", color: "#8a6a10", bg: "rgba(196,160,80,0.1)",  border: "rgba(196,160,80,0.3)" },
    anulata:      { label: "Anulată",      color: "#aa2020", bg: "rgba(220,50,50,0.08)",  border: "rgba(220,50,50,0.2)" },
  };
  const c = cfg[status] || cfg.in_asteptare;
  return (
    <span style={{
      fontFamily: "'Jost',sans-serif", fontSize: "0.7rem", fontWeight: 500,
      letterSpacing: "0.08em", textTransform: "uppercase",
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: "2px", padding: "2px 8px", whiteSpace: "nowrap",
    }}>{c.label}</span>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, gold }) {
  return (
    <div style={{
      background: "#fff", borderRadius: "4px", padding: "22px 24px",
      border: "1px solid rgba(196,160,80,0.12)",
      boxShadow: "0 4px 16px rgba(10,14,35,0.06)",
    }}>
      <div style={{
        fontFamily: "'Jost',sans-serif", fontSize: "0.68rem",
        letterSpacing: "0.15em", textTransform: "uppercase",
        color: "rgba(26,26,46,0.4)", marginBottom: "10px",
      }}>{label}</div>
      <div style={{
        fontFamily: "'Cormorant Garamond',serif",
        fontSize: "2.2rem", fontWeight: 700, lineHeight: 1,
        color: gold ? "#C4A050" : "#0A0E23",
      }}>{value ?? "—"}</div>
      {sub && <div style={{
        fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
        color: "rgba(26,26,46,0.35)", marginTop: "6px",
      }}>{sub}</div>}
    </div>
  );
}

// ─── Mini bar chart (SVG) ──────────────────────────────────────────────────
export function BarChart({ data, title }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 560, H = 180, padL = 40, padB = 30, padT = 10, padR = 10;
  const barW = Math.min(36, (W - padL - padR) / data.length - 6);
  const step = (W - padL - padR) / data.length;

  return (
    <div style={{
      background: "#fff", borderRadius: "4px", padding: "20px 24px",
      border: "1px solid rgba(196,160,80,0.12)",
      boxShadow: "0 4px 16px rgba(10,14,35,0.06)",
    }}>
      <div style={{
        fontFamily: "'Jost',sans-serif", fontSize: "0.7rem",
        letterSpacing: "0.15em", textTransform: "uppercase",
        color: "rgba(26,26,46,0.4)", marginBottom: "16px",
      }}>{title}</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H + padB + padT}`}>
        {/* Linii orizontale */}
        {[0.25, 0.5, 0.75, 1].map(f => {
          const y = padT + (1 - f) * H;
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W - padR} y2={y}
                stroke="rgba(196,160,80,0.1)" strokeWidth="1"/>
              <text x={padL - 4} y={y + 4} textAnchor="end"
                style={{ fontFamily: "'Jost',sans-serif", fontSize: "10px", fill: "rgba(26,26,46,0.3)" }}>
                {Math.round(max * f)}
              </text>
            </g>
          );
        })}
        {/* Bare */}
        {data.map((d, i) => {
          const barH = Math.max(2, (d.value / max) * H);
          const x = padL + i * step + step / 2 - barW / 2;
          const y = padT + H - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH}
                fill="#C4A050" rx="2" opacity="0.85"/>
              <text x={x + barW / 2} y={padT + H + 18} textAnchor="middle"
                style={{ fontFamily: "'Jost',sans-serif", fontSize: "10px", fill: "rgba(26,26,46,0.45)" }}>
                {d.label}
              </text>
              {d.value > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle"
                  style={{ fontFamily: "'Jost',sans-serif", fontSize: "10px", fill: "#C4A050", fontWeight: 500 }}>
                  {d.value}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
