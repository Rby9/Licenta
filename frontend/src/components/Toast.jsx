import { useState, useCallback, useEffect } from "react";

import { ToastContext } from "./ToastContext";

const COLORS = {
  success: { border: "rgba(196,160,80,.5)",  accent: "#C4A050", icon: "✓" },
  error:   { border: "rgba(220,50,50,.5)",   accent: "#ff7070", icon: "⚠" },
  info:    { border: "rgba(100,160,220,.4)", accent: "#88bbee", icon: "◈" },
};

function ToastItem({ id, text, type, onRemove }) {
  const [leaving, setLeaving] = useState(false);
  const c = COLORS[type] || COLORS.success;

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onRemove(id), 320);
  }, [id, onRemove]);

  useEffect(() => {
    const t = setTimeout(dismiss, 4000);
    return () => clearTimeout(t);
  }, [dismiss]);

  return (
    <div onClick={dismiss} style={{
      fontFamily: "'Jost',sans-serif", fontSize: "0.88rem",
      padding: "14px 16px", borderRadius: "4px",
      background: "#0A0E23", border: `1px solid ${c.border}`,
      color: "#fff", boxShadow: "0 10px 36px rgba(0,0,0,.45)",
      display: "flex", alignItems: "center", gap: "12px",
      minWidth: "280px", maxWidth: "380px",
      cursor: "pointer", position: "relative", overflow: "hidden",
      animation: leaving ? "toastOut .32s ease both" : "toastIn .35s ease both",
    }}>
      <span style={{ color: c.accent, fontSize: "1rem", flexShrink: 0 }}>{c.icon}</span>
      <span style={{ flex: 1, lineHeight: 1.5 }}>{text}</span>
      <span style={{ color: "rgba(255,255,255,.25)", fontSize: "0.7rem" }}>✕</span>
      <div style={{
        position: "absolute", bottom: 0, left: 0, height: "2px",
        background: c.border, animation: "toastBar 4s linear both",
      }} />
    </div>
  );
}

function ToastContainer({ toasts, onRemove }) {
  return (
    <div style={{
      position: "fixed", bottom: "28px", right: "28px",
      zIndex: 9999, display: "flex", flexDirection: "column",
      gap: "10px", pointerEvents: "none",
    }}>
      <style>{`
        @keyframes toastIn  { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
        @keyframes toastOut { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(24px); } }
        @keyframes toastBar { from { width:100%; } to { width:0%; } }
      `}</style>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: "all" }}>
          <ToastItem {...t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((text, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, text, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}
