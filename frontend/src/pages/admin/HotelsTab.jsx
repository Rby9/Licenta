import { Fragment, useState } from 'react';
import { defaultHotelFilters, filterAdminHotels, hotelCityOptions } from './hotelFilters';


export default function HotelsTab({
  s,
  setFormHotel,
  setModalHotel,
  setFormOras,
  setModalOras,
  hoteluri,
  expandedHotel,
  handleToggleOferta,
  setExpanded,
  categorii,
  fetchCategorii,
  orase,
  setPozaProfilFisier,
  setPozaProfilPreview,
  setGaleriFisiere,
  setGaleriPreview,
  setModPoza,
  handleStergeHotel,
  setFormCategorie,
  setModalCategorie,
  editingCat,
  editingCatForm,
  setEditingCatForm,
  handleSalveazaCategorieInline,
  setEditingCat,
  handleStergeCategorie,
}) {
  const [filters, setFilters] = useState(defaultHotelFilters);
  const filteredHotels = filterAdminHotels(hoteluri, filters);
  const cities = hotelCityOptions(hoteluri, orase);
  const updateFilter = (key, value) => setFilters(previous => ({ ...previous, [key]: value }));
  return (
    <div>
      <div className="admin-hotel-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <button style={s.btnPrincipal} onClick={() => {
            setFormHotel({ id_oras: "", nume_hotel: "", adresa: "", stele: 3, descriere: "", imagine_url: "", imagine_2: "", imagine_3: "", latitudine: "", longitudine: "" });
            setModPoza("demo"); setPozaProfilFisier(null); setPozaProfilPreview(null);
            setModalHotel("nou");
          }}>+ Adaugă hotel</button>
          <button style={{ ...s.btnPrincipal, background: "transparent", color: "#C4A050", border: "1px solid rgba(196,160,80,0.4)" }}
            onClick={() => { setFormOras({ nume_oras: "" }); setModalOras(true); }}>
            + Adaugă oraș
          </button>
        </div>
        <span role="status" aria-live="polite" style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(26,26,46,0.4)" }}>
          {filteredHotels.length} din {hoteluri.length} hoteluri
        </span>
      </div>

      <div className="admin-hotel-filters" role="search" aria-label="Filtre hoteluri">
        <label className="hotel-search-field">Caută hotel
          <input type="search" value={filters.query} onChange={event => updateFilter('query', event.target.value)}
            placeholder="Nume, adresă sau oraș" />
        </label>
        <label>Oraș
          <select aria-label="Oraș" value={filters.city} onChange={event => updateFilter('city', event.target.value)}>
            <option value="">Toate orașele</option>
            {cities.map(city => <option key={city} value={city}>{city}</option>)}
          </select>
        </label>
        <label>Stele
          <select aria-label="Stele" value={filters.stars} onChange={event => updateFilter('stars', event.target.value)}>
            <option value="">Toate clasificările</option>
            {[1, 2, 3, 4, 5].map(stars => <option key={stars} value={stars}>{stars} {stars === 1 ? 'stea' : 'stele'}</option>)}
          </select>
        </label>
        <label>Ofertă
          <select aria-label="Ofertă" value={filters.offer} onChange={event => updateFilter('offer', event.target.value)}>
            <option value="">Toate hotelurile</option>
            <option value="active">Cu ofertă activă</option>
            <option value="inactive">Fără ofertă activă</option>
          </select>
        </label>
        <label>Sortare
          <select aria-label="Sortare" value={filters.sort} onChange={event => updateFilter('sort', event.target.value)}>
            <option value="default">Ordinea inițială</option>
            <option value="name">Nume A–Z</option>
            <option value="price-asc">Preț crescător</option>
            <option value="price-desc">Preț descrescător</option>
            <option value="stars">Stele descrescător</option>
          </select>
        </label>
        <button type="button" className="hotel-filter-reset" onClick={() => setFilters(defaultHotelFilters)}>Resetează filtrele</button>
      </div>

      <div className="admin-table-card" style={s.tabelCard}>
        <table style={s.table}>
          <thead>
            <tr>
              {["Hotel", "Oraș", "Stele", "Preț minim", "Ofertă", "Categorii", "Acțiuni"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!filteredHotels.length && <tr><td colSpan={7} style={{ ...s.td(0), textAlign: 'center', padding: '32px' }}>
              {hoteluri.length ? 'Niciun hotel nu corespunde filtrelor selectate.' : 'Nu există hoteluri. Adaugă primul hotel.'}
            </td></tr>}
            {filteredHotels.map((h, i) => (
              <Fragment key={h.id_hotel}>
                <tr key={h.id_hotel} style={s.hotelRow(expandedHotel === h.id_hotel)}>
                  <td style={s.td(i)}>
                    <div style={{ fontWeight: 500 }}>{h.nume_hotel}</div>
                    <div style={{ ...s.tdMuted, fontSize: "0.75rem" }}>{h.adresa}</div>
                  </td>
                  <td style={{ ...s.td(i), ...s.tdMuted }}>{h.nume_oras}</td>
                  <td style={s.td(i)}>
                    <span style={{ color: "#C4A050" }}>{"★".repeat(h.stele)}</span>
                  </td>
                  <td style={s.td(i)}>
                    {h.pret_minim ? `${Math.round(h.pret_minim)} RON` : "—"}
                  </td>
                  <td style={s.td(i)}>
                    <button
                      onClick={(e) => handleToggleOferta(e, h.id_hotel)}
                      style={{
                        fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500,
                        letterSpacing: "0.06em", textTransform: "uppercase",
                        padding: "4px 10px", borderRadius: "2px", border: "1px solid", cursor: "pointer",
                        transition: "all .2s",
                        color: h.oferta_activa ? "#0f6e56" : "rgba(26,26,46,0.35)",
                        borderColor: h.oferta_activa ? "rgba(29,158,117,0.4)" : "rgba(26,26,46,0.15)",
                        background: h.oferta_activa ? "rgba(29,158,117,0.08)" : "transparent",
                      }}>
                      {h.oferta_activa ? "★ Activă" : "— Inactivă"}
                    </button>
                  </td>
                  <td style={s.td(i)}>
                    <button style={{ ...s.btnMic("add"), fontSize: "0.68rem" }} onClick={() => {
                      if (expandedHotel === h.id_hotel) { setExpanded(null); return; }
                      setExpanded(h.id_hotel);
                      if (!categorii[h.id_hotel]) fetchCategorii(h.id_hotel);
                    }}>
                      {expandedHotel === h.id_hotel ? "▲ Ascunde" : "▼ Vezi"}
                    </button>
                  </td>
                  <td style={s.td(i)}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button style={s.btnMic("edit")} onClick={() => {
                        setFormHotel({
                          id_oras: h.id_oras || orase.find(o => o.nume_oras === h.nume_oras)?.id_oras || "",
                          nume_hotel: h.nume_hotel, adresa: h.adresa || "",
                          stele: h.stele, descriere: h.descriere || "",
                          imagine_url: h.imagine_url || "",
                          imagine_2: h.imagine_2 || "",
                          imagine_3: h.imagine_3 || "", latitudine: h.latitudine ?? "", longitudine: h.longitudine ?? "",
                        });
                        setPozaProfilFisier(null); setPozaProfilPreview(null); setGaleriFisiere([]); setGaleriPreview([]);
                        setModPoza(h.imagine_url?.startsWith("demo:") || !h.imagine_url ? "demo" : "url");
                        setModalHotel(h);
                      }}>Editează</button>
                      <button style={s.btnMic("del")} onClick={() => handleStergeHotel(h.id_hotel)}>Șterge</button>
                    </div>
                  </td>
                </tr>
                {/* Categorii expandate */}
                {expandedHotel === h.id_hotel && (
                  <tr key={`cat-${h.id_hotel}`}>
                    <td colSpan={7} style={{ padding: "0 16px 16px 32px", background: "rgba(196,160,80,0.03)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 8px" }}>
                        <span style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4A050" }}>
                          Categorii camere
                        </span>
                        <button style={s.btnMic("add")} onClick={() => {
                          setFormCategorie({ denumire: "", capacitate: 2, pret_pe_noapte: "", descriere: "", numar_camere: 1 });
                          setModalCategorie({ id_hotel: h.id_hotel });
                        }}>+ Adaugă categorie</button>
                      </div>
                      {(categorii[h.id_hotel] || []).length === 0 ? (
                        <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(26,26,46,0.35)", padding: "8px 0" }}>
                          Nu există categorii. Adaugă prima categorie.
                        </div>
                      ) : (
                        <table style={{ ...s.table, marginTop: "4px" }}>
                          <thead>
                            <tr>
                              {["Denumire", "Capacitate", "Preț/noapte (RON)", "Descriere", "Acțiuni"].map(col => (
                                <th key={col} style={{ ...s.th, padding: "6px 10px" }}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(categorii[h.id_hotel] || []).map((c, ci) => {
                              const inEdit = editingCat === c.id_categorie;
                              const inp = {
                                fontFamily: "'Jost',sans-serif", fontSize: "0.83rem",
                                color: "#0A0E23", background: "#FDFBF8",
                                border: "1px solid #C4A050", borderRadius: "2px",
                                padding: "4px 8px", outline: "none", width: "100%",
                                boxSizing: "border-box",
                              };
                              return (
                                <tr key={c.id_categorie}>
                                  <td style={{ ...s.td(ci), padding: "6px 10px" }}>
                                    {inEdit
                                      ? <input style={inp} value={editingCatForm.denumire}
                                          onChange={e => setEditingCatForm(f => ({ ...f, denumire: e.target.value }))} />
                                      : <span style={{ fontWeight: 500 }}>{c.denumire}</span>
                                    }
                                  </td>
                                  <td style={{ ...s.td(ci), padding: "6px 10px" }}>
                                    {inEdit
                                      ? <input type="number" style={{ ...inp, width: "70px" }}
                                          value={editingCatForm.capacitate} min={1} max={10}
                                          onChange={e => setEditingCatForm(f => ({ ...f, capacitate: parseInt(e.target.value) }))} />
                                      : <span style={s.tdMuted}>{c.capacitate} pers.</span>
                                    }
                                  </td>
                                  <td style={{ ...s.td(ci), padding: "6px 10px" }}>
                                    {inEdit
                                      ? <input type="number" style={{ ...inp, width: "110px" }}
                                          value={editingCatForm.pret_pe_noapte} min={0} step="0.01"
                                          onChange={e => setEditingCatForm(f => ({ ...f, pret_pe_noapte: e.target.value }))} />
                                      : <span style={{ color: "#C4A050", fontWeight: 600 }}>{Math.round(c.pret_pe_noapte)} RON</span>
                                    }
                                  </td>
                                  <td style={{ ...s.td(ci), padding: "6px 10px" }}>
                                    {inEdit
                                      ? <input style={inp} value={editingCatForm.descriere}
                                          placeholder="Descriere opțională"
                                          onChange={e => setEditingCatForm(f => ({ ...f, descriere: e.target.value }))} />
                                      : <span style={{ ...s.tdMuted, fontSize: "0.78rem" }}>{c.descriere || "—"}</span>
                                    }
                                  </td>
                                  <td style={{ ...s.td(ci), padding: "6px 10px" }}>
                                    <div style={{ display: "flex", gap: "6px" }}>
                                      {inEdit ? (
                                        <>
                                          <button style={s.btnMic("confirm")}
                                            onClick={() => handleSalveazaCategorieInline(c.id_categorie, h.id_hotel)}>
                                            ✓ Salvează
                                          </button>
                                          <button style={s.btnMic("edit")}
                                            onClick={() => setEditingCat(null)}>
                                            Anulează
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button style={s.btnMic("edit")}
                                            onClick={() => {
                                              setEditingCat(c.id_categorie);
                                              setEditingCatForm({
                                                denumire: c.denumire,
                                                capacitate: c.capacitate,
                                                pret_pe_noapte: c.pret_pe_noapte,
                                                descriere: c.descriere || "",
                                              });
                                            }}>
                                            Editează
                                          </button>
                                          <button style={s.btnMic("del")}
                                            onClick={() => handleStergeCategorie(c.id_categorie, h.id_hotel)}>
                                            Șterge
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ); }
