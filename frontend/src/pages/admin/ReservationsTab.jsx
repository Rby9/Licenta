import { downloadReservation } from '../../utils/downloadReservation';
import { clampPage } from './adminData';
import Paginator from './Paginator';
import { StatusBadge } from './AdminWidgets';
import { PER_PAGE } from './adminConstants';
import { formatData } from './adminConstants';

export default function ReservationsTab({
  s,
  cautareRez,
  setCautareRez,
  setPaginaRez,
  filtruRez,
  setFiltruRez,
  rezervariFiltrate,
  paginaRez,
  handleSchimbaStatus,
  utilizator,
  showEroare,
  token,
}) {
  const currentPage = clampPage(paginaRez, rezervariFiltrate.length);
  return (
    <div>
      <div style={s.filtreRow}>
        <input style={s.filtruInput} placeholder="Caută hotel sau client..."
          value={cautareRez} onChange={e => { setCautareRez(e.target.value); setPaginaRez(1); }} />
        <select style={s.filtruSelect} value={filtruRez} onChange={e => { setFiltruRez(e.target.value); setPaginaRez(1); }}>
          <option value="toate">Toate statusurile</option>
          <option value="confirmata">Confirmate</option>
          <option value="in_asteptare">În așteptare</option>
          <option value="anulata">Anulate</option>
        </select>
        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(26,26,46,0.4)" }}>
          {rezervariFiltrate.length} rezervări
        </span>
      </div>

      <div className="admin-table-card" style={s.tabelCard}>
        <table style={s.table}>
          <thead>
            <tr>
              {["#", "Client", "Hotel / Cameră", "Check-in", "Check-out", "Total", "Status", "Acțiuni"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rezervariFiltrate.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE).map((r, i) => (
              <tr key={r.id_rezervare}>
                <td style={{ ...s.td(i), ...s.tdMuted }}>#{r.id_rezervare}</td>
                <td style={s.td(i)}>
                  <div style={{ fontWeight: 500 }}>{r.nume_complet}</div>
                  <div style={{ ...s.tdMuted, fontSize: "0.75rem" }}>{r.email}</div>
                </td>
                <td style={s.td(i)}>
                  <div style={{ fontWeight: 500 }}>{r.nume_hotel}</div>
                  <div style={{ ...s.tdMuted, fontSize: "0.75rem" }}>{r.tip_camera}</div>
                </td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{formatData(r.data_checkin)}</td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{formatData(r.data_checkout)}</td>
                <td style={{ ...s.td(i), color: "#C4A050", fontWeight: 500 }}>
                  {Math.round(r.pret_total).toLocaleString()} RON
                </td>
                <td style={s.td(i)}><StatusBadge status={r.status_rezervare} /></td>
                <td style={s.td(i)}>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {r.status_rezervare !== "confirmata" && (
                      <button style={s.btnMic("confirm")}
                        onClick={() => handleSchimbaStatus(r.id_rezervare, "confirmata")}>
                        Confirmă
                      </button>
                    )}
                    {r.status_rezervare !== "anulata" && (
                      <button style={s.btnMic("anulare")}
                        onClick={() => handleSchimbaStatus(r.id_rezervare, "anulata")}>
                        Anulează
                      </button>
                    )}
                    {["super_admin", "admin_hotel"].includes(utilizator?.rol) && (
                      <button style={{ ...s.btnMic("edit"), fontSize: "0.65rem" }}
                        onClick={async () => {
                          try { await downloadReservation(r.id_rezervare, token); }
                          catch (error) { showEroare(error.message || 'Documentul nu a putut fi descărcat.'); }
                        }}>
                        ↓ Factură
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!rezervariFiltrate.length && (
              <tr><td colSpan={8} style={{ ...s.td(0), textAlign: "center", color: "rgba(26,26,46,0.35)", padding: "40px" }}>
                Nu există rezervări.
              </td></tr>
            )}
          </tbody>
        </table>
        <Paginator total={rezervariFiltrate.length} pagina={currentPage} setPagina={setPaginaRez} />
      </div>
    </div>
  ); }
