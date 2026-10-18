import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";

import { API_URL } from "../api";

const formatData = (str) => {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("ro-RO", {
    day: "numeric", month: "long", year: "numeric",
  });
};

export default function Rezervare() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const categorieId  = searchParams.get("categorie_id");
  const checkinURL   = searchParams.get("checkin");
  const checkoutURL  = searchParams.get("checkout");
  const hotelId      = searchParams.get("hotel_id");

  const [hotel, setHotel]         = useState(null);
  const [categorie, setCategorie] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [loadingPlata, setLoadingPlata] = useState(false);
  const [eroare, setEroare]       = useState("");
  const [politicaAcceptata, setPolitica] = useState(false);
  const [codInput, setCodInput]   = useState("");
  const [codValidat, setCodValidat] = useState(null);
  const [loadingCod, setLoadingCod] = useState(false);
  const [metodaPlata, setMetodaPlata] = useState("online_total");

  // Date editabile direct pe pagina de rezervare
  const [checkin, setCheckin]   = useState(checkinURL || "");
  const [checkout, setCheckout] = useState(checkoutURL || "");

  const token = localStorage.getItem("token");
  const utilizator = (() => {
    try {
      const val = localStorage.getItem("utilizator");
      if (!val || val === "undefined") return null;
      return JSON.parse(val);
    } catch { return null; }
  })();

  useEffect(() => {
    if (!utilizator || !token) {
      sessionStorage.setItem("returnTo", window.location.href);
      navigate("/autentificare");
    }
  }, []);

  useEffect(() => {
    if (!hotelId || !categorieId) return;
    const fetchDate = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/hoteluri/${hotelId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setHotel(data);
        const cat = data.categorii_camere?.find(c => String(c.id_categorie) === String(categorieId));
        setCategorie(cat);
      } catch {
        setEroare("Nu s-au putut încărca datele hotelului.");
      } finally {
        setLoading(false);
      }
    };
    fetchDate();
  }, [hotelId, categorieId]);

  const nopti = (() => {
    if (!checkin || !checkout) return 0;
    const d1 = new Date(checkin);
    const d2 = new Date(checkout);
    return Math.max(0, Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
  })();

  const pretBaza   = categorie ? Math.round(categorie.pret_pe_noapte * nopti) : 0;
  const reducere   = codValidat ? Math.round(pretBaza * codValidat.procent_reducere / 100) : 0;
  const pretTotal  = pretBaza - reducere;
  const sumaAvans  = Math.round(pretTotal * 0.30);
  const comision   = Math.round(pretTotal * 0.10);
  const sumHotel   = pretTotal - comision;

  const valideazaCod = async () => {
    if (!codInput.trim()) return;
    if (!checkin) {
      setEroare("Selectează mai întâi data de check-in pentru a valida codul.");
      return;
    }
    try {
      setLoadingCod(true);
      const params = new URLSearchParams({ cod: codInput, checkin });
      const res = await fetch(
        `${API_URL}/api/coduri/valideaza?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const d = await res.json();
        setEroare(d.eroare || "Cod invalid.");
        setCodValidat(null);
        return;
      }
      const data = await res.json();
      setCodValidat(data);
      setEroare("");
    } catch {
      setEroare("Eroare la validarea codului.");
    } finally {
      setLoadingCod(false);
    }
  };

  const handlePlata = async () => {
    if (!politicaAcceptata) {
      setEroare("Trebuie să accepți politica de anulare pentru a continua.");
      return;
    }
    if (!checkin || !checkout) {
      setEroare("Selectează datele de check-in și check-out.");
      return;
    }
    if (nopti <= 0) {
      setEroare("Data de check-out trebuie să fie după check-in.");
      return;
    }
    try {
      setLoadingPlata(true);
      setEroare("");

      const camRes = await fetch(
        `${API_URL}/api/camere/disponibila?categorie_id=${categorieId}&checkin=${checkin}&checkout=${checkout}`
      );
      if (!camRes.ok) {
        const d = await camRes.json();
        throw new Error(d.eroare || "Nu există camere disponibile.");
      }
      const { id_camera } = await camRes.json();

      const sesRes = await fetch(`${API_URL}/api/plati/creare-sesiune`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          id_camera, data_checkin: checkin, data_checkout: checkout,
          pret_total: pretTotal, nume_hotel: hotel?.nume_hotel,
          tip_camera: categorie?.denumire, nopti,
          id_cod: codValidat?.id_cod || null,
          metoda_plata: metodaPlata,
          suma_avans: metodaPlata === "avans_online" ? sumaAvans : null,
        }),
      });
      if (!sesRes.ok) { const d = await sesRes.json(); throw new Error(d.eroare || "Eroare la inițierea plății."); }
      const { url } = await sesRes.json();
      window.location.href = url;
    } catch (err) {
      setEroare(err.message || "Eroare la procesarea plății.");
    } finally {
      setLoadingPlata(false);
    }
  };

  const steps = [
    { nr: "1", label: "Date & Client", active: true },
    { nr: "2", label: "Plată Stripe", active: false },
    { nr: "3", label: "Confirmare", active: false },
  ];

  const s = {
    page: { minHeight: "100vh", background: "#F8F6F1", paddingTop: "80px" },
    hero: { background: "#0A0E23", padding: "40px 48px 36px", borderBottom: "1px solid rgba(196,160,80,0.15)" },
    heroInner: { maxWidth: "900px", margin: "0 auto" },
    breadcrumb: { fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" },
    heroTitle: { fontFamily: "'Cormorant Garamond',serif", fontSize: "2rem", fontWeight: 700, color: "#fff" },
    layout: { maxWidth: "900px", margin: "0 auto", padding: "40px 48px", display: "grid", gridTemplateColumns: "1fr 380px", gap: "32px" },
    card: { background: "#fff", borderRadius: "4px", border: "1px solid rgba(196,160,80,0.15)", boxShadow: "0 4px 20px rgba(10,14,35,0.06)", overflow: "hidden", marginBottom: "20px" },
    cardHead: { background: "#0A0E23", padding: "16px 20px", fontFamily: "'Cormorant Garamond',serif", fontSize: "1.1rem", fontWeight: 600, color: "#fff" },
    cardBody: { padding: "20px" },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(196,160,80,0.08)", fontFamily: "'Jost',sans-serif" },
    rowLabel: { fontSize: "0.82rem", color: "rgba(26,26,46,0.5)" },
    rowValue: { fontSize: "0.88rem", fontWeight: 500, color: "#0A0E23" },
    totalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 0", fontFamily: "'Jost',sans-serif" },
    totalLabel: { fontSize: "0.85rem", fontWeight: 500, color: "#0A0E23" },
    totalValue: { fontSize: "1.4rem", fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", color: "#C4A050" },
    sectionTitle: { fontFamily: "'Cormorant Garamond',serif", fontSize: "1.3rem", fontWeight: 600, color: "#0A0E23", marginBottom: "6px" },
    sectionLine: { height: "2px", background: "linear-gradient(90deg,#C4A050,transparent)", width: "40px", marginBottom: "20px" },
    politicaBox: { background: "rgba(196,160,80,0.05)", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "4px", padding: "16px", marginBottom: "20px" },
    politicaTitle: { fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C4A050", marginBottom: "10px" },
    politicaText: { fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", color: "rgba(26,26,46,0.6)", lineHeight: 1.7, marginBottom: "8px" },
    checkboxRow: { display: "flex", alignItems: "flex-start", gap: "10px", fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", color: "rgba(26,26,46,0.7)", cursor: "pointer" },
    stripeInfo: { background: "rgba(99,91,255,0.04)", border: "1px solid rgba(99,91,255,0.15)", borderRadius: "4px", padding: "14px 16px", fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", color: "rgba(26,26,46,0.55)", marginBottom: "20px", display: "flex", alignItems: "flex-start", gap: "10px" },
    btnPlata: { width: "100%", padding: "14px", fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0A0E23", background: loadingPlata ? "rgba(196,160,80,0.5)" : "linear-gradient(135deg,#C4A050,#A8883C)", border: "none", borderRadius: "2px", cursor: loadingPlata ? "not-allowed" : "pointer", transition: "all .2s", marginBottom: "12px" },
    comisionBox: { fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", color: "rgba(26,26,46,0.4)", textAlign: "center", lineHeight: 1.6 },
    eroare: { fontFamily: "'Jost',sans-serif", fontSize: "0.83rem", color: "#cc2200", background: "rgba(255,80,80,0.07)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: "2px", padding: "10px 14px", marginBottom: "16px" },
  };

  if (loading) return (
    <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Jost',sans-serif", color: "rgba(26,26,46,0.4)" }}>Se încarcă...</div>
    </div>
  );

  if (!hotel || !categorie) return (
    <div style={{ ...s.page, textAlign: "center", paddingTop: "120px" }}>
      <div style={{ fontFamily: "'Jost',sans-serif", color: "#888" }}>
        Date lipsă. <Link to="/hoteluri" style={{ color: "#C4A050" }}>Înapoi la hoteluri</Link>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div style={s.heroInner}>
          <div style={s.breadcrumb}>
            <Link to="/" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Acasă</Link>
            <span>›</span>
            <Link to="/hoteluri" style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Hoteluri</Link>
            <span>›</span>
            <Link to={`/hoteluri/${hotelId}`} style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>{hotel.nume_hotel}</Link>
            <span>›</span>
            <span style={{ color: "rgba(255,255,255,0.6)" }}>Rezervare</span>
          </div>
          <h1 style={s.heroTitle}>Finalizează rezervarea</h1>

          {/* Stepper */}
          <div style={{ display: "flex", alignItems: "center", marginTop: "28px" }}>
            {steps.map((step, i) => (
              <div key={step.nr} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", fontWeight: 600,
                    background: step.active ? "linear-gradient(135deg,#C4A050,#A8883C)" : "rgba(255,255,255,0.08)",
                    color: step.active ? "#0A0E23" : "rgba(255,255,255,0.25)",
                    border: step.active ? "none" : "1px solid rgba(255,255,255,0.12)",
                    transition: "all .3s",
                  }}>{step.nr}</div>
                  <span style={{
                    fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", letterSpacing: "0.08em",
                    color: step.active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
                    fontWeight: step.active ? 500 : 400, whiteSpace: "nowrap",
                  }}>{step.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)", margin: "0 18px" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={s.layout}>
        <div>
          <div style={s.sectionTitle}>Date sejur</div>
          <div style={s.sectionLine} />

          <div style={s.card}>
            <div style={s.cardHead}>Date client</div>
            <div style={s.cardBody}>
              <div style={s.row}>
                <span style={s.rowLabel}>Nume</span>
                <span style={s.rowValue}>{utilizator?.nume_complet}</span>
              </div>
              <div style={{ ...s.row, borderBottom: "none" }}>
                <span style={s.rowLabel}>Email</span>
                <span style={s.rowValue}>{utilizator?.email}</span>
              </div>
            </div>
          </div>

          {/* Selectare date */}
          <div style={{ ...s.card, marginTop: "20px" }}>
            <div style={s.cardHead}>Perioada sejurului</div>
            <div style={s.cardBody}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "12px" }}>
                <div>
                  <label style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C4A050", display: "block", marginBottom: "6px" }}>Check-in</label>
                  <input type="date" value={checkin}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={e => { setCheckin(e.target.value); setCodValidat(null); setCodInput(""); }}
                    style={{ width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "#0A0E23", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px", padding: "9px 12px", outline: "none", background: "#FDFBF8", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C4A050", display: "block", marginBottom: "6px" }}>Check-out</label>
                  <input type="date" value={checkout}
                    min={checkin || new Date().toISOString().split("T")[0]}
                    onChange={e => setCheckout(e.target.value)}
                    style={{ width: "100%", fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "#0A0E23", border: "1px solid rgba(196,160,80,0.2)", borderRadius: "2px", padding: "9px 12px", outline: "none", background: "#FDFBF8", boxSizing: "border-box" }} />
                </div>
              </div>
              {nopti > 0 && (
                <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", color: "#0f6e56", background: "rgba(29,158,117,0.08)", border: "1px solid rgba(29,158,117,0.2)", borderRadius: "2px", padding: "8px 12px" }}>
                  ✓ {nopti} {nopti === 1 ? "noapte" : "nopți"} selectate — Total: {pretTotal.toLocaleString()} RON
                </div>
              )}
            </div>
          </div>

          {/* ── Cod promoțional ── */}
          <div style={{ ...s.card, marginTop: "20px" }}>
            <div style={s.cardHead}>Cod promoțional</div>
            <div style={s.cardBody}>
              {codValidat ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.85rem", color: "#0f6e56", fontWeight: 500 }}>
                      ✓ Cod <strong>{codValidat.cod}</strong> aplicat — reducere {codValidat.procent_reducere}%
                    </div>
                    {codValidat.descriere && (
                      <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.75rem", color: "rgba(26,26,46,0.45)", marginTop: "2px" }}>
                        {codValidat.descriere}
                      </div>
                    )}
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.82rem", color: "#C4A050", marginTop: "4px" }}>
                      Economisești {reducere.toLocaleString()} RON
                    </div>
                  </div>
                  <button onClick={() => { setCodValidat(null); setCodInput(""); }}
                    style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", color: "#cc2200", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    Elimină
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    value={codInput}
                    onChange={e => setCodInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && valideazaCod()}
                    placeholder="Ex: VARA2025"
                    style={{ flex: 1, fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "#0A0E23", border: "1px solid rgba(196,160,80,0.25)", borderRadius: "2px", padding: "9px 12px", outline: "none", background: "#FDFBF8", textTransform: "uppercase", letterSpacing: "0.05em" }}
                  />
                  <button onClick={valideazaCod} disabled={loadingCod || !codInput.trim()}
                    style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", padding: "9px 18px", borderRadius: "2px", border: "none", cursor: codInput.trim() ? "pointer" : "not-allowed", background: codInput.trim() ? "linear-gradient(135deg,#C4A050,#A8883C)" : "rgba(196,160,80,0.3)", color: "#0A0E23", transition: "all .2s" }}>
                    {loadingCod ? "..." : "Aplică"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Metodă de plată ── */}
          <div style={{ ...s.card, marginTop: "20px" }}>
            <div style={s.cardHead}>Metodă de plată</div>
            <div style={s.cardBody}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {[
                  {
                    id: "online_total",
                    titlu: "Plată integrală online",
                    desc: <>Achită <strong>{nopti > 0 ? pretTotal.toLocaleString() : "—"} RON</strong> acum prin Stripe.<br />Nicio plată suplimentară la hotel.</>,
                  },
                  {
                    id: "avans_online",
                    titlu: "Avans 30% + rest la cazare",
                    desc: nopti > 0 ? <>Plătești acum <strong>{sumaAvans.toLocaleString()} RON</strong> (30%).<br />Rest de <strong>{(pretTotal - sumaAvans).toLocaleString()} RON</strong> la hotel.</> : "Selectează datele pentru calcul.",
                  },
                ].map(opt => (
                  <div key={opt.id} onClick={() => setMetodaPlata(opt.id)} style={{
                    border: `2px solid ${metodaPlata === opt.id ? "#C4A050" : "rgba(196,160,80,0.2)"}`,
                    borderRadius: "4px", padding: "14px", cursor: "pointer",
                    background: metodaPlata === opt.id ? "rgba(196,160,80,0.06)" : "#FDFBF8",
                    transition: "all .2s",
                  }}>
                    <div style={{
                      fontFamily: "'Jost',sans-serif", fontSize: "0.72rem", fontWeight: 600,
                      letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px",
                      color: metodaPlata === opt.id ? "#C4A050" : "#0A0E23",
                    }}>
                      {metodaPlata === opt.id && "✓ "}{opt.titlu}
                    </div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.78rem", color: "rgba(26,26,46,0.5)", lineHeight: 1.55 }}>
                      {opt.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ height: "20px" }} />

          <div style={s.politicaBox}>
            <div style={s.politicaTitle}>📋 Politică de anulare</div>
            <div style={s.politicaText}>✓ <strong>Anulare gratuită</strong> — cu mai mult de 48h înainte de check-in, rambursare 100%</div>
            <div style={s.politicaText}>⚠ <strong>Anulare parțială</strong> — între 24h și 48h înainte, rambursare 80%</div>
            <div style={s.politicaText}>✗ <strong>Fără rambursare</strong> — mai puțin de 24h înainte de check-in</div>
            <div style={{ height: "12px" }} />
            <label style={s.checkboxRow}>
              <input type="checkbox" checked={politicaAcceptata}
                onChange={e => setPolitica(e.target.checked)}
                style={{ marginTop: "2px", accentColor: "#C4A050" }} />
              Am citit și accept politica de anulare și condițiile de rezervare HoteluriRo
            </label>
          </div>

          <div style={s.stripeInfo}>
            <span style={{ fontSize: "1.2rem" }}>🔒</span>
            <div>
              <strong style={{ color: "#0A0E23" }}>Plată securizată prin Stripe</strong><br />
              Datele cardului sunt procesate direct de Stripe. HoteluriRo nu stochează informații despre cardul tău.<br />
              <span style={{ color: "#C4A050", fontStyle: "italic" }}>
                Test: card 4242 4242 4242 4242, orice dată și orice CVV.
              </span>
            </div>
          </div>

          {eroare && <div style={s.eroare}>⚠ {eroare}</div>}

          <button style={s.btnPlata} onClick={handlePlata} disabled={loadingPlata}>
            {loadingPlata ? "Se procesează..." :
              metodaPlata === "avans_online"
                ? `Plătește avans ${sumaAvans.toLocaleString()} RON`
                : `Plătește ${pretTotal.toLocaleString()} RON`}
          </button>

          <div style={s.comisionBox}>
            {codValidat && <><strong style={{ color: "#C4A050" }}>Reducere {codValidat.procent_reducere}% aplicată</strong> — ai economisit {reducere.toLocaleString()} RON.<br /></>}
            {metodaPlata === "avans_online"
              ? <>Acum plătești avansul de <strong>{sumaAvans.toLocaleString()} RON</strong>. Restul de {(pretTotal - sumaAvans).toLocaleString()} RON se achită la hotel.<br /></>
              : null}
            HoteluriRo aplică un comision de 10% ({comision} RON). Suma de {sumHotel} RON va fi decontată hotelului.
          </div>
        </div>

        <div>
          <div style={s.sectionTitle}>Sumar rezervare</div>
          <div style={s.sectionLine} />
          <div style={s.card}>
            {/* Imagine hotel */}
            <div style={{ height: "180px", overflow: "hidden", position: "relative" }}>
              <img
                src={hotel.imagine_url || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80"}
                alt={hotel.nume_hotel}
                onError={e => { e.target.src = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80"; }}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform .4s ease" }}
              />
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to top, rgba(10,14,35,0.7) 0%, transparent 60%)",
              }} />
              <div style={{
                position: "absolute", bottom: "12px", left: "14px",
                fontFamily: "'Cormorant Garamond',serif", fontSize: "1.15rem",
                fontWeight: 700, color: "#fff",
              }}>{hotel.nume_hotel}</div>
              <div style={{
                position: "absolute", bottom: "12px", right: "14px",
                fontFamily: "'Jost',sans-serif", fontSize: "0.72rem",
                color: "#C4A050", letterSpacing: "0.1em",
              }}>{"★".repeat(hotel.stele)}</div>
            </div>

            <div style={s.cardBody}>
              <div style={s.row}><span style={s.rowLabel}>Tip cameră</span><span style={s.rowValue}>{categorie.denumire}</span></div>
              <div style={s.row}><span style={s.rowLabel}>Check-in</span><span style={s.rowValue}>{checkin ? formatData(checkin) : "—"}</span></div>
              <div style={s.row}><span style={s.rowLabel}>Check-out</span><span style={s.rowValue}>{checkout ? formatData(checkout) : "—"}</span></div>
              <div style={s.row}><span style={s.rowLabel}>Nopți</span><span style={s.rowValue}>{nopti} {nopti === 1 ? "noapte" : "nopți"}</span></div>
              <div style={s.row}><span style={s.rowLabel}>Capacitate</span><span style={s.rowValue}>până la {categorie.capacitate} persoane</span></div>
              <div style={s.row}><span style={s.rowLabel}>Preț / noapte</span><span style={s.rowValue}>{Math.round(categorie.pret_pe_noapte)} RON</span></div>
              <div style={s.row}><span style={s.rowLabel}>Subtotal</span><span style={s.rowValue}>{pretBaza.toLocaleString()} RON</span></div>
              {codValidat && (
                <div style={s.row}>
                  <span style={{ ...s.rowLabel, color: "#0f6e56" }}>Reducere {codValidat.procent_reducere}%</span>
                  <span style={{ ...s.rowValue, color: "#0f6e56" }}>− {reducere.toLocaleString()} RON</span>
                </div>
              )}
              <div style={{ ...s.row, borderBottom: "none" }}><span style={s.rowLabel}>TVA (19%)</span><span style={s.rowValue}>{Math.round(pretTotal * 0.19)} RON</span></div>
              <div style={s.totalRow}>
                <span style={s.totalLabel}>TOTAL DE PLATĂ</span>
                <span style={s.totalValue}>{pretTotal.toLocaleString()} RON</span>
              </div>
              {metodaPlata === "avans_online" && nopti > 0 && (
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(196,160,80,0.15)" }}>
                  <div style={{ ...s.row, borderBottom: "none", padding: "4px 0" }}>
                    <span style={{ ...s.rowLabel, color: "#0f6e56" }}>Avans online (30%)</span>
                    <span style={{ ...s.rowValue, color: "#0f6e56", fontWeight: 700 }}>{sumaAvans.toLocaleString()} RON</span>
                  </div>
                  <div style={{ ...s.row, borderBottom: "none", padding: "4px 0" }}>
                    <span style={{ ...s.rowLabel, color: "#C4A050" }}>Rest la cazare (70%)</span>
                    <span style={{ ...s.rowValue, color: "#C4A050" }}>{(pretTotal - sumaAvans).toLocaleString()} RON</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{
            fontFamily: "'Jost',sans-serif", fontSize: "0.78rem",
            color: "rgba(26,26,46,0.4)", display: "flex", alignItems: "center",
            gap: "6px", marginTop: "10px",
          }}>
            <span style={{ color: "#C4A050" }}>{"★".repeat(hotel.stele)}</span>
            <span>{hotel.stele} stele · 📍 {hotel.nume_oras}</span>
          </div>
        </div>
      </div>
    </div>
  );
}