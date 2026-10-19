import { clampPage } from './adminData';
import Paginator from './Paginator';
import { PER_PAGE } from './adminConstants';
import { ROL_STYLE } from './adminConstants';
import { ROL_LABEL } from './adminConstants';

export default function UsersTab({
  s,
  utilizatori,
  utilizator,
  paginaUtil,
  handleSchimbaRolUtilizator,
  setPaginaUtil,
}) {
  const currentPage = clampPage(paginaUtil, utilizatori.length);
  return (
    <div className="admin-table-card" style={s.tabelCard}>
      <div style={s.tabelHead}>
        <span style={s.tabelTitle}>Utilizatori înregistrați</span>
        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(26,26,46,0.4)" }}>
          {utilizatori.length} conturi
        </span>
      </div>
      <table style={s.table}>
        <thead>
          <tr>
            {["#", "Nume", "Email", "Telefon", "Rol", "Rezervări",
              ...(utilizator?.rol === "super_admin" ? ["Schimbă rol"] : [])
            ].map(h => (
              <th key={h} style={s.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {utilizatori.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE).map((u, i) => {
            const rc = ROL_STYLE[u.rol] || ROL_STYLE.client;
            return (
              <tr key={u.id_utilizator}>
                <td style={{ ...s.td(i), ...s.tdMuted }}>#{u.id_utilizator}</td>
                <td style={s.td(i)}>{u.nume_complet}</td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{u.email}</td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{u.telefon || "—"}</td>
                <td style={s.td(i)}>
                  <span style={{
                    fontFamily: "'Jost',sans-serif", fontSize: "0.7rem",
                    fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: rc.color, background: rc.bg, border: `1px solid ${rc.border}`,
                    borderRadius: "2px", padding: "2px 8px", whiteSpace: "nowrap",
                  }}>{ROL_LABEL[u.rol] || u.rol}</span>
                </td>
                <td style={s.td(i)}>{u.nr_rezervari || 0}</td>
                {utilizator?.rol === "super_admin" && (
                  <td style={s.td(i)}>
                    <select
                      value={u.rol}
                      onChange={e => handleSchimbaRolUtilizator(u.id_utilizator, e.target.value)}
                      style={{
                        fontFamily: "'Jost',sans-serif", fontSize: "0.75rem",
                        color: "#0A0E23", border: "1px solid rgba(196,160,80,0.25)",
                        borderRadius: "2px", padding: "4px 8px", background: "#fff",
                        cursor: "pointer", outline: "none",
                      }}>
                      {Object.entries(ROL_LABEL).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Paginator total={utilizatori.length} pagina={currentPage} setPagina={setPaginaUtil} />
    </div>
  ); }
