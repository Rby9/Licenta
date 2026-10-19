import { clampPage } from './adminData';
import Paginator from './Paginator';
import { StatusBadge, StatCard } from './AdminWidgets';
import { PER_PAGE } from './adminConstants';
import { formatData } from './adminConstants';

export default function PaymentsTab({
  s,
  platiStats,
  platiLista,
  paginaPlati,
  setPaginaPlati,
}) {
  const currentPage = clampPage(paginaPlati, platiLista.length);
  return (
    <div>
      <div className="admin-stats" style={s.statsGrid}>
        <StatCard label="Total plăți procesate" value={platiStats?.total_rezervari ?? "—"} sub="prin Stripe" />
        <StatCard label="Venituri totale" value={platiStats ? `${Math.round(platiStats.venituri_totale || 0).toLocaleString()} RON` : "—"} sub="plăți confirmate" gold />
        <StatCard label="Comisioane platformă" value={platiStats ? `${Math.round(platiStats.comisioane_totale || 0).toLocaleString()} RON` : "—"} sub="10% din fiecare plată" />
        <StatCard label="Sume decontate hoteluri" value={platiStats ? `${Math.round(platiStats.sume_hoteluri || 0).toLocaleString()} RON` : "—"} sub="90% din fiecare plată" gold />
      </div>

      <div className="admin-table-card" style={s.tabelCard}>
        <div style={s.tabelHead}>
          <span style={s.tabelTitle}>Plăți procesate prin Stripe</span>
          <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(26,26,46,0.4)" }}>
            {platiLista.length} tranzacții
          </span>
        </div>
        <table style={s.table}>
          <thead>
            <tr>
              {["#", "Client", "Hotel / Cameră", "Check-in", "Check-out", "Total", "Comision (10%)", "Hotel (90%)", "Status"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platiLista.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE).map((p, i) => (
              <tr key={p.id_rezervare}>
                <td style={{ ...s.td(i), ...s.tdMuted }}>#{p.id_rezervare}</td>
                <td style={s.td(i)}>
                  <div style={{ fontWeight: 500 }}>{p.nume_complet}</div>
                  <div style={{ ...s.tdMuted, fontSize: "0.75rem" }}>{p.email}</div>
                </td>
                <td style={s.td(i)}>
                  <div style={{ fontWeight: 500 }}>{p.nume_hotel}</div>
                  <div style={{ ...s.tdMuted, fontSize: "0.75rem" }}>{p.tip_camera} — {p.nume_oras}</div>
                </td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{formatData(p.data_checkin)}</td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{formatData(p.data_checkout)}</td>
                <td style={{ ...s.td(i), color: "#C4A050", fontWeight: 500 }}>
                  {Math.round(Number(p.pret_total)).toLocaleString()} RON
                </td>
                <td style={{ ...s.td(i), color: "#1565c0", fontWeight: 500 }}>
                  {p.comision_platforma ? `${Math.round(Number(p.comision_platforma)).toLocaleString()} RON` : "—"}
                </td>
                <td style={{ ...s.td(i), color: "#0f6e56", fontWeight: 500 }}>
                  {p.suma_hotel ? `${Math.round(Number(p.suma_hotel)).toLocaleString()} RON` : "—"}
                </td>
                <td style={s.td(i)}><StatusBadge status={p.status_rezervare} /></td>
              </tr>
            ))}
            {!platiLista.length && (
              <tr><td colSpan={9} style={{ ...s.td(0), textAlign: "center", color: "rgba(26,26,46,0.35)", padding: "40px" }}>
                Nu există plăți procesate prin Stripe încă.
              </td></tr>
            )}
          </tbody>
        </table>
        <Paginator total={platiLista.length} pagina={currentPage} setPagina={setPaginaPlati} />
      </div>
    </div>
  ); }
