import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Navbar           from "./components/Navbar";
import Home             from "./pages/Home";
import Hoteluri         from "./pages/Hoteluri";
import HotelDetalii     from "./pages/HotelDetalii";
import Autentificare    from "./pages/Autentificare";
import Rezervare        from "./pages/Rezervare";
import RezervareSucces  from "./pages/RezervareSucces";
import RezervareAnulat  from "./pages/RezervareAnulat";
import ProfilUtilizator from "./pages/ProfilUtilizator";
import AdminDashboard   from "./pages/admin/AdminDashboard";
import UitareParola     from "./pages/UitareParola";
import ResetareParola   from "./pages/ResetareParola";
import { ToastProvider } from "./components/Toast";
import Footer    from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import ScrollToTopBtn from "./components/ScrollToTopBtn";

function NotFound() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8F6F1", display: "flex", alignItems: "center", justifyContent: "center", padding: "100px 24px 60px" }}>
      <div style={{ textAlign: "center", maxWidth: "480px" }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(6rem,15vw,10rem)", fontWeight: 700, lineHeight: 1, background: "linear-gradient(135deg,#C4A050,#F0D080)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "8px" }}>
          404
        </div>
        <div style={{ width: "48px", height: "2px", background: "linear-gradient(90deg,#C4A050,#F0D080)", margin: "0 auto 24px", borderRadius: "1px" }} />
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.8rem", fontWeight: 600, color: "#0A0E23", marginBottom: "12px" }}>
          Pagina nu a fost găsită
        </h2>
        <p style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.88rem", color: "rgba(26,26,46,0.5)", lineHeight: 1.7, marginBottom: "36px" }}>
          Pagina pe care o cauți nu există sau a fost mutată.<br />Întoarce-te la pagina principală și continuă explorarea.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/" style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0A0E23", background: "linear-gradient(135deg,#C4A050,#A8883C)", padding: "12px 28px", borderRadius: "2px", textDecoration: "none" }}>
            Acasă
          </a>
          <a href="/hoteluri" style={{ fontFamily: "'Jost',sans-serif", fontSize: "0.8rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0A0E23", border: "1px solid rgba(196,160,80,0.4)", padding: "12px 28px", borderRadius: "2px", textDecoration: "none" }}>
            Hoteluri
          </a>
        </div>
      </div>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} style={{ animation: "pageFade 0.18s ease" }}>
      <Routes>
        <Route path="/"              element={<Home />} />
        <Route path="/hoteluri"      element={<Hoteluri />} />
        <Route path="/hoteluri/:id"  element={<HotelDetalii />} />
        <Route path="/autentificare" element={<Autentificare />} />
        <Route path="/rezervare"          element={<Rezervare />} />
        <Route path="/rezervare/succes"   element={<RezervareSucces />} />
        <Route path="/rezervare/anulat"   element={<RezervareAnulat />} />
        <Route path="/profil"           element={<ProfilUtilizator />} />
        <Route path="/rezervarile-mele" element={<ProfilUtilizator />} />
        <Route path="/admin"           element={<AdminDashboard />} />
        <Route path="/uitare-parola"  element={<UitareParola />} />
        <Route path="/resetare-parola" element={<ResetareParola />} />
        <Route path="*"              element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <style>{`@keyframes pageFade { from { opacity:0; } to { opacity:1; } }`}</style>
        <ScrollToTop />
        <ScrollToTopBtn />
        <Navbar />
        <AnimatedRoutes />
        <Footer />
      </ToastProvider>
    </BrowserRouter>
  );
}
