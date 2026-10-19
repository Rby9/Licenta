import { StatCard } from './AdminWidgets';
import { formatData } from './adminConstants';

export default function MarketingTab({
  utilizatori,
  coduri,
  hoteluri,
  rezervari,
  s,
  formCod,
  setFormCod,
  setFocus,
  handleCreazaCod,
  handleToggleCod,
  handleStergeCod,
  oferteExpandate,
  OFERTE_VIZIBILE,
  handleToggleOferta,
  setOferteExpandate,
  formNewsletter,
  setFormNewsletter,
  handleTrimiteNewsletter,
  newsletterRezultat,
  newsletterLoading,
  oferteSez,
  editOferta,
  setEditOferta,
  handleSaveOfertaSez,
  handleToggleOfertaSez,
}) {
    const sLabel = { fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(26,26,46,0.4)", marginBottom: "14px" };

    const abonatiNewsletter = utilizatori.filter(u => u.email_marketing).length;
    const coduriActive      = coduri.filter(c => c.activ).length;
    const hoteluriFeatured  = hoteluri.filter(h => h.oferta_activa).length;
    const acum = new Date();
    const rezLunaAceasta = rezervari.filter(r => {
      const d = new Date(r.data_crearii);
      return d.getMonth() === acum.getMonth() && d.getFullYear() === acum.getFullYear();
    }).length;

    return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

      {/* ── 0. KPI-uri marketing ── */}
      <div>
        <div style={sLabel}>Statistici marketing</div>
        <div className="admin-stats" style={s.statsGrid}>
          <StatCard label="Abonați newsletter" value={abonatiNewsletter} sub="utilizatori cu notificări activate" gold />
          <StatCard label="Coduri promoționale" value={coduriActive} sub={coduri.length ? `active din ${coduri.length} total` : "active"} />
          <StatCard label="Hoteluri în ofertă" value={hoteluriFeatured} sub={hoteluri.length ? `din ${hoteluri.length} hoteluri` : "hoteluri"} />
          <StatCard label="Rezervări luna aceasta" value={rezLunaAceasta} sub={acum.toLocaleString("ro-RO", { month: "long", year: "numeric" })} />
        </div>
      </div>

      {/* ── 1. Coduri de reducere ── */}
      <div>
        <div style={sLabel}>Coduri de reducere</div>
        <div className="marketing-columns" style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "16px", alignItems: "start" }}>

          {/* Formular */}
          <div style={{ ...s.tabelCard, padding: "22px" }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.1rem", fontWeight: 600, color: "#0A0E23", marginBottom: "18px" }}>
              Cod nou
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={s.label}>Cod *</label>
              <input style={s.input("cod_nou")} value={formCod.cod}
                onChange={e => setFormCod(f => ({ ...f, cod: e.target.value.toUpperCase() }))}
                onFocus={() => setFocus("cod_nou")} onBlur={() => setFocus(null)}
                placeholder="Ex: VARA2025" />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={s.label}>Reducere (%) *</label>
              <input type="number" style={s.input("proc_nou")} value={formCod.procent_reducere}
                onChange={e => setFormCod(f => ({ ...f, procent_reducere: parseInt(e.target.value) }))}
                onFocus={() => setFocus("proc_nou")} onBlur={() => setFocus(null)}
                min={1} max={90} />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={s.label}>Descriere (opțional)</label>
              <input style={s.input("desc_cod")} value={formCod.descriere}
                onChange={e => setFormCod(f => ({ ...f, descriere: e.target.value }))}
                onFocus={() => setFocus("desc_cod")} onBlur={() => setFocus(null)}
                placeholder="Ex: Reducere de vară 2025" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={s.label}>Valabil de la</label>
                <input type="date" style={s.input("start_cod")} value={formCod.data_start}
                  onChange={e => setFormCod(f => ({ ...f, data_start: e.target.value }))}
                  onFocus={() => setFocus("start_cod")} onBlur={() => setFocus(null)} />
              </div>
              <div>
                <label style={s.label}>Valabil până la</label>
                <input type="date" style={s.input("exp_cod")} value={formCod.data_expirare}
                  onChange={e => setFormCod(f => ({ ...f, data_expirare: e.target.value }))}
                  onFocus={() => setFocus("exp_cod")} onBlur={() => setFocus(null)} />
              </div>
            </div>
            <div style={{ marginBottom: "18px" }}>
              <label style={s.label}>Utilizări maxime (opțional — gol = nelimitat)</label>
              <input type="number" style={s.input("util_cod")} value={formCod.utilizari_maxime}
                onChange={e => setFormCod(f => ({ ...f, utilizari_maxime: e.target.value }))}
                onFocus={() => setFocus("util_cod")} onBlur={() => setFocus(null)}
                placeholder="Ex: 50" min={1} />
            </div>
            <button style={s.btnPrincipal} onClick={handleCreazaCod}>
              + Crează cod
            </button>
          </div>

          {/* Tabel coduri */}
          <div className="admin-table-card" style={s.tabelCard}>
            <div style={{ ...s.tabelHead, borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={s.tabelTitle}>Coduri existente</span>
              <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.4)" }}>{coduri.length} total</span>
            </div>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Cod", "Reducere", "Descriere", "Perioadă", "Utilizări", "Status", ""].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coduri.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...s.td(0), textAlign: "center", color: "rgba(26,26,46,0.35)", padding: "32px" }}>Nu există coduri create încă.</td></tr>
                ) : coduri.map((c, i) => {
                  const epuizat = c.utilizari_maxime && c.utilizari_curente >= c.utilizari_maxime;
                  return (
                  <tr key={c.id_cod} style={{ opacity: c.activ && !epuizat ? 1 : 0.45 }}>
                    <td style={s.td(i)}>
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", fontWeight: 600, color: "#0A0E23", letterSpacing: "0.06em" }}>{c.cod}</span>
                    </td>
                    <td style={s.td(i)}>
                      <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", fontWeight: 600, color: "#C4A050", background: "rgba(196,160,80,0.1)", border: "1px solid rgba(196,160,80,0.25)", borderRadius: "2px", padding: "2px 8px" }}>
                        -{c.procent_reducere}%
                      </span>
                    </td>
                    <td style={{ ...s.td(i), ...s.tdMuted }}>{c.descriere || "—"}</td>
                    <td style={{ ...s.td(i), ...s.tdMuted, fontSize: "0.78rem" }}>
                      {c.data_start || c.data_expirare
                        ? `${c.data_start ? formatData(c.data_start) : "—"} → ${c.data_expirare ? formatData(c.data_expirare) : "∞"}`
                        : "Oricând"}
                    </td>
                    <td style={s.td(i)}>
                      {c.utilizari_maxime
                        ? <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", fontWeight: 500, color: epuizat ? "#aa2020" : "#0A0E23" }}>
                            {c.utilizari_curente} / {c.utilizari_maxime}
                          </span>
                        : <span style={{ ...s.tdMuted, fontSize: "0.78rem" }}>Nelimitat</span>
                      }
                    </td>
                    <td style={s.td(i)}>
                      <span style={{
                        fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        color: c.activ && !epuizat ? "#0f6e56" : "#888",
                        background: c.activ && !epuizat ? "rgba(29,158,117,0.08)" : "rgba(26,26,46,0.05)",
                        border: `1px solid ${c.activ && !epuizat ? "rgba(29,158,117,0.25)" : "rgba(26,26,46,0.12)"}`,
                        borderRadius: "2px", padding: "2px 8px",
                      }}>{c.activ ? (epuizat ? "Epuizat" : "Activ") : "Inactiv"}</span>
                    </td>
                    <td style={{ ...s.td(i), textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button style={{ ...s.btnMic(c.activ ? "edit" : "confirm"), fontSize: "0.65rem" }}
                          onClick={() => handleToggleCod(c.id_cod)}>
                          {c.activ ? "Dezactivează" : "Activează"}
                        </button>
                        <button style={s.btnMic("del")} onClick={() => handleStergeCod(c.id_cod)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 2. Oferte speciale hoteluri ── */}
      <div>
        <div style={sLabel}>Oferte speciale hoteluri</div>
        <div className="admin-table-card" style={s.tabelCard}>
          <div style={{ ...s.tabelHead, borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={s.tabelTitle}>Gestionare badge "Ofertă specială"</span>
            <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.4)" }}>
              {hoteluri.filter(h => h.oferta_activa).length} active
            </span>
          </div>
          <table style={s.table}>
            <thead>
              <tr>
                {["Hotel", "Oraș", "Stele", "Preț de la", "Ofertă activă"].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hoteluri.length === 0 ? (
                <tr><td colSpan={5} style={{ ...s.td(0), textAlign: "center", color: "rgba(26,26,46,0.35)", padding: "32px" }}>Se încarcă...</td></tr>
              ) : (oferteExpandate ? hoteluri : hoteluri.slice(0, OFERTE_VIZIBILE)).map((h, i) => (
                <tr key={h.id_hotel}>
                  <td style={s.td(i)}>
                    <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", fontWeight: 500, color: "#0A0E23" }}>{h.nume_hotel}</span>
                  </td>
                  <td style={{ ...s.td(i), ...s.tdMuted }}>{h.nume_oras}</td>
                  <td style={s.td(i)}>
                    <span style={{ color: "#C4A050" }}>{"★".repeat(h.stele)}</span>
                  </td>
                  <td style={{ ...s.td(i), ...s.tdMuted }}>
                    {h.pret_minim ? `${Math.round(h.pret_minim).toLocaleString()} RON` : "—"}
                  </td>
                  <td style={s.td(i)}>
                    <button
                      onClick={(e) => handleToggleOferta(e, h.id_hotel)}
                      style={{
                        fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500,
                        letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                        padding: "4px 12px", borderRadius: "2px", border: "1px solid",
                        transition: "all .15s",
                        background: h.oferta_activa ? "rgba(196,160,80,0.12)" : "rgba(26,26,46,0.04)",
                        borderColor: h.oferta_activa ? "rgba(196,160,80,0.5)" : "rgba(26,26,46,0.15)",
                        color: h.oferta_activa ? "#C4A050" : "rgba(26,26,46,0.45)",
                      }}>
                      {h.oferta_activa ? "★ Ofertă activă" : "Fără ofertă"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hoteluri.length > OFERTE_VIZIBILE && (
            <div style={{ borderTop: "1px solid rgba(196,160,80,0.08)", padding: "12px 20px", textAlign: "center" }}>
              <button
                onClick={() => setOferteExpandate(v => !v)}
                style={{
                  fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", fontWeight: 500,
                  letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                  background: "none", border: "1px solid rgba(196,160,80,0.25)",
                  borderRadius: "2px", padding: "7px 20px", color: "#C4A050",
                  transition: "all .2s",
                }}>
                {oferteExpandate
                  ? `▲ Restrânge lista`
                  : `▼ Arată toate hotelurile (${hoteluri.length - OFERTE_VIZIBILE} mai mult)`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Newsletter ── */}
      <div>
        <div style={sLabel}>Trimite newsletter</div>
        <div style={{ ...s.tabelCard, padding: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.05rem", fontWeight: 600, color: "#0A0E23", marginBottom: "4px" }}>
                Email promoțional
              </div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.4)", marginBottom: "18px", lineHeight: 1.5 }}>
                Trimite un email cu oferte speciale către toți utilizatorii care s-au abonat la newsletter.
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={s.label}>Subiect email *</label>
                <input style={s.input("nl_subj")}
                  value={formNewsletter?.subiect || ""}
                  onChange={e => setFormNewsletter(f => ({ ...f, subiect: e.target.value }))}
                  onFocus={() => setFocus("nl_subj")} onBlur={() => setFocus(null)}
                  placeholder="Ex: Oferte speciale de vară 2026" />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={s.label}>Conținut *</label>
                <textarea style={{ ...s.input("nl_body"), minHeight: "120px", resize: "vertical" }}
                  value={formNewsletter?.continut || ""}
                  onChange={e => setFormNewsletter(f => ({ ...f, continut: e.target.value }))}
                  onFocus={() => setFocus("nl_body")} onBlur={() => setFocus(null)}
                  placeholder="Scrie mesajul promoțional aici..." />
              </div>
              <button style={s.btnPrincipal} disabled={newsletterLoading} onClick={handleTrimiteNewsletter}>
                {newsletterLoading ? "Se trimite…" : "✉ Trimite newsletter"}
              </button>
              {newsletterRezultat && (
                <div style={{
                  marginTop: "12px", padding: "10px 14px", borderRadius: "2px",
                  fontFamily: "'Jost',sans-serif", fontSize: "0.82rem",
                  background: newsletterRezultat.ok ? "rgba(30,160,100,0.08)" : "rgba(220,50,50,0.07)",
                  border: `1px solid ${newsletterRezultat.ok ? "rgba(30,160,100,0.25)" : "rgba(220,50,50,0.2)"}`,
                  color: newsletterRezultat.ok ? "#0f6e56" : "#bb2222",
                }}>
                  {newsletterRezultat.ok ? "✓" : "⚠"} {newsletterRezultat.mesaj}
                </div>
              )}
            </div>
            <div style={{ background: "rgba(196,160,80,0.04)", border: "1px solid rgba(196,160,80,0.1)", borderRadius: "4px", padding: "20px" }}>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(26,26,46,0.35)", marginBottom: "10px" }}>
                Abonați newsletter
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "2.4rem", fontWeight: 700, color: "#C4A050" }}>
                {utilizatori.filter ? utilizatori.filter(u => u.email_marketing).length : "—"}
              </div>
              <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.4)", marginTop: "4px" }}>
                utilizatori abonați din {utilizatori.length} total
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Oferte de sezon ── */}
      <div>
        <div style={sLabel}>Oferte de sezon</div>
        <div className="admin-table-card" style={s.tabelCard}>
          <div style={{ ...s.tabelHead, borderRadius: "4px 4px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={s.tabelTitle}>Gestionare oferte sezoniere</span>
            <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.4)" }}>
              {oferteSez.filter(o => o.activa).length} active din {oferteSez.length}
            </span>
          </div>

          {oferteSez.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "rgba(26,26,46,0.35)" }}>
              Se încarcă...
            </div>
          ) : oferteSez.map(o => {
            const SEZ_ICON = { paste: "🐣", craciun: "🎄", revelion: "🎆", vara: "☀️" };
            const SEZ_LABEL = { paste: "Paște", craciun: "Crăciun", revelion: "Revelion", vara: "Vară" };
            const isEdit = editOferta?.id_oferta === o.id_oferta;

            return (
              <div key={o.id_oferta} style={{
                borderBottom: "1px solid rgba(196,160,80,0.08)",
                padding: "18px 20px",
                background: o.activa ? "rgba(196,160,80,0.02)" : "transparent",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                  {/* Icon + color bar */}
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "4px", flexShrink: 0,
                    background: o.culoare + "22", border: `1px solid ${o.culoare}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.4rem",
                  }}>
                    {SEZ_ICON[o.tip] || "⭐"}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1rem", fontWeight: 600, color: "#0A0E23" }}>
                        {o.titlu}
                      </span>
                      <span style={{
                        fontFamily: "'Jost',sans-serif", fontSize: "0.65rem", fontWeight: 500,
                        letterSpacing: "0.1em", textTransform: "uppercase",
                        color: o.culoare, background: o.culoare + "18",
                        border: `1px solid ${o.culoare}40`,
                        borderRadius: "2px", padding: "2px 8px",
                      }}>
                        {SEZ_LABEL[o.tip] || o.tip}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.45)", marginBottom: "8px" }}>
                      {o.descriere}
                    </div>

                    {isEdit ? (
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end", marginTop: "10px" }}>
                        <div>
                          <label style={s.label}>Reducere %</label>
                          <input style={{ ...s.input(null), width: "90px" }}
                            type="number" min="0" max="100"
                            value={editOferta.discount_procent}
                            onChange={e => setEditOferta(f => ({ ...f, discount_procent: e.target.value }))} />
                        </div>
                        <div>
                          <label style={s.label}>Data start</label>
                          <input style={{ ...s.input(null), width: "140px" }}
                            type="date" value={editOferta.data_start?.slice(0,10) || ""}
                            onChange={e => setEditOferta(f => ({ ...f, data_start: e.target.value }))} />
                        </div>
                        <div>
                          <label style={s.label}>Data sfârșit</label>
                          <input style={{ ...s.input(null), width: "140px" }}
                            type="date" value={editOferta.data_sfarsit?.slice(0,10) || ""}
                            onChange={e => setEditOferta(f => ({ ...f, data_sfarsit: e.target.value }))} />
                        </div>
                        <button style={s.btnPrincipal} onClick={() => handleSaveOfertaSez(o.id_oferta, editOferta)}>
                          Salvează
                        </button>
                        <button style={{ ...s.btnSecundar, cursor: "pointer" }} onClick={() => setEditOferta(null)}>
                          Anulează
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "#C4A050", fontWeight: 600 }}>
                          {o.discount_procent}% reducere
                        </span>
                        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", color: "rgba(26,26,46,0.4)" }}>
                          {o.data_start ? new Date(o.data_start).toLocaleDateString("ro-RO", { day: "numeric", month: "short" }) : "—"}
                          {" — "}
                          {o.data_sfarsit ? new Date(o.data_sfarsit).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </span>
                        <button
                          onClick={() => setEditOferta({ ...o })}
                          style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", padding: "4px 12px", borderRadius: "2px", border: "1px solid rgba(196,160,80,0.3)", background: "transparent", color: "#C4A050" }}>
                          Editează
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Toggle buton */}
                  <button
                    onClick={() => handleToggleOfertaSez(o.id_oferta)}
                    style={{
                      flexShrink: 0, fontFamily: "'Jost',sans-serif", fontSize: "0.68rem",
                      fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
                      cursor: "pointer", padding: "6px 14px", borderRadius: "2px", border: "1px solid",
                      transition: "all .15s",
                      background: o.activa ? "rgba(29,158,117,0.1)" : "rgba(26,26,46,0.04)",
                      borderColor: o.activa ? "rgba(29,158,117,0.4)" : "rgba(26,26,46,0.15)",
                      color: o.activa ? "#0f6e56" : "rgba(26,26,46,0.45)",
                    }}>
                    {o.activa ? "✓ Activă" : "— Inactivă"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
  }
