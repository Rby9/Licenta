import { StatCard, BarChart } from './AdminWidgets';


export default function OverviewTab({
  getStatsFiltrate,
  setPerioadaDashboard,
  perioadaDashboard,
  s,
  stats,
  graficLunar,
  graficVenituri,
}) {
    const sf = getStatsFiltrate();
    return (
    <div>
      {/* Filtru perioadă */}
      <div className="admin-period" style={{ display: "flex", gap: "8px", marginBottom: "20px", alignItems: "center" }}>
        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(26,26,46,0.4)" }}>
          Perioadă:
        </span>
        {[
          { key: "toate", label: "Toate timpurile" },
          { key: "an",    label: "Anul curent" },
          { key: "luna",  label: "Luna curentă" },
        ].map(p => (
          <button key={p.key} onClick={() => setPerioadaDashboard(p.key)} style={{
            fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", fontWeight: 500,
            letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
            padding: "6px 14px", borderRadius: "2px", border: "1px solid",
            borderColor: perioadaDashboard === p.key ? "#C4A050" : "rgba(196,160,80,0.2)",
            background: perioadaDashboard === p.key ? "rgba(196,160,80,0.1)" : "transparent",
            color: perioadaDashboard === p.key ? "#C4A050" : "rgba(26,26,46,0.5)",
            transition: "all .2s",
          }}>{p.label}</button>
        ))}
      </div>

      <div className="admin-stats" style={s.statsGrid}>
        <StatCard label="Total rezervări"  value={sf.total}    sub={perioadaDashboard === "luna" ? "luna aceasta" : perioadaDashboard === "an" ? "anul acesta" : "din toate timpurile"} />
        <StatCard label="Rezervări active" value={sf.active}   sub="confirmate" gold />
        <StatCard label="Total utilizatori" value={stats?.total_utilizatori} sub="conturi înregistrate" />
        <StatCard label="Venituri totale"  value={sf.venituri ? `${Math.round(sf.venituri).toLocaleString()} RON` : "—"} sub="din rezervări confirmate" gold />
      </div>

      <div className="admin-charts" style={s.graficeGrid}>
        <BarChart data={graficLunar} title="Rezervări pe luni (anul curent)" />
        <BarChart data={graficVenituri} title="Venituri pe luni — RON (confirmate)" />
      </div>

      {/* Top hoteluri */}
      <div className="admin-table-card" style={s.tabelCard}>
        <div style={s.tabelHead}>
          <span style={s.tabelTitle}>Top hoteluri după rezervări</span>
        </div>
        <table style={s.table}>
          <thead>
            <tr>
              {["Hotel", "Oraș", "Stele", "Rezervări", "Venit total"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(stats?.top_hoteluri || []).map((h, i) => (
              <tr key={i}>
                <td style={s.td(i)}>{h.nume_hotel}</td>
                <td style={{ ...s.td(i), ...s.tdMuted }}>{h.nume_oras}</td>
                <td style={s.td(i)}>{"★".repeat(h.stele)}</td>
                <td style={s.td(i)}>{h.nr_rezervari}</td>
                <td style={{ ...s.td(i), color: "#C4A050", fontWeight: 500 }}>
                  {Math.round(h.venit_total).toLocaleString()} RON
                </td>
              </tr>
            ))}
            {(!stats?.top_hoteluri || !stats.top_hoteluri.length) && (
              <tr><td colSpan={5} style={{ ...s.td(0), textAlign: "center", color: "rgba(26,26,46,0.35)", padding: "32px" }}>
                Nu există date încă.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );}
