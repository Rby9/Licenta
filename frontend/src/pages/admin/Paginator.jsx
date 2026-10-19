import { clampPage } from './adminData';
import { PER_PAGE } from "./adminConstants";

export default function Paginator({ total, pagina, setPagina }) {
    pagina = clampPage(pagina, total);
    const totalPag = Math.ceil(total / PER_PAGE);
    if (totalPag <= 1) return null;
    return (
      <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end", padding: "12px 16px", borderTop: "1px solid rgba(196,160,80,0.08)" }}>
        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", color: "rgba(26,26,46,0.4)", marginRight: "8px" }}>
          {(pagina - 1) * PER_PAGE + 1}–{Math.min(pagina * PER_PAGE, total)} din {total}
        </span>
        <button onClick={() => setPagina(1)} disabled={pagina === 1}
          style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", padding: "4px 9px", cursor: pagina === 1 ? "default" : "pointer", background: "none", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px", color: pagina === 1 ? "rgba(26,26,46,0.25)" : "#0A0E23" }}>«</button>
        <button onClick={() => setPagina(Math.max(1, pagina - 1))} disabled={pagina === 1}
          style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", padding: "4px 9px", cursor: pagina === 1 ? "default" : "pointer", background: "none", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px", color: pagina === 1 ? "rgba(26,26,46,0.25)" : "#0A0E23" }}>‹</button>
        {Array.from({ length: totalPag }, (_, i) => i + 1)
          .filter(n => n === 1 || n === totalPag || Math.abs(n - pagina) <= 1)
          .reduce((acc, n, i, arr) => {
            if (i > 0 && n - arr[i - 1] > 1) acc.push("...");
            acc.push(n); return acc;
          }, [])
          .map((n, i) => n === "..." ? (
            <span key={`e${i}`} style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", color: "rgba(26,26,46,0.3)", padding: "0 2px" }}>…</span>
          ) : (
            <button key={n} onClick={() => setPagina(n)}
              style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", padding: "4px 10px", cursor: "pointer",
                background: n === pagina ? "linear-gradient(135deg,#C4A050,#A8883C)" : "none",
                border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px",
                color: n === pagina ? "#0A0E23" : "#0A0E23", fontWeight: n === pagina ? 600 : 400 }}>{n}</button>
          ))}
        <button onClick={() => setPagina(Math.min(totalPag, pagina + 1))} disabled={pagina === totalPag}
          style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", padding: "4px 9px", cursor: pagina === totalPag ? "default" : "pointer", background: "none", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px", color: pagina === totalPag ? "rgba(26,26,46,0.25)" : "#0A0E23" }}>›</button>
        <button onClick={() => setPagina(totalPag)} disabled={pagina === totalPag}
          style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", padding: "4px 9px", cursor: pagina === totalPag ? "default" : "pointer", background: "none", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px", color: pagina === totalPag ? "rgba(26,26,46,0.25)" : "#0A0E23" }}>»</button>
      </div>
    );
  }
