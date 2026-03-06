import { useState, useEffect, useRef, useContext, createContext, useCallback } from "react";

// ============================================================
// DEVTOOLS & ANTI-CHEAT PROTECTION (runs immediately)
// ============================================================
(function() {
  const isExam = () => document.body && document.body.getAttribute("data-exam-active") === "true";

  // 1. Block F12 / Ctrl+Shift+I / Ctrl+U / Cmd+Option+I
  document.addEventListener("keydown", function(e) {
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;
    if (
      k === "F12" ||
      (ctrl && shift && (k === "I" || k === "i" || k === "J" || k === "j" || k === "C" || k === "c" || k === "K" || k === "k")) ||
      (ctrl && (k === "u" || k === "U")) ||
      (ctrl && alt && (k === "I" || k === "i" || k === "J" || k === "j" || k === "C" || k === "c"))
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  // 2. Block right-click context menu always
  document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
    return false;
  }, true);

  // 3. Block copy/cut during exam
  document.addEventListener("copy", function(e) {
    if (isExam()) {
      e.preventDefault();
      if (e.clipboardData) e.clipboardData.setData("text/plain", "");
    }
  }, true);
  document.addEventListener("cut", function(e) {
    if (isExam()) { e.preventDefault(); }
  }, true);

  // 4. Window size devtools detection (devtools panel opens = size changes)
  var _dtOpen = false;
  setInterval(function() {
    var w = window.outerWidth - window.innerWidth;
    var h = window.outerHeight - window.innerHeight;
    var open = w > 160 || h > 160;
    if (open && !_dtOpen && isExam()) {
      _dtOpen = true;
      document.dispatchEvent(new CustomEvent("mm-devtools-detected"));
    }
    if (!open) _dtOpen = false;
  }, 1000);

  // 5. Debugger timing detection — only fires if DevTools open AND breakpoints active
  setInterval(function() {
    if (!isExam()) return;
    var t = +new Date();
    (function() {})["constructor"]("debugger")();
    if ((+new Date() - t) > 200) {
      document.dispatchEvent(new CustomEvent("mm-devtools-detected"));
    }
  }, 3000);

  // 6. Override console to prevent answer extraction via console
  var noop = function() {};
  var consoleMethods = ["log","warn","error","info","table","dir","debug","trace","group","groupEnd","dirxml","count","time","timeEnd","profile","profileEnd","assert"];
  consoleMethods.forEach(function(m) {
    try {
      Object.defineProperty(console, m, { get: function() { return noop; }, configurable: false });
    } catch(e) {}
  });

  // 7. Firebug / legacy devtools detection
  var fb = window.console;
  if (fb && fb.firebug) {
    document.dispatchEvent(new CustomEvent("mm-devtools-detected"));
  }

})();


// ============================================================
// CONTEXTS
// ============================================================
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const ThemeContext = createContext("dark");
const useTheme = () => useContext(ThemeContext);

// Light mode uses slightly darkened accents for eye comfort
const T = {
  // Backgrounds
  examBg:   (d) => d ? "#080a14"   : "#eef0f5",
  cardBg:   (d) => d ? "rgba(255,255,255,0.05)" : "#ffffff",
  sidebarBg:(d) => d ? "rgba(0,0,0,0.3)"        : "#e8eaf0",
  topbarBg: (d) => d ? "rgba(8,10,20,0.98)"      : "rgba(240,242,248,0.98)",
  inputBg:  (d) => d ? "rgba(255,255,255,0.06)"  : "rgba(0,0,0,0.06)",
  // Text
  primary:  (d) => d ? "#ffffff" : "#111111",
  secondary:(d) => d ? "#aaaaaa" : "#444444",
  muted:    (d) => d ? "#555555" : "#777777",
  // Accents — slightly darker in light mode for eye comfort
  gold:     (d) => d ? "#FFD700" : "#b8860b",   // dark gold
  green:    (d) => d ? "#4ade80" : "#15803d",   // dark green
  red:      (d) => d ? "#ff6b6b" : "#b91c1c",   // dark red
  orange:   (d) => d ? "#fb923c" : "#c2410c",   // dark orange
  purple:   (d) => d ? "#818cf8" : "#4338ca",   // dark indigo
  // Option states in exam
  optDefault:   (d) => d ? {bg:"rgba(255,255,255,0.04)",   border:"rgba(255,255,255,0.1)",  text:"#aaa"}
                         : {bg:"rgba(0,0,0,0.04)",          border:"rgba(0,0,0,0.15)",       text:"#444"},
  optSelected:  (d) => d ? {bg:"rgba(99,102,241,0.18)",    border:"rgba(99,102,241,0.6)",   text:"#818cf8"}
                         : {bg:"rgba(67,56,202,0.1)",       border:"rgba(67,56,202,0.5)",    text:"#3730a3"},
  optCorrect:   (d) => d ? {bg:"rgba(74,222,128,0.14)",    border:"rgba(74,222,128,0.5)",   text:"#4ade80"}
                         : {bg:"rgba(21,128,61,0.1)",       border:"rgba(21,128,61,0.5)",    text:"#15803d"},
  optWrong:     (d) => d ? {bg:"rgba(255,100,100,0.12)",   border:"rgba(255,100,100,0.5)",  text:"#ff6b6b"}
                         : {bg:"rgba(185,28,28,0.08)",      border:"rgba(185,28,28,0.4)",    text:"#b91c1c"},
};

// ============================================================
// SUPABASE CONFIG (replace with real values)
// ============================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";

// PASTE THIS ENTIRE NEW BLOCK:
async function supabaseRequest(endpoint, options = {}) {
  // 1. Always try to grab the absolute freshest token from storage first
  let activeToken = options.token || SUPABASE_ANON_KEY;
  try {
    const sessionStr = sessionStorage.getItem("mm_session");
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      if (session.access_token) activeToken = session.access_token;
    }
  } catch (e) {}

  // Helper to make the actual fetch call
  const makeFetch = (token) => fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...options.headers,
    },
    method: options.method || "GET",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // 2. Make the initial request
  let res = await makeFetch(activeToken);

  // 3. SILENT REFRESH: If it fails due to an expired JWT (401 Unauthorized), intercept it!
  if (res.status === 401 || res.status === 403) {
    try {
      const sessionStr = sessionStorage.getItem("mm_session");
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session.refresh_token) {
          // Ask Supabase for a new token
          const refreshRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: "POST",
            headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: session.refresh_token }),
          });
          
          const refreshed = await refreshRes.json();
          if (refreshed.access_token) {
            // Success! Save the new tokens to local storage immediately
            sessionStorage.setItem("mm_session", JSON.stringify({
               ...session, 
               access_token: refreshed.access_token, 
               refresh_token: refreshed.refresh_token || session.refresh_token 
            }));
            
            // Sync the user object token as well
            // Update sessionStorage user token
            try {
              const s2 = sessionStorage.getItem("mm_session");
              if (s2) {
                const parsed = JSON.parse(s2);
                if (parsed.user) {
                  parsed.user.token = refreshed.access_token;
                  sessionStorage.setItem("mm_session", JSON.stringify(parsed));
                }
              }
            } catch {}

            // 4. Retry the exact same request they originally made, but with the new key
            res = await makeFetch(refreshed.access_token);
          }
        }
      }
    } catch(e) {
      // If the silent refresh completely fails, let the error fall through normally
    }
  }

  // Handle standard errors
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.hint || err.details || `HTTP ${res.status}`);
  }
  // 204 No Content (DELETE/PATCH with return=minimal) — return null, not error
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

async function supabaseAuth(action, payload) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${action}`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
  throw new Error(data.error_description || data.msg || data.message || "Auth failed");
}
  return data;
}

// PASTE THIS RIGHT BELOW supabaseAuth:
async function supabaseUpload(bucket, path, file, token) {
  // Try POST first; if file exists (409) use PUT to upsert
  const upload = async (method) => fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method,
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${token}`,
      "Content-Type": file.type,
      "x-upsert": "true",
      "Cache-Control": "3600",
    },
    body: file
  });
  let res = await upload("POST");
  if (res.status === 409) res = await upload("PUT"); // file exists — overwrite
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Upload failed (${res.status})`);
  }
  // Return cache-busted public URL to ensure fresh load
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  return publicUrl;
}

// ============================================================
// LOGO DATA (dynamic, easily extendable)
// ============================================================
const LOGOS_CONFIG = [
  { id: 1, name: "Indian Army", file: "indianarmy.webp", bg: "#cc0000" },
  { id: 2, name: "Indian Navy", file: "indiannavy.webp", bg: "#1a3a6b" },
  { id: 3, name: "Indian Air Force", file: "iaf.webp", bg: "#87CEEB" },
  { id: 4, name: "Indian Coast Guard", file: "ICG.webp", bg: "#1a3a6b" },
  { id: 5, name: "BSF", file: "bsf.webp", bg: "#ffffff" },
  { id: 6, name: "CISF", file: "cisf.webp", bg: "#ffffff" },
  { id: 7, name: "CRPF", file: "crpf.webp", bg: "#ffffff" },
  { id: 8, name: "ITBP", file: "itbp.webp", bg: "#000000" },
  { id: 9, name: "Odisha Police", file: "odishapolice.webp", bg: "#0033a0" },
  { id: 10, name: "Odisha Govt", file: "odishashashan.webp", bg: "#ffffff" },
];

// ============================================================
// UTILITY HOOKS
// ============================================================
function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initial; }
    catch { return initial; }
  });
  const set = useCallback((v) => {
    setVal(v);
    localStorage.setItem(key, JSON.stringify(v));
  }, [key]);
  return [val, set];
}

// ============================================================
// COMPONENTS
// ============================================================

// NAVBAR
function Navbar({ page, setPage, user, onLogout, dark, setDark }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: dark ? "rgba(8,10,20,0.97)" : "rgba(255,255,255,0.97)",
      backdropFilter: "blur(12px)",
      borderBottom: dark ? "1px solid rgba(255,215,0,0.15)" : "1px solid rgba(0,0,0,0.08)",
      padding: "0 1rem", height: "60px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      transition: "background 0.3s, border-color 0.3s"
    }}>
      <div
        onClick={() => setPage("home")}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: "8px",
          background: "linear-gradient(135deg, #FFD700, #FF6B00)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: "16px", color: "#000"
        }}>M</div>
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "18px", color: dark ? "#FFD700" : "#C47A00", letterSpacing: "-0.5px" }}>
          Merit<span style={{ color: dark ? "#fff" : "#111" }}>Matrix</span>
        </span>
      </div>

      {/* Desktop Nav */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }} className="desktop-nav">
        {[["home","Home"],["exams","Exams"],["pricing","Pricing"]].map(([p,l]) => (
          <button key={p} onClick={() => setPage(p)} style={{
            background: page===p ? "rgba(255,215,0,0.15)" : "transparent",
            border: page===p ? "1px solid rgba(255,215,0,0.3)" : "1px solid transparent",
            color: page===p ? (dark ? "#E6A800" : "#92600A") : (dark ? "#aaa" : "#555"),
            padding: "6px 14px", borderRadius: "6px", cursor: "pointer",
            fontSize: "14px", fontWeight: 500, transition: "all 0.2s"
          }}>{l}</button>
        ))}
        {/* Theme Toggle */}
        <button onClick={() => setDark(d => !d)} title={dark ? "Switch to Light" : "Switch to Dark"} style={{
          background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.1)",
          color: dark ? "#FFD700" : "#555",
          padding: "6px 10px", borderRadius: "8px", cursor: "pointer",
          fontSize: "16px", lineHeight: 1, transition: "all 0.2s"
        }}>{dark ? "☀️" : "🌙"}</button>

        {user ? (
          <>
            <button onClick={() => setPage("dashboard")} style={{
              background: dark ? "rgba(255,215,0,0.1)" : "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.3)",
              color: dark ? "#E6A800" : "#92600A", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "14px", fontWeight: 600
            }}>Dashboard</button>
            {user.isAdmin && (
              <button onClick={() => setPage("admin")} style={{
                background: "rgba(255,50,50,0.15)", border: "1px solid rgba(255,50,50,0.3)",
                color: "#ff6b6b", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "14px"
              }}>Admin</button>
            )}
            <button onClick={onLogout} style={{
              background: "transparent", border: dark ? "1px solid #333" : "1px solid #ddd",
              color: dark ? "#666" : "#888", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "14px"
            }}>Logout</button>
          </>
        ) : (
          <button onClick={() => setPage("auth")} style={{
            background: "linear-gradient(135deg, #FFD700, #FF8C00)",
            border: "none", color: "#000", padding: "8px 20px",
            borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 700
          }}>Get Started</button>
        )}
      </div>

      {/* Mobile Hamburger */}
      <button onClick={() => setMenuOpen(!menuOpen)} style={{
        display: "none", background: "transparent", border: "none",
        color: dark ? "#FFD700" : "#C47A00", fontSize: "22px", cursor: "pointer"
      }} className="mobile-menu-btn">☰</button>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div style={{
          position: "absolute", top: "60px", left: 0, right: 0,
          background: dark ? "rgba(8,10,20,0.98)" : "rgba(255,255,255,0.99)", borderBottom: dark ? "1px solid rgba(255,215,0,0.15)" : "1px solid rgba(0,0,0,0.08)",
          padding: "1rem", display: "flex", flexDirection: "column", gap: "8px"
        }} className="mobile-menu">
          {[["home","🏠 Home"],["exams","📚 Exams"],["pricing","💎 Pricing"]].map(([p,l]) => (
            <button key={p} onClick={() => { setPage(p); setMenuOpen(false); }} style={{
              background: "transparent", border: dark ? "1px solid rgba(255,215,0,0.15)" : "1px solid rgba(0,0,0,0.1)",
              color: dark ? "#fff" : "#111", padding: "10px 16px", borderRadius: "8px",
              cursor: "pointer", fontSize: "15px", textAlign: "left"
            }}>{l}</button>
          ))}
          {/* Theme toggle */}
          <button onClick={() => setDark(d => !d)} style={{
            background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.1)",
            color: dark ? "#aaa" : "#555",
            padding: "10px 16px", borderRadius: "8px", cursor: "pointer",
            fontSize: "15px", textAlign: "left", display: "flex", alignItems: "center", gap: "10px"
          }}>
            <span>{dark ? "☀️" : "🌙"}</span>
            <span>{dark ? "Switch to Light Mode" : "Switch to Dark Mode"}</span>
          </button>

          {user ? (
            <>
              <button onClick={() => { setPage("dashboard"); setMenuOpen(false); }} style={{
                background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)",
                color: dark ? "#FFD700" : "#92600A", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "15px", textAlign: "left"
              }}>📊 Dashboard</button>
              <button onClick={onLogout} style={{
                background: "transparent", border: dark ? "1px solid #333" : "1px solid #ddd",
                color: dark ? "#666" : "#888", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "15px", textAlign: "left"
              }}>🚪 Logout</button>
            </>
          ) : (
            <button onClick={() => { setPage("auth"); setMenuOpen(false); }} style={{
              background: "linear-gradient(135deg, #FFD700, #FF8C00)",
              border: "none", color: "#000", padding: "12px 16px",
              borderRadius: "8px", cursor: "pointer", fontSize: "15px", fontWeight: 700
            }}>Get Started →</button>
          )}
        </div>
      )}
    </nav>
  );
}

// LOGO SLIDER
function LogoSlider({ logos = LOGOS_CONFIG }) {
  const dark = useTheme();
  const [hovered, setHovered] = useState(null);
  const items = [...logos, ...logos];
  return (
    <div style={{
      background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)",
      borderTop: dark ? "1px solid rgba(255,215,0,0.1)" : "1px solid rgba(0,0,0,0.08)",
      borderBottom: dark ? "1px solid rgba(255,215,0,0.1)" : "1px solid rgba(0,0,0,0.08)",
      padding: "32px 0", overflow: "hidden"
    }}>
      <p style={{ textAlign: "center", color: dark ? "#555" : "#999", fontSize: "11px", letterSpacing: "3px", marginBottom: "24px", textTransform: "uppercase", fontWeight: 600 }}>
        We provide mock tests for these exams
      </p>
      <div style={{ overflow: "hidden" }} className="slider-wrapper">
        <div className="slider-track">
          {items.map((logo, i) => (
            <div
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                flex: "0 0 auto",
                width: "clamp(130px, 15vw, 200px)",
                height: "clamp(90px, 11vw, 140px)",
                margin: "0 clamp(12px, 2vw, 20px)",
                background: hovered === i
                  ? (dark ? "rgba(255,215,0,0.08)" : "rgba(255,215,0,0.12)")
                  : (dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.8)"),
                borderRadius: "18px",
                border: hovered === i
                  ? "1.5px solid rgba(255,215,0,0.5)"
                  : (dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)"),
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: "14px", gap: "10px",
                cursor: "pointer",
                transition: "all 0.25s ease",
                transform: hovered === i ? "translateY(-6px) scale(1.04)" : "translateY(0) scale(1)",
                boxShadow: hovered === i
                  ? (dark ? "0 12px 32px rgba(255,215,0,0.15)" : "0 12px 32px rgba(0,0,0,0.12)")
                  : "none",
              }}>
              <img
                src={`/logos/${logo.file}`}
                alt={logo.name}
                loading="lazy"
                style={{
                  width: "clamp(48px, 6vw, 76px)",
                  height: "clamp(48px, 6vw, 76px)",
                  objectFit: "contain",
                  transition: "transform 0.25s ease",
                  transform: hovered === i ? "scale(1.1)" : "scale(1)"
                }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
              <span style={{
                color: hovered === i ? (dark ? "#FFD700" : "#FF8C00") : (dark ? "#aaa" : "#666"),
                fontSize: "clamp(9px, 1vw, 12px)",
                textAlign: "center", lineHeight: 1.3,
                fontWeight: hovered === i ? 700 : 400,
                transition: "all 0.2s"
              }}>{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// HERO SECTION
function HeroSection({ setPage, user }) {
  const dark = useTheme();
  return (
    <section style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "80px 1rem 60px",
      background: dark ? "radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.08) 0%, transparent 60%)" : "radial-gradient(ellipse at 50% 0%, rgba(255,180,0,0.12) 0%, transparent 60%)",
      position: "relative", overflow: "hidden"
    }}>
      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "linear-gradient(rgba(255,215,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.5) 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }} />

      <div style={{ textAlign: "center", maxWidth: "800px", position: "relative", zIndex: 1 }}>
        <div style={{
          display: "inline-block", background: "rgba(255,215,0,0.1)",
          border: "1px solid rgba(255,215,0,0.4)", color: dark ? "#FFD700" : "#92600A",
          padding: "6px 16px", borderRadius: "20px", fontSize: "13px",
          marginBottom: "24px", fontWeight: 600
        }}>
          🎯 Odisha's #1 Mock Test Platform
        </div>

        <h1 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 900,
          fontSize: "clamp(2.2rem, 6vw, 4.5rem)",
          lineHeight: 1.05, marginBottom: "20px", color: dark ? "#fff" : "#111"
        }}>
          Crack Your{" "}
          <span style={{
            background: "linear-gradient(135deg, #FFD700, #FF8C00)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            color: "transparent"
          }}>Dream Exam</span>
          <br />with Smart Practice
        </h1>

        <p style={{ color: dark ? "#aaa" : "#555", fontSize: "clamp(1rem, 2vw, 1.2rem)", lineHeight: 1.7, marginBottom: "36px", maxWidth: "600px", margin: "0 auto 36px" }}>
          Mock tests, sectional tests & PYQs for OSSSC RI/ARI, Odisha Police, Army, Navy, Air Force, Agniveer, SSC GD and more. Real exam simulation. Real results.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setPage("exams")} style={{
            background: "linear-gradient(135deg, #FFD700, #FF8C00)",
            border: "none", color: "#000", padding: "14px 32px",
            borderRadius: "10px", cursor: "pointer", fontSize: "16px",
            fontWeight: 800, letterSpacing: "-0.3px"
          }}>
            Browse Exams →
          </button>
          <button onClick={() => setPage(user ? "exams" : "auth")} style={{
            background: "transparent", border: dark ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(0,0,0,0.2)",
            color: dark ? "#fff" : "#333", padding: "14px 32px", borderRadius: "10px",
            cursor: "pointer", fontSize: "16px"
          }}>
            {user ? "Browse Exams →" : "Start Free Trial"}
          </button>
        </div>

        {/* Stats row */}
        <div style={{
          marginTop: "60px", display: "flex", gap: "24px",
          justifyContent: "center", flexWrap: "wrap"
        }}>
          {[["10+","Exam Categories"],["100%","Free Forever"],["Live","Leaderboard"]].map(([n,l]) => (
            <div key={l} style={{
              background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
              border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
              borderRadius: "12px", padding: "16px 24px", textAlign: "center"
            }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: dark ? "#E6A800" : "#92600A", fontFamily: "'Sora',sans-serif" }}>{n}</div>
              <div style={{ fontSize: "12px", color: dark ? "#666" : "#888", marginTop: "2px" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// EXAM CARD — live Supabase data with logo
function ExamCard({ exam, setPage, setActiveExam }) {
  const dark = useTheme();
  const color = exam.color || exam.organizations?.color || "#FFD700";
  const orgName = exam.organizations?.name || exam.org || "";
  const testCount = exam.test_count ?? 0;
  const [imgFailed, setImgFailed] = useState(false);
  const logoFile = LOGOS_CONFIG.find(l => l.name.toLowerCase() === orgName.toLowerCase())?.file || null;
  return (
    <div
      onClick={() => { setActiveExam(exam); setPage("exam-detail"); }}
      style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#fff",
        border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
        borderRadius: "16px", padding: "20px", cursor: "pointer",
        transition: "all 0.2s", position: "relative", overflow: "hidden",
        boxShadow: dark ? "none" : "0 2px 8px rgba(0,0,0,0.06)"
      }}
      onMouseEnter={e => {
        e.currentTarget.style.border = `1px solid ${color}44`;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 24px ${color}22`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: color }} />
      {exam.is_free && (
        <span style={{
          position: "absolute", top: "12px", right: "12px",
          background: "#4ade8033", color: "#4ade80", fontSize: "10px", fontWeight: 700,
          padding: "2px 8px", borderRadius: "20px", border: "1px solid #4ade8055"
        }}>FREE</span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
        <div style={{
          width: 48, height: 48, borderRadius: "10px", flexShrink: 0,
          background: color + "22", border: `1px solid ${color}44`,
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden"
        }}>
          {logoFile && !imgFailed ? (
            <img src={`/logos/${logoFile}`} alt={orgName} onError={() => setImgFailed(true)}
              style={{ width: 36, height: 36, objectFit: "contain" }} />
          ) : (
            <span style={{ fontSize: "20px", fontWeight: 900, color }}>{orgName.charAt(0)}</span>
          )}
        </div>
        <div>
          <div style={{ color: dark ? "#666" : "#999", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>{orgName}</div>
          <div style={{ color: dark ? "#fff" : "#111", fontSize: "15px", fontWeight: 700, lineHeight: 1.3 }}>{exam.name}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {exam.has_mock      && <span style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", color: dark ? "#aaa" : "#777", fontSize: "10px", padding: "3px 8px", borderRadius: "4px" }}>Mock Tests</span>}
        {exam.has_sectional && <span style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", color: dark ? "#aaa" : "#777", fontSize: "10px", padding: "3px 8px", borderRadius: "4px" }}>Sectional</span>}
        {exam.has_pyq       && <span style={{ background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", color: dark ? "#aaa" : "#777", fontSize: "10px", padding: "3px 8px", borderRadius: "4px" }}>PYQ</span>}
      </div>
      <div style={{ marginTop: "12px", color: dark ? "#666" : "#888", fontSize: "12px" }}>
        {testCount} test{testCount !== 1 ? "s" : ""} available
      </div>
    </div>
  );
}

// EXAMS PAGE — fully dynamic from Supabase
function ExamsPage({ setPage, setActiveExam }) {
  const dark = useTheme();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    supabaseRequest("/exams?is_published=eq.true&select=*,organizations(name,color)&order=created_at.desc", {})
      .then(async (data) => {
        if (!data || data.length === 0) { setExams([]); setLoading(false); return; }
        const enriched = await Promise.all(data.map(async (exam) => {
          try {
            const tests = await supabaseRequest(`/tests?exam_id=eq.${exam.id}&is_published=eq.true&select=test_type`, {});
            const types = (tests || []).map(t => t.test_type);
            return {
              ...exam,
              color: exam.organizations?.color || "#FFD700",
              test_count: types.length,
              has_mock: types.includes("mock"),
              has_sectional: types.some(t => ["sectional","practice_set","speed_test"].includes(t)),
              has_pyq: types.includes("pyq"),
            };
          } catch { return { ...exam, color: "#FFD700", test_count: 0 }; }
        }));
        setExams(enriched);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const orgs = ["All", ...new Set(exams.map(e => e.organizations?.name).filter(Boolean))];
  const filtered = filter === "All" ? exams : exams.filter(e => e.organizations?.name === filter);

  return (
    <div style={{ padding: "80px 1rem 60px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 900, color: dark ? "#fff" : "#111", marginBottom: "8px" }}>All Exams</h1>
      <p style={{ color: dark ? "#666" : "#777", marginBottom: "32px" }}>Choose your exam and start preparing today</p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "28px" }}>
        {orgs.map(o => (
          <button key={o} onClick={() => setFilter(o)} style={{
            background: filter===o ? "rgba(255,215,0,0.15)" : (dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"),
            border: filter===o ? "1px solid rgba(255,215,0,0.4)" : (dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)"),
            color: filter===o ? "#E6A800" : (dark ? "#888" : "#666"), padding: "7px 16px",
            borderRadius: "20px", cursor: "pointer", fontSize: "13px", fontWeight: filter===o?700:400
          }}>{o}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(255,215,0,0.2)", borderTop: "3px solid #FFD700", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
          <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📭</div>
          <p style={{ color: dark ? "#555" : "#888" }}>No published exams yet. Check back soon!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {filtered.map(exam => (
            <ExamCard key={exam.id} exam={exam} setPage={setPage} setActiveExam={setActiveExam} />
          ))}
        </div>
      )}
    </div>
  );
}

function TestInstructionsModal({ test, onConfirm, onCancel, dark }) {
  const [agreed, setAgreed] = useState(false);

  // Helper for the UI Legend
  const StatusIcon = ({ color, label, desc }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
      <div style={{ 
        width: "30px", height: "30px", borderRadius: "6px", 
        background: color + "22", border: `1px solid ${color}`, 
        color: color, display: "flex", alignItems: "center", 
        justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0 
      }}>1</div>
      <div>
        <div style={{ color: dark ? "#fff" : "#111", fontSize: "13px", fontWeight: 600 }}>{label}</div>
        <div style={{ color: "#777", fontSize: "11px", lineHeight: 1.2 }}>{desc}</div>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }} />
      
      <div className="custom-scroll" style={{ 
        position: "relative", width: "100%", maxWidth: "750px", maxHeight: "90vh", 
        background: dark ? "#0f1120" : "#fff", borderRadius: "20px", border: dark ? "1px solid rgba(255,215,0,0.2)" : "1px solid #ddd",
        display: "flex", flexDirection: "column", overflow: "hidden", animation: "fadeUp 0.3s ease" 
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(90deg, rgba(255,215,0,0.05), transparent)" }}>
          <h2 style={{ color: dark ? "#FFD700" : "#92600A", fontSize: "20px", fontWeight: 800, margin: 0 }}>Exam Instructions</h2>
          <p style={{ color: "#888", fontSize: "12px", margin: "4px 0 0" }}>Test: {test.name}</p>
        </div>

        {/* Content */}
        <div className="custom-scroll" style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
          <div className="modal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
            
            {/* Left: UI Guide */}
            <div>
              <h3 style={{ color: dark ? "#FFD700" : "#92600A", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>🎨 Know your interface</h3>
              <StatusIcon color="#4ade80" label="Answered" desc="Question is saved and will be evaluated." />
              <StatusIcon color="#ff6b6b" label="Skipped" desc="Visited but no option was selected." />
              <StatusIcon color="#fb923c" label="Marked" desc="Marked for review to check later." />
              <StatusIcon color="#818cf8" label="Marked & Answered" desc="Answered but marked for a final look." />
              <StatusIcon color="#555" label="Not Visited" desc="Questions you haven't viewed yet." />
            </div>

            {/* Right: Rules & Marking */}
            <div>
              <h3 style={{ color: dark ? "#FFD700" : "#92600A", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>🎯 Marking & Timing</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
                <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ color: "#666", fontSize: "10px" }}>TOTAL MARKS</div>
                  <div style={{ color: "#fff", fontWeight: 700 }}>{test.limit}</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ color: "#ff6b6b", fontSize: "10px" }}>NEGATIVE</div>
                  <div style={{ color: "#ff6b6b", fontWeight: 700 }}>-{test.negative_value}</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)", gridColumn: "span 2" }}>
                  <div style={{ color: "#818cf8", fontSize: "10px" }}>DURATION</div>
                  <div style={{ color: "#818cf8", fontWeight: 700 }}>{test.duration} Minutes ({test.duration * 60} Seconds)</div>
                </div>
              </div>
              {/* Sections in modal */}
              {test.sections && (() => {
                let parsedSecs = [];
                try { parsedSecs = typeof test.sections === "string" ? JSON.parse(test.sections) : (test.sections || []); } catch {}
                if (!parsedSecs.length) return null;
                const SCOLS = ["#FFD700","#4ade80","#818cf8","#fb923c","#f472b6","#22d3ee","#a78bfa","#34d399"];
                return (
                  <div style={{ marginTop: "4px" }}>
                    <div style={{ color: dark ? "#FFD700" : "#92600A", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>📚 Sections</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {parsedSecs.map((sec, i) => {
                        const c = sec.color || SCOLS[i % SCOLS.length];
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: `${c}0f`, border: `1px solid ${c}33`, borderRadius: "8px" }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <span style={{ color: c, fontWeight: 700, fontSize: "12px" }}>{sec.name}</span>
                              {sec.subject && <span style={{ color: "#666", fontSize: "11px" }}> · {sec.subject}</span>}
                            </div>
                            <div style={{ color: "#555", fontSize: "11px", textAlign: "right" }}>
                              <span style={{ color: "#aaa" }}>{sec.questions_count} Qs</span>
                              <span style={{ color: "#4ade80", marginLeft: "8px" }}>+{sec.marks_per_question}</span>
                              <span style={{ color: "#ff6b6b", marginLeft: "4px" }}>-{sec.negative_marks}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <div style={{ display: "none" }}>
              </div>

              <h3 style={{ color: dark ? "#FFD700" : "#92600A", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", marginBottom: "12px" }}>🛡️ General Instructions</h3>
              <ul style={{ color: "#aaa", fontSize: "12px", lineHeight: "1.6", paddingLeft: "18px" }}>
                <li><b>Window Lock:</b> Do not minimize or switch tabs.</li>
                <li><b>Anti-Cheat:</b> 3 warnings lead to auto-submission.</li>
                <li><b>Finality:</b> Submit button ends the test immediately.</li>
              </ul>
            </div>
          </div>

          {/* Admin Specific Instructions */}
          <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <h3 style={{ color: dark ? "#FFD700" : "#92600A", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", marginBottom: "12px" }}>📝 Specific Instructions for this Test</h3>
            <div style={{ background: "rgba(255,215,0,0.04)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,215,0,0.1)" }}>
              {test.instructions ? (() => {
                // Split on patterns like "1." "2." etc or ". " between sentences
                const raw = test.instructions.trim();
                // Try to split on numbered points: "1. " "2. " etc
                const numbered = raw.split(/(?=\d+\.\s)/g).filter(s => s.trim());
                if (numbered.length > 1) {
                  return (
                    <ol style={{ margin: 0, padding: "0 0 0 18px", listStyle: "decimal" }}>
                      {numbered.map((pt, i) => {
                        const clean = pt.replace(/^\d+\.\s*/, "").trim();
                        return clean ? <li key={i} style={{ color: "#aaa", fontSize: "13px", lineHeight: "1.7", marginBottom: "4px" }}>{clean}</li> : null;
                      })}
                    </ol>
                  );
                }
                // fallback: split on ". " as sentences
                const sentences = raw.split(/\. (?=[A-Z0-9])/g).filter(s => s.trim());
                if (sentences.length > 1) {
                  return (
                    <ul style={{ margin: 0, padding: "0 0 0 18px" }}>
                      {sentences.map((s, i) => (
                        <li key={i} style={{ color: "#aaa", fontSize: "13px", lineHeight: "1.7", marginBottom: "4px" }}>{s.replace(/\.$/, "")}</li>
                      ))}
                    </ul>
                  );
                }
                return <p style={{ color: "#aaa", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>{raw}</p>;
              })() : <p style={{ color: "#555", fontSize: "13px", margin: 0 }}>No additional instructions provided for this test.</p>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "20px 24px", borderTop: "1px solid rgba(255,255,255,0.08)", background: dark ? "rgba(0,0,0,0.2)" : "#fafafa" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", marginBottom: "20px" }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ width: "20px", height: "20px", accentColor: "#FFD700" }} />
            <span style={{ color: dark ? "#ddd" : "#444", fontSize: "14px", fontWeight: 600 }}>I have read all instructions.</span>
          </label>
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={onCancel} style={{ flex: 1, background: "transparent", border: "1px solid #444", color: "#888", padding: "14px", borderRadius: "12px", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
            <button 
              disabled={!agreed} 
              onClick={onConfirm}
              style={{ flex: 2, background: agreed ? "linear-gradient(135deg, #FFD700, #FF8C00)" : "#333", border: "none", color: "#000", padding: "14px", borderRadius: "12px", cursor: agreed ? "pointer" : "not-allowed", fontWeight: 800, fontSize: "16px" }}
            >
              Start Examination →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// EXAM DETAIL PAGE — fully dynamic from Supabase

function SectionalGrouped({ tests, dark, renderTestCard }) {
  const GCOLS = ["#FFD700","#4ade80","#818cf8","#fb923c","#f472b6","#22d3ee","#a78bfa","#34d399","#60a5fa","#f87171"];
  const subjectKeywords = ["english","odia","hindi","mathematics","maths","math","reasoning","logical","general studies","gs","general knowledge","gk","computer","science","history","geography","polity","economics","current affairs","physics","chemistry","biology","environment"];
  const [activeSubject, setActiveSubject] = useState(null);

  const groups = {};
  tests.forEach(t => {
    let group = t.subject && t.subject.trim() ? t.subject.trim() : null;
    if (!group) {
      const nl = (t.name || "").toLowerCase();
      for (const kw of subjectKeywords) {
        if (nl.includes(kw)) { group = kw.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "); break; }
      }
    }
    if (!group) group = "Other";
    if (!groups[group]) groups[group] = [];
    groups[group].push(t);
  });
  const groupEntries = Object.entries(groups);

  const scrollTo = (subject) => {
    setActiveSubject(subject);
    setTimeout(() => {
      const el = document.getElementById(`sg-${subject.replace(/\s+/g, "-")}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const visibleGroups = activeSubject ? groupEntries.filter(([s]) => s === activeSubject) : groupEntries;

  return (
    <div>
      {/* Subject filter pills — always visible */}
      <div style={{
        position: "sticky", top: "58px", zIndex: 50,
        background: dark ? "rgba(8,10,20,0.97)" : "rgba(245,246,250,0.97)",
        backdropFilter: "blur(12px)",
        borderBottom: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)",
        padding: "10px 0", marginBottom: "20px",
        display: "flex", gap: "8px", overflowX: "auto", scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}>
        <button onClick={() => setActiveSubject(null)} style={{
          flexShrink: 0, padding: "7px 16px", borderRadius: "20px", cursor: "pointer",
          border: activeSubject === null ? "1px solid rgba(255,215,0,0.5)" : dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.12)",
          background: activeSubject === null ? "rgba(255,215,0,0.12)" : "transparent",
          color: activeSubject === null ? "#FFD700" : dark ? "#888" : "#666",
          fontSize: "13px", fontWeight: activeSubject === null ? 700 : 500, transition: "all 0.15s"
        }}>All <span style={{ opacity: 0.6, fontSize: "11px" }}>({tests.length})</span></button>

        {groupEntries.map(([subject, subTests], gi) => {
          const c = GCOLS[gi % GCOLS.length];
          const isActive = activeSubject === subject;
          return (
            <button key={subject} onClick={() => {
              const next = isActive ? null : subject;
              setActiveSubject(next);
              if (next) setTimeout(() => {
                const el = document.getElementById(`sg-${subject.replace(/\s+/g,"-")}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 50);
            }} style={{
              flexShrink: 0, padding: "7px 16px", borderRadius: "20px", cursor: "pointer",
              border: isActive ? `1px solid ${c}88` : dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.12)",
              background: isActive ? `${c}25` : `${c}0a`,
              color: isActive ? c : dark ? "#aaa" : "#666",
              fontSize: "13px", fontWeight: isActive ? 700 : 500, transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: "6px"
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
              {subject}
              <span style={{ background: isActive ? `${c}30` : `${c}18`, color: c, fontSize: "10px", fontWeight: 700, padding: "1px 7px", borderRadius: "8px", marginLeft: "2px" }}>{subTests.length}</span>
            </button>
          );
        })}
      </div>

      {/* Groups */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {visibleGroups.map(([subject, subTests]) => {
          const gi = groupEntries.findIndex(([s]) => s === subject);
          const c = GCOLS[gi % GCOLS.length];
          return (
            <div key={subject} id={`sg-${subject.replace(/\s+/g, "-")}`} style={{ scrollMarginTop: "120px" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px",
                padding: "10px 14px", borderRadius: "10px",
                background: `${c}0e`, border: `1px solid ${c}25`
              }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, flexShrink: 0 }} />
                <span style={{ color: c, fontWeight: 800, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.8px", flex: 1 }}>{subject}</span>
                <span style={{ background: `${c}20`, border: `1px solid ${c}40`, color: c, fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "10px" }}>
                  {subTests.length} test{subTests.length > 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {subTests.map(test => renderTestCard(test))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExamDetailPage({ exam, setPage, setActiveTest, user }) {
  const dark = useTheme();
  const [activeTab, setActiveTab] = useState("mock");
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State to track which test is waiting for instructions to be read
  const [pendingTest, setPendingTest] = useState(null);

  const color = exam.color || exam.organizations?.color || "#FFD700";
  const orgName = exam.organizations?.name || exam.org || "";

  useEffect(() => {
    supabaseRequest(`/tests?exam_id=eq.${exam.id}&is_published=eq.true&order=created_at.asc&select=*`, {})
      .then(data => { setTests(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [exam.id]);

  const byType = {
    mock:      tests.filter(t => t.test_type === "mock"),
    sectional: tests.filter(t => ["sectional","practice_set","speed_test"].includes(t.test_type)),
    pyq:       tests.filter(t => t.test_type === "pyq"),
  };

  const renderTestCard = (test) => {
    const typeLabel = { mock: "Mock", sectional: "Sectional", pyq: "PYQ", practice_set: "Practice", speed_test: "Speed" }[test.test_type] || "";
    const typeColor = { mock: "#FFD700", sectional: "#4ade80", pyq: "#818cf8", practice_set: "#fb923c", speed_test: "#f472b6" }[test.test_type] || "#FFD700";
    return (
      <div key={test.id} style={{
        background: dark ? "rgba(255,255,255,0.04)" : "#fff",
        border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
        borderRadius: "12px", padding: "16px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
        boxShadow: dark ? "none" : "0 1px 4px rgba(0,0,0,0.06)"
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
            <span style={{ color: dark ? "#fff" : "#111", fontWeight: 600, fontSize: "15px" }}>{test.name}</span>
            <span style={{ background: typeColor + "18", border: `1px solid ${typeColor}40`, color: typeColor, fontSize: "10px", fontWeight: 700, padding: "1px 7px", borderRadius: "10px", letterSpacing: "0.5px" }}>{typeLabel}</span>
          </div>
          <div style={{ color: dark ? "#666" : "#888", fontSize: "13px" }}>
            {test.duration_minutes} min • {test.total_marks} Marks • -{test.negative_value} negative
          </div>
        </div>
        <button
          onClick={() => {
            if (!user) { setPage("auth"); return; }
            setPendingTest({
              name: test.name,
              test_id: test.id,
              duration: test.duration_minutes,
              limit: test.total_marks,
              negative_value: test.negative_value,
              instructions: test.instructions,
              sections: test.sections || null,
            });
          }}
          style={{
            background: "linear-gradient(135deg, #FFD700, #FF8C00)",
            border: "none", color: "#000", padding: "10px 22px",
            borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 700, flexShrink: 0
          }}
        >{user ? "Start Test" : "Login to Start"}</button>
      </div>
    );
  };

  return (
    <div style={{ padding: "80px 1rem 60px", maxWidth: "900px", margin: "0 auto" }}>
      <button onClick={() => setPage("exams")} style={{
        background: "transparent", border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.15)",
        color: dark ? "#aaa" : "#777", padding: "8px 16px", borderRadius: "8px",
        cursor: "pointer", marginBottom: "24px", fontSize: "14px"
      }}>← Back to Exams</button>

      {/* Header */}
      <div style={{
        background: dark ? color + "15" : color + "12", border: `1px solid ${color}44`,
        borderRadius: "16px", padding: "24px", marginBottom: "28px",
        display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap"
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: "12px",
          background: color + "22", border: `1px solid ${color}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "26px", fontWeight: 900, color: color
        }}>{orgName.charAt(0)}</div>
        <div>
          <div style={{ color: dark ? "#aaa" : "#777", fontSize: "13px" }}>{orgName}</div>
          <h1 style={{ color: dark ? "#fff" : "#111", fontSize: "clamp(1.3rem,3vw,1.8rem)", fontWeight: 800, margin: 0 }}>{exam.name}</h1>
          {exam.description && <p style={{ color: dark ? "#666" : "#888", fontSize: "13px", margin: "4px 0 0" }}>{exam.description}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", borderRadius: "10px", padding: "4px" }}>
        {[["mock","Mock Tests"],["sectional","Sectional / Practice"],["pyq","PYQ"]].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)} style={{
            flex: 1, background: activeTab===k ? "rgba(255,215,0,0.15)" : "transparent",
            border: activeTab===k ? "1px solid rgba(255,215,0,0.3)" : "1px solid transparent",
            color: activeTab===k ? "#FFD700" : "#888",
            padding: "10px", borderRadius: "7px", cursor: "pointer", fontSize: "14px", fontWeight: activeTab===k?700:400
          }}>
            {l} {byType[k].length > 0 && <span style={{ fontSize: "11px", opacity: 0.7 }}>({byType[k].length})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>Loading tests...</div>
      ) : byType[activeTab].length === 0 ? (
        <div style={{
          textAlign: "center", padding: "48px",
          background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: dark ? "1px dashed rgba(255,255,255,0.08)" : "1px dashed rgba(0,0,0,0.12)",
          borderRadius: "14px", color: "#555"
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>📭</div>
          <span style={{ color: dark ? "#555" : "#888" }}>No {activeTab === "mock" ? "mock tests" : activeTab === "sectional" ? "sectional/practice tests" : "PYQ papers"} published yet.</span>
        </div>
      ) : activeTab === "sectional" ? (
        <SectionalGrouped tests={byType["sectional"]} dark={dark} renderTestCard={renderTestCard} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {byType[activeTab].map(test => renderTestCard(test))}
        </div>
      )}

      {/* COMPULSORY INSTRUCTIONS MODAL OVERLAY */}
      {pendingTest && (
        <TestInstructionsModal 
          test={pendingTest} 
          dark={dark}
          onCancel={() => setPendingTest(null)}
          onConfirm={() => {
            setActiveTest(pendingTest);
            setPage("exam-interface");
            setPendingTest(null);
          }}
        />
      )}

    </div>
  );
}

// AUTH PAGE — with email verification flow
function AuthPage({ setPage, onLogin, recoveryToken: propRecoveryToken, onRecoveryUsed }) {
  const dark = useTheme();
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [state, setState] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState(null); // stores recovery access token
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // React to propRecoveryToken arriving from parent (root App parsed the URL hash)
  useEffect(() => {
    if (propRecoveryToken) {
      setResetToken(propRecoveryToken);
      setMode("reset");
    }
  }, [propRecoveryToken]);

  // On mount: check localStorage for recovery token (persisted by root App)
  useEffect(() => {
    const storedToken = sessionStorage.getItem("mm_recovery_token");
    if (storedToken) {
      sessionStorage.removeItem("mm_recovery_token"); // consume it immediately
      setResetToken(storedToken);
      setMode("reset");
      return;
    }

    // Also check URL hash directly (user opened link in new tab scenario)
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const accessToken = params.get("access_token");
    const type = params.get("type");
    if (!accessToken) return;
    window.history.replaceState(null, "", window.location.pathname);

    if (type === "recovery") {
      setResetToken(accessToken);
      setMode("reset");
    } else if (type === "signup" || type === "magiclink") {
      (async () => {
        try {
          const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${accessToken}` }
          });
          const userData = await res.json();
          if (userData?.id) {
            sessionStorage.setItem("mm_session", JSON.stringify({ access_token: accessToken, user: userData }));
            let isAdmin = false;
            try {
              const roles = await supabaseRequest(`/roles?user_id=eq.${userData.id}&select=role`, { token: accessToken });
              isAdmin = roles?.some(r => r.role === "admin") || false;
            } catch {}
            onLogin({ ...userData, token: accessToken, isAdmin });
            setPage("dashboard");
          }
        } catch(e) { setError("Verification failed. Please try signing in again."); }
      })();
    }
  }, []);

  // Handle password reset submission
  const handleResetPassword = async () => {
    setError(""); setSuccess("");
    if (!newPassword || !confirmPassword) { setError("Please fill in both fields."); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${resetToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: newPassword })
      });
      const data = await res.json();
      if (data.error || data.error_description) throw new Error(data.error_description || data.error?.message || "Failed to reset password");
      sessionStorage.removeItem("mm_recovery_token");
      setSuccess("✅ Password updated successfully! Sign in with your new password.");
      setMode("login");
      setResetToken(null);
      setNewPassword(""); setConfirmPassword("");
      if (onRecoveryUsed) onRecoveryUsed();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleAuth = async () => {
    if (mode === "signup" && !fullName.trim()) { setError("Please enter your full name"); return; }
    if (mode === "signup" && !state) { setError("Please select your state"); return; }
    if (!email || !password) { setError("Enter email and password"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError("");
    try {
      if (mode === "signup") {
        const data = await supabaseAuth("signup", {
          email, password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (data.error) throw new Error(data.error.message || "Signup failed");

        // If confirm email is OFF — Supabase returns access_token immediately
        if (data.access_token) {
          sessionStorage.setItem("mm_session", JSON.stringify(data));
          // Save name and state to profiles
          try {
            await supabaseRequest(`/profiles?id=eq.${data.user?.id}`, {
              method: "PATCH",
              body: { full_name: fullName.trim(), state },
              token: data.access_token, prefer: "return=minimal"
            });
          } catch {
            // If PATCH fails (no row yet), try INSERT
            try {
              await supabaseRequest("/profiles", {
                method: "POST",
                body: { id: data.user?.id, full_name: fullName.trim(), state },
                token: data.access_token, prefer: "return=minimal"
              });
            } catch {}
          }
          let isAdmin = false;
          try {
            const roles = await supabaseRequest(`/roles?user_id=eq.${data.user?.id}&select=role`, { token: data.access_token });
            isAdmin = roles?.some(r => r.role === "admin") || false;
          } catch {}
          onLogin({ ...data.user, token: data.access_token, isAdmin });
          setPage("dashboard");
        } else {
          // Confirm email is ON — show check email screen (profile saved after verification)
          // Store name+state temporarily so we can save after email confirm
          sessionStorage.setItem("mm_pending_profile", JSON.stringify({ full_name: fullName.trim(), state }));
          setVerifyEmail(email);
        }
        setLoading(false);
        return;
      } else {
        // Login
        const data = await supabaseAuth("token?grant_type=password", { email, password });
        if (data.error || data.error_description) throw new Error(data.error_description || data.error?.message || "Invalid email or password");
        sessionStorage.setItem("mm_session", JSON.stringify(data));
        let isAdmin = false;
        try {
          const roles = await supabaseRequest(`/roles?user_id=eq.${data.user?.id}&select=role`, { token: data.access_token });
          isAdmin = roles?.some(r => r.role === "admin") || false;
        } catch {}
        onLogin({ ...data.user, token: data.access_token, isAdmin });
        setPage("dashboard");
      }
    } catch(e) {
      setError(e.message || "Authentication failed");
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError("Enter your email address"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: "POST",
        headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email, options: { redirectTo: window.location.origin } }),
      });
      if (res.ok || res.status === 200) {
        setResetSent(true);
      } else {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || "Failed to send reset email");
      }
    } catch(e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const inputStyle = {
    width: "100%",
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.15)",
    color: dark ? "#fff" : "#111",
    padding: "14px 16px", borderRadius: "10px", fontSize: "16px",
    outline: "none", boxSizing: "border-box"
  };

  // ── Check your email screen ──
  if (verifyEmail) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", padding: "80px 1rem 40px",
        background: "radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.06) 0%, transparent 60%)"
      }}>
        <div style={{
          width: "100%", maxWidth: "420px", textAlign: "center",
          background: dark ? "rgba(255,255,255,0.04)" : "#fff", border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
          borderRadius: "20px", padding: "40px",
          boxShadow: dark ? "none" : "0 8px 40px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "20px" }}>📧</div>
          <h2 style={{ color: dark ? "#fff" : "#111", fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: "1.6rem", marginBottom: "12px" }}>
            Check your email
          </h2>
          <p style={{ color: dark ? "#aaa" : "#666", fontSize: "14px", lineHeight: 1.7, marginBottom: "8px" }}>
            We sent a verification link to
          </p>
          <p style={{ color: dark ? "#FFD700" : "#92600A", fontWeight: 700, fontSize: "15px", marginBottom: "24px", wordBreak: "break-all" }}>
            {verifyEmail}
          </p>
          <p style={{ color: dark ? "#666" : "#888", fontSize: "13px", lineHeight: 1.7, marginBottom: "28px" }}>
            Click the link in the email to verify your account and get started. Check your spam folder if you don't see it.
          </p>
          <div style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: "12px", padding: "14px", marginBottom: "24px" }}>
            <p style={{ color: "#aaa", fontSize: "12px", margin: 0 }}>
              💡 After clicking the link, you'll be automatically signed in and redirected to your dashboard.
            </p>
          </div>
          <button
            onClick={() => { setVerifyEmail(""); setMode("login"); setError(""); }}
            style={{
              background: "transparent", border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.15)",
              color: dark ? "#aaa" : "#666", padding: "12px 24px", borderRadius: "10px",
              cursor: "pointer", fontSize: "14px", width: "100%"
            }}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  // ── Reset Password screen (from email link) ──
  if (mode === "reset") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 1rem 40px",
        background: dark ? "radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.06) 0%, transparent 60%)" : "radial-gradient(ellipse at 50% 0%, rgba(255,180,0,0.08) 0%, transparent 60%)" }}>
        <div style={{ width: "100%", maxWidth: "420px", background: dark ? "rgba(255,255,255,0.04)" : "#fff", border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)", boxShadow: dark ? "none" : "0 8px 40px rgba(0,0,0,0.1)", borderRadius: "20px", padding: "clamp(24px,5vw,40px)" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔐</div>
            <h2 style={{ color: dark ? "#fff" : "#111", fontFamily: "'Sora',sans-serif", fontWeight: 800, margin: 0 }}>Set New Password</h2>
            <p style={{ color: dark ? "#666" : "#888", fontSize: "14px", marginTop: "6px" }}>Choose a strong password for your account.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {error && <div style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", color: "#ff6b6b", padding: "10px 14px", borderRadius: "8px", fontSize: "14px" }}>{error}</div>}
            {success && <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", padding: "10px 14px", borderRadius: "8px", fontSize: "14px" }}>{success}</div>}
            <div>
              <label style={{ color: dark?"#aaa":"#666", fontSize: "12px", display: "block", marginBottom: "6px" }}>NEW PASSWORD</label>
              <input type="password" placeholder="Enter new password (min 6 chars)" value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ width:"100%", background: dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)", border: dark?"1px solid rgba(255,255,255,0.15)":"1px solid rgba(0,0,0,0.15)", color: dark?"#fff":"#111", padding:"14px 16px", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ color: dark?"#aaa":"#666", fontSize: "12px", display: "block", marginBottom: "6px" }}>CONFIRM PASSWORD</label>
              <input type="password" placeholder="Re-enter new password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleResetPassword()}
                style={{ width:"100%", background: dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)", border: dark?"1px solid rgba(255,255,255,0.15)":"1px solid rgba(0,0,0,0.15)", color: dark?"#fff":"#111", padding:"14px 16px", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box" }} />
            </div>
            {newPassword && confirmPassword && (
              <div style={{ fontSize: "12px", color: newPassword === confirmPassword ? "#4ade80" : "#ff6b6b" }}>
                {newPassword === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
              </div>
            )}
            <button onClick={handleResetPassword} disabled={loading} style={{ width:"100%", background: loading?"#555":"linear-gradient(135deg,#FFD700,#FF8C00)", border:"none", color:"#000", padding:"14px", borderRadius:"10px", cursor: loading?"not-allowed":"pointer", fontSize:"16px", fontWeight:700, marginTop:"4px" }}>
              {loading ? "Updating Password..." : "Set New Password →"}
            </button>
            <button onClick={() => { setMode("login"); setError(""); }} style={{ background:"transparent", border:"none", color: dark?"#555":"#888", cursor:"pointer", fontSize:"13px", padding:"4px" }}>← Back to Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password screen ──
  if (mode === "forgot") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 1rem 40px",
        background: dark ? "radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.06) 0%, transparent 60%)" : "radial-gradient(ellipse at 50% 0%, rgba(255,180,0,0.08) 0%, transparent 60%)" }}>
        <div style={{ width: "100%", maxWidth: "420px", background: dark ? "rgba(255,255,255,0.04)" : "#fff", border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)", boxShadow: dark ? "none" : "0 8px 40px rgba(0,0,0,0.1)", borderRadius: "20px", padding: "clamp(24px,5vw,40px)" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔑</div>
            <h2 style={{ color: dark ? "#fff" : "#111", fontFamily: "'Sora',sans-serif", fontWeight: 800, margin: 0 }}>Reset Password</h2>
            <p style={{ color: dark ? "#666" : "#888", fontSize: "14px", marginTop: "6px" }}>
              {resetSent ? "Check your email for the reset link." : "Enter your email to receive a password reset link."}
            </p>
          </div>
          {resetSent ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📧</div>
              <p style={{ color: dark ? "#aaa" : "#666", fontSize: "14px", marginBottom: "20px" }}>Reset link sent to <strong>{email}</strong>. Check your inbox and spam folder.</p>
              <button onClick={() => { setMode("login"); setResetSent(false); setError(""); }} style={{ width: "100%", background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "13px", borderRadius: "10px", cursor: "pointer", fontSize: "15px", fontWeight: 700 }}>Back to Sign In</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {error && <div style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", color: "#ff6b6b", padding: "10px 14px", borderRadius: "8px", fontSize: "14px" }}>{error}</div>}
              <input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleForgotPassword()} style={inputStyle} />
              <button onClick={handleForgotPassword} disabled={loading} style={{ width: "100%", background: loading ? "#555" : "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "14px", borderRadius: "10px", cursor: loading ? "not-allowed" : "pointer", fontSize: "16px", fontWeight: 700 }}>
                {loading ? "Sending..." : "Send Reset Link →"}
              </button>
              <button onClick={() => { setMode("login"); setError(""); }} style={{ background: "transparent", border: "none", color: dark ? "#666" : "#555", cursor: "pointer", fontSize: "14px", padding: "4px" }}>← Back to Sign In</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Login / Signup form ──
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "80px 1rem 40px",
      background: dark ? "radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.06) 0%, transparent 60%)" : "radial-gradient(ellipse at 50% 0%, rgba(255,180,0,0.08) 0%, transparent 60%)"
    }}>
      <div style={{
        width: "100%", maxWidth: "420px",
        background: dark ? "rgba(255,255,255,0.04)" : "#fff", border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
        boxShadow: dark ? "none" : "0 8px 40px rgba(0,0,0,0.1)",
        borderRadius: "20px", padding: "clamp(24px,5vw,40px)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "12px",
            background: "linear-gradient(135deg, #FFD700, #FF6B00)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "22px", fontWeight: 900, color: "#000", margin: "0 auto 12px"
          }}>M</div>
          <h2 style={{ color: dark ? "#fff" : "#111", fontFamily: "'Sora',sans-serif", fontWeight: 800, margin: 0 }}>
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p style={{ color: dark ? "#666" : "#888", fontSize: "14px", marginTop: "6px" }}>
            {mode === "login" ? "Sign in to your account" : "Join MeritMatrix today"}
          </p>
        </div>

        {error && (
          <div style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", color: "#ff6b6b", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" }}>
            {error}
          </div>
        )}

        {mode === "signup" && (
          <div style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#aaa" }}>
            📧 A verification link will be sent to your email. Click it to activate your account.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {mode === "signup" && (
            <input
              type="text" placeholder="Full Name *"
              value={fullName} onChange={e => setFullName(e.target.value)}
              style={inputStyle}
            />
          )}
          {mode === "signup" && (
            <select value={state} onChange={e => setState(e.target.value)} style={{...inputStyle, appearance:"none", cursor:"pointer"}}>
              <option value="">Select Your State *</option>
              {["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <input
            type="email" placeholder="Enter your email"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAuth()}
            style={inputStyle}
          />
          <input
            type="password" placeholder="Password (min 6 characters)"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAuth()}
            style={inputStyle}
          />
          <button onClick={handleAuth} disabled={loading} style={{
            width: "100%",
            background: loading ? "#555" : "linear-gradient(135deg, #FFD700, #FF8C00)",
            border: "none", color: "#000", padding: "14px",
            borderRadius: "10px", cursor: loading ? "not-allowed" : "pointer",
            fontSize: "16px", fontWeight: 700
          }}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In →" : "Create Account →"}
          </button>
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }} style={{
            background: "transparent", border: "none", color: dark ? "#666" : "#555",
            cursor: "pointer", fontSize: "14px", padding: "4px"
          }}>
            {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
          {mode === "login" && (
            <button onClick={() => { setMode("forgot"); setError(""); }} style={{
              background: "transparent", border: "none", color: dark ? "#555" : "#999",
              cursor: "pointer", fontSize: "13px", padding: "2px"
            }}>Forgot password?</button>
          )}
        </div>

        <p style={{ color: dark ? "#444" : "#888", fontSize: "12px", textAlign: "center", marginTop: "20px" }}>
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
// DASHBOARD
function ScorecardModal({ attempt, dark, onClose, onReattempt }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all|correct|wrong|skipped
  const { user } = useAuth();

  useEffect(() => {
    if (!attempt?.test_id) { setLoading(false); return; }
    supabaseRequest(`/questions?test_id=eq.${attempt.test_id}&select=*&order=order_index.asc`, { token: user?.token })
      .then(data => { setQuestions(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [attempt?.test_id]);

  const answers = (() => { try { return JSON.parse(attempt.answers_snapshot || "{}"); } catch { return {}; } })();
  const subjectScores = (() => { try { return JSON.parse(attempt.subject_scores || "{}"); } catch { return {}; } })();
  const pct = attempt.total_marks > 0 ? Math.round((attempt.score / attempt.total_marks) * 100) : 0;
  const grade = pct >= 90 ? {l:"Excellent",c:"#FFD700",e:"🥇"} : pct >= 75 ? {l:"Very Good",c:"#4ade80",e:"🎉"} : pct >= 60 ? {l:"Good",c:"#4ade80",e:"👍"} : pct >= 40 ? {l:"Average",c:"#fb923c",e:"📈"} : {l:"Need Practice",c:"#ff6b6b",e:"💪"};
  const mm = Math.floor((attempt.time_taken_seconds||0)/60), ss = String((attempt.time_taken_seconds||0)%60).padStart(2,"0");

  const filteredQs = questions.filter(q => {
    const ua = answers[q.id];
    const isCorrect = ua !== undefined && String(ua).toLowerCase().trim() === String(q.correct_answer||q.correct).toLowerCase().trim();
    const isWrong = ua !== undefined && !isCorrect;
    const isSkipped = ua === undefined;
    if (filter === "correct") return isCorrect;
    if (filter === "wrong") return isWrong;
    if (filter === "skipped") return isSkipped;
    return true;
  });

  const cardBg = dark ? "rgba(255,255,255,0.04)" : "#fff";
  const border = dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)";

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:9000, overflowY:"auto", padding:"20px 1rem 60px" }}>
      <div style={{ maxWidth:"860px", margin:"0 auto" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <div style={{ color:"#aaa", fontSize:"12px", marginBottom:"4px" }}>DETAILED SCORECARD</div>
            <h2 style={{ color:"#fff", fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"1.4rem", margin:0 }}>{attempt.tests?.name || "Test"}</h2>
            <div style={{ color:"#555", fontSize:"12px", marginTop:"4px" }}>{new Date(attempt.created_at).toLocaleString("en-IN", {day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
          </div>
          <div style={{ display:"flex", gap:"8px" }}>
            {onReattempt && (
              <button onClick={onReattempt} style={{ background:"linear-gradient(135deg,#4ade80,#22c55e)", border:"none", color:"#000", padding:"10px 20px", borderRadius:"8px", cursor:"pointer", fontWeight:700, fontSize:"13px" }}>🔄 Reattempt</button>
            )}
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", color:"#aaa", padding:"10px 18px", borderRadius:"8px", cursor:"pointer", fontSize:"13px" }}>✕ Close</button>
          </div>
        </div>

        {/* Score hero */}
        <div style={{ background:"linear-gradient(135deg,rgba(255,215,0,0.1),rgba(255,140,0,0.06))", border:"1px solid rgba(255,215,0,0.2)", borderRadius:"20px", padding:"24px", marginBottom:"16px", display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:"16px", textAlign:"center" }}>
          <div>
            <div style={{ fontSize:"3rem", fontWeight:900, fontFamily:"'Sora',sans-serif", color:"#FFD700", lineHeight:1 }}>{pct}%</div>
            <div style={{ color:"#888", fontSize:"12px", marginTop:"4px" }}>{attempt.score}/{attempt.total_marks} marks</div>
            <div style={{ color:grade.c, fontSize:"12px", fontWeight:700, marginTop:"4px" }}>{grade.e} {grade.l}</div>
          </div>
          {[
            ["✓ Correct", attempt.correct_count||0, "#4ade80"],
            ["✗ Wrong", attempt.wrong_count||0, "#ff6b6b"],
            ["— Skipped", attempt.unattempted_count||0, "#818cf8"],
            ["⏱ Time", `${mm}m ${ss}s`, "#fb923c"],
          ].map(([l,v,c]) => (
            <div key={l}>
              <div style={{ color:c, fontSize:"1.6rem", fontWeight:900, fontFamily:"'Sora',sans-serif", lineHeight:1 }}>{v}</div>
              <div style={{ color:"#666", fontSize:"11px", marginTop:"4px" }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Subject-wise */}
        {Object.keys(subjectScores).length > 0 && (
          <div style={{ background:cardBg, border, borderRadius:"16px", padding:"20px", marginBottom:"16px" }}>
            <div style={{ color:"#aaa", fontSize:"11px", fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", marginBottom:"14px" }}>Subject-wise Performance</div>
            {Object.entries(subjectScores).map(([subj, d]) => {
              const maxMarks = questions.filter(q => (q.subject||"General") === subj).reduce((s,q) => s+(q.marks||1), 0);
              const spct = maxMarks > 0 ? Math.max(0, Math.round((d.score/maxMarks)*100)) : 0;
              const accuracy = d.total > 0 ? Math.round((d.correct/d.total)*100) : 0;
              return (
                <div key={subj} style={{ marginBottom:"14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px", flexWrap:"wrap", gap:"6px" }}>
                    <span style={{ color:dark?"#ddd":"#222", fontWeight:600, fontSize:"14px" }}>{subj}</span>
                    <div style={{ display:"flex", gap:"12px", fontSize:"12px" }}>
                      <span style={{ color:"#4ade80" }}>✓ {d.correct}</span>
                      <span style={{ color:"#ff6b6b" }}>✗ {d.wrong}</span>
                      <span style={{ color:"#818cf8" }}>— {d.skipped}</span>
                      <span style={{ color:"#fb923c", fontWeight:700 }}>Acc: {accuracy}%</span>
                      <span style={{ color:"#FFD700", fontWeight:700 }}>{d.score.toFixed(1)}/{maxMarks}</span>
                    </div>
                  </div>
                  <div style={{ height:"8px", borderRadius:"4px", background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${spct}%`, background:spct>=70?"#4ade80":spct>=40?"#fb923c":"#ff6b6b", borderRadius:"4px", transition:"width 1s ease" }} />
                  </div>
                  <div style={{ color:"#555", fontSize:"11px", marginTop:"3px" }}>{spct}% score rate</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Performance insights */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"12px", marginBottom:"16px" }}>
          {[
            ["🎯 Accuracy", `${(attempt.correct_count||0)+(attempt.wrong_count||0) > 0 ? Math.round((attempt.correct_count||0)/((attempt.correct_count||0)+(attempt.wrong_count||0))*100) : 0}%`, "of attempted", "#4ade80"],
            ["📊 Attempt Rate", `${attempt.total_marks > 0 ? Math.round(((attempt.correct_count||0)+(attempt.wrong_count||0))/(questions.length||1)*100) : 0}%`, `${(attempt.correct_count||0)+(attempt.wrong_count||0)} of ${questions.length} Qs`, "#FFD700"],
            ["⚠️ Marks Lost", (attempt.wrong_count||0) > 0 ? `-${((attempt.negative_value || (questions[0]?.negative_marks) || 0.33) * (attempt.wrong_count||0)).toFixed(2)}` : "0", "from wrong answers", "#ff6b6b"],
            ["⏱ Avg/Question", questions.length > 0 ? `${Math.round((attempt.time_taken_seconds||0)/questions.length)}s` : "—", "per question", "#fb923c"],
          ].map(([l,v,sub,c]) => (
            <div key={l} style={{ background:cardBg, border, borderRadius:"12px", padding:"16px" }}>
              <div style={{ color:"#666", fontSize:"11px", marginBottom:"6px" }}>{l}</div>
              <div style={{ color:c, fontSize:"1.5rem", fontWeight:900, fontFamily:"'Sora',sans-serif" }}>{v}</div>
              <div style={{ color:"#555", fontSize:"11px", marginTop:"3px" }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Question-by-question review */}
        <div style={{ background:cardBg, border, borderRadius:"16px", padding:"20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px", flexWrap:"wrap", gap:"10px" }}>
            <div style={{ color:"#aaa", fontSize:"11px", fontWeight:700, letterSpacing:"1px", textTransform:"uppercase" }}>Question Review ({filteredQs.length})</div>
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
              {[["all","All","#666"],["correct","Correct","#4ade80"],["wrong","Wrong","#ff6b6b"],["skipped","Skipped","#818cf8"]].map(([k,l,c]) => (
                <button key={k} onClick={() => setFilter(k)} style={{ background:filter===k?`${c}20`:"transparent", border:`1px solid ${filter===k?c:"rgba(255,255,255,0.1)"}`, color:filter===k?c:"#555", padding:"5px 12px", borderRadius:"20px", cursor:"pointer", fontSize:"12px", fontWeight:700 }}>{l}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign:"center", padding:"40px", color:"#555" }}>Loading questions...</div>
          ) : filteredQs.length === 0 ? (
            <div style={{ textAlign:"center", padding:"30px", color:"#555" }}>No questions in this filter.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
              {filteredQs.map((q, qi) => {
                const ua = answers[q.id];
                const correct = q.correct_answer || q.correct;
                const isCorrect = ua !== undefined && String(ua).toLowerCase().trim() === String(correct).toLowerCase().trim();
                const isSkipped = ua === undefined;
                const statusColor = isCorrect ? "#4ade80" : isSkipped ? "#818cf8" : "#ff6b6b";
                const statusLabel = isCorrect ? "✓ Correct" : isSkipped ? "— Skipped" : "✗ Wrong";
                const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
                const letters = ["a","b","c","d"];
                return (
                  <div key={q.id} style={{ border:`1px solid ${statusColor}30`, borderLeft:`4px solid ${statusColor}`, borderRadius:"10px", padding:"14px 16px", background:`${statusColor}06` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"10px", marginBottom:"10px", flexWrap:"wrap" }}>
                      <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
                        <span style={{ background:"rgba(255,255,255,0.06)", color:"#888", padding:"2px 8px", borderRadius:"4px", fontSize:"11px", fontWeight:700 }}>Q{questions.indexOf(q)+1}</span>
                        {q.subject && <span style={{ color:"#666", fontSize:"11px" }}>{q.subject}</span>}
                        <span style={{ color:statusColor, fontSize:"11px", fontWeight:700 }}>{statusLabel}</span>
                      </div>
                      <div style={{ display:"flex", gap:"10px", fontSize:"12px" }}>
                        <span style={{ color:"#4ade80" }}>+{q.marks||1}</span>
                        <span style={{ color:"#ff6b6b" }}>-{q.negative_marks||0}</span>
                      </div>
                    </div>
                    {q.image_url && <img src={q.image_url} alt="" style={{ maxHeight:120, borderRadius:"6px", marginBottom:"10px", display:"block" }} onError={e=>e.target.style.display="none"} />}
                    <p style={{ color:dark?"#ddd":"#333", fontSize:"14px", lineHeight:1.7, margin:"0 0 12px" }}>{q.question_text||q.text}</p>
                    <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      {opts.map((opt, oi) => {
                        if (!opt) return null;
                        const letter = letters[oi];
                        const isUserAns = ua !== undefined && String(ua).toLowerCase().trim() === letter;
                        const isCorrectAns = String(correct).toLowerCase().trim() === letter;
                        let bg = "transparent", bc = "rgba(255,255,255,0.06)", col = "#666";
                        if (isCorrectAns) { bg = "rgba(74,222,128,0.1)"; bc = "rgba(74,222,128,0.4)"; col = "#4ade80"; }
                        if (isUserAns && !isCorrectAns) { bg = "rgba(255,100,100,0.08)"; bc = "rgba(255,100,100,0.4)"; col = "#ff6b6b"; }
                        return (
                          <div key={oi} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"8px 12px", borderRadius:"7px", background:bg, border:`1px solid ${bc}` }}>
                            <span style={{ width:22, height:22, borderRadius:"50%", background:isCorrectAns?"rgba(74,222,128,0.2)":isUserAns?"rgba(255,100,100,0.2)":"rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center", color:col, fontSize:"11px", fontWeight:800, flexShrink:0 }}>{letter.toUpperCase()}</span>
                            <span style={{ color:col, fontSize:"13px", flex:1 }}>{opt}</span>
                            {isCorrectAns && <span style={{ color:"#4ade80", fontSize:"11px", fontWeight:700 }}>✓ Correct</span>}
                            {isUserAns && !isCorrectAns && <span style={{ color:"#ff6b6b", fontSize:"11px", fontWeight:700 }}>Your answer</span>}
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <div style={{ marginTop:"10px", background:"rgba(255,215,0,0.06)", border:"1px solid rgba(255,215,0,0.15)", borderRadius:"7px", padding:"10px 12px" }}>
                        <span style={{ color:"#FFD700", fontSize:"11px", fontWeight:700 }}>💡 EXPLANATION</span>
                        <p style={{ color:"#aaa", fontSize:"13px", margin:"4px 0 0", lineHeight:1.6 }}>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardPage({ user, setPage, setActiveTest }) {
  const dark = useTheme();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [showScorecard, setShowScorecard] = useState(false);

  const loadAttempts = () => {
    if (!user) return;
    supabaseRequest(`/attempts?user_id=eq.${user.id}&select=*,tests(id,name,duration_minutes,negative_value,sections,instructions)&order=created_at.desc&limit=50`, { token: user.token })
      .then(data => { setAttempts(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadAttempts(); }, [user]);

  if (!user) return null;

  const totalAttempts = attempts.length;
  const avgScore = attempts.length ? Math.round(attempts.reduce((s,a) => s + (a.score/a.total_marks*100), 0) / attempts.length) : 0;

  const handleReattempt = (a) => {
    const testId = a.test_id || a.tests?.id;
    if (!testId) { setPage("exams"); return; }
    // Clear old exam state so it starts fresh
    localStorage.removeItem(`mm_time_${testId}`);
    localStorage.removeItem(`mm_ans_${testId}`);
    localStorage.removeItem(`mm_mark_${testId}`);
    localStorage.removeItem(`mm_cur_${testId}`);
    setActiveTest({
      name: a.tests?.name || "Test",
      test_id: testId,
      duration: a.tests?.duration_minutes || a.duration_minutes || 90,
      limit: a.total_marks,
      negative_value: a.tests?.negative_value || a.negative_value || 0.33,
      sections: a.tests?.sections || null,
      instructions: a.tests?.instructions || null,
    });
    setShowScorecard(false);
    setPage("exam-interface");
  };

  return (
    <div style={{ padding:"80px 1rem 60px", maxWidth:"1100px", margin:"0 auto" }}>
      {showScorecard && selectedAttempt && (
        <ScorecardModal
          attempt={selectedAttempt}
          dark={dark}
          onClose={() => setShowScorecard(false)}
          onReattempt={() => handleReattempt(selectedAttempt)}
        />
      )}

      <div style={{ marginBottom:"28px" }}>
        <h1 style={{ color:dark?"#fff":"#111", fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"clamp(1.5rem,4vw,2.2rem)", margin:0 }}>Welcome back 👋</h1>
        <p style={{ color:dark?"#666":"#888", fontSize:"14px", marginTop:"4px" }}>{user.email}</p>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"16px", marginBottom:"32px" }}>
        {[
          ["📝 Tests Taken", totalAttempts, "#FFD700"],
          ["🎯 Avg Score", totalAttempts ? `${avgScore}%` : "—", "#4ade80"],
          ["✅ Best Score", attempts.length ? `${Math.max(...attempts.map(a=>Math.round(a.score/a.total_marks*100)))}%` : "—", "#818cf8"],
          ["📅 This Month", attempts.filter(a=>new Date(a.created_at).getMonth()===new Date().getMonth()).length, "#fb923c"],
        ].map(([l,v,c]) => (
          <div key={l} style={{ background:dark?"rgba(255,255,255,0.04)":"#fff", border:dark?"1px solid rgba(255,255,255,0.08)":"1px solid rgba(0,0,0,0.08)", borderRadius:"14px", padding:"20px", boxShadow:dark?"none":"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ color:dark?"#666":"#888", fontSize:"12px", marginBottom:"8px" }}>{l}</div>
            <div style={{ color:c, fontSize:"1.8rem", fontWeight:900, fontFamily:"'Sora',sans-serif" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom:"32px" }}>
        <h2 style={{ color:dark?"#aaa":"#888", fontSize:"14px", letterSpacing:"1px", textTransform:"uppercase", marginBottom:"12px" }}>Quick Actions</h2>
        <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
          <button onClick={() => setPage("exams")} style={{ background:"linear-gradient(135deg,#FFD700,#FF8C00)", border:"none", color:"#000", padding:"12px 24px", borderRadius:"10px", cursor:"pointer", fontSize:"14px", fontWeight:700 }}>Browse Exams →</button>
        </div>
      </div>

      {/* Attempts */}
      <div>
        <h2 id="recent-attempts" style={{ color:dark?"#aaa":"#888", fontSize:"14px", letterSpacing:"1px", textTransform:"uppercase", marginBottom:"12px" }}>Test History ({attempts.length})</h2>
        {loading ? (
          <div style={{ color:"#666", padding:"20px 0" }}>Loading...</div>
        ) : attempts.length === 0 ? (
          <div style={{ background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)", border:dark?"1px dashed rgba(255,255,255,0.1)":"1px dashed rgba(0,0,0,0.12)", borderRadius:"16px", padding:"40px", textAlign:"center" }}>
            <div style={{ fontSize:"3rem", marginBottom:"12px" }}>📚</div>
            <p style={{ color:"#666" }}>No tests taken yet. Start your first test!</p>
            <button onClick={() => setPage("exams")} style={{ marginTop:"16px", background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.4)", color:dark?"#FFD700":"#92600A", padding:"10px 24px", borderRadius:"8px", cursor:"pointer", fontSize:"14px" }}>Browse Exams</button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {attempts.map((a, i) => {
              const pct = a.total_marks > 0 ? Math.round((a.score/a.total_marks)*100) : 0;
              const pctColor = pct>=60?"#4ade80":pct>=40?"#fb923c":"#ff6b6b";
              const mm = Math.floor((a.time_taken_seconds||0)/60), ss = String((a.time_taken_seconds||0)%60).padStart(2,"0");
              return (
                <div key={i} style={{ background:dark?"rgba(255,255,255,0.04)":"#fff", border:dark?"1px solid rgba(255,255,255,0.08)":"1px solid rgba(0,0,0,0.08)", borderRadius:"14px", padding:"16px 20px", boxShadow:dark?"none":"0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"12px" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:dark?"#fff":"#111", fontWeight:700, fontSize:"15px", marginBottom:"6px" }}>{a.tests?.name || "Test"}</div>
                      <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
                        <span style={{ color:"#4ade80", fontSize:"12px" }}>✓ {a.correct_count||0}</span>
                        <span style={{ color:"#ff6b6b", fontSize:"12px" }}>✗ {a.wrong_count||0}</span>
                        <span style={{ color:"#818cf8", fontSize:"12px" }}>— {a.unattempted_count||0}</span>
                        <span style={{ color:"#666", fontSize:"12px" }}>⏱ {mm}m {ss}s</span>
                        <span style={{ color:"#444", fontSize:"12px" }}>{new Date(a.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:"14px", flexShrink:0, flexWrap:"wrap" }}>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ color:pctColor, fontWeight:900, fontSize:"22px", fontFamily:"'Sora',sans-serif", lineHeight:1 }}>{pct}%</div>
                        <div style={{ color:"#666", fontSize:"12px" }}>{a.score}/{a.total_marks}</div>
                      </div>
                      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                        <button onClick={() => { setSelectedAttempt(a); setShowScorecard(true); }}
                          style={{ background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.3)", color:dark?"#FFD700":"#92600A", padding:"7px 14px", borderRadius:"7px", cursor:"pointer", fontSize:"12px", fontWeight:700 }}>📊 Scorecard</button>
                        <button onClick={() => handleReattempt(a)}
                          style={{ background:"rgba(74,222,128,0.1)", border:"1px solid rgba(74,222,128,0.3)", color:"#4ade80", padding:"7px 14px", borderRadius:"7px", cursor:"pointer", fontSize:"12px", fontWeight:700 }}>🔄 Reattempt</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


// SECURE EXAM INTERFACE — Advanced
function ExamInterface({ setPage, activeTest, setDark }) {
  const dark = useTheme();
  const { user } = useAuth();
  const testName = activeTest?.name || "Mock Test";
  const DURATION = (activeTest?.duration || 10) * 60;

  const [questions, setQuestions] = useState([]);
  const [sections, setSections] = useState([]); // parsed section config
  const [activeSection, setActiveSection] = useState(null); // null = all
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Dynamic keys to ensure we save state for THIS specific test
  const timerKey = `mm_time_${activeTest?.test_id}`;
  const ansKey = `mm_ans_${activeTest?.test_id}`;
  const markKey = `mm_mark_${activeTest?.test_id}`;
  const curKey = `mm_cur_${activeTest?.test_id}`;

  // Initialize state from storage if it exists, otherwise use defaults
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem(timerKey);
    return saved ? parseInt(saved, 10) : DURATION;
  });
  const [answers, setAnswers] = useState(() => {
    const saved = localStorage.getItem(ansKey);
    return saved ? JSON.parse(saved) : {};
  });
  const [marked, setMarked] = useState(() => {
    const saved = localStorage.getItem(markKey);
    return saved ? JSON.parse(saved) : {};
  });
  const [current, setCurrent] = useState(() => {
    const saved = localStorage.getItem(curKey);
    return saved ? parseInt(saved, 10) : 0;
  });

  // Silently sync to local storage whenever they change
  useEffect(() => { localStorage.setItem(timerKey, timeLeft); }, [timeLeft, timerKey]);
  useEffect(() => { localStorage.setItem(ansKey, JSON.stringify(answers)); }, [answers, ansKey]);
  useEffect(() => { localStorage.setItem(markKey, JSON.stringify(marked)); }, [marked, markKey]);
  useEffect(() => { localStorage.setItem(curKey, current); }, [current, curKey]);
  const [submitted, setSubmitted] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [warnings, setWarnings] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [score, setScore] = useState(null);
  const [showPalette, setShowPalette] = useState(false); // mobile drawer
  const [showSolution, setShowSolution] = useState(null); // question index for solution view
  const [activeResultTab, setActiveResultTab] = useState("overview");
  const timerRef = useRef();

  useEffect(() => {
    const endpoint = activeTest?.test_id
      ? `/questions?test_id=eq.${activeTest.test_id}&select=*`
      : `/questions?limit=20&select=*`;
    supabaseRequest(endpoint, { token: user?.token })
      .then(data => {
        if (!data || data.length === 0) {
          setLoadError("No questions found for this test. Go to Admin → Questions and upload questions linked to this test.");
          setLoading(false); return;
        }
        // Parse sections from activeTest
        let parsedSections = [];
        try {
          if (activeTest?.sections) {
            parsedSections = typeof activeTest.sections === "string"
              ? JSON.parse(activeTest.sections) : activeTest.sections;
          }
        } catch {}

        // Map questions — if sections exist, apply per-section marks/negative
        const qs = data.map((q, idx) => {
          // Find which section this question belongs to based on subject or order
          let secMarks = q.marks || 1;
          let secNeg = q.negative_marks ?? 0.25;
          if (parsedSections.length > 0) {
            // Match by subject first
            const secBySubj = parsedSections.find(s =>
              s.subject && q.subject &&
              s.subject.toLowerCase().trim() === q.subject.toLowerCase().trim()
            );
            if (secBySubj) {
              secMarks = parseFloat(secBySubj.marks_per_question) || secMarks;
              secNeg = parseFloat(secBySubj.negative_marks) ?? secNeg;
            } else {
              // Fall back to order-based assignment
              let cumulative = 0;
              for (const sec of parsedSections) {
                cumulative += parseInt(sec.questions_count) || 0;
                if (idx < cumulative) {
                  secMarks = parseFloat(sec.marks_per_question) || secMarks;
                  secNeg = parseFloat(sec.negative_marks) ?? secNeg;
                  break;
                }
              }
            }
          }
          return {
            id: q.id,
            text: q.question_text,
            options: [q.option_a, q.option_b, q.option_c, q.option_d],
            correct: q.correct_answer?.toLowerCase()?.trim(),
            marks: secMarks,
            negative: secNeg,
            subject: q.subject || "General",
            explanation: q.explanation || "",
            image_url: q.image_url || null,
          };
        });
        setSections(parsedSections);
        setQuestions(qs);
        setLoading(false);
      })
      .catch(err => { setLoadError("Failed to load questions: " + err.message); setLoading(false); });
  }, []);

  const TOTAL = questions.length;

  const handleSubmit = useCallback(async () => {
    if (submitted) return;
    clearInterval(timerRef.current);
    let s = 0;
    questions.forEach(q => {
      const userAns = answers[q.id]; // "a","b","c","d" or undefined
      const correctAns = q.correct;  // "a","b","c","d"
      const marks = parseFloat(q.marks) || 1;
      const neg = parseFloat(q.negative) ?? 0.25;
      if (userAns === undefined || userAns === null) {
        // Unattempted — no change
      } else if (String(userAns).toLowerCase().trim() === String(correctAns).toLowerCase().trim()) {
        // Correct
        s += marks;
      } else {
        // Wrong — apply negative marking
        s -= neg;
      }
    });
    const finalScore = parseFloat(s.toFixed(2)); // Negative scores allowed
    const totalMarks = questions.reduce((acc, q) => acc + q.marks, 0);
    setScore(finalScore);
    setSubmitted(true);
    setShowPalette(false);
    // Clear the saved test data so they can retake it fresh later
    localStorage.removeItem(`mm_time_${activeTest?.test_id}`);
    localStorage.removeItem(`mm_ans_${activeTest?.test_id}`);
    localStorage.removeItem(`mm_mark_${activeTest?.test_id}`);
    localStorage.removeItem(`mm_cur_${activeTest?.test_id}`);
    // Save attempt to Supabase
    if (user?.id && (activeTest?.test_id || activeTest?.id)) {
      try {
        const correctCount = questions.filter(q => 
          answers[q.id] !== undefined && 
          String(answers[q.id]).toLowerCase().trim() === String(q.correct).toLowerCase().trim()
        ).length;
        const wrongCount = questions.filter(q => 
          answers[q.id] !== undefined && 
          String(answers[q.id]).toLowerCase().trim() !== String(q.correct||"").toLowerCase().trim()
        ).length;
        const unattemptedCount = questions.filter(q => answers[q.id] === undefined).length;
        // Build per-subject breakdown
        const subjectMap = {};
        questions.forEach(q => {
          const s = q.subject || "General";
          if (!subjectMap[s]) subjectMap[s] = { correct: 0, wrong: 0, skipped: 0, total: 0, score: 0 };
          subjectMap[s].total++;
          const ua = answers[q.id];
          if (ua === undefined) { subjectMap[s].skipped++; }
          else if (String(ua).toLowerCase().trim() === String(q.correct||"").toLowerCase().trim()) { subjectMap[s].correct++; subjectMap[s].score += (q.marks||1); }
          else { subjectMap[s].wrong++; subjectMap[s].score -= (q.negative||0.25); }
        });
        await supabaseRequest("/attempts", {
          method: "POST",
          body: {
            user_id: user.id,
            test_id: activeTest.test_id || activeTest.id,
            score: finalScore,
            total_marks: totalMarks,
            correct_count: correctCount,
            wrong_count: wrongCount,
            unattempted_count: unattemptedCount,
            time_taken_seconds: DURATION - timeLeft,
            status: "completed",
            submitted_at: new Date().toISOString(),
            answers_snapshot: JSON.stringify(answers),
            subject_scores: JSON.stringify(subjectMap),
          },
          token: user.token,
          prefer: "return=minimal",
        });
      } catch(e) {
      }
      // Silently sync the test's total_marks in DB to match actual question marks
      try {
        if (activeTest?.test_id || activeTest?.id) {
          await supabaseRequest(`/tests?id=eq.${activeTest.test_id || activeTest.id}`, {
            method: "PATCH",
            body: { total_marks: totalMarks },
            token: user.token,
            prefer: "return=minimal"
          });
        }
      } catch(e) { /* non-critical */ }
    }
  }, [answers, submitted, questions, user, activeTest, timeLeft, DURATION]);

  // Set body flag so DevTools blocker knows exam is active
  useEffect(() => {
    document.body.setAttribute("data-exam-active", "true");
    // Listen for DevTools detection event
    const handleDevTools = () => {
      if (!submitted) {
        setWarnings(w => {
          const nw = w + 1;
          setShowWarning(true);
          if (nw >= 3) handleSubmit();
          return nw;
        });
      }
    };
    document.addEventListener("mm-devtools-detected", handleDevTools);
    return () => {
      document.body.removeAttribute("data-exam-active");
      document.removeEventListener("mm-devtools-detected", handleDevTools);
    };
  }, [submitted, handleSubmit]);

  useEffect(() => {
    if (loading || loadError) return;
    const handleVisibility = () => {
      if (document.hidden && !submitted) {
        setWarnings(w => { const nw = w + 1; setShowWarning(true); if (nw >= 3) handleSubmit(); return nw; });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    const handleCtx = e => { if (!submitted) e.preventDefault(); };
    document.addEventListener("contextmenu", handleCtx);
    // Don't start timer if already submitted or loading
    if (!submitted && !loading && !loadError) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            handleSubmit(); // Auto-submit — no confirm dialog
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("contextmenu", handleCtx);
      clearInterval(timerRef.current);
    };
  }, [submitted, loading, loadError, handleSubmit]);

  const mm = String(Math.floor(timeLeft/60)).padStart(2,"0");
  const ss = String(timeLeft%60).padStart(2,"0");
  const isRed = timeLeft < 120;
  const isOrange = timeLeft < 300 && timeLeft >= 120;

  // Question status helpers
  const getStatus = (q, i) => {
    if (answers[q.id] !== undefined && marked[q.id]) return "marked-answered";
    if (marked[q.id]) return "marked";
    if (answers[q.id] !== undefined) return "answered";
    if (i < current) return "skipped";
    return "unattempted";
  };

  const statusColor = (status, isCurrent) => {
    if (isCurrent) return { bg: "rgba(255,215,0,0.25)", border: "2px solid #FFD700", color: "#FFD700" };
    switch(status) {
      case "answered": return { bg: "rgba(74,222,128,0.2)", border: "1px solid #4ade80", color: "#4ade80" };
      case "marked": return { bg: "rgba(251,146,60,0.2)", border: "1px solid #fb923c", color: "#fb923c" };
      case "marked-answered": return { bg: "rgba(129,140,248,0.2)", border: "1px solid #818cf8", color: "#818cf8" };
      case "skipped": return { bg: "rgba(255,100,100,0.15)", border: "1px solid rgba(255,100,100,0.4)", color: "#ff6b6b" };
      default: return { bg: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#555" };
    }
  };

  const answered = Object.keys(answers).length;
  const markedCount = Object.keys(marked).filter(k => marked[k]).length;
  const skipped = questions.filter((q,i) => i < current && answers[q.id] === undefined && !marked[q.id]).length;

  // Section helpers
  const SECT_COLORS = ["#FFD700","#4ade80","#818cf8","#fb923c","#f472b6","#22d3ee","#a78bfa","#34d399","#f87171","#60a5fa"];
  const getSectionColor = (idx) => SECT_COLORS[idx % SECT_COLORS.length];

  // Get questions for active section (or all)
  const visibleQuestions = activeSection === null
    ? questions
    : questions.filter(q => {
        const sec = sections[activeSection];
        if (!sec) return true;
        if (sec.subject && q.subject && sec.subject.toLowerCase().trim() === q.subject.toLowerCase().trim()) return true;
        // Order based fallback
        const secIdx = sections.indexOf(sec);
        let start = 0;
        for (let i = 0; i < secIdx; i++) start += parseInt(sections[i].questions_count)||0;
        const end = start + (parseInt(sec.questions_count)||0);
        const globalIdx = questions.indexOf(q);
        return globalIdx >= start && globalIdx < end;
      });

  // Jump to first question of a section
  const jumpToSection = (secIdx) => {
    setActiveSection(secIdx);
    if (secIdx === null) return;
    const sec = sections[secIdx];
    if (!sec) return;
    // Find first question of this section
    const firstQ = questions.findIndex(q => {
      if (sec.subject && q.subject && sec.subject.toLowerCase().trim() === q.subject.toLowerCase().trim()) return true;
      let start = 0;
      for (let i = 0; i < secIdx; i++) start += parseInt(sections[i].questions_count)||0;
      return questions.indexOf(q) === start;
    });
    if (firstQ >= 0) setCurrent(firstQ);
  };

  // Get section index of a question
  const getQuestionSection = (q, idx) => {
    if (!sections.length) return null;
    const bySubject = sections.findIndex(s => s.subject && q.subject && s.subject.toLowerCase().trim() === q.subject.toLowerCase().trim());
    if (bySubject >= 0) return bySubject;
    let cumulative = 0;
    for (let i = 0; i < sections.length; i++) {
      cumulative += parseInt(sections[i].questions_count)||0;
      if (idx < cumulative) return i;
    }
    return sections.length - 1;
  };

  // Loading
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", background: "#080a14" }}>
      <div style={{ width: 52, height: 52, border: "4px solid rgba(255,215,0,0.15)", borderTop: "4px solid #FFD700", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color: dark ? "#aaa" : "#555", fontFamily: "'Sora',sans-serif" }}>Loading questions...</p>
      <p style={{ color: "#555", fontSize: "12px" }}>{testName}</p>
    </div>
  );

  if (loadError) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", background: "#080a14" }}>
      <div style={{ textAlign: "center", maxWidth: "500px" }}>
        <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>⚠️</div>
        <h2 style={{ color: dark ? "#fff" : "#111", fontWeight: 700, marginBottom: "12px", fontFamily: "'Sora',sans-serif" }}>No Questions Found</h2>
        <p style={{ color: dark ? "#666" : "#888", fontSize: "14px", marginBottom: "24px", lineHeight: 1.6 }}>{loadError}</p>
        <button onClick={() => setPage("exams")} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "12px 28px", borderRadius: "10px", cursor: "pointer", fontWeight: 700 }}>Back to Exams</button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // RESULTS SCREEN
  // ─────────────────────────────────────────────
  if (submitted && score !== null) {
    const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
    const pct = totalMarks > 0 ? Math.round(score / totalMarks * 100) : 0;
    const isNegativeScore = score < 0;
    const normAnswer = (v) => typeof v === "number" ? ["a","b","c","d"][v] || String(v) : String(v||"").toLowerCase().trim();
    const correct = questions.filter(q => answers[q.id] !== undefined && normAnswer(answers[q.id]) === normAnswer(q.correct)).length;
    const wrong = questions.filter(q => answers[q.id] !== undefined && normAnswer(answers[q.id]) !== normAnswer(q.correct)).length;
    const skippedQ = TOTAL - correct - wrong;
    const timeTaken = DURATION - timeLeft;
    const mm2 = String(Math.floor(timeTaken/60)).padStart(2,"0");
    const ss2 = String(timeTaken%60).padStart(2,"0");

    const subjects = {};
    questions.forEach(q => {
      const s = q.subject || "General";
      if (!subjects[s]) subjects[s] = { correct: 0, wrong: 0, skipped: 0, total: 0, marks: 0 };
      subjects[s].total++;
      if (answers[q.id] !== undefined && normAnswer(answers[q.id]) === normAnswer(q.correct)) { subjects[s].correct++; subjects[s].marks += q.marks; }
      else if (answers[q.id] !== undefined) { subjects[s].wrong++; subjects[s].marks -= q.negative; }
      else subjects[s].skipped++;
    });

    const grade = pct >= 90 ? { label: "Excellent", color: dark ? "#FFD700" : "#92600A", emoji: "🥇" }
      : pct >= 75 ? { label: "Very Good", color: "#4ade80", emoji: "🎉" }
      : pct >= 60 ? { label: "Good", color: "#4ade80", emoji: "👍" }
      : pct >= 40 ? { label: "Average", color: "#fb923c", emoji: "📈" }
      : { label: "Need Practice", color: "#ff6b6b", emoji: "💪" };

    const resultTabs = ["overview", "solutions"];

    return (
      <div style={{ minHeight: "100vh", background: T.examBg(dark), padding: "20px 1rem 60px" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "28px", animation: "fadeUp 0.5s ease" }}>
            <div style={{ fontSize: "4rem", marginBottom: "8px" }}>{grade.emoji}</div>
            <h1 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: "clamp(1.6rem,4vw,2.4rem)", color: "#fff", marginBottom: "4px" }}>Test Completed!</h1>
            <p style={{ color: dark ? "#666" : "#888", fontSize: "14px", marginBottom: "12px" }}>{testName}</p>
            <span style={{ background: grade.color + "22", border: `1px solid ${grade.color}55`, color: grade.color, padding: "4px 16px", borderRadius: "20px", fontSize: "14px", fontWeight: 700 }}>{grade.label}</span>
          </div>

          {/* Score hero */}
          <div style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,140,0,0.05))", border: "1px solid rgba(255,215,0,0.2)", borderRadius: "20px", padding: "28px", marginBottom: "20px", textAlign: "center", animation: "fadeUp 0.6s ease" }}>
            <div style={{ fontSize: "clamp(3rem,8vw,5rem)", fontWeight: 900, fontFamily: "'Sora',sans-serif", color: dark ? "#FFD700" : "#92600A", lineHeight: 1 }}>{pct}%</div>
            <div style={{ color: isNegativeScore ? "#ff6b6b" : (dark ? "#aaa" : "#777"), fontSize: "15px", marginTop: "6px" }}>
              {isNegativeScore ? "⚠️ " : ""}{score.toFixed(2)} out of {totalMarks} marks{isNegativeScore ? " (negative score)" : ""}
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", height: "8px", margin: "16px 0 8px", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#FFD700,#FF8C00)", borderRadius: "8px", transition: "width 1.5s ease" }} />
            </div>
          </div>

          {/* Stats grid */}
          <div className="results-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "10px", marginBottom: "20px", animation: "fadeUp 0.7s ease" }}>
            {[
              { v: correct, l: "Correct", c: "#4ade80", icon: "✓" },
              { v: wrong, l: "Wrong", c: "#ff6b6b", icon: "✗" },
              { v: skippedQ, l: "Skipped", c: "#818cf8", icon: "–" },
              { v: `${mm2}:${ss2}`, l: "Time Taken", c: "#fb923c", icon: "⏱" },
            ].map(({ v, l, c, icon }) => (
              <div key={l} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px", textAlign: "center" }}>
                <div style={{ color: c, fontSize: "1.8rem", fontWeight: 900, fontFamily: "'Sora',sans-serif" }}>{v}</div>
                <div style={{ color: "#555", fontSize: "11px", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Result tabs */}
          <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "4px", marginBottom: "20px" }}>
            {[["overview","📊 Overview"],["solutions","📝 Solutions"]].map(([k,l]) => (
              <button key={k} onClick={() => setActiveResultTab(k)} style={{
                flex: 1, padding: "10px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: activeResultTab===k ? 700 : 400,
                background: activeResultTab===k ? "rgba(255,215,0,0.15)" : "transparent",
                color: activeResultTab===k ? (dark ? "#FFD700" : "#92600A") : (dark ? "#666" : "#888"),
              }}>{l}</button>
            ))}
          </div>

          {activeResultTab === "overview" && (
            <div style={{ animation: "fadeUp 0.3s ease" }}>

              {/* Section-wise Breakdown */}
              {sections.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "20px", marginBottom: "16px" }}>
                  <h3 style={{ color: dark ? "#aaa" : "#888", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>📚 Section-wise Breakdown</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {sections.map((sec, i) => {
                      const secColor = sec.color || getSectionColor(i);
                      const secQs = questions.filter((q, qi) => getQuestionSection(q, qi) === i);
                      const secCorrect = secQs.filter(q => answers[q.id] !== undefined && String(answers[q.id]).toLowerCase().trim() === String(q.correct).toLowerCase().trim()).length;
                      const secWrong = secQs.filter(q => answers[q.id] !== undefined && String(answers[q.id]).toLowerCase().trim() !== String(q.correct).toLowerCase().trim()).length;
                      const secSkipped = secQs.filter(q => answers[q.id] === undefined).length;
                      const secMaxMarks = secQs.reduce((s, q) => s + q.marks, 0);
                      const secScore = parseFloat(secQs.reduce((s, q) => {
                        if (answers[q.id] === undefined) return s;
                        return String(answers[q.id]).toLowerCase().trim() === String(q.correct).toLowerCase().trim() ? s + q.marks : s - q.negative;
                      }, 0).toFixed(2));
                      const secPct = secMaxMarks > 0 ? Math.max(0, Math.round((secScore / secMaxMarks) * 100)) : 0;
                      return (
                        <div key={i} style={{ background: `${secColor}08`, border: `1px solid ${secColor}30`, borderRadius: "12px", padding: "14px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ width: 10, height: 10, borderRadius: "50%", background: secColor, flexShrink: 0 }} />
                              <span style={{ color: secColor, fontWeight: 700, fontSize: "14px" }}>{sec.name}</span>
                              {sec.subject && <span style={{ color: "#666", fontSize: "12px" }}>· {sec.subject}</span>}
                              <span style={{ color: "#555", fontSize: "11px" }}>{secQs.length} Qs</span>
                            </div>
                            <div style={{ display: "flex", gap: "10px", fontSize: "12px", flexWrap: "wrap" }}>
                              <span style={{ color: "#4ade80", fontWeight: 600 }}>✓ {secCorrect}</span>
                              <span style={{ color: "#ff6b6b", fontWeight: 600 }}>✗ {secWrong}</span>
                              <span style={{ color: "#666" }}>— {secSkipped}</span>
                              <span style={{ color: secScore < 0 ? "#ff6b6b" : secColor, fontWeight: 800 }}>{secScore < 0 ? "⚠️ " : ""}{secScore}/{secMaxMarks}</span>
                            </div>
                          </div>
                          <div style={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${secPct}%`, background: secColor, borderRadius: "3px", transition: "width 1s ease" }} />
                          </div>
                          <div style={{ color: "#555", fontSize: "11px", marginTop: "5px" }}>{secPct}% score rate · +{sec.marks_per_question}/correct · -{sec.negative_marks}/wrong</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Subject Breakdown */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "20px", marginBottom: "16px" }}>
                <h3 style={{ color: dark ? "#aaa" : "#888", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>Subject-wise Performance</h3>
                {Object.entries(subjects).map(([sub, d]) => {
                  const spct = Math.round(d.correct / d.total * 100);
                  return (
                    <div key={sub} style={{ marginBottom: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span style={{ color: dark ? "#ddd" : "#222", fontSize: "14px", fontWeight: 600 }}>{sub}</span>
                        <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
                          <span style={{ color: "#4ade80" }}>✓ {d.correct}</span>
                          <span style={{ color: "#ff6b6b" }}>✗ {d.wrong}</span>
                          <span style={{ color: "#818cf8" }}>– {d.skipped}</span>
                          <span style={{ color: dark ? "#FFD700" : "#92600A", fontWeight: 700 }}>{spct}%</span>
                        </div>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "4px", height: "6px", overflow: "hidden" }}>
                        <div style={{ width: `${spct}%`, height: "100%", background: spct >= 70 ? "#4ade80" : spct >= 40 ? "#fb923c" : "#ff6b6b", borderRadius: "4px", transition: "width 1s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Performance analysis */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "20px", marginBottom: "20px" }}>
                <h3 style={{ color: dark ? "#aaa" : "#888", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "14px" }}>Performance Analysis</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ color: "#4ade80", fontSize: "11px", marginBottom: "4px" }}>ACCURACY</div>
                    <div style={{ color: dark ? "#fff" : "#111", fontSize: "1.4rem", fontWeight: 800 }}>{answered > 0 ? Math.round(correct/answered*100) : 0}%</div>
                    <div style={{ color: "#555", fontSize: "11px" }}>{correct} correct of {answered} attempted</div>
                  </div>
                  <div style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ color: dark ? "#FFD700" : "#92600A", fontSize: "11px", marginBottom: "4px" }}>ATTEMPT RATE</div>
                    <div style={{ color: dark ? "#fff" : "#111", fontSize: "1.4rem", fontWeight: 800 }}>{Math.round(answered/TOTAL*100)}%</div>
                    <div style={{ color: "#555", fontSize: "11px" }}>{answered} of {TOTAL} attempted</div>
                  </div>
                  <div style={{ background: "rgba(255,100,100,0.05)", border: "1px solid rgba(255,100,100,0.15)", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ color: "#ff6b6b", fontSize: "11px", marginBottom: "4px" }}>MARKS LOST</div>
                    <div style={{ color: dark ? "#fff" : "#111", fontSize: "1.4rem", fontWeight: 800 }}>-{(wrong * (questions[0]?.negative || 0.25)).toFixed(2)}</div>
                    <div style={{ color: "#555", fontSize: "11px" }}>from {wrong} wrong answers</div>
                  </div>
                  <div style={{ background: "rgba(129,140,248,0.05)", border: "1px solid rgba(129,140,248,0.15)", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ color: "#818cf8", fontSize: "11px", marginBottom: "4px" }}>AVG TIME/Q</div>
                    <div style={{ color: dark ? "#fff" : "#111", fontSize: "1.4rem", fontWeight: 800 }}>{answered > 0 ? Math.round(timeTaken/answered) : 0}s</div>
                    <div style={{ color: "#555", fontSize: "11px" }}>per attempted question</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeResultTab === "solutions" && (
            <div style={{ animation: "fadeUp 0.3s ease" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {questions.map((q, i) => {
                  const userAns = answers[q.id];
                  const isCorrect = userAns !== undefined && String(userAns).toLowerCase().trim() === String(q.correct).toLowerCase().trim();
                  const isWrong = userAns !== undefined && !isCorrect;
                  const isSkipped = userAns === undefined;
                  const statusC = isCorrect ? "#4ade80" : isWrong ? "#ff6b6b" : "#818cf8";
                  const statusIcon = isCorrect ? "✓" : isWrong ? "✗" : "–";
                  return (
                    <div key={q.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${statusC}33`, borderRadius: "14px", overflow: "hidden" }}>
                      <div
                        onClick={() => setShowSolution(showSolution === i ? null : i)}
                        style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "12px" }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: statusC + "22", border: `1px solid ${statusC}55`, display: "flex", alignItems: "center", justifyContent: "center", color: statusC, fontWeight: 800, fontSize: "13px", flexShrink: 0 }}>{statusIcon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: dark ? "#888" : "#aaa", fontSize: "11px", marginBottom: "4px" }}>Q{i+1} • {q.subject}</div>
                          <div style={{ color: dark ? "#ddd" : "#333", fontSize: "14px", lineHeight: 1.5 }}>{q.text.length > 100 ? q.text.slice(0,100) + "..." : q.text}</div>
                        </div>
                        <div style={{ color: "#555", fontSize: "18px", flexShrink: 0 }}>{showSolution === i ? "▲" : "▼"}</div>
                      </div>
                      {showSolution === i && (
                        <div style={{ padding: "0 18px 18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ paddingTop: "14px", marginBottom: "12px", color: dark ? "#ccc" : "#333", fontSize: "14px", lineHeight: 1.7 }}>{q.text}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
                            {q.options.map((opt, idx) => {
                              // q.correct is "a"/"b"/"c"/"d", idx is 0/1/2/3 — convert
                              const idxLetter = ["a","b","c","d"][idx];
                              // Handle both old (number index) and new (letter) format
                              const normAns = typeof userAns === "number" ? ["a","b","c","d"][userAns] : String(userAns).toLowerCase().trim();
                              const isUserChoice = normAns === idxLetter;
                              const isCorrectOpt = String(q.correct).toLowerCase().trim() === idxLetter;
                              const defTheme = T.optDefault(dark);
                              let bg = defTheme.bg, border = `1px solid ${defTheme.border}`, col = defTheme.text;
                              if (isCorrectOpt) { const t = T.optCorrect(dark); bg = t.bg; border = `1px solid ${t.border}`; col = t.text; }
                              if (isUserChoice && !isCorrectOpt) { const t = T.optWrong(dark); bg = t.bg; border = `1px solid ${t.border}`; col = t.text; }
                              return (
                                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "8px", background: bg, border }}>
                                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: col, fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>{["A","B","C","D"][idx]}</span>
                                  <span style={{ color: col, fontSize: "14px" }}>{opt}</span>
                                  {isCorrectOpt && <span style={{ marginLeft: "auto", color: "#4ade80", fontSize: "12px" }}>✓ Correct</span>}
                                  {isUserChoice && !isCorrectOpt && <span style={{ marginLeft: "auto", color: "#ff6b6b", fontSize: "12px" }}>Your answer</span>}
                                </div>
                              );
                            })}
                          </div>
                          {q.explanation && (
                            <div style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: "8px", padding: "12px 14px" }}>
                              <span style={{ color: dark ? "#FFD700" : "#92600A", fontSize: "11px", fontWeight: 700 }}>💡 EXPLANATION</span>
                              <p style={{ color: "#aaa", fontSize: "13px", marginTop: "6px", lineHeight: 1.6, margin: "6px 0 0" }}>{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px", flexWrap: "wrap" }}>
            <button onClick={() => setPage("exams")} style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.15)", color: dark ? "#fff" : "#333", padding: "13px 28px", borderRadius: "10px", cursor: "pointer", fontSize: "15px", fontWeight: 600 }}>← More Tests</button>
            <button onClick={() => setPage("dashboard")} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "13px 32px", borderRadius: "10px", cursor: "pointer", fontSize: "15px", fontWeight: 800 }}>Dashboard →</button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // EXAM INTERFACE
  // ─────────────────────────────────────────────
  const q = questions[current];

  // Question Palette component (shared between desktop sidebar and mobile drawer)
  const QuestionPalette = ({ onClose }) => (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div style={{ color: T.primary(dark), fontSize: "14px", fontWeight: 700 }}>Question Palette</div>
        {onClose && <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#aaa", fontSize: "20px", cursor: "pointer", lineHeight: 1 }}>×</button>}
      </div>
      {/* Legend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "14px", fontSize: "11px" }}>
        {[
          { c: T.green(dark), l: `Answered (${answered})` },
          { c: T.red(dark), l: `Skipped (${skipped})` },
          { c: T.orange(dark), l: `Marked (${markedCount})` },
          { c: T.muted(dark), l: `Not visited` },
        ].map(({ c, l }) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "2px", background: c + "44", border: `1px solid ${c}88`, flexShrink: 0 }} />
            <span style={{ color: "#666" }}>{l}</span>
          </div>
        ))}
      </div>
      {/* Section filter in palette */}
      {sections.length > 0 && (
        <div style={{ marginBottom: "10px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
          <button onClick={() => setActiveSection(null)} style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "10px", border: "none", cursor: "pointer", background: activeSection === null ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.06)", color: activeSection === null ? "#FFD700" : "#666" }}>All</button>
          {sections.map((sec, i) => {
            const c = sec.color || getSectionColor(i);
            return <button key={i} onClick={() => jumpToSection(i)} style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "10px", border: "none", cursor: "pointer", background: activeSection === i ? `${c}30` : "rgba(255,255,255,0.06)", color: activeSection === i ? c : "#666" }}>{sec.name}</button>;
          })}
        </div>
      )}
      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
        {(activeSection === null ? questions : visibleQuestions).map((qq, _) => {
          const i = questions.indexOf(qq);
          const status = getStatus(qq, i);
          const isCurrent = i === current;
          const sc = statusColor(status, isCurrent);
          return (
            <button key={i} onClick={() => { setCurrent(i); if(onClose) onClose(); }} style={{
              height: "36px", borderRadius: "6px", border: sc.border,
              background: sc.bg, color: sc.color,
              cursor: "pointer", fontSize: "12px", fontWeight: 700,
              position: "relative", transition: "all 0.15s"
            }}>
              {i+1}
              {marked[qq.id] && <span style={{ position: "absolute", top: 1, right: 2, fontSize: "7px", color: "#fb923c" }}>●</span>}
            </button>
          );
        })}
      </div>
      {/* Stats */}
      <div style={{ marginTop: "14px", padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#555", fontSize: "12px", marginBottom: "6px" }}>
          <span>Total Questions</span><span style={{ color: T.secondary(dark) }}>{TOTAL}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#555", fontSize: "12px", marginBottom: "6px" }}>
          <span>Attempted</span><span style={{ color: "#4ade80" }}>{answered}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#555", fontSize: "12px" }}>
          <span>Remaining</span><span style={{ color: "#ff6b6b" }}>{TOTAL - answered}</span>
        </div>
      </div>
      <button onClick={() => {
setShowSubmitConfirm(true);
      }} style={{
        width: "100%", marginTop: "14px",
        background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none",
        color: "#000", padding: "13px", borderRadius: "10px",
        cursor: "pointer", fontSize: "15px", fontWeight: 800
      }}>Submit Test ✓</button>
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: T.examBg(dark), userSelect: "none", overflow: "hidden", transition: "background 0.3s" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      `}</style>

      {/* Submit Confirm Modal */}
      {showSubmitConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{
            background: dark ? "#0f1120" : "#ffffff",
            border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.12)",
            borderRadius: "20px", padding: "32px 28px", maxWidth: "420px", width: "100%",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)"
          }}>
            {/* Icon */}
            <div style={{ textAlign:"center", marginBottom:"20px" }}>
              <div style={{ width:64, height:64, borderRadius:"50%", background:"rgba(255,215,0,0.1)", border:"2px solid rgba(255,215,0,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"28px", margin:"0 auto" }}>📋</div>
            </div>
            <h3 style={{ color: dark?"#fff":"#111", fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"1.2rem", textAlign:"center", margin:"0 0 8px" }}>Submit Test?</h3>
            <p style={{ color: dark?"#666":"#888", fontSize:"13px", textAlign:"center", margin:"0 0 24px" }}>Once submitted, answers cannot be changed.</p>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px", marginBottom:"24px" }}>
              {[
                { label:"Answered", value:answered, color:"#4ade80" },
                { label:"Unanswered", value:TOTAL-answered, color: (TOTAL-answered)>0?"#fb923c":"#4ade80" },
                { label:"Marked", value:Object.keys(marked).filter(k=>marked[k]).length, color:"#818cf8" },
              ].map(({label,value,color}) => (
                <div key={label} style={{ background: dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)", borderRadius:"10px", padding:"12px 8px", textAlign:"center" }}>
                  <div style={{ color, fontSize:"1.5rem", fontWeight:900, fontFamily:"'Sora',sans-serif", lineHeight:1 }}>{value}</div>
                  <div style={{ color: dark?"#555":"#888", fontSize:"10px", marginTop:"4px", textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Warning if unanswered */}
            {TOTAL - answered > 0 && (
              <div style={{ background:"rgba(251,146,60,0.08)", border:"1px solid rgba(251,146,60,0.25)", borderRadius:"10px", padding:"10px 14px", marginBottom:"20px", display:"flex", gap:"8px", alignItems:"center" }}>
                <span style={{ fontSize:"16px" }}>⚠️</span>
                <span style={{ color:"#fb923c", fontSize:"12px" }}>{TOTAL - answered} question{TOTAL-answered>1?"s":""} unanswered — they will be marked as skipped.</span>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => setShowSubmitConfirm(false)} style={{
                flex:1, background:"transparent",
                border: dark?"1px solid rgba(255,255,255,0.12)":"1px solid rgba(0,0,0,0.15)",
                color: dark?"#aaa":"#555", padding:"13px", borderRadius:"10px",
                cursor:"pointer", fontSize:"14px", fontWeight:600
              }}>Cancel</button>
              <button onClick={() => { setShowSubmitConfirm(false); handleSubmit(); }} style={{
                flex:2, background:"linear-gradient(135deg,#FFD700,#FF8C00)",
                border:"none", color:"#000", padding:"13px",
                borderRadius:"10px", cursor:"pointer", fontSize:"14px", fontWeight:800
              }}>✓ Submit Test</button>
            </div>
          </div>
        </div>
      )}

      {/* Warning banner */}
      {showWarning && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, background: "linear-gradient(135deg,rgba(255,50,50,0.97),rgba(200,0,0,0.97))", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>⚠️ Tab switch detected! Warning {warnings}/3 — Auto-submit at 3</span>
          <button onClick={() => setShowWarning(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Dismiss</button>
        </div>
      )}

      {/* Top Bar */}
      <div style={{
        background: dark ? "rgba(8,10,20,0.98)" : "rgba(255,255,255,0.98)", backdropFilter: "blur(12px)",
        borderBottom: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)",
        padding: "0 16px", height: "58px", flexShrink: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"
      }}>
        {/* Left: Test name */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="exam-topbar-title" style={{ color: T.primary(dark), fontWeight: 700, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{testName}</div>
          <div style={{ color: dark ? "#555" : "#888", fontSize: "11px" }}>Q{current+1}/{TOTAL} • {answered} answered</div>
        </div>

        {/* Center: Timer */}
        <div style={{
          color: isRed ? "#ff4444" : isOrange ? "#fb923c" : "#4ade80",
          fontFamily: "monospace", fontSize: "1.5rem", fontWeight: 900,
          background: isRed ? "rgba(255,68,68,0.12)" : isOrange ? "rgba(251,146,60,0.12)" : "rgba(74,222,128,0.1)",
          border: `1px solid ${isRed ? "rgba(255,68,68,0.4)" : isOrange ? "rgba(251,146,60,0.4)" : "rgba(74,222,128,0.3)"}`,
          padding: "5px 14px", borderRadius: "8px", flexShrink: 0,
          animation: isRed ? "pulse 1s infinite" : "none"
        }}>{mm}:{ss}</div>

        {/* Right: theme toggle + palette + submit */}
        <div style={{ display: "flex", gap: "8px", flexShrink: 0, alignItems: "center" }}>
          <button onClick={() => setDark(d => !d)} title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"} style={{
            background: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)",
            border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.15)",
            color: dark ? "#FFD700" : "#555", padding: "7px 10px", borderRadius: "8px",
            cursor: "pointer", fontSize: "15px", lineHeight: 1
          }}>{dark ? "☀️" : "🌙"}</button>
          <button onClick={() => setShowPalette(true)} className="palette-btn-mobile" style={{
            background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
            border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.15)",
            color: dark ? "#aaa" : "#555", padding: "7px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "13px"
          }}>📋</button>
          <button onClick={() => {
    setShowSubmitConfirm(true);
          }} style={{
            background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none",
            color: "#000", padding: "8px 16px", borderRadius: "8px",
            cursor: "pointer", fontSize: "13px", fontWeight: 800
          }}>Submit</button>
        </div>
      </div>

      {/* Section Tabs — shown only when test has sections */}
      {sections.length > 0 && (
        <div style={{
          background: dark ? "rgba(0,0,0,0.4)" : "rgba(220,224,235,0.8)",
          borderBottom: dark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.15)",
          display: "flex", overflowX: "auto", flexShrink: 0, padding: "0 8px",
          gap: "2px", alignItems: "stretch", scrollbarWidth: "none"
        }} className="custom-scroll section-tabs-bar">
          {/* All tab */}
          <button onClick={() => setActiveSection(null)} style={{
            padding: "10px 16px", border: "none", cursor: "pointer", whiteSpace: "nowrap",
            background: activeSection === null ? "rgba(255,215,0,0.12)" : "transparent",
            color: activeSection === null ? "#FFD700" : "#666",
            fontWeight: activeSection === null ? 700 : 400, fontSize: "13px",
            borderBottom: activeSection === null ? "2px solid #FFD700" : "2px solid transparent",
            transition: "all 0.15s"
          }}>
            All ({questions.length})
          </button>
          {sections.map((sec, i) => {
            const secColor = sec.color || getSectionColor(i);
            const secQs = questions.filter((q, qi) => getQuestionSection(q, qi) === i);
            const secAns = secQs.filter(q => answers[q.id] !== undefined).length;
            const isActive = activeSection === i;
            return (
              <button key={i} onClick={() => jumpToSection(i)} style={{
                padding: "10px 16px", border: "none", cursor: "pointer", whiteSpace: "nowrap",
                background: isActive ? `${secColor}15` : "transparent",
                color: isActive ? secColor : "#666",
                fontWeight: isActive ? 700 : 400, fontSize: "13px",
                borderBottom: isActive ? `2px solid ${secColor}` : "2px solid transparent",
                transition: "all 0.15s", display: "flex", alignItems: "center", gap: "7px"
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: secColor, flexShrink: 0 }} />
                {sec.name}{sec.subject && ` · ${sec.subject}`}
                <span style={{ background: `${secColor}22`, color: secColor, fontSize: "11px", padding: "1px 6px", borderRadius: "10px", fontWeight: 700 }}>
                  {secAns}/{secQs.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: "flex", flex: 1, maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "16px", gap: "20px", overflow: "hidden" }}>

        {/* Question area */}
        <div className="custom-scroll exam-q-area" style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingRight: "8px", paddingBottom: "80px" }}>
          {/* Question header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: T.gold(dark), padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>Q {current+1}</span>
              {(() => {
                const secIdx = getQuestionSection(q, current);
                if (secIdx !== null && sections[secIdx]) {
                  const sec = sections[secIdx];
                  const c = sec.color || getSectionColor(secIdx);
                  return <span style={{ background: `${c}18`, border: `1px solid ${c}44`, color: c, padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>{sec.name}</span>;
                }
                return null;
              })()}
              <span style={{ background: "rgba(255,255,255,0.06)", color: "#888", padding: "3px 10px", borderRadius: "6px", fontSize: "12px" }}>{q.subject}</span>
              <span style={{ color: T.green(dark), fontSize: "12px", fontWeight: 700 }}>+{q.marks}</span>
              <span style={{ color: T.red(dark), fontSize: "12px", fontWeight: 700 }}>-{q.negative}</span>
            </div>
            <button
              onClick={() => setMarked(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
              style={{
                background: marked[q.id] ? "rgba(251,146,60,0.15)" : "rgba(255,255,255,0.05)",
                border: marked[q.id] ? "1px solid rgba(251,146,60,0.5)" : "1px solid rgba(255,255,255,0.12)",
                color: marked[q.id] ? "#fb923c" : "#666",
                padding: "5px 12px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: 600
              }}
            >{marked[q.id] ? "🔖 Marked" : "🔖 Mark for Review"}</button>
          </div>

          {/* Question card */}
          <div style={{ background: T.cardBg(dark), border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)", borderRadius: "16px", padding: "clamp(16px,3vw,28px)", marginBottom: "14px" }}>
            {q.image_url && (
              <div style={{ marginBottom: "16px", textAlign: "center" }}>
                <img
                  src={q.image_url}
                  alt="Question illustration"
                  style={{ maxWidth: "100%", maxHeight: "280px", borderRadius: "10px", border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)", objectFit: "contain", display: "block", margin: "0 auto" }}
                  onError={e => {
                    // Show broken image placeholder instead of hiding silently
                    e.target.style.display = "none";
                    const ph = e.target.nextSibling;
                    if (ph) ph.style.display = "flex";
                  }}
                  onLoad={e => {
                    const ph = e.target.nextSibling;
                    if (ph) ph.style.display = "none";
                  }}
                />
                <div style={{ display: "none", flexDirection: "column", alignItems: "center", gap: "8px", padding: "20px", background: "rgba(255,100,100,0.06)", border: "1px dashed rgba(255,100,100,0.3)", borderRadius: "10px" }}>
                  <span style={{ fontSize: "2rem" }}>🖼️</span>
                  <span style={{ color: "#ff6b6b", fontSize: "12px" }}>Image failed to load</span>
                  <button onClick={() => { const img = document.querySelector(`img[src="${q.image_url}"]`); if(img){ img.src = q.image_url + "?t=" + Date.now(); img.style.display = "block"; img.previousSibling && (img.previousSibling.style.display="none"); } }} style={{ background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)", color: "#ff6b6b", padding: "4px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "11px" }}>Retry</button>
                </div>
              </div>
            )}
            <p style={{ color: T.primary(dark), fontSize: "clamp(15px,2.5vw,18px)", lineHeight: 1.8, margin: 0, fontWeight: 500 }}>{q.text}</p>
          </div>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
            {q.options.map((opt, idx) => {
              const selected = answers[q.id] === ["a","b","c","d"][idx];
              const ot = selected ? T.optSelected(dark) : T.optDefault(dark);
              return (
                <button key={idx} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: ["a","b","c","d"][idx] }))} style={{
                  background: ot.bg,
                  border: `${selected ? "2px" : "1px"} solid ${ot.border}`,
                  color: ot.text,
                  padding: "clamp(12px,2vw,16px) clamp(14px,2vw,20px)",
                  borderRadius: "12px", cursor: "pointer", textAlign: "left",
                  fontSize: "clamp(14px,2vw,16px)", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: "14px",
                  boxShadow: selected ? `0 0 0 1px ${ot.border}33` : "none"
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: selected ? (dark ? "#818cf8" : "#4338ca") : (dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: selected ? "#fff" : T.muted(dark), fontSize: "13px", fontWeight: 800,
                    transition: "all 0.15s"
                  }}>{["A","B","C","D"][idx]}</span>
                  <span style={{ lineHeight: 1.5 }}>{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => {
                    if (activeSection !== null) {
                      const secIdxs = questions.map((q,i)=>i).filter(i => getQuestionSection(questions[i],i) === activeSection);
                      const prev = [...secIdxs].reverse().find(i => i < current);
                      setCurrent(prev !== undefined ? prev : Math.max(0, current-1));
                    } else { setCurrent(c => Math.max(0, c-1)); }
                  }} disabled={current===0} style={{
              background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.12)",
              color: current===0 ? T.muted(dark) : T.primary(dark), padding: "11px 22px",
              borderRadius: "9px", cursor: current===0 ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: 600
            }}>← Prev</button>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setAnswers(prev => { const n={...prev}; delete n[q.id]; return n; })} style={{
                background: "transparent", border: "1px solid rgba(255,100,100,0.3)",
                color: "#ff6b6b", padding: "11px 16px", borderRadius: "9px", cursor: "pointer", fontSize: "13px"
              }}>Clear</button>
              <button onClick={() => {
                    setMarked(prev => ({ ...prev, [q.id]: true }));
                    if (activeSection !== null) {
                      const secIdxs = questions.map((q,i)=>i).filter(i => getQuestionSection(questions[i],i) === activeSection);
                      const nxt = secIdxs.find(i => i > current);
                      setCurrent(nxt !== undefined ? nxt : Math.min(TOTAL-1, current+1));
                    } else { setCurrent(c => Math.min(TOTAL-1, c+1)); }
                  }} style={{
                background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)",
                color: "#fb923c", padding: "11px 14px", borderRadius: "9px", cursor: "pointer", fontSize: "13px"
              }}>Mark & Next</button>
            </div>

            <button onClick={() => {
                    if (activeSection !== null) {
                      const secIdxs = questions.map((q,i)=>i).filter(i => getQuestionSection(questions[i],i) === activeSection);
                      const nxt = secIdxs.find(i => i > current);
                      setCurrent(nxt !== undefined ? nxt : Math.min(TOTAL-1, current+1));
                    } else { setCurrent(c => Math.min(TOTAL-1, c+1)); }
                  }} disabled={current===TOTAL-1} style={{
              background: current===TOTAL-1 ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#FFD700,#FF8C00)",
              border: "none", color: current===TOTAL-1 ? "#333" : "#000",
              padding: "11px 22px", borderRadius: "9px",
              cursor: current===TOTAL-1 ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: 700
            }}>Next →</button>
          </div>
        </div>

        {/* Desktop Sidebar */}
        <div className="exam-sidebar custom-scroll" style={{
          width: "250px", flexShrink: 0, display: "flex", flexDirection: "column",
          background: T.sidebarBg(dark),
          border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)",
          borderRadius: "16px", overflowY: "auto",
          boxShadow: dark ? "none" : "0 2px 10px rgba(0,0,0,0.06)"
        }}>
          <QuestionPalette />
        </div>
      </div>

      {/* Mobile Palette Drawer */}
      {showPalette && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setShowPalette(false)} style={{ flex: 1, background: "rgba(0,0,0,0.6)" }} />
          <div style={{
            background: dark ? "#0f1120" : "#fff", borderRadius: "20px 20px 0 0",
            border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
            maxHeight: "80vh", overflowY: "auto",
            animation: "slideUp 0.3s ease"
          }}>
            <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: "2px", margin: "12px auto 0" }} />
            <QuestionPalette onClose={() => setShowPalette(false)} />
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <div className="mobile-bottom-nav" style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 99,
        background: dark ? "rgba(8,10,20,0.98)" : "rgba(255,255,255,0.98)", backdropFilter: "blur(12px)",
        borderTop: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)",
        padding: "8px 16px", display: "none",
        alignItems: "center", justifyContent: "space-between", gap: "8px"
      }}>
        <button onClick={() => setCurrent(c => Math.max(0, c-1))} disabled={current===0} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: current===0?"#333":"#fff", padding: "10px", borderRadius: "8px", cursor: current===0?"not-allowed":"pointer", fontSize: "13px" }}>← Prev</button>
        <button onClick={() => setShowPalette(true)} style={{ flex: 1, background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: dark ? "#FFD700" : "#92600A", padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>📋 {answered}/{TOTAL}</button>
        <button onClick={() => setCurrent(c => Math.min(TOTAL-1, c+1))} disabled={current===TOTAL-1} style={{ flex: 1, background: current===TOTAL-1?"rgba(255,255,255,0.04)":"linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: current===TOTAL-1?"#333":"#000", padding: "10px", borderRadius: "8px", cursor: current===TOTAL-1?"not-allowed":"pointer", fontSize: "13px", fontWeight: 700 }}>Next →</button>
      </div>
    </div>
  );
}

// PRICING PAGE
function PricingPage({ setPage, user }) {
  const dark = useTheme();
  const features = [
    { icon: "📝", title: "Unlimited Mock Tests", desc: "Full-length mock tests for all exams — no limits, no paywalls." },
    { icon: "📖", title: "Sectional Practice", desc: "Subject-wise sectional tests to sharpen specific topics." },
    { icon: "📅", title: "PYQ Papers", desc: "Previous year question papers with detailed solutions." },
    { icon: "📊", title: "Advanced Analytics", desc: "Score, accuracy, subject breakdown, time analysis after every test." },
    { icon: "🏆", title: "Live Leaderboard", desc: "Compete with other students and see your rank in real time." },
    { icon: "📱", title: "Mobile Friendly", desc: "Fully optimized for phone and tablet — practice anywhere." },
  ];
  return (
    <div style={{ padding: "80px 1rem 80px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: "56px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)",
          color: "#4ade80", padding: "6px 18px", borderRadius: "20px",
          fontSize: "13px", fontWeight: 700, marginBottom: "20px"
        }}>✦ 100% Free — No Credit Card Required</div>
        <h1 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: "clamp(2rem,5vw,3.2rem)", color: dark ? "#fff" : "#111", marginBottom: "12px" }}>
          Everything is Free.<br />
          <span style={{ background: "linear-gradient(135deg, #FFD700, #FF8C00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>No Hidden Charges.</span>
        </h1>
        <p style={{ color: dark ? "#666" : "#777", fontSize: "17px", lineHeight: 1.7, maxWidth: "560px", margin: "0 auto" }}>
          MeritMatrix is completely free for all students. We believe every aspirant deserves quality practice — regardless of their budget.
        </p>
      </div>

      {/* Big FREE card */}
      <div style={{
        background: dark ? "linear-gradient(135deg, rgba(255,215,0,0.07), rgba(255,140,0,0.04))" : "linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,140,0,0.06))",
        border: "1.5px solid rgba(255,215,0,0.35)",
        borderRadius: "24px", padding: "clamp(28px,5vw,48px)",
        boxShadow: dark ? "0 0 60px rgba(255,215,0,0.06)" : "0 8px 40px rgba(255,180,0,0.12)",
        marginBottom: "40px", textAlign: "center", position: "relative", overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", top: -20, right: -20, width: 160, height: 160,
          background: "radial-gradient(circle, rgba(255,215,0,0.08), transparent 70%)",
          borderRadius: "50%"
        }} />
        <div style={{ fontSize: "clamp(3.5rem,8vw,5.5rem)", fontWeight: 900, fontFamily: "'Sora',sans-serif", color: dark ? "#FFD700" : "#92600A", lineHeight: 1, marginBottom: "6px" }}>
          ₹0
        </div>
        <div style={{ color: dark ? "#aaa" : "#666", fontSize: "15px", marginBottom: "24px" }}>Forever free • No registration fees • No subscription</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginBottom: "28px", textAlign: "left" }}>
          {features.map(f => (
            <div key={f.title} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px", background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)", borderRadius: "10px" }}>
              <span style={{ fontSize: "18px", flexShrink: 0 }}>{f.icon}</span>
              <div>
                <div style={{ color: dark ? "#fff" : "#111", fontSize: "13px", fontWeight: 700 }}>{f.title}</div>
                <div style={{ color: dark ? "#666" : "#888", fontSize: "12px", lineHeight: 1.4, marginTop: "2px" }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setPage(user ? "exams" : "auth")} style={{
          background: "linear-gradient(135deg, #FFD700, #FF8C00)",
          border: "none", color: "#000", padding: "16px 48px",
          borderRadius: "12px", cursor: "pointer", fontSize: "17px", fontWeight: 800,
          boxShadow: "0 4px 20px rgba(255,215,0,0.3)"
        }}>{user ? "Browse Exams →" : "Start Practicing Free →"}</button>
      </div>

      {/* Bottom note */}
      <div style={{ textAlign: "center" }}>
        <p style={{ color: dark ? "#555" : "#999", fontSize: "14px", lineHeight: 1.8 }}>
          🎯 Built for Odisha's defence & government exam aspirants.<br />
          Currently free for all students — start practicing today.
        </p>
      </div>
    </div>
  );
}

// ADMIN ORGANIZATIONS COMPONENT
function AdminOrganizations({ user }) {
  const dark = useTheme();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [msg, setMsg] = useState("");
  const [confirmDel, setConfirmDel] = useState(null); // org id to delete

  const emptyOrg = { name: "", color: "#FFD700", description: "", is_active: true };
  const [orgForm, setOrgForm] = useState(emptyOrg);

  const loadOrgs = () => {
    setLoading(true);
    supabaseRequest("/organizations?select=*&order=name.asc", { token: user.token })
      .then(data => { setOrgs(data || []); setLoading(false); })
      .catch(err => { setMsg("❌ " + err.message); setLoading(false); });
  };

  useEffect(() => { loadOrgs(); }, []);

  const toSlug = (str) => str.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

  const saveOrg = async () => {
    if (!orgForm.name.trim()) { setMsg("❌ Organization name is required"); return; }
    const slug = toSlug(orgForm.name);
    const body = { ...orgForm, slug };
    try {
      if (editOrg) {
        await supabaseRequest(`/organizations?id=eq.${editOrg.id}`, { method: "PATCH", body, token: user.token });
        setMsg("✅ Organization updated!");
      } else {
        await supabaseRequest("/organizations", { method: "POST", body, token: user.token });
        setMsg("✅ Organization created!");
      }
      setShowForm(false); setEditOrg(null); setOrgForm(emptyOrg); loadOrgs();
    } catch(e) { setMsg("❌ " + e.message); }
  };

  const deleteOrg = async (id) => {
    setConfirmDel(id);
  };
  const confirmDeleteOrg = async () => {
    const id = confirmDel; setConfirmDel(null);
    try {
      await supabaseRequest(`/organizations?id=eq.${id}`, { method: "DELETE", token: user.token });
      setMsg("✅ Organization deleted."); loadOrgs();
    } catch(e) { setMsg("❌ " + e.message); }
  };

  const inputS = { width: "100%", background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.15)", color: dark ? "#fff" : "#111", padding: "10px 12px", borderRadius: "8px", fontSize: "14px", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ maxWidth: "900px" }}>
      {/* Confirm Delete Modal */}
      {confirmDel && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
          <div style={{ background:dark?"#0f1120":"#fff",border:dark?"1px solid rgba(255,255,255,0.1)":"1px solid rgba(0,0,0,0.12)",borderRadius:"16px",padding:"28px",maxWidth:"360px",width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.5)",textAlign:"center" }}>
            <div style={{fontSize:"2.5rem",marginBottom:"12px"}}>⚠️</div>
            <h3 style={{color:dark?"#fff":"#111",fontFamily:"'Sora',sans-serif",fontWeight:800,margin:"0 0 8px"}}>Delete Organization?</h3>
            <p style={{color:"#666",fontSize:"13px",lineHeight:1.6,margin:"0 0 24px"}}>Exams linked to this organization may be affected. This cannot be undone.</p>
            <div style={{display:"flex",gap:"10px"}}>
              <button onClick={() => setConfirmDel(null)} style={{flex:1,background:"transparent",border:dark?"1px solid rgba(255,255,255,0.12)":"1px solid rgba(0,0,0,0.15)",color:dark?"#aaa":"#555",padding:"11px",borderRadius:"8px",cursor:"pointer",fontWeight:600}}>Cancel</button>
              <button onClick={confirmDeleteOrg} style={{flex:1,background:"linear-gradient(135deg,#ff4444,#cc0000)",border:"none",color:"#fff",padding:"11px",borderRadius:"8px",cursor:"pointer",fontWeight:800}}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ color: dark ? "#fff" : "#111", fontFamily: "'Sora',sans-serif", fontWeight: 800 }}>Organizations</h1>
        <button onClick={() => { setShowForm(true); setEditOrg(null); setOrgForm(emptyOrg); }} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: 700 }}>+ New Organization</button>
      </div>

      {msg && <div onClick={() => setMsg("")} style={{ color: msg.startsWith("✅") ? "#4ade80" : "#ff6b6b", marginBottom: "16px", fontSize: "13px", cursor:"pointer", padding:"10px 14px", background: msg.startsWith("✅") ? "rgba(74,222,128,0.08)" : "rgba(255,50,50,0.08)", borderRadius:"8px", border: msg.startsWith("✅") ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,50,50,0.25)" }}>{msg} <span style={{float:"right",opacity:0.5}}>✕</span></div>}

      {showForm && (
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: "14px", padding: "20px", marginBottom: "20px" }}>
          <h3 style={{ color: dark ? "#FFD700" : "#92600A", marginBottom: "16px" }}>{editOrg ? "Edit Organization" : "New Organization"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ color: "#aaa", fontSize: "12px" }}>Organization Name *</label>
              <input value={orgForm.name} onChange={e => setOrgForm(p => ({...p, name: e.target.value}))} style={inputS} placeholder="e.g. Indian Army" />
            </div>
            <div>
              <label style={{ color: "#aaa", fontSize: "12px" }}>Theme Color (Hex)</label>
              <input type="color" value={orgForm.color} onChange={e => setOrgForm(p => ({...p, color: e.target.value}))} style={{...inputS, padding: "2px", height: "40px", cursor: "pointer"}} />
            </div>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ color: "#aaa", fontSize: "12px" }}>Description</label>
            <input value={orgForm.description} onChange={e => setOrgForm(p => ({...p, description: e.target.value}))} style={inputS} placeholder="Short description" />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#aaa", fontSize: "14px", cursor: "pointer" }}>
              <input type="checkbox" checked={orgForm.is_active} onChange={e => setOrgForm(p => ({...p, is_active: e.target.checked}))} /> Active (Visible)
            </label>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={saveOrg} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: 700 }}>Save</button>
            <button onClick={() => { setShowForm(false); setEditOrg(null); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#aaa", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: "#666", padding: "20px" }}>Loading...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {orgs.length === 0 && <div style={{ color: "#555", textAlign: "center", padding: "40px" }}>No organizations yet.</div>}
          {orgs.map(org => (
            <div key={org.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: 16, height: 16, borderRadius: "4px", background: org.color || "#FFD700" }} title="Theme Color" />
                <div>
                  <div style={{ color: dark ? "#fff" : "#111", fontWeight: 600 }}>{org.name}</div>
                  <div style={{ color: "#555", fontSize: "12px" }}>{org.slug} • {org.is_active ? <span style={{ color: "#4ade80" }}>Active</span> : <span style={{ color: "#ff6b6b" }}>Inactive</span>}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => { setEditOrg(org); setOrgForm({ name: org.name, color: org.color || "#FFD700", description: org.description || "", is_active: org.is_active }); setShowForm(true); }} style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Edit</button>
                <button onClick={() => deleteOrg(org.id)} style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", color: "#ff6b6b", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ADMIN EXAMS COMPONENT — Advanced with Sections
function AdminExams({ user }) {
  const dark = useTheme();
  const [exams, setExams] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editExam, setEditExam] = useState(null);
  const [expandedExam, setExpandedExam] = useState(null);
  const [tests, setTests] = useState({});
  const [showTestForm, setShowTestForm] = useState(null); // exam id
  const [editTest, setEditTest] = useState(null);
  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] = useState("basic"); // "basic" | "sections" | "instructions"

  const SECTION_COLORS = ["#FFD700","#4ade80","#818cf8","#fb923c","#f472b6","#22d3ee","#a78bfa","#34d399","#f87171","#60a5fa"];
  const PRESET_SUBJECTS = ["Mathematics","Reasoning","General Knowledge","English","Science","History","Geography","Computer","Current Affairs","Hindi","Odia","Physics","Chemistry","Biology"];

  const emptyExam = { name: "", organization_id: "", description: "", is_published: false, is_free: false };
  const emptyTest = {
    name: "", test_type: "mock", duration_minutes: 60,
    total_marks: 100, negative_value: 0.25,
    instructions: "", is_published: false, sections: [], subject: ""
  };
  const emptySection = {
    name: "Section A", subject: "", questions_count: 20,
    marks_per_question: 1, negative_marks: 0.25,
    instructions: "", time_limit: 0, color: "#FFD700"
  };

  const [examForm, setExamForm] = useState(emptyExam);
  const [testForm, setTestForm] = useState(emptyTest);
  // Section builder state
  const [sectionForm, setSectionForm] = useState(emptySection);
  const [editingSectionIdx, setEditingSectionIdx] = useState(null);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [dragOver, setDragOver] = useState(null);

  const loadExams = () => {
    setLoading(true);
    supabaseRequest("/exams?select=*,organizations(name,color)&order=created_at.desc", { token: user.token })
      .then(data => { setExams(data || []); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadExams();
    supabaseRequest("/organizations?select=*&order=name.asc", { token: user.token })
      .then(data => setOrgs(data || [])).catch(() => {});
  }, []);

  const loadTests = async (examId) => {
    const data = await supabaseRequest(`/tests?exam_id=eq.${examId}&order=created_at.asc&select=*`, { token: user.token });
    setTests(prev => ({ ...prev, [examId]: data || [] }));
  };

  const toSlug = (str) => str.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");

  const saveExam = async () => {
    if (!examForm.name.trim()) { setMsg("❌ Exam name is required"); return; }
    const body = { ...examForm, slug: toSlug(examForm.name), organization_id: examForm.organization_id || null };
    try {
      if (editExam) {
        await supabaseRequest(`/exams?id=eq.${editExam.id}`, { method: "PATCH", body, token: user.token });
        setMsg("✅ Exam updated!");
      } else {
        await supabaseRequest("/exams", { method: "POST", body, token: user.token });
        setMsg("✅ Exam created!");
      }
      setShowForm(false); setEditExam(null); setExamForm(emptyExam); loadExams();
    } catch(e) { setMsg("❌ " + e.message); }
  };

  const deleteExam = async (id) => {
    if (!confirm("Delete this exam and all its tests?")) return;
    await supabaseRequest(`/exams?id=eq.${id}`, { method: "DELETE", token: user.token });
    loadExams();
  };

  const saveTest = async (examId) => {
    if (!testForm.name.trim()) { setMsg("❌ Test name is required"); return; }
    const sections = testForm.sections || [];
    const autoMarks = sections.length > 0
      ? sections.reduce((s, sec) => s + ((parseInt(sec.questions_count)||0) * (parseFloat(sec.marks_per_question)||1)), 0)
      : testForm.total_marks;
    try {
      const body = {
        name: testForm.name,
        test_type: testForm.test_type,
        duration_minutes: testForm.duration_minutes,
        total_marks: autoMarks,
        negative_value: testForm.negative_value,
        instructions: testForm.instructions || null,
        is_published: testForm.is_published,
        sections: sections.length > 0 ? JSON.stringify(sections) : null,
        exam_id: examId,
        subject: testForm.subject || null,
      };
      const saveReq = async (b) => editTest
        ? supabaseRequest(`/tests?id=eq.${editTest.id}`, { method: "PATCH", body: b, token: user.token, prefer: "return=minimal" })
        : supabaseRequest("/tests", { method: "POST", body: b, token: user.token, prefer: "return=minimal" });
      try {
        await saveReq(body);
      } catch(e) {
        // If subject column doesn't exist yet, retry without it
        if (e.message && (e.message.includes("subject") || e.message.includes("column"))) {
          const { subject, ...bodyWithout } = body;
          await saveReq(bodyWithout);
          setMsg("⚠️ Saved! But run this SQL in Supabase: ALTER TABLE tests ADD COLUMN IF NOT EXISTS subject TEXT;");
          setShowTestForm(null); setEditTest(null); setTestForm(emptyTest);
          setActiveTab("basic");
          loadTests(examId);
          return;
        }
        throw e;
      }
      setShowTestForm(null); setEditTest(null); setTestForm(emptyTest);
      setActiveTab("basic");
      loadTests(examId);
      setMsg("✅ Test saved!");
    } catch(e) { setMsg("❌ " + e.message); }
  };

  const deleteTest = async (testId, examId) => {
    if (!confirm("Delete this test and ALL its questions + attempts? This cannot be undone.")) return;
    try {
      await supabaseRequest(`/attempts?test_id=eq.${testId}`, { method: "DELETE", token: user.token, prefer: "return=minimal" });
    } catch(e) {}
    try {
      await supabaseRequest(`/questions?test_id=eq.${testId}`, { method: "DELETE", token: user.token, prefer: "return=minimal" });
    } catch(e) {}
    try {
      await supabaseRequest(`/tests?id=eq.${testId}`, { method: "DELETE", token: user.token, prefer: "return=minimal" });
    } catch(e) { alert("Delete failed: " + e.message); return; }
    loadTests(examId);
  };

  // Section helpers
  const sectionStats = (sections = []) => ({
    totalQ: sections.reduce((s, sec) => s + (parseInt(sec.questions_count)||0), 0),
    totalM: sections.reduce((s, sec) => s + ((parseInt(sec.questions_count)||0) * (parseFloat(sec.marks_per_question)||1)), 0),
    hasTimeLimits: sections.some(s => (parseInt(s.time_limit)||0) > 0),
    hasMixedMarks: new Set(sections.map(s => s.marks_per_question)).size > 1,
  });

  const addOrUpdateSection = () => {
    if (!sectionForm.name.trim()) return;
    const sections = [...(testForm.sections || [])];
    const color = sectionForm.color || SECTION_COLORS[sections.length % SECTION_COLORS.length];
    if (editingSectionIdx !== null) {
      sections[editingSectionIdx] = { ...sectionForm, color };
      setEditingSectionIdx(null);
    } else {
      sections.push({ ...sectionForm, color });
    }
    setTestForm(p => ({ ...p, sections }));
    setSectionForm({ ...emptySection, name: `Section ${String.fromCharCode(65 + sections.length)}`, color: SECTION_COLORS[sections.length % SECTION_COLORS.length] });
    setShowSectionForm(false);
  };

  const removeSection = (idx) => {
    const sections = (testForm.sections || []).filter((_, i) => i !== idx);
    setTestForm(p => ({ ...p, sections }));
  };

  const duplicateSection = (idx) => {
    const sections = [...(testForm.sections || [])];
    const copy = { ...sections[idx], name: sections[idx].name + " (Copy)", color: SECTION_COLORS[(sections.length) % SECTION_COLORS.length] };
    sections.splice(idx + 1, 0, copy);
    setTestForm(p => ({ ...p, sections }));
  };

  const moveSectionUp = (idx) => {
    if (idx === 0) return;
    const sections = [...(testForm.sections || [])];
    [sections[idx - 1], sections[idx]] = [sections[idx], sections[idx - 1]];
    setTestForm(p => ({ ...p, sections }));
  };

  const moveSectionDown = (idx) => {
    const sections = [...(testForm.sections || [])];
    if (idx >= sections.length - 1) return;
    [sections[idx], sections[idx + 1]] = [sections[idx + 1], sections[idx]];
    setTestForm(p => ({ ...p, sections }));
  };

  const parseSections = (test) => {
    if (!test?.sections) return [];
    try { return typeof test.sections === "string" ? JSON.parse(test.sections) : test.sections; }
    catch { return []; }
  };

  const openTestForm = (examId, test = null) => {
    setEditTest(test);
    if (test) {
      const secs = parseSections(test);
      setTestForm({ name: test.name, test_type: test.test_type, duration_minutes: test.duration_minutes, total_marks: test.total_marks, negative_value: test.negative_value, instructions: test.instructions || "", is_published: test.is_published, sections: secs, subject: test.subject || "" });
    } else {
      setTestForm(emptyTest);
    }
    setActiveTab("basic");
    setShowSectionForm(false);
    setEditingSectionIdx(null);
    setShowTestForm(examId);
  };

  // Styles
  const inp = { width: "100%", background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", border: dark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.12)", color: dark ? "#fff" : "#111", padding: "10px 12px", borderRadius: "8px", fontSize: "14px", outline: "none", boxSizing: "border-box" };
  const lbl = { color: dark ? "#888" : "#666", fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", display: "block", marginBottom: "5px" };
  const stats = sectionStats(testForm.sections);

  return (
    <div style={{ maxWidth: "1000px" }}>
      <style>{`
        .sec-row:hover { background: rgba(255,255,255,0.06) !important; }
        .admin-tab-btn { transition: all 0.15s; }
        .admin-tab-btn:hover { opacity: 1 !important; }
        .preset-chip:hover { background: rgba(255,215,0,0.2) !important; border-color: rgba(255,215,0,0.5) !important; }
        .sec-action-btn:hover { opacity: 0.8; transform: scale(1.05); }
        @media (max-width: 600px) {
          .test-grid { grid-template-columns: 1fr !important; }
          .sec-grid { grid-template-columns: 1fr 1fr !important; }
          .exam-actions { flex-direction: column !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ color: dark ? "#fff" : "#111", fontFamily: "'Sora',sans-serif", fontWeight: 800, margin: 0, fontSize: "clamp(20px,4vw,28px)" }}>Exams & Tests</h1>
          <p style={{ color: "#555", fontSize: "13px", marginTop: "4px" }}>Create exams • Configure tests • Define section-wise marking schemes</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditExam(null); setExamForm(emptyExam); }}
          style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
          + New Exam
        </button>
      </div>

      {/* Message */}
      {msg && <div onClick={() => setMsg("")} style={{ color: msg.startsWith("✅") ? "#4ade80" : "#ff6b6b", marginBottom: "16px", fontSize: "14px", cursor: "pointer", padding: "10px 14px", background: msg.startsWith("✅") ? "rgba(74,222,128,0.1)" : "rgba(255,50,50,0.1)", borderRadius: "8px", border: msg.startsWith("✅") ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,50,50,0.3)" }}>{msg} <span style={{ float: "right", opacity: 0.5 }}>✕</span></div>}

      {/* Exam Form */}
      {showForm && (
        <div style={{ background: dark ? "rgba(255,215,0,0.04)" : "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.25)", borderRadius: "16px", padding: "20px", marginBottom: "20px" }}>
          <h3 style={{ color: "#FFD700", marginBottom: "16px", fontFamily: "'Sora',sans-serif", fontSize: "16px" }}>{editExam ? "✏️ Edit Exam" : "➕ New Exam"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "12px" }}>
            <div><label style={lbl}>Exam Name *</label><input value={examForm.name} onChange={e => setExamForm(p => ({...p, name: e.target.value}))} style={inp} placeholder="e.g. Constable Recruitment 2025" /></div>
            <div><label style={lbl}>Organization</label>
              <select value={examForm.organization_id} onChange={e => setExamForm(p => ({...p, organization_id: e.target.value}))} style={inp}>
                <option value="">-- Select Organization --</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Description</label><input value={examForm.description} onChange={e => setExamForm(p => ({...p, description: e.target.value}))} style={inp} placeholder="Short description" /></div>
          </div>
          <div style={{ display: "flex", gap: "20px", marginBottom: "16px", flexWrap: "wrap" }}>
            {[["is_published","✅ Published"],["is_free","🆓 Free"]].map(([k,l]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: "8px", color: "#aaa", fontSize: "14px", cursor: "pointer" }}>
                <input type="checkbox" checked={examForm[k]} onChange={e => setExamForm(p => ({...p, [k]: e.target.checked}))} /> {l}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={saveExam} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: 700 }}>Save Exam</button>
            <button onClick={() => { setShowForm(false); setEditExam(null); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#aaa", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Exam List */}
      {loading ? <div style={{ color: "#666", padding: "40px", textAlign: "center" }}>Loading exams...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {exams.length === 0 && <div style={{ color: "#555", textAlign: "center", padding: "60px 20px", background: dark ? "rgba(255,255,255,0.02)" : "#f9f9f9", borderRadius: "16px", border: dark ? "1px dashed rgba(255,255,255,0.08)" : "1px dashed #ddd" }}>No exams yet. Create your first exam!</div>}
          {exams.map(exam => (
            <div key={exam.id} style={{ background: dark ? "rgba(255,255,255,0.03)" : "#fff", border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)", borderRadius: "14px", overflow: "hidden" }}>
              {/* Exam Header */}
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button onClick={() => { const id = exam.id; setExpandedExam(expandedExam === id ? null : id); if (expandedExam !== id) loadTests(id); }}
                    style={{ background: "rgba(255,255,255,0.08)", border: "none", color: dark ? "#fff" : "#111", width: 30, height: 30, borderRadius: "8px", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.2s", transform: expandedExam === exam.id ? "rotate(90deg)" : "none" }}>▶</button>
                  <div>
                    <div style={{ color: dark ? "#fff" : "#111", fontWeight: 700, fontSize: "15px" }}>{exam.name}</div>
                    <div style={{ color: "#666", fontSize: "12px", marginTop: "2px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {exam.organizations?.name && <span style={{ background: "rgba(255,255,255,0.06)", padding: "1px 7px", borderRadius: "10px" }}>{exam.organizations.name}</span>}
                      <span style={{ color: exam.is_published ? "#4ade80" : "#ff6b6b" }}>● {exam.is_published ? "Published" : "Draft"}</span>
                      {exam.is_free && <span style={{ color: "#4ade80" }}>🆓 Free</span>}
                    </div>
                  </div>
                </div>
                <div className="exam-actions" style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => { setEditExam(exam); setExamForm({ name: exam.name, organization_id: exam.organization_id || "", description: exam.description || "", is_published: exam.is_published, is_free: exam.is_free }); setShowForm(true); }} style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Edit</button>
                  <button onClick={() => deleteExam(exam.id)} style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", color: "#ff6b6b", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Delete</button>
                </div>
              </div>

              {/* Tests Panel */}
              {expandedExam === exam.id && (
                <div style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, background: dark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.02)" }}>
                  <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ color: "#666", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tests ({(tests[exam.id] || []).length})</div>
                    <button onClick={() => openTestForm(exam.id)} style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)", color: "#4ade80", padding: "6px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>+ Add Test</button>
                  </div>

                  {/* ══════════════════════════════════════════ */}
                  {/* ADVANCED TEST FORM */}
                  {/* ══════════════════════════════════════════ */}
                  {showTestForm === exam.id && (
                    <div style={{ margin: "0 16px 16px", background: dark ? "rgba(255,215,0,0.03)" : "#fffdf0", border: "1px solid rgba(255,215,0,0.2)", borderRadius: "14px", overflow: "hidden" }}>
                      {/* Form Header */}
                      <div style={{ padding: "16px 20px", background: dark ? "rgba(255,215,0,0.06)" : "rgba(255,215,0,0.1)", borderBottom: "1px solid rgba(255,215,0,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                        <div>
                          <div style={{ color: "#FFD700", fontWeight: 800, fontSize: "15px", fontFamily: "'Sora',sans-serif" }}>{editTest ? "✏️ Edit Test" : "➕ Create New Test"}</div>
                          <div style={{ color: "#666", fontSize: "12px", marginTop: "2px" }}>Configure test details, sections, and marking scheme</div>
                        </div>
                        {/* Live Stats */}
                        {testForm.sections.length > 0 && (
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <div style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.25)", borderRadius: "8px", padding: "6px 12px", textAlign: "center" }}>
                              <div style={{ color: "#FFD700", fontWeight: 800, fontSize: "18px" }}>{stats.totalQ}</div>
                              <div style={{ color: "#888", fontSize: "10px" }}>Questions</div>
                            </div>
                            <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: "8px", padding: "6px 12px", textAlign: "center" }}>
                              <div style={{ color: "#4ade80", fontWeight: 800, fontSize: "18px" }}>{stats.totalM}</div>
                              <div style={{ color: "#888", fontSize: "10px" }}>Total Marks</div>
                            </div>
                            <div style={{ background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.25)", borderRadius: "8px", padding: "6px 12px", textAlign: "center" }}>
                              <div style={{ color: "#818cf8", fontWeight: 800, fontSize: "18px" }}>{testForm.sections.length}</div>
                              <div style={{ color: "#888", fontSize: "10px" }}>Sections</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Tab Navigation */}
                      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", background: dark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.03)" }}>
                        {[["basic","⚙️ Basic Info"],["sections","📚 Sections & Marks"],["instructions","📋 Instructions"]].map(([tab, label]) => (
                          <button key={tab} className="admin-tab-btn" onClick={() => setActiveTab(tab)}
                            style={{ flex: 1, padding: "12px 8px", background: "transparent", border: "none", borderBottom: activeTab === tab ? "2px solid #FFD700" : "2px solid transparent", color: activeTab === tab ? "#FFD700" : "#555", cursor: "pointer", fontSize: "clamp(11px,2.5vw,13px)", fontWeight: activeTab === tab ? 700 : 400, transition: "all 0.15s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {label}
                            {tab === "sections" && testForm.sections.length > 0 && <span style={{ background: "#FFD700", color: "#000", borderRadius: "10px", padding: "1px 6px", fontSize: "10px", marginLeft: "5px", fontWeight: 800 }}>{testForm.sections.length}</span>}
                          </button>
                        ))}
                      </div>

                      <div style={{ padding: "20px" }}>

                        {/* ── TAB 1: Basic Info ── */}
                        {activeTab === "basic" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div className="test-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                              <div style={{ gridColumn: "span 2" }}>
                                <label style={lbl}>Test Name *</label>
                                <input value={testForm.name} onChange={e => setTestForm(p => ({...p, name: e.target.value}))} style={inp} placeholder="e.g. Mathematics Practice Set 01" />
                              </div>
                              <div>
                                <label style={lbl}>Test Type</label>
                                <select value={testForm.test_type} onChange={e => setTestForm(p => ({...p, test_type: e.target.value}))} style={inp}>
                                  <option value="mock">📝 Mock Test (Full)</option>
                                  <option value="sectional">📚 Sectional Test</option>
                                  <option value="pyq">📜 PYQ (Previous Year)</option>
                                  <option value="practice_set">🎯 Practice Set</option>
                                  <option value="speed_test">⚡ Speed Test</option>
                                </select>
                              </div>
                              {["sectional","practice_set","speed_test"].includes(testForm.test_type) && (
                                <div>
                                  <label style={lbl}>Subject <span style={{ color: "#ff6b6b" }}>*</span> <span style={{ color: "#555", fontSize: "11px", textTransform: "none", fontWeight: 400 }}>(used for grouping)</span></label>
                                  <select value={testForm.subject || ""} onChange={e => setTestForm(p => ({...p, subject: e.target.value}))} style={inp}>
                                    <option value="">— Select Subject —</option>
                                    {["English","Odia","Hindi","Mathematics","Logical Reasoning","General Studies","General Knowledge","Computer","Current Affairs","Science","History","Geography","Polity","Economics","Physics","Chemistry","Biology","Environment","Other"].map(s => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              <div>
                                <label style={lbl}>Duration (minutes)</label>
                                <input type="number" min="1" value={testForm.duration_minutes} onChange={e => setTestForm(p => ({...p, duration_minutes: parseInt(e.target.value)||60}))} style={inp} />
                              </div>
                              <div>
                                <label style={lbl}>
                                  Total Marks
                                  {testForm.sections.length > 0 && <span style={{ color: "#4ade80", marginLeft: "6px", textTransform: "none", fontWeight: 400 }}>← auto from sections</span>}
                                </label>
                                <input type="number" value={testForm.sections.length > 0 ? stats.totalM : testForm.total_marks}
                                  disabled={testForm.sections.length > 0}
                                  onChange={e => setTestForm(p => ({...p, total_marks: parseInt(e.target.value)||0}))}
                                  style={{...inp, opacity: testForm.sections.length > 0 ? 0.5 : 1, cursor: testForm.sections.length > 0 ? "not-allowed" : "text"}} />
                              </div>
                              <div>
                                <label style={lbl}>Default Negative Marks</label>
                                <input type="number" step="0.25" min="0" value={testForm.negative_value} onChange={e => setTestForm(p => ({...p, negative_value: parseFloat(e.target.value)||0}))} style={inp} />
                              </div>
                            </div>
                            {/* Quick presets */}
                            <div>
                              <label style={{...lbl, marginBottom: "8px"}}>Quick Duration Presets</label>
                              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                {[[30,"30m"],[45,"45m"],[60,"1h"],[90,"1.5h"],[120,"2h"],[180,"3h"]].map(([min, label]) => (
                                  <button key={min} onClick={() => setTestForm(p => ({...p, duration_minutes: min}))}
                                    className="preset-chip"
                                    style={{ padding: "5px 14px", borderRadius: "20px", border: `1px solid ${testForm.duration_minutes === min ? "rgba(255,215,0,0.6)" : "rgba(255,255,255,0.1)"}`, background: testForm.duration_minutes === min ? "rgba(255,215,0,0.15)" : "transparent", color: testForm.duration_minutes === min ? "#FFD700" : "#666", cursor: "pointer", fontSize: "12px", fontWeight: testForm.duration_minutes === min ? 700 : 400, transition: "all 0.15s" }}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* Negative marks presets */}
                            <div>
                              <label style={{...lbl, marginBottom: "8px"}}>Negative Marking Presets</label>
                              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                {[[0,"None"],[0.25,"-0.25"],[0.33,"-1/3"],[0.5,"-0.5"],[1,"-1"]].map(([val, label]) => (
                                  <button key={val} onClick={() => setTestForm(p => ({...p, negative_value: val}))}
                                    className="preset-chip"
                                    style={{ padding: "5px 14px", borderRadius: "20px", border: `1px solid ${testForm.negative_value === val ? "rgba(255,100,100,0.6)" : "rgba(255,255,255,0.1)"}`, background: testForm.negative_value === val ? "rgba(255,100,100,0.15)" : "transparent", color: testForm.negative_value === val ? "#ff6b6b" : "#666", cursor: "pointer", fontSize: "12px", fontWeight: testForm.negative_value === val ? 700 : 400, transition: "all 0.15s" }}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <label style={{ display: "flex", alignItems: "center", gap: "10px", color: dark ? "#aaa" : "#555", fontSize: "14px", cursor: "pointer" }}>
                              <input type="checkbox" checked={testForm.is_published} onChange={e => setTestForm(p => ({...p, is_published: e.target.checked}))} />
                              <span>✅ Published (visible to students)</span>
                            </label>
                          </div>
                        )}

                        {/* ── TAB 2: Sections & Marks ── */}
                        {activeTab === "sections" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            {/* Intro banner */}
                            <div style={{ background: dark ? "rgba(129,140,248,0.08)" : "rgba(129,140,248,0.05)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: dark ? "#818cf8" : "#5654c4" }}>
                              💡 Sections let you organise questions into Subject A, B, C... with different marks and negative marking per section. Students will see section tabs in the exam and can jump between subjects easily.
                            </div>

                            {/* Section list */}
                            {testForm.sections.length > 0 && (
                              <div>
                                {/* Summary row */}
                                <div style={{ display: "flex", gap: "8px", padding: "10px 14px", background: dark ? "rgba(255,215,0,0.06)" : "rgba(255,215,0,0.08)", borderRadius: "10px", marginBottom: "10px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                                    <span style={{ color: "#FFD700", fontWeight: 700, fontSize: "13px" }}>📊 {stats.totalQ} Questions</span>
                                    <span style={{ color: "#4ade80", fontWeight: 700, fontSize: "13px" }}>✅ {stats.totalM} Marks</span>
                                    <span style={{ color: "#818cf8", fontWeight: 700, fontSize: "13px" }}>📚 {testForm.sections.length} Sections</span>
                                    {stats.hasMixedMarks && <span style={{ color: "#fb923c", fontSize: "12px" }}>⚡ Mixed marking scheme</span>}
                                  </div>
                                </div>

                                {/* Section rows */}
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                  {testForm.sections.map((sec, idx) => (
                                    <div key={idx} className="sec-row" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", background: dark ? "rgba(255,255,255,0.03)" : "#fafafa", border: `1px solid ${sec.color}33`, borderLeft: `3px solid ${sec.color}`, borderRadius: "10px", transition: "background 0.15s", flexWrap: "wrap" }}>
                                      {/* Color dot + name */}
                                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "160px" }}>
                                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: sec.color, flexShrink: 0, boxShadow: `0 0 6px ${sec.color}88` }} />
                                        <div>
                                          <div style={{ color: dark ? "#fff" : "#111", fontWeight: 700, fontSize: "13px" }}>{sec.name}</div>
                                          {sec.subject && <div style={{ color: sec.color, fontSize: "11px", marginTop: "1px" }}>{sec.subject}</div>}
                                        </div>
                                      </div>
                                      {/* Stats chips */}
                                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flex: 2 }}>
                                        <span style={{ background: `${sec.color}18`, color: sec.color, padding: "3px 9px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>{sec.questions_count} Qs</span>
                                        <span style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", padding: "3px 9px", borderRadius: "12px", fontSize: "11px" }}>+{sec.marks_per_question}/correct</span>
                                        <span style={{ background: "rgba(255,100,100,0.1)", color: "#ff6b6b", padding: "3px 9px", borderRadius: "12px", fontSize: "11px" }}>-{sec.negative_marks}/wrong</span>
                                        <span style={{ background: "rgba(255,255,255,0.05)", color: "#666", padding: "3px 9px", borderRadius: "12px", fontSize: "11px" }}>{sec.questions_count * sec.marks_per_question} total marks</span>
                                        {(parseInt(sec.time_limit)||0) > 0 && <span style={{ background: "rgba(251,146,60,0.1)", color: "#fb923c", padding: "3px 9px", borderRadius: "12px", fontSize: "11px" }}>⏱ {sec.time_limit}m</span>}
                                      </div>
                                      {/* Actions */}
                                      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                                        <button className="sec-action-btn" onClick={() => moveSectionUp(idx)} title="Move up" style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#666", width: 28, height: 28, borderRadius: "6px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} disabled={idx === 0}>↑</button>
                                        <button className="sec-action-btn" onClick={() => moveSectionDown(idx)} title="Move down" style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#666", width: 28, height: 28, borderRadius: "6px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }} disabled={idx === testForm.sections.length - 1}>↓</button>
                                        <button className="sec-action-btn" onClick={() => duplicateSection(idx)} title="Duplicate" style={{ background: "rgba(129,140,248,0.1)", border: "none", color: "#818cf8", width: 28, height: 28, borderRadius: "6px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>⧉</button>
                                        <button className="sec-action-btn" onClick={() => { setSectionForm({...sec}); setEditingSectionIdx(idx); setShowSectionForm(true); }} title="Edit" style={{ background: "rgba(255,215,0,0.1)", border: "none", color: "#FFD700", width: 28, height: 28, borderRadius: "6px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>✏️</button>
                                        <button className="sec-action-btn" onClick={() => removeSection(idx)} title="Delete" style={{ background: "rgba(255,50,50,0.1)", border: "none", color: "#ff6b6b", width: 28, height: 28, borderRadius: "6px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>✕</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {testForm.sections.length === 0 && !showSectionForm && (
                              <div style={{ textAlign: "center", padding: "32px 20px", background: dark ? "rgba(255,255,255,0.02)" : "#fafafa", borderRadius: "10px", border: dark ? "1px dashed rgba(255,255,255,0.08)" : "1px dashed #ddd" }}>
                                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📚</div>
                                <div style={{ color: dark ? "#555" : "#888", fontSize: "13px", marginBottom: "12px" }}>No sections added yet. This test uses default marking (+{testForm.total_marks > 0 ? (testForm.total_marks / Math.max(1, 20)).toFixed(1) : 1} per Q).</div>
                                <div style={{ color: "#444", fontSize: "12px" }}>Add sections to define per-subject marks, negative marking, and time limits.</div>
                              </div>
                            )}

                            {/* Add Section Button */}
                            {!showSectionForm && (
                              <button onClick={() => { setSectionForm({ ...emptySection, name: `Section ${String.fromCharCode(65 + testForm.sections.length)}`, color: SECTION_COLORS[testForm.sections.length % SECTION_COLORS.length] }); setEditingSectionIdx(null); setShowSectionForm(true); }}
                                style={{ background: "rgba(255,215,0,0.08)", border: "1px dashed rgba(255,215,0,0.35)", color: "#FFD700", padding: "12px", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: 700, width: "100%", transition: "all 0.15s" }}>
                                + Add Section
                              </button>
                            )}

                            {/* ── Section Form ── */}
                            {showSectionForm && (
                              <div style={{ background: dark ? "rgba(0,0,0,0.3)" : "#f5f5f5", border: `1px solid ${sectionForm.color || "#FFD700"}44`, borderLeft: `3px solid ${sectionForm.color || "#FFD700"}`, borderRadius: "12px", padding: "18px", animation: "fadeIn 0.2s ease" }}>
                                <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}`}</style>
                                <div style={{ color: sectionForm.color || "#FFD700", fontWeight: 700, fontSize: "14px", marginBottom: "14px" }}>
                                  {editingSectionIdx !== null ? "✏️ Edit Section" : "➕ New Section"}
                                </div>

                                {/* Color picker row */}
                                <div style={{ marginBottom: "14px" }}>
                                  <label style={lbl}>Section Color</label>
                                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    {SECTION_COLORS.map(c => (
                                      <button key={c} onClick={() => setSectionForm(p => ({...p, color: c}))}
                                        style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: sectionForm.color === c ? "3px solid #fff" : "2px solid transparent", cursor: "pointer", transition: "transform 0.15s", transform: sectionForm.color === c ? "scale(1.2)" : "scale(1)" }} />
                                    ))}
                                  </div>
                                </div>

                                <div className="sec-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                                  <div>
                                    <label style={lbl}>Section Name *</label>
                                    <input value={sectionForm.name} onChange={e => setSectionForm(p => ({...p, name: e.target.value}))} style={inp} placeholder="e.g. Section A" />
                                  </div>
                                  <div>
                                    <label style={lbl}>Subject / Topic</label>
                                    <input value={sectionForm.subject} onChange={e => setSectionForm(p => ({...p, subject: e.target.value}))} list="subjects-list" style={inp} placeholder="e.g. Mathematics" />
                                    <datalist id="subjects-list">{PRESET_SUBJECTS.map(s => <option key={s} value={s} />)}</datalist>
                                  </div>
                                  <div>
                                    <label style={lbl}>No. of Questions</label>
                                    <input type="number" min="1" value={sectionForm.questions_count} onChange={e => setSectionForm(p => ({...p, questions_count: parseInt(e.target.value)||1}))} style={inp} />
                                  </div>
                                  <div>
                                    <label style={lbl}>Marks per Correct</label>
                                    <input type="number" step="0.5" min="0.5" value={sectionForm.marks_per_question} onChange={e => setSectionForm(p => ({...p, marks_per_question: parseFloat(e.target.value)||1}))} style={inp} />
                                  </div>
                                  <div>
                                    <label style={lbl}>Negative per Wrong</label>
                                    <input type="number" step="0.25" min="0" value={sectionForm.negative_marks} onChange={e => setSectionForm(p => ({...p, negative_marks: parseFloat(e.target.value)||0}))} style={inp} />
                                  </div>
                                  <div>
                                    <label style={lbl}>Time Limit (mins, 0=none)</label>
                                    <input type="number" min="0" value={sectionForm.time_limit || 0} onChange={e => setSectionForm(p => ({...p, time_limit: parseInt(e.target.value)||0}))} style={inp} />
                                  </div>
                                </div>
                                <div style={{ marginBottom: "12px" }}>
                                  <label style={lbl}>Section Instructions</label>
                                  <input value={sectionForm.instructions} onChange={e => setSectionForm(p => ({...p, instructions: e.target.value}))} style={inp} placeholder="e.g. Each question carries 2 marks. No negative marking in this section." />
                                </div>

                                {/* Live preview */}
                                <div style={{ background: `${sectionForm.color || "#FFD700"}10`, border: `1px solid ${sectionForm.color || "#FFD700"}30`, borderRadius: "8px", padding: "10px 14px", marginBottom: "12px", fontSize: "12px", color: sectionForm.color || "#FFD700" }}>
                                  Preview: <strong>{sectionForm.name || "Section"}</strong>{sectionForm.subject && ` — ${sectionForm.subject}`} · {sectionForm.questions_count} questions · +{sectionForm.marks_per_question} per correct · -{sectionForm.negative_marks} per wrong · {sectionForm.questions_count * sectionForm.marks_per_question} total marks{(parseInt(sectionForm.time_limit)||0) > 0 ? ` · ⏱ ${sectionForm.time_limit} min time limit` : ""}
                                </div>

                                {/* Subject presets */}
                                <div style={{ marginBottom: "12px" }}>
                                  <label style={lbl}>Quick Subject Presets</label>
                                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    {PRESET_SUBJECTS.slice(0, 10).map(s => (
                                      <button key={s} className="preset-chip"
                                        onClick={() => setSectionForm(p => ({...p, subject: s}))}
                                        style={{ padding: "4px 12px", borderRadius: "16px", border: `1px solid ${sectionForm.subject === s ? (sectionForm.color || "#FFD700") + "88" : "rgba(255,255,255,0.1)"}`, background: sectionForm.subject === s ? `${sectionForm.color || "#FFD700"}18` : "transparent", color: sectionForm.subject === s ? (sectionForm.color || "#FFD700") : "#666", cursor: "pointer", fontSize: "11px", transition: "all 0.15s" }}>
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button onClick={addOrUpdateSection} style={{ background: `linear-gradient(135deg, ${sectionForm.color || "#FFD700"}, ${sectionForm.color || "#FF8C00"})`, border: "none", color: "#000", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>
                                    {editingSectionIdx !== null ? "Update Section" : "Add Section"}
                                  </button>
                                  <button onClick={() => { setShowSectionForm(false); setEditingSectionIdx(null); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#666", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
                                </div>
                              </div>
                            )}

                            {/* Marks scheme preview table */}
                            {testForm.sections.length > 0 && (
                              <div style={{ background: dark ? "rgba(255,255,255,0.02)" : "#fafafa", border: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #eee", borderRadius: "10px", overflow: "hidden" }}>
                                <div style={{ padding: "10px 14px", borderBottom: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #eee", color: dark ? "#aaa" : "#666", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>Marking Scheme Summary</div>
                                <div style={{ overflow: "auto" }}>
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                    <thead>
                                      <tr style={{ background: dark ? "rgba(255,255,255,0.04)" : "#f0f0f0" }}>
                                        {["Section","Subject","Questions","+Marks","-Marks","Total","Time"].map(h => (
                                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: dark ? "#888" : "#666", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {testForm.sections.map((sec, i) => (
                                        <tr key={i} style={{ borderTop: dark ? "1px solid rgba(255,255,255,0.04)" : "1px solid #f0f0f0" }}>
                                          <td style={{ padding: "8px 12px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: sec.color, display: "inline-block" }} /><strong style={{ color: dark ? "#fff" : "#111" }}>{sec.name}</strong></span></td>
                                          <td style={{ padding: "8px 12px", color: "#666" }}>{sec.subject || "—"}</td>
                                          <td style={{ padding: "8px 12px", color: sec.color, fontWeight: 700 }}>{sec.questions_count}</td>
                                          <td style={{ padding: "8px 12px", color: "#4ade80", fontWeight: 700 }}>+{sec.marks_per_question}</td>
                                          <td style={{ padding: "8px 12px", color: "#ff6b6b", fontWeight: 700 }}>-{sec.negative_marks}</td>
                                          <td style={{ padding: "8px 12px", color: "#FFD700", fontWeight: 700 }}>{sec.questions_count * sec.marks_per_question}</td>
                                          <td style={{ padding: "8px 12px", color: "#fb923c" }}>{(parseInt(sec.time_limit)||0) > 0 ? `${sec.time_limit}m` : "—"}</td>
                                        </tr>
                                      ))}
                                      <tr style={{ borderTop: dark ? "2px solid rgba(255,215,0,0.2)" : "2px solid rgba(255,215,0,0.3)", background: dark ? "rgba(255,215,0,0.04)" : "rgba(255,215,0,0.05)" }}>
                                        <td colSpan={2} style={{ padding: "8px 12px", color: "#FFD700", fontWeight: 700 }}>TOTAL</td>
                                        <td style={{ padding: "8px 12px", color: "#FFD700", fontWeight: 800 }}>{stats.totalQ}</td>
                                        <td colSpan={2}></td>
                                        <td style={{ padding: "8px 12px", color: "#4ade80", fontWeight: 800 }}>{stats.totalM}</td>
                                        <td></td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── TAB 3: Instructions ── */}
                        {activeTab === "instructions" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div>
                              <label style={lbl}>General Instructions</label>
                              <textarea value={testForm.instructions} onChange={e => setTestForm(p => ({...p, instructions: e.target.value}))}
                                rows={6} style={{...inp, resize: "vertical", lineHeight: 1.6}}
                                placeholder={"e.g.\n1. This test contains 100 questions.\n2. Each correct answer carries 1 mark.\n3. 0.25 marks will be deducted for each wrong answer.\n4. Do not refresh the page during the exam."} />
                            </div>
                            {/* Quick instruction templates */}
                            <div>
                              <label style={{...lbl, marginBottom: "8px"}}>Quick Templates</label>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {[
                                  ["SSC/Police Standard", "1. This test contains multiple sections.\n2. Each correct answer carries marks as specified per section.\n3. There is negative marking for wrong answers.\n4. Do not close or refresh the browser during the exam.\n5. Questions marked for review will also be evaluated.\n6. Submit the test before time runs out."],
                                  ["No Negative Marking", "1. There is NO negative marking in this test.\n2. Attempt all questions.\n3. Each question carries equal marks.\n4. Do not refresh the page during the exam."],
                                  ["Speed Test", "1. This is a speed test — attempt as many as possible.\n2. Time is limited. Manage wisely.\n3. Negative marking applies.\n4. Your score = Correct - (Wrong × penalty)"]
                                ].map(([title, text]) => (
                                  <button key={title} onClick={() => setTestForm(p => ({...p, instructions: text}))}
                                    style={{ background: dark ? "rgba(255,255,255,0.04)" : "#f5f5f5", border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e0e0e0", color: dark ? "#aaa" : "#555", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", textAlign: "left", fontSize: "13px", transition: "all 0.15s" }}>
                                    <strong style={{ color: dark ? "#fff" : "#111" }}>{title}</strong><br />
                                    <span style={{ fontSize: "11px", opacity: 0.7 }}>{text.substring(0, 80)}...</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Save / Cancel buttons — always visible */}
                        <div style={{ display: "flex", gap: "10px", marginTop: "20px", paddingTop: "16px", borderTop: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #eee" }}>
                          <button onClick={() => saveTest(exam.id)} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "12px 28px", borderRadius: "9px", cursor: "pointer", fontWeight: 800, fontSize: "14px" }}>
                            {editTest ? "✅ Update Test" : "✅ Create Test"}
                          </button>
                          <button onClick={() => { setShowTestForm(null); setEditTest(null); setShowSectionForm(false); setActiveTab("basic"); }} style={{ background: "transparent", border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid #ddd", color: dark ? "#aaa" : "#555", padding: "12px 20px", borderRadius: "9px", cursor: "pointer", fontSize: "14px" }}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Test List */}
                  <div style={{ padding: "0 16px 16px" }}>
                    {(tests[exam.id] || []).length === 0 ? (
                      <div style={{ color: "#444", fontSize: "13px", padding: "8px 0", textAlign: "center" }}>No tests yet.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {(tests[exam.id] || []).map(test => {
                          const secs = parseSections(test);
                          const tStats = sectionStats(secs);
                          return (
                            <div key={test.id} style={{ background: dark ? "rgba(255,255,255,0.03)" : "#fafafa", border: dark ? "1px solid rgba(255,255,255,0.07)" : "1px solid #e8e8e8", borderRadius: "10px", overflow: "hidden" }}>
                              <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                    <div style={{ color: dark ? "#fff" : "#111", fontSize: "14px", fontWeight: 700 }}>{test.name}</div>
                                    <span style={{ background: test.is_published ? "rgba(74,222,128,0.12)" : "rgba(255,100,100,0.1)", border: test.is_published ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,100,100,0.3)", color: test.is_published ? "#4ade80" : "#ff6b6b", padding: "1px 8px", borderRadius: "8px", fontSize: "10px", fontWeight: 700 }}>{test.is_published ? "● Live" : "● Draft"}</span>
                                  </div>
                                  <div style={{ color: "#666", fontSize: "11px", marginTop: "4px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    <span style={{ background: "rgba(255,255,255,0.06)", padding: "1px 7px", borderRadius: "8px" }}>{test.test_type}</span>
                                    <span>⏱ {test.duration_minutes}min</span>
                                    <span>📊 {secs.length > 0 ? tStats.totalM : test.total_marks} marks</span>
                                    <span>➖ -{test.negative_value}</span>
                                    {secs.length > 0 && <span style={{ color: "#818cf8" }}>📚 {secs.length} sections · {tStats.totalQ} Qs</span>}
                                  </div>
                                  {secs.length > 0 && (
                                    <div style={{ display: "flex", gap: "5px", marginTop: "8px", flexWrap: "wrap" }}>
                                      {secs.map((sec, i) => (
                                        <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: `${sec.color || SECTION_COLORS[i % SECTION_COLORS.length]}15`, border: `1px solid ${sec.color || SECTION_COLORS[i % SECTION_COLORS.length]}40`, borderRadius: "20px", padding: "2px 9px" }}>
                                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: sec.color || SECTION_COLORS[i % SECTION_COLORS.length] }} />
                                          <span style={{ color: sec.color || SECTION_COLORS[i % SECTION_COLORS.length], fontSize: "10px", fontWeight: 700 }}>{sec.name}</span>
                                          {sec.subject && <span style={{ color: "#555", fontSize: "10px" }}>{sec.subject}</span>}
                                          <span style={{ color: "#555", fontSize: "10px" }}>{sec.questions_count}Q</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                                  <button onClick={() => openTestForm(exam.id, test)} style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.25)", color: "#FFD700", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Edit</button>
                                  <button onClick={() => deleteTest(test.id, exam.id)} style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.25)", color: "#ff6b6b", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Del</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ADMIN USERS COMPONENT - Advanced
function AdminUsers({ user: adminUser }) {
  const dark = useTheme();
  const [users, setUsers] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState(null);
  const [userAttempts, setUserAttempts] = useState({});
  const [loadingAttempts, setLoadingAttempts] = useState({});
  const [msg, setMsg] = useState("");
  const [actionLoading, setActionLoading] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const inputS = { background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)", border:dark?"1px solid rgba(255,255,255,0.15)":"1px solid rgba(0,0,0,0.15)", color:dark?"#fff":"#111", padding:"10px 14px", borderRadius:"8px", fontSize:"14px", outline:"none", boxSizing:"border-box" };

  const exportCSV = () => {
    const rows = [["Name","Phone","State","Target Exam","Attempts","Role","Joined","User ID"]];
    users.forEach(u => rows.push([
      u.full_name||"", u.phone||"", u.state||"", u.target_exam||"",
      u.attempt_count||0,
      u.isAdmin?"admin":u.isModerator?"moderator":"student",
      u.created_at?new Date(u.created_at).toLocaleDateString("en-IN"):"",
      u.id
    ]));
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
    a.download = `meritmatrix_users_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const loadUsers = () => {
    setLoading(true);
    Promise.all([
      supabaseRequest("/profiles?select=*&order=created_at.desc&limit=500", { token: adminUser.token }).catch(() => []),
      supabaseRequest("/attempts?select=user_id,created_at&order=created_at.desc", { token: adminUser.token }).catch(() => []),
      supabaseRequest("/roles?select=user_id,role", { token: adminUser.token }).catch(() => []),
    ]).then(([profileData, attemptData, rolesData]) => {
      const attemptCounts = {};
      (attemptData || []).forEach(a => { attemptCounts[a.user_id] = (attemptCounts[a.user_id] || 0) + 1; });
      const adminSet = new Set((rolesData || []).filter(r => r.role === "admin").map(r => r.user_id));
      const modSet = new Set((rolesData || []).filter(r => r.role === "moderator").map(r => r.user_id));
      let enriched = (profileData || []).map(u => ({ ...u, attempt_count: attemptCounts[u.id] || 0, isAdmin: adminSet.has(u.id), isModerator: modSet.has(u.id) }));
      if (enriched.length === 0 && Object.keys(attemptCounts).length > 0) {
        enriched = Object.keys(attemptCounts).map(uid => ({ id: uid, full_name: null, phone: null, state: null, target_exam: null, created_at: null, attempt_count: attemptCounts[uid], isAdmin: adminSet.has(uid), isModerator: modSet.has(uid) }));
      }
      setUsers(enriched);
      setAttempts(attemptData || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const loadUserAttempts = async (uid) => {
    // If already expanded, just toggle closed
    if (expandedUser === uid) { setExpandedUser(null); return; }
    setLoadingAttempts(p => ({...p, [uid]: true}));
    setExpandedUser(uid);
    try {
      // Always fetch fresh from DB — never use stale cache
      const data = await supabaseRequest(`/attempts?user_id=eq.${uid}&select=*,tests(name)&order=created_at.desc&limit=50`, { token: adminUser.token });
      const fresh = data || [];
      setUserAttempts(p => ({...p, [uid]: fresh}));
      // Also sync the count shown on the card
      setUsers(prev => prev.map(x => x.id === uid ? {...x, attempt_count: fresh.length} : x));
    } catch { setUserAttempts(p => ({...p, [uid]: []})); }
    setLoadingAttempts(p => ({...p, [uid]: false}));
  };

  const setAction = (uid, val) => setActionLoading(p => ({...p, [uid]: val}));

  const deleteUser = async (u) => {
    setAction(u.id, "deleting");
    const errors = [];
    // 1. Delete attempts
    try { await supabaseRequest(`/attempts?user_id=eq.${u.id}`, { method: "DELETE", token: adminUser.token, prefer: "return=minimal" }); } catch(e) { errors.push("attempts: " + e.message); }
    // 2. Delete roles
    try { await supabaseRequest(`/roles?user_id=eq.${u.id}`, { method: "DELETE", token: adminUser.token, prefer: "return=minimal" }); } catch(e) { errors.push("roles: " + e.message); }
    // 3. Delete profile (RLS must allow admin delete — see SQL below)
    try {
      await supabaseRequest(`/profiles?id=eq.${u.id}`, { method: "DELETE", token: adminUser.token, prefer: "return=minimal" });
    } catch(e) {
      errors.push("profile: " + e.message);
      setAction(u.id, null);
      setMsg(`❌ Profile delete failed (${e.message}). Run SQL: CREATE POLICY "Admin delete profiles" ON profiles FOR DELETE USING (EXISTS (SELECT 1 FROM roles WHERE user_id = auth.uid() AND role = 'admin'));`);
      return;
    }
    // All done — remove from UI immediately
    if (expandedUser === u.id) setExpandedUser(null);
    setUserAttempts(p => { const n = {...p}; delete n[u.id]; return n; });
    setUsers(prev => prev.filter(x => x.id !== u.id));
    setMsg(errors.length > 0 ? `⚠️ Deleted but some errors: ${errors.join(", ")}` : "✅ User deleted successfully.");
    setAction(u.id, null);
  };

  const deleteAttempts = async (u) => {
    setConfirmAction({ label: "Clear all attempts", desc: `This will permanently delete all ${u.attempt_count} attempts for ${u.full_name || "this user"}. Cannot be undone.`, danger: true, onConfirm: async () => {
      setConfirmAction(null);
      setAction(u.id, "clearing");
    try {
      await supabaseRequest(`/attempts?user_id=eq.${u.id}`, { method: "DELETE", token: adminUser.token, prefer: "return=minimal" });
      setMsg("✅ All attempts cleared.");
      setUserAttempts(p => ({...p, [u.id]: []}));
      setUsers(prev => prev.map(x => x.id === u.id ? {...x, attempt_count: 0} : x));
    } catch(e) { setMsg("❌ " + e.message); }
    setAction(u.id, null);
    }});
  };

  const toggleAdmin = async (u) => {
    const making = !u.isAdmin;
    setConfirmAction({ label: making ? "Grant Admin Access" : "Revoke Admin Access", desc: making ? `${u.full_name || "This user"} will get full admin access to the panel.` : `${u.full_name || "This user"} will lose admin access.`, danger: !making, onConfirm: async () => {
      setConfirmAction(null);
      setAction(u.id, "role");
    try {
      if (making) {
        await supabaseRequest("/roles", { method: "POST", body: { user_id: u.id, role: "admin" }, token: adminUser.token });
      } else {
        await supabaseRequest(`/roles?user_id=eq.${u.id}&role=eq.admin`, { method: "DELETE", token: adminUser.token });
      }
      setMsg(`✅ ${making ? "Admin access granted." : "Admin access revoked."}`);
      setUsers(prev => prev.map(x => x.id === u.id ? {...x, isAdmin: making} : x));
    } catch(e) { setMsg("❌ " + e.message); }
    setAction(u.id, null);
    }});
  };

  const toggleModerator = async (u) => {
    const making = !u.isModerator;
    setConfirmAction({ label: making ? "Grant Moderator Access" : "Revoke Moderator Access", desc: making ? `${u.full_name || "This user"} will be able to create/edit exams and tests only. No user management.` : `${u.full_name || "This user"} will lose moderator access.`, danger: !making, onConfirm: async () => {
      setConfirmAction(null);
      setAction(u.id, "mod");
      try {
        if (making) {
          await supabaseRequest("/roles", { method: "POST", body: { user_id: u.id, role: "moderator" }, token: adminUser.token });
        } else {
          await supabaseRequest(`/roles?user_id=eq.${u.id}&role=eq.moderator`, { method: "DELETE", token: adminUser.token, prefer: "return=minimal" });
        }
        setMsg(`✅ ${making ? "Moderator access granted." : "Moderator access revoked."}`);
        setUsers(prev => prev.map(x => x.id === u.id ? {...x, isModerator: making} : x));
      } catch(e) { setMsg("❌ " + e.message); }
      setAction(u.id, null);
    }});
  };

  const filtered = users
    .filter(u => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (u.full_name||"").toLowerCase().includes(q) ||
        (u.phone||"").includes(q) ||
        (u.id||"").includes(q) ||
        (u.state||"").toLowerCase().includes(q) ||
        (u.target_exam||"").toLowerCase().includes(q);
      const matchRole = roleFilter==="all" ? true
        : roleFilter==="admin" ? u.isAdmin
        : roleFilter==="mod" ? u.isModerator && !u.isAdmin
        : !u.isAdmin && !u.isModerator;
      return matchSearch && matchRole;
    })
    .sort((a,b) => {
      if (sortBy==="attempts") return (b.attempt_count||0)-(a.attempt_count||0);
      if (sortBy==="name") return (a.full_name||"").localeCompare(b.full_name||"");
      if (sortBy==="oldest") return new Date(a.created_at||0)-new Date(b.created_at||0);
      return new Date(b.created_at||0)-new Date(a.created_at||0);
    });

  const btnS = (bg, col, border) => ({
    background: bg, border, color: col,
    padding: "5px 11px", borderRadius: "6px",
    cursor: "pointer", fontSize: "11px", fontWeight: 700,
    whiteSpace: "nowrap"
  });

  return (
    <div style={{ maxWidth: "1000px" }}>
      {/* Confirm Modal */}
      {confirmAction && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
          <div style={{ background: dark?"#0f1120":"#fff", border: dark?"1px solid rgba(255,255,255,0.1)":"1px solid rgba(0,0,0,0.12)", borderRadius:"16px", padding:"28px", maxWidth:"380px", width:"100%", boxShadow:"0 24px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize:"2rem", textAlign:"center", marginBottom:"12px" }}>{confirmAction.danger ? "⚠️" : "✅"}</div>
            <h3 style={{ color: dark?"#fff":"#111", fontFamily:"'Sora',sans-serif", fontWeight:800, textAlign:"center", margin:"0 0 8px", fontSize:"1.1rem" }}>{confirmAction.label}</h3>
            <p style={{ color: dark?"#666":"#888", fontSize:"13px", textAlign:"center", lineHeight:1.6, margin:"0 0 24px" }}>{confirmAction.desc}</p>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => setConfirmAction(null)} style={{ flex:1, background:"transparent", border: dark?"1px solid rgba(255,255,255,0.12)":"1px solid rgba(0,0,0,0.15)", color: dark?"#aaa":"#555", padding:"11px", borderRadius:"8px", cursor:"pointer", fontSize:"14px", fontWeight:600 }}>Cancel</button>
              <button onClick={confirmAction.onConfirm} style={{ flex:1, background: confirmAction.danger?"linear-gradient(135deg,#ff4444,#cc0000)":"linear-gradient(135deg,#4ade80,#22c55e)", border:"none", color:"#fff", padding:"11px", borderRadius:"8px", cursor:"pointer", fontSize:"14px", fontWeight:800 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <h1 style={{ color:dark?"#fff":"#111", fontFamily:"'Sora',sans-serif", fontWeight:800, margin:0 }}>Users & Management</h1>
          <p style={{ color:"#555", fontSize:"13px", marginTop:"4px" }}>
            <span style={{color:"#ff6b6b"}}>{users.filter(u=>u.isAdmin).length} admins</span>
            {" · "}
            <span style={{color:"#22d3ee"}}>{users.filter(u=>u.isModerator&&!u.isAdmin).length} mods</span>
            {" · "}
            <span style={{color:"#818cf8"}}>{users.filter(u=>!u.isAdmin&&!u.isModerator).length} students</span>
            {" · "}
            <span style={{color:"#FFD700"}}>{attempts.length} total attempts</span>
          </p>
        </div>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          <button onClick={exportCSV} title="Export all users to CSV" style={{ background:"rgba(74,222,128,0.1)", border:"1px solid rgba(74,222,128,0.25)", color:"#4ade80", padding:"7px 14px", borderRadius:"8px", fontSize:"12px", fontWeight:700, cursor:"pointer" }}>⬇ Export CSV</button>
          <button onClick={loadUsers} title="Refresh user list" style={{ background:"rgba(255,255,255,0.05)", border:dark?"1px solid rgba(255,255,255,0.1)":"1px solid rgba(0,0,0,0.1)", color:"#666", padding:"7px 12px", borderRadius:"8px", fontSize:"12px", cursor:"pointer" }}>↻ Refresh</button>
        </div>
      </div>

      {msg && (
        <div onClick={() => setMsg("")} style={{ color:msg.startsWith("✅")?"#4ade80":"#ff6b6b", marginBottom:"16px", fontSize:"13px", cursor:"pointer", padding:"10px 14px", background:msg.startsWith("✅")?"rgba(74,222,128,0.08)":"rgba(255,50,50,0.08)", borderRadius:"8px", border:msg.startsWith("✅")?"1px solid rgba(74,222,128,0.25)":"1px solid rgba(255,50,50,0.25)" }}>
          {msg} <span style={{float:"right",opacity:0.5}}>✕ dismiss</span>
        </div>
      )}

      {/* Search + Filter + Sort */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"12px", flexWrap:"wrap" }}>
        <input placeholder="🔍 Search name, phone, state, exam, ID…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputS, flex:1, minWidth:"180px" }} />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...inputS, width:"auto", cursor:"pointer" }}>
          <option value="all">All Roles</option>
          <option value="admin">Admins only</option>
          <option value="mod">Moderators only</option>
          <option value="student">Students only</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inputS, width:"auto", cursor:"pointer" }}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="attempts">Most Attempts</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      {(search || roleFilter !== "all") && <div style={{ color:"#555", fontSize:"12px", marginBottom:"10px" }}>Showing {filtered.length} of {users.length} users</div>}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
          <div style={{ width: 32, height: 32, border: "3px solid rgba(255,215,0,0.2)", borderTop: "3px solid #FFD700", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.length === 0 && <div style={{ color: "#555", textAlign: "center", padding: "40px" }}>No users found.</div>}
          {filtered.map(u => {
            const isLoading = actionLoading[u.id];
            const isSelf = u.id === adminUser.id;
            return (
              <div key={u.id} style={{ background: dark ? "rgba(255,255,255,0.04)" : "#fff", border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)", borderRadius: "12px", overflow: "hidden", boxShadow: dark ? "none" : "0 1px 4px rgba(0,0,0,0.05)" }}>
                <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  {/* Avatar + info */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: u.isAdmin ? "linear-gradient(135deg,#ff6b6b,#ff3333)" : "linear-gradient(135deg,#818cf8,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: "15px", flexShrink: 0 }}>
                      {(u.full_name || "U").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ color: dark ? "#fff" : "#111", fontWeight: 600, fontSize: "14px" }}>{u.full_name || <span style={{color:"#555"}}>No name</span>}</span>
                        {u.isAdmin && <span style={{ background: "rgba(255,50,50,0.15)", border: "1px solid rgba(255,50,50,0.3)", color: "#ff6b6b", fontSize: "9px", fontWeight: 800, padding: "1px 6px", borderRadius: "10px", letterSpacing: "1px" }}>ADMIN</span>}
                        {u.isModerator && !u.isAdmin && <span style={{ background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)", color: "#22d3ee", fontSize: "9px", fontWeight: 800, padding: "1px 6px", borderRadius: "10px", letterSpacing: "1px" }}>MOD</span>}
                        {isSelf && <span style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700", fontSize: "9px", fontWeight: 800, padding: "1px 6px", borderRadius: "10px" }}>YOU</span>}
                      </div>
                      <div style={{ color: "#555", fontSize: "11px", display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                        {u.phone && <span>📞 {u.phone}</span>}
                        {u.state && <span>📍 {u.state}</span>}
                        {u.target_exam && <span>🎯 {u.target_exam}</span>}
                        <span style={{ fontFamily: "monospace", color: "#444", fontSize: "10px" }}>{u.id?.substring(0,12)}...</span>
                        {u.created_at && <span>{new Date(u.created_at).toLocaleDateString("en-IN")}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
                    <div style={{ textAlign: "center", marginRight: "4px" }}>
                      <div style={{ color: u.attempt_count > 0 ? "#4ade80" : "#555", fontWeight: 700, fontSize: "18px", lineHeight: 1 }}>{u.attempt_count}</div>
                      <div style={{ color: "#555", fontSize: "9px", textTransform: "uppercase" }}>Attempts</div>
                    </div>

                    {/* View Attempts */}
                    <button onClick={() => loadUserAttempts(u.id)}
                      style={btnS("rgba(74,222,128,0.1)", "#4ade80", "1px solid rgba(74,222,128,0.3)")}>
                      {expandedUser === u.id ? "▲ Hide" : "▼ History"}
                    </button>

                    {/* Clear Attempts */}
                    {u.attempt_count > 0 && (
                      <button onClick={() => deleteAttempts(u)} disabled={!!isLoading}
                        style={btnS("rgba(251,146,60,0.1)", "#fb923c", "1px solid rgba(251,146,60,0.3)")}>
                        {isLoading === "clearing" ? "..." : "🗑 Attempts"}
                      </button>
                    )}

                    {/* Toggle Moderator */}
                    {!isSelf && !u.isAdmin && (
                      <button onClick={() => toggleModerator(u)} disabled={!!isLoading}
                        style={btnS(u.isModerator ? "rgba(34,211,238,0.1)" : "rgba(34,211,238,0.08)", u.isModerator ? "#22d3ee" : "#22d3ee99", u.isModerator ? "1px solid rgba(34,211,238,0.35)" : "1px solid rgba(34,211,238,0.2)")}>
                        {isLoading === "mod" ? "..." : u.isModerator ? "⬇ Revoke Mod" : "🛡 Make Mod"}
                      </button>
                    )}
                    {/* Toggle Admin — can't revoke your own admin */}
                    {!isSelf && (
                      <button onClick={() => toggleAdmin(u)} disabled={!!isLoading}
                        style={btnS(u.isAdmin ? "rgba(255,50,50,0.1)" : "rgba(129,140,248,0.1)", u.isAdmin ? "#ff6b6b" : "#818cf8", u.isAdmin ? "1px solid rgba(255,50,50,0.3)" : "1px solid rgba(129,140,248,0.3)")}>
                        {isLoading === "role" ? "..." : u.isAdmin ? "⬇ Revoke Admin" : "⬆ Make Admin"}
                      </button>
                    )}

                    {/* Delete User — can't delete yourself */}
                    {!isSelf && (
                      <button onClick={() => setConfirmAction({ label: "Delete User", desc: `Permanently delete ${u.full_name || "this user"} and all their data. This cannot be undone.`, danger: true, onConfirm: () => deleteUser(u) })} disabled={!!isLoading}
                        style={btnS("rgba(255,30,30,0.12)", "#ff4444", "1px solid rgba(255,30,30,0.35)")}>
                        {isLoading === "deleting" ? "..." : "🗑 Delete"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Attempts history */}
                {expandedUser === u.id && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px", background: "rgba(0,0,0,0.15)" }}>
                    {loadingAttempts[u.id] ? (
                      <div style={{ color: "#666", padding: "12px", fontSize: "13px" }}>Loading...</div>
                    ) : (userAttempts[u.id] || []).length === 0 ? (
                      <div style={{ color: "#555", fontSize: "13px", padding: "8px" }}>No attempts recorded.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ color: "#aaa", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", marginBottom: "4px" }}>ATTEMPT HISTORY</div>
                        {(userAttempts[u.id] || []).map((a) => {
                          const pct = a.total_marks > 0 ? Math.round((a.score / a.total_marks) * 100) : 0;
                          return (
                            <div key={a.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: dark ? "#ddd" : "#222", fontSize: "13px", fontWeight: 600 }}>{a.tests?.name || "Unknown Test"}</div>
                                <div style={{ color: "#555", fontSize: "11px" }}>{new Date(a.created_at).toLocaleString("en-IN")}</div>
                              </div>
                              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ color: "#4ade80", fontSize: "12px" }}>✓ {a.correct_count || 0}</span>
                                <span style={{ color: "#ff6b6b", fontSize: "12px" }}>✗ {a.wrong_count || 0}</span>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ color: pct >= 60 ? "#4ade80" : pct >= 40 ? "#fb923c" : "#ff6b6b", fontWeight: 700, fontSize: "15px" }}>{pct}%</div>
                                  <div style={{ color: "#555", fontSize: "10px" }}>{a.score}/{a.total_marks}</div>
                                </div>
                                <button onClick={() => setConfirmAction({ label: "Delete Attempt", desc: `Remove this attempt from ${u.full_name || "this user"}'s history permanently.`, danger: true, onConfirm: async () => {
                                  setConfirmAction(null);
                                  try {
                                    await supabaseRequest(`/attempts?id=eq.${a.id}`, { method: "DELETE", token: adminUser.token, prefer: "return=minimal" });
                                    const remaining = (userAttempts[u.id]||[]).filter(x => x.id !== a.id);
                                    setUserAttempts(p => ({...p, [u.id]: remaining}));
                                    setUsers(prev => prev.map(x => x.id === u.id ? {...x, attempt_count: remaining.length} : x));
                                    setMsg("✅ Attempt deleted.");
                                  } catch { setMsg("❌ Failed to delete attempt."); }
                                }})} style={{ background: "rgba(255,30,30,0.12)", border: "1px solid rgba(255,30,30,0.3)", color: "#ff4444", padding: "3px 9px", borderRadius: "5px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>🗑</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ==========================================================
// ADMIN QUESTIONS — PRO EDITION
// ==========================================================
function AdminQuestions({ user }) {
  const dark = useTheme();
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [mode, setMode] = useState("manual"); // "manual"|"file"|"manage"|"ai"

  // Manual form state
  const emptyQ = { question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "a", marks: 1, negative_marks: 0.25, subject: "General", explanation: "", image_url: "", option_a_image: "", option_b_image: "", option_c_image: "", option_d_image: "" };
  const [qForm, setQForm] = useState(emptyQ);
  const [qImageFile, setQImageFile] = useState(null);
  const [optImageFiles, setOptImageFiles] = useState({ a: null, b: null, c: null, d: null });
  const [editingQId, setEditingQId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  // Manage state
  const [existingQs, setExistingQs] = useState([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [previewQ, setPreviewQ] = useState(null);
  const [bulkSelect, setBulkSelect] = useState([]);

  // File upload state
  const [fileData, setFileData] = useState([]);
  const [fileError, setFileError] = useState("");
  const [filePreviewOpen, setFilePreviewOpen] = useState(false);

  // AI paste state
  const [aiRawText, setAiRawText] = useState("");
  const [aiParsed, setAiParsed] = useState([]);
  const [aiError, setAiError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Filter state for manage
  const [manageSearch, setManageSearch] = useState("");
  const [manageSubjectFilter, setManageSubjectFilter] = useState("All");

  const inputS = { width: "100%", background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.15)", color: dark ? "#fff" : "#111", padding: "10px 12px", borderRadius: "8px", fontSize: "14px", outline: "none", boxSizing: "border-box" };

  useEffect(() => {
    supabaseRequest("/tests?select=id,name,exams(name)&order=created_at.desc", { token: user.token })
      .then(data => setAvailableTests(data || [])).catch(() => {});
  }, [user]);

  const loadQuestions = useCallback(() => {
    if (!selectedTestId) return;
    setLoadingQs(true);
    supabaseRequest(`/questions?test_id=eq.${selectedTestId}&order=created_at.asc`, { token: user.token })
      .then(data => { setExistingQs(data || []); setLoadingQs(false); })
      .catch(() => setLoadingQs(false));
  }, [selectedTestId, user.token]);

  useEffect(() => {
    if (mode === "manage" && selectedTestId) loadQuestions();
  }, [mode, selectedTestId, loadQuestions]);

  // --- UPLOAD IMAGE HELPER ---
  const uploadImg = async (file, token) => {
    if (!file) return null;
    // Validate file type
    if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");
    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.name.split(".").pop().toLowerCase();
    const name = `q_${Date.now()}_${Math.random().toString(36).substring(2,8)}.${ext}`;
    return supabaseUpload("question_images", name, file, token);
  };

  // --- MANUAL SUBMIT ---
  const handleManualSubmit = async () => {
    if (!selectedTestId && !editingQId) { setMsg("❌ Select a test first."); return; }
    if (!qForm.question_text.trim()) { setMsg("❌ Question text is required."); return; }
    if (!qForm.option_a.trim() || !qForm.option_b.trim()) { setMsg("❌ At least options A and B are required."); return; }
    setUploading(true); setMsg("");
    try {
      let imgUrl = qForm.image_url;
      if (qImageFile) imgUrl = await uploadImg(qImageFile, user.token);

      let optImgUrls = { a: qForm.option_a_image, b: qForm.option_b_image, c: qForm.option_c_image, d: qForm.option_d_image };
      for (const opt of ["a","b","c","d"]) {
        if (optImageFiles[opt]) optImgUrls[opt] = await uploadImg(optImageFiles[opt], user.token);
      }

      const body = {
        question_text: qForm.question_text,
        option_a: qForm.option_a, option_b: qForm.option_b,
        option_c: qForm.option_c, option_d: qForm.option_d,
        correct_answer: qForm.correct_answer,
        marks: parseFloat(qForm.marks) || 1,
        negative_marks: parseFloat(qForm.negative_marks) || 0.25,
        subject: qForm.subject || "General",
        explanation: qForm.explanation || null,
        image_url: imgUrl || null,
        difficulty: qForm.difficulty || "medium",
      };

      if (editingQId) {
        await supabaseRequest(`/questions?id=eq.${editingQId}`, { method: "PATCH", body, token: user.token, prefer: "return=minimal" });
        setMsg("✅ Question updated!");
        setEditingQId(null);
        loadQuestions();
        setMode("manage");
      } else {
        await supabaseRequest("/questions", { method: "POST", body: { ...body, test_id: selectedTestId }, token: user.token, prefer: "return=minimal" });
        setMsg("✅ Question saved! Add another or switch to Manage to view.");
      }
      setQForm({ ...emptyQ, subject: qForm.subject });
      setQImageFile(null); setOptImageFiles({ a:null,b:null,c:null,d:null });
      ["q-img","opt-img-a","opt-img-b","opt-img-c","opt-img-d"].forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
    } catch(e) { setMsg("❌ " + e.message); } finally { setUploading(false); }
  };

  // --- EDIT QUESTION ---
  const handleEditQ = (q) => {
    setQForm({
      question_text: q.question_text, option_a: q.option_a, option_b: q.option_b,
      option_c: q.option_c || "", option_d: q.option_d || "", correct_answer: q.correct_answer,
      marks: q.marks, negative_marks: q.negative_marks, subject: q.subject || "General",
      explanation: q.explanation || "", image_url: q.image_url || "",
      option_a_image: "", option_b_image: "", option_c_image: "", option_d_image: "",
      difficulty: q.difficulty || "medium",
    });
    setEditingQId(q.id);
    setMode("manual");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMsg("✏️ Editing question — make changes and click Update.");
  };

  const [qConfirm, setQConfirm] = useState(null); // {label, desc, onConfirm}

  // --- DELETE QUESTION ---
  const handleDeleteQ = (id) => {
    setQConfirm({ label: "Delete Question?", desc: "This question will be permanently removed.", onConfirm: async () => {
      setQConfirm(null);
      try {
        await supabaseRequest(`/questions?id=eq.${id}`, { method: "DELETE", token: user.token });
        setExistingQs(prev => prev.filter(q => q.id !== id));
        setBulkSelect(prev => prev.filter(x => x !== id));
        setMsg("✅ Question deleted.");
      } catch(e) { setMsg("❌ " + e.message); }
    }});
  };

  // --- BULK DELETE ---
  const handleBulkDelete = () => {
    if (!bulkSelect.length) return;
    setQConfirm({ label: `Delete ${bulkSelect.length} Questions?`, desc: `Permanently remove ${bulkSelect.length} selected questions. Cannot be undone.`, onConfirm: async () => {
      setQConfirm(null);
      try {
        await Promise.all(bulkSelect.map(id => supabaseRequest(`/questions?id=eq.${id}`, { method: "DELETE", token: user.token })));
        setExistingQs(prev => prev.filter(q => !bulkSelect.includes(q.id)));
        setBulkSelect([]);
        setMsg(`✅ Deleted ${bulkSelect.length} questions.`);
      } catch(e) { setMsg("❌ " + e.message); }
    }});
  };

  // --- DUPLICATE QUESTION ---
  const handleDuplicateQ = async (q) => {
    if (!selectedTestId) return;
    const body = {
      test_id: selectedTestId, question_text: q.question_text + " (copy)",
      option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
      correct_answer: q.correct_answer, marks: q.marks, negative_marks: q.negative_marks,
      subject: q.subject, explanation: q.explanation, image_url: q.image_url, difficulty: q.difficulty,
    };
    try {
      await supabaseRequest("/questions", { method: "POST", body, token: user.token, prefer: "return=minimal" });
      setMsg("✅ Question duplicated."); loadQuestions();
    } catch(e) { setMsg("❌ " + e.message); }
  };

  // --- CSV/TXT PARSER ---
  const parseCSVLine = (line) => {
    const result = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    result.push(cur.trim()); return result;
  };

  const parseCSV = (text) => {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return { rows: [], errors: ["CSV must have a header row"] };
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/"/g,"").trim());
    const rows = []; const errors = [];
    lines.slice(1).forEach((line, i) => {
      if (!line.trim()) return;
      const vals = parseCSVLine(line); const row = {};
      headers.forEach((h, idx) => { row[h] = (vals[idx] || "").replace(/^"|"$/g,"").trim(); });
      if (!row.question_text) { errors.push(`Row ${i+2}: Missing question_text`); return; }
      if (!row.option_a || !row.option_b) { errors.push(`Row ${i+2}: Need at least option_a and option_b`); return; }
      if (!["a","b","c","d"].includes((row.correct_answer||"").toLowerCase())) { errors.push(`Row ${i+2}: correct_answer must be a/b/c/d`); return; }
      rows.push({ ...row, marks: parseFloat(row.marks)||1, negative_marks: parseFloat(row.negative_marks)||0.25, subject: row.subject||"General", correct_answer: row.correct_answer.toLowerCase() });
    });
    return { rows, errors };
  };

  const parseTXT = (text) => {
    const blocks = text.split(/\n\s*\n/).filter(b => b.trim());
    const rows = []; const errors = [];
    blocks.forEach((block, i) => {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      const q = { marks: 1, negative_marks: 0.25, subject: "General" };
      lines.forEach(line => {
        if (/^Q\d*[:.]/i.test(line)) q.question_text = line.replace(/^Q\d*[:.]\s*/i,"").trim();
        else if (/^[Aa][).\s]/i.test(line)) q.option_a = line.replace(/^[Aa][).\s]/,"").trim();
        else if (/^[Bb][).\s]/i.test(line)) q.option_b = line.replace(/^[Bb][).\s]/,"").trim();
        else if (/^[Cc][).\s]/i.test(line)) q.option_c = line.replace(/^[Cc][).\s]/,"").trim();
        else if (/^[Dd][).\s]/i.test(line)) q.option_d = line.replace(/^[Dd][).\s]/,"").trim();
        else if (/^Ans[:.]/i.test(line)) q.correct_answer = line.replace(/^Ans[:.]\s*/i,"").trim().toLowerCase();
        else if (/^Exp[:.]/i.test(line)) q.explanation = line.replace(/^Exp[:.]\s*/i,"").trim();
        else if (/^Subj[:.]/i.test(line)) q.subject = line.replace(/^Subj[:.]\s*/i,"").trim();
        else if (/^Marks[:.]/i.test(line)) q.marks = parseFloat(line.replace(/^Marks[:.]\s*/i,""));
        else if (/^Neg[:.]/i.test(line)) q.negative_marks = parseFloat(line.replace(/^Neg[:.]\s*/i,""));
        else if (/^Img[:.]/i.test(line)) q.image_url = line.replace(/^Img[:.]\s*/i,"").trim();
      });
      if (!q.question_text || !q.option_a || !q.option_b || !q.correct_answer) { errors.push(`Block ${i+1}: Missing required fields (Q/A/B/Ans)`); return; }
      if (!["a","b","c","d"].includes(q.correct_answer)) { errors.push(`Block ${i+1}: Ans must be a/b/c/d`); return; }
      rows.push(q);
    });
    return { rows, errors };
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setFileError(""); setFileData([]);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      let result;
      if (file.name.endsWith('.csv')) result = parseCSV(text);
      else if (file.name.endsWith('.txt')) result = parseTXT(text);
      else { setFileError("Unsupported file. Use .csv or .txt"); return; }
      if (result.errors.length) setFileError(result.errors.slice(0,5).join(" | "));
      setFileData(result.rows);
      if (result.rows.length > 0) setFilePreviewOpen(true);
    };
    reader.readAsText(file);
  };

  const submitBulk = async (rows) => {
    if (!rows.length) return;
    if (!selectedTestId) { setMsg("❌ Select a test first."); return; }
    setUploading(true); setMsg("");
    try {
      const questions = rows.map(r => ({ ...r, test_id: selectedTestId, image_url: r.image_url || null }));
      await supabaseRequest("/questions", { method: "POST", body: questions, token: user.token, prefer: "return=minimal" });
      setMsg(`✅ ${questions.length} questions uploaded!`);
      setFileData([]); setFilePreviewOpen(false);
      const el = document.getElementById("bulk-file-upload"); if (el) el.value = "";
    } catch(e) { setMsg(`❌ ${e.message}`); } finally { setUploading(false); }
  };

  // --- AI SMART PASTE ---
  const handleAIParse = async () => {
    if (!aiRawText.trim()) { setAiError("Paste some text first."); return; }
    setAiLoading(true); setAiError(""); setAiParsed([]);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: `You are a question parser for a test platform. Parse the following text into structured MCQ questions. Extract every question you find.

Return ONLY a valid JSON array, no markdown, no explanation. Each object must have:
- question_text (string)
- option_a (string)
- option_b (string)
- option_c (string, empty string if not present)
- option_d (string, empty string if not present)
- correct_answer (string: "a", "b", "c", or "d")
- explanation (string, empty string if not present)
- subject (string, guess from context or use "General")
- marks (number, default 1)
- negative_marks (number, default 0.25)

TEXT TO PARSE:
${aiRawText}`
          }]
        })
      });
      const data = await response.json();
      const raw = data.content?.[0]?.text || "";
      const clean = raw.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed)) throw new Error("Not an array");
      setAiParsed(parsed);
    } catch(e) {
      setAiError("Parse failed. Check your text format or try again. " + e.message);
    } finally { setAiLoading(false); }
  };

  // Filter for manage
  const allSubjects = ["All", ...new Set(existingQs.map(q => q.subject || "General"))];
  const filteredQs = existingQs.filter(q => {
    const matchSubject = manageSubjectFilter === "All" || q.subject === manageSubjectFilter;
    const matchSearch = !manageSearch || q.question_text?.toLowerCase().includes(manageSearch.toLowerCase());
    return matchSubject && matchSearch;
  });

  const TABS = [
    { key: "manual", label: "✍️ Manual Entry" },
    { key: "file", label: "📁 File Upload" },
    { key: "ai", label: "🤖 AI Smart Paste" },
    { key: "manage", label: `📋 Manage (${existingQs.length})` },
  ];

  return (
    <div style={{ maxWidth: "900px" }}>
      {/* Confirm Delete Modal */}
      {qConfirm && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
          <div style={{ background:dark?"#0f1120":"#fff",border:dark?"1px solid rgba(255,255,255,0.1)":"1px solid rgba(0,0,0,0.12)",borderRadius:"16px",padding:"28px",maxWidth:"360px",width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.5)",textAlign:"center" }}>
            <div style={{fontSize:"2.5rem",marginBottom:"12px"}}>⚠️</div>
            <h3 style={{color:dark?"#fff":"#111",fontFamily:"'Sora',sans-serif",fontWeight:800,margin:"0 0 8px"}}>{qConfirm.label}</h3>
            <p style={{color:"#666",fontSize:"13px",lineHeight:1.6,margin:"0 0 24px"}}>{qConfirm.desc}</p>
            <div style={{display:"flex",gap:"10px"}}>
              <button onClick={() => setQConfirm(null)} style={{flex:1,background:"transparent",border:dark?"1px solid rgba(255,255,255,0.12)":"1px solid rgba(0,0,0,0.15)",color:dark?"#aaa":"#555",padding:"11px",borderRadius:"8px",cursor:"pointer",fontWeight:600}}>Cancel</button>
              <button onClick={qConfirm.onConfirm} style={{flex:1,background:"linear-gradient(135deg,#ff4444,#cc0000)",border:"none",color:"#fff",padding:"11px",borderRadius:"8px",cursor:"pointer",fontWeight:800}}>Delete</button>
            </div>
          </div>
        </div>
      )}
      <h1 style={{ color: dark ? "#fff" : "#111", fontFamily: "'Sora',sans-serif", fontWeight: 800, marginBottom: "6px" }}>Question Manager</h1>
      <p style={{ color: "#666", fontSize: "13px", marginBottom: "20px" }}>Add questions manually, via file, or paste raw text and let AI parse it automatically.</p>

      {/* Test Selector */}
      <div style={{ background: dark ? "rgba(255,215,0,0.05)" : "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.25)", padding: "16px", borderRadius: "12px", marginBottom: "20px" }}>
        <label style={{ color: dark ? "#FFD700" : "#92600A", fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "8px" }}>TARGET TEST *</label>
        <select value={selectedTestId} onChange={e => { setSelectedTestId(e.target.value); setMsg(""); setExistingQs([]); setBulkSelect([]); }} style={inputS}>
          <option value="">— Select a test —</option>
          {availableTests.map(t => <option key={t.id} value={t.id}>{t.exams?.name ? `${t.exams.name} › ` : ""}{t.name}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", overflowX: "auto", background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", padding: "4px", borderRadius: "10px" }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => { setMode(tab.key); setMsg(""); if(tab.key!=="manual") setEditingQId(null); }} style={{
            flex: "0 0 auto", padding: "9px 16px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: mode===tab.key ? 700 : 400, whiteSpace: "nowrap",
            background: mode===tab.key ? (tab.key==="ai" ? "rgba(129,140,248,0.2)" : "rgba(255,215,0,0.15)") : "transparent",
            color: mode===tab.key ? (tab.key==="ai" ? "#818cf8" : (dark?"#FFD700":"#92600A")) : (dark?"#666":"#888"),
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div style={{ color: msg.startsWith("✅") ? "#4ade80" : msg.startsWith("✏️") ? "#FFD700" : "#ff6b6b", marginBottom: "16px", fontSize: "13px", padding: "10px 14px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{msg}</span>
          <button onClick={() => setMsg("")} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: "16px" }}>×</button>
        </div>
      )}

      {/* ─── MANUAL MODE ─── */}
      {mode === "manual" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "fadeIn 0.3s ease" }}>
          {editingQId && (
            <div style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.4)", color: "#FFD700", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>✏️ <strong>Edit Mode</strong> — Modifying an existing question</span>
              <button onClick={() => { setEditingQId(null); setQForm(emptyQ); setMsg(""); }} style={{ background: "transparent", border: "1px solid rgba(255,215,0,0.4)", color: "#FFD700", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Cancel Edit</button>
            </div>
          )}

          {/* Question Text */}
          <div>
            <label style={{ color: "#aaa", fontSize: "12px", display: "block", marginBottom: "6px" }}>QUESTION TEXT *</label>
            <textarea value={qForm.question_text} onChange={e => setQForm(p => ({...p, question_text: e.target.value}))} style={{...inputS, minHeight: "90px", resize: "vertical"}} placeholder="Type the question here. For math: use $$formula$$ syntax." />
          </div>

          {/* Question Image */}
          <div style={{ background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: dark ? "1px dashed rgba(255,255,255,0.1)" : "1px dashed rgba(0,0,0,0.12)", padding: "16px", borderRadius: "10px" }}>
            <label style={{ color: "#aaa", fontSize: "12px", display: "block", marginBottom: "10px" }}>📷 QUESTION IMAGE (Optional — for diagrams, maps, passages)</label>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <label htmlFor="q-img" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: dark ? "#ddd" : "#333", padding: "8px 16px", borderRadius: "7px", cursor: "pointer", fontSize: "13px", whiteSpace: "nowrap" }}>
                📁 Upload Image
              </label>
              <input type="file" id="q-img" accept="image/*" style={{ display: "none" }} onChange={e => {
                const f = e.target.files[0];
                if (f) { setQImageFile(f); setQForm(p => ({...p, image_url: URL.createObjectURL(f)})); }
              }} />
              <span style={{ color: "#555", fontSize: "12px" }}>OR</span>
              <input value={qImageFile ? "" : qForm.image_url} onChange={e => { setQImageFile(null); setQForm(p => ({...p, image_url: e.target.value})); }} style={{...inputS, flex: 1, padding: "8px", marginBottom: 0}} placeholder="Paste image URL..." disabled={!!qImageFile} />
            </div>
            {qForm.image_url && (
              <div style={{ marginTop: "12px", position: "relative", display: "inline-block" }}>
                <img src={qForm.image_url} alt="Preview" style={{ maxHeight: "140px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }} onError={e => e.target.style.display="none"} />
                <button onClick={() => { setQImageFile(null); setQForm(p => ({...p, image_url: ""})); const el=document.getElementById("q-img"); if(el)el.value=""; }} style={{ position: "absolute", top: -8, right: -8, background: "#ff6b6b", color: "#fff", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: "14px", lineHeight: "24px", textAlign: "center" }}>×</button>
              </div>
            )}
          </div>

          {/* Options */}
          <div>
            <label style={{ color: "#aaa", fontSize: "12px", display: "block", marginBottom: "10px" }}>OPTIONS *</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {["a","b","c","d"].map(opt => (
                <div key={opt} style={{ display: "flex", gap: "10px", alignItems: "flex-start", background: qForm.correct_answer === opt ? (dark ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.08)") : "transparent", border: qForm.correct_answer === opt ? "1px solid rgba(74,222,128,0.25)" : "1px solid transparent", borderRadius: "8px", padding: qForm.correct_answer === opt ? "8px" : "0" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flexShrink: 0, paddingTop: "8px" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: qForm.correct_answer === opt ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.06)", border: qForm.correct_answer === opt ? "2px solid #4ade80" : "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: qForm.correct_answer === opt ? "#4ade80" : "#666", fontWeight: 800, fontSize: "12px", cursor: "pointer" }} onClick={() => setQForm(p => ({...p, correct_answer: opt}))}>
                      {opt.toUpperCase()}
                    </div>
                    {qForm.correct_answer === opt && <span style={{ color: "#4ade80", fontSize: "9px", fontWeight: 700 }}>CORRECT</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input value={qForm[`option_${opt}`]} onChange={e => setQForm(p => ({...p, [`option_${opt}`]: e.target.value}))} style={{...inputS, marginBottom: "6px"}} placeholder={`Option ${opt.toUpperCase()}${opt==="a"||opt==="b"?" *":""}`} />
                    {/* Option image */}
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <label htmlFor={`opt-img-${opt}`} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#777", padding: "4px 10px", borderRadius: "5px", cursor: "pointer", fontSize: "11px", whiteSpace: "nowrap" }}>🖼 Img</label>
                      <input type="file" id={`opt-img-${opt}`} accept="image/*" style={{ display: "none" }} onChange={e => {
                        const f = e.target.files[0];
                        if (f) { setOptImageFiles(p => ({...p, [opt]: f})); setQForm(p2 => ({...p2, [`option_${opt}_image`]: URL.createObjectURL(f)})); }
                      }} />
                      {(qForm[`option_${opt}_image`] || optImageFiles[opt]) && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <img src={qForm[`option_${opt}_image`]} alt="" style={{ height: 32, borderRadius: "4px" }} onError={e => e.target.style.display="none"} />
                          <button onClick={() => { setOptImageFiles(p => ({...p, [opt]: null})); setQForm(p => ({...p, [`option_${opt}_image`]: ""})); const el=document.getElementById(`opt-img-${opt}`); if(el)el.value=""; }} style={{ background: "rgba(255,50,50,0.2)", border: "none", color: "#ff6b6b", padding: "2px 6px", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>Remove</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Correct Answer Selector */}
          <div style={{ background: dark ? "rgba(74,222,128,0.05)" : "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", padding: "14px", borderRadius: "10px" }}>
            <label style={{ color: "#4ade80", fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "10px" }}>✓ CORRECT ANSWER</label>
            <div style={{ display: "flex", gap: "10px" }}>
              {["a","b","c","d"].map(opt => (
                <button key={opt} onClick={() => setQForm(p => ({...p, correct_answer: opt}))} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: qForm.correct_answer===opt ? "2px solid #4ade80" : "1px solid rgba(255,255,255,0.1)", background: qForm.correct_answer===opt ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.04)", color: qForm.correct_answer===opt ? "#4ade80" : "#666", cursor: "pointer", fontWeight: 800, fontSize: "16px" }}>
                  {opt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Meta fields */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" }}>
            <div>
              <label style={{ color: "#aaa", fontSize: "11px", display: "block", marginBottom: "5px" }}>Subject</label>
              <input value={qForm.subject} onChange={e => setQForm(p => ({...p, subject: e.target.value}))} style={inputS} placeholder="e.g. Maths" />
            </div>
            <div>
              <label style={{ color: "#aaa", fontSize: "11px", display: "block", marginBottom: "5px" }}>Marks</label>
              <input type="number" step="0.5" min="0" value={qForm.marks} onChange={e => setQForm(p => ({...p, marks: e.target.value}))} style={inputS} />
            </div>
            <div>
              <label style={{ color: "#aaa", fontSize: "11px", display: "block", marginBottom: "5px" }}>Negative</label>
              <input type="number" step="0.25" min="0" value={qForm.negative_marks} onChange={e => setQForm(p => ({...p, negative_marks: e.target.value}))} style={inputS} />
            </div>
            <div>
              <label style={{ color: "#aaa", fontSize: "11px", display: "block", marginBottom: "5px" }}>Difficulty</label>
              <select value={qForm.difficulty || "medium"} onChange={e => setQForm(p => ({...p, difficulty: e.target.value}))} style={inputS}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Explanation */}
          <div>
            <label style={{ color: "#aaa", fontSize: "12px", display: "block", marginBottom: "6px" }}>EXPLANATION (Optional — shown after test)</label>
            <textarea value={qForm.explanation} onChange={e => setQForm(p => ({...p, explanation: e.target.value}))} style={{...inputS, minHeight: "60px", resize: "vertical"}} placeholder="Why is this the correct answer?" />
          </div>

          <button onClick={handleManualSubmit} disabled={uploading} style={{ background: uploading ? "#333" : "linear-gradient(135deg, #FFD700, #FF8C00)", border: "none", color: uploading ? "#666" : "#000", padding: "15px", borderRadius: "10px", cursor: uploading ? "not-allowed" : "pointer", fontWeight: 800, fontSize: "16px" }}>
            {uploading ? "⏳ Saving..." : editingQId ? "✅ Update Question" : "✅ Save Question"}
          </button>
        </div>
      )}

      {/* ─── FILE UPLOAD MODE ─── */}
      {mode === "file" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          {/* Format guide cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <div style={{ background: dark ? "rgba(255,255,255,0.03)" : "#f9f9f9", border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)", padding: "16px", borderRadius: "12px" }}>
              <div style={{ color: dark ? "#FFD700" : "#92600A", fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>📄 TXT Format</div>
              <pre style={{ fontSize: "11px", color: "#aaa", whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0 }}>
{`Q: What is 2+2?
A) 3
B) 4
C) 5
D) 6
Ans: b
Subj: Maths
Exp: Basic addition
Marks: 1
Neg: 0.25
Img: https://...optional

(blank line between questions)`}
              </pre>
            </div>
            <div style={{ background: dark ? "rgba(255,255,255,0.03)" : "#f9f9f9", border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)", padding: "16px", borderRadius: "12px" }}>
              <div style={{ color: dark ? "#818cf8" : "#4338ca", fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>📊 CSV Format (Headers required)</div>
              <div style={{ fontSize: "11px", color: "#aaa", lineHeight: 1.7 }}>
                <div style={{ fontFamily: "monospace", color: dark ? "#FFD700" : "#92600A", marginBottom: "6px", fontSize: "10px", wordBreak: "break-all" }}>question_text, option_a, option_b, option_c, option_d, correct_answer, marks, negative_marks, subject, explanation, image_url</div>
                <div>• correct_answer = a/b/c/d</div>
                <div>• marks default = 1</div>
                <div>• negative_marks default = 0.25</div>
                <div>• image_url = full URL or blank</div>
              </div>
            </div>
          </div>

          {/* Drop Zone */}
          <label htmlFor="bulk-file-upload" style={{ display: "block", border: "2px dashed rgba(255,215,0,0.4)", padding: "40px", borderRadius: "14px", textAlign: "center", background: "rgba(255,215,0,0.02)", cursor: "pointer" }}>
            <div style={{ fontSize: "3rem", marginBottom: "10px" }}>📂</div>
            <div style={{ color: dark ? "#FFD700" : "#92600A", fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>Click to browse or drag & drop</div>
            <div style={{ color: "#666", fontSize: "13px" }}>Supports .txt and .csv files</div>
            <input type="file" id="bulk-file-upload" accept=".csv,.txt" style={{ display: "none" }} onChange={handleFileUpload} />
          </label>

          {fileError && (
            <div style={{ color: "#ff6b6b", fontSize: "13px", marginTop: "12px", padding: "12px", background: "rgba(255,0,0,0.08)", borderRadius: "8px" }}>
              ⚠️ {fileError}
            </div>
          )}

          {fileData.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ color: "#4ade80", fontWeight: 700, fontSize: "14px" }}>✅ {fileData.length} valid questions ready</div>
                <button onClick={() => setFilePreviewOpen(p => !p)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#aaa", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                  {filePreviewOpen ? "Hide Preview" : "Show Preview"}
                </button>
              </div>

              {filePreviewOpen && (
                <div style={{ maxHeight: "320px", overflowY: "auto", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }} className="custom-scroll">
                  {fileData.map((q, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "12px 14px" }}>
                      <div style={{ color: dark ? "#fff" : "#111", fontSize: "13px", marginBottom: "6px" }}><strong style={{ color: "#FFD700" }}>Q{i+1}.</strong> {q.question_text}</div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "11px" }}>
                        {["a","b","c","d"].filter(o => q[`option_${o}`]).map(o => (
                          <span key={o} style={{ padding: "2px 8px", borderRadius: "4px", background: q.correct_answer===o ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.05)", color: q.correct_answer===o ? "#4ade80" : "#888", border: q.correct_answer===o ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(255,255,255,0.06)" }}>
                            {o.toUpperCase()}: {q[`option_${o}`]}
                          </span>
                        ))}
                        <span style={{ color: "#666", padding: "2px 8px" }}>{q.subject}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => submitBulk(fileData)} disabled={uploading || !selectedTestId} style={{ width: "100%", background: uploading||!selectedTestId ? "#333" : "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: uploading||!selectedTestId ? "#666" : "#000", padding: "14px", borderRadius: "10px", cursor: uploading||!selectedTestId ? "not-allowed" : "pointer", fontWeight: 800, fontSize: "15px" }}>
                {uploading ? "⏳ Uploading..." : !selectedTestId ? "⚠️ Select a test above first" : `Upload ${fileData.length} Questions to DB`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── AI SMART PASTE MODE ─── */}
      {mode === "ai" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={{ background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.25)", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
            <div style={{ color: "#818cf8", fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>🤖 AI Smart Parser</div>
            <div style={{ color: "#aaa", fontSize: "13px", lineHeight: 1.6 }}>Paste any raw text — copied from a PDF, image (OCR), website, or any source. AI will automatically detect and structure the questions, options, and answers.</div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ color: "#aaa", fontSize: "12px", display: "block", marginBottom: "8px" }}>PASTE RAW QUESTION TEXT</label>
            <textarea value={aiRawText} onChange={e => setAiRawText(e.target.value)} style={{...inputS, minHeight: "200px", resize: "vertical", fontFamily: "monospace", fontSize: "13px"}} placeholder={`Paste anything here — messy or clean. Examples:\n\n1. What is the capital of India?\n(a) Mumbai (b) Delhi (c) Chennai (d) Kolkata\nAnswer: b\n\nOR from PDFs, any format...`} />
          </div>

          {aiError && <div style={{ color: "#ff6b6b", fontSize: "13px", marginBottom: "12px", padding: "10px", background: "rgba(255,0,0,0.08)", borderRadius: "8px" }}>{aiError}</div>}

          <button onClick={handleAIParse} disabled={aiLoading || !aiRawText.trim()} style={{ background: aiLoading||!aiRawText.trim() ? "#333" : "linear-gradient(135deg, #818cf8, #6366f1)", border: "none", color: aiLoading||!aiRawText.trim() ? "#666" : "#fff", padding: "13px 28px", borderRadius: "10px", cursor: aiLoading||!aiRawText.trim() ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "14px", marginBottom: "20px" }}>
            {aiLoading ? "🤖 Parsing with AI..." : "🤖 Parse with AI"}
          </button>

          {aiParsed.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ color: "#4ade80", fontWeight: 700, fontSize: "14px" }}>✅ {aiParsed.length} questions detected</div>
                <button onClick={() => submitBulk(aiParsed)} disabled={uploading || !selectedTestId} style={{ background: uploading||!selectedTestId ? "#333" : "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: uploading||!selectedTestId ? "#666" : "#000", padding: "10px 20px", borderRadius: "8px", cursor: uploading||!selectedTestId ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "13px" }}>
                  {uploading ? "Uploading..." : !selectedTestId ? "Select test first" : `Upload All ${aiParsed.length}`}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "500px", overflowY: "auto" }} className="custom-scroll">
                {aiParsed.map((q, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "14px" }}>
                    <div style={{ color: dark ? "#fff" : "#111", fontSize: "14px", marginBottom: "10px" }}><strong style={{ color: "#818cf8" }}>Q{i+1}.</strong> {q.question_text}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "8px" }}>
                      {["a","b","c","d"].filter(o => q[`option_${o}`]).map(o => (
                        <div key={o} style={{ padding: "6px 10px", borderRadius: "6px", fontSize: "12px", background: q.correct_answer===o ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.04)", color: q.correct_answer===o ? "#4ade80" : (dark?"#ccc":"#444"), border: q.correct_answer===o ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                          <strong>{o.toUpperCase()}.</strong> {q[`option_${o}`]}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "10px", fontSize: "11px", color: "#666" }}>
                      <span>✓ Ans: <strong style={{color:"#4ade80"}}>{q.correct_answer?.toUpperCase()}</strong></span>
                      <span>📚 {q.subject}</span>
                      <span>⭐ {q.marks}m</span>
                      {q.explanation && <span title={q.explanation}>💡 Has explanation</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── MANAGE MODE ─── */}
      {mode === "manage" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          {!selectedTestId ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#555", background: "rgba(0,0,0,0.15)", borderRadius: "12px" }}>Select a test above to manage its questions.</div>
          ) : loadingQs ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
              <div style={{ width: 32, height: 32, border: "3px solid rgba(255,215,0,0.2)", borderTop: "3px solid #FFD700", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <div>
              {/* Stats bar */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "10px" }}>
                {[
                  ["Total", existingQs.length, "#FFD700"],
                  ["Easy", existingQs.filter(q=>q.difficulty==="easy").length, "#4ade80"],
                  ["Medium", existingQs.filter(q=>q.difficulty==="medium").length, "#fb923c"],
                  ["Hard", existingQs.filter(q=>q.difficulty==="hard").length, "#ff6b6b"],
                  ["With Images", existingQs.filter(q=>q.image_url).length, "#818cf8"],
                ].map(([l,v,c]) => (
                  <div key={l} style={{ flex: 1, minWidth: 80, textAlign: "center", padding: "8px", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
                    <div style={{ color: c, fontWeight: 700, fontSize: "18px" }}>{v}</div>
                    <div style={{ color: "#555", fontSize: "10px" }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Filters & bulk actions */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px", alignItems: "center" }}>
                <input value={manageSearch} onChange={e => setManageSearch(e.target.value)} style={{...inputS, flex: 2, minWidth: 180, marginBottom: 0}} placeholder="🔍 Search questions..." />
                <select value={manageSubjectFilter} onChange={e => setManageSubjectFilter(e.target.value)} style={{...inputS, flex: 1, minWidth: 130, marginBottom: 0}}>
                  {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={loadQuestions} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#aaa", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>🔄 Refresh</button>
              </div>

              {bulkSelect.length > 0 && (
                <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "rgba(255,50,50,0.08)", border: "1px solid rgba(255,50,50,0.25)", padding: "10px 14px", borderRadius: "8px", marginBottom: "12px" }}>
                  <span style={{ color: "#ff6b6b", fontSize: "13px", fontWeight: 600 }}>{bulkSelect.length} selected</span>
                  <button onClick={handleBulkDelete} style={{ background: "rgba(255,50,50,0.2)", border: "1px solid rgba(255,50,50,0.4)", color: "#ff6b6b", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>🗑 Delete Selected</button>
                  <button onClick={() => setBulkSelect([])} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#666", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Clear</button>
                </div>
              )}

              {filteredQs.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#555" }}>No questions match your filters.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {filteredQs.map((q, i) => (
                    <div key={q.id} style={{ background: bulkSelect.includes(q.id) ? "rgba(255,215,0,0.06)" : (dark ? "rgba(255,255,255,0.04)" : "#fff"), border: bulkSelect.includes(q.id) ? "1px solid rgba(255,215,0,0.4)" : (dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)"), borderRadius: "10px", overflow: "hidden" }}>
                      <div style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <input type="checkbox" checked={bulkSelect.includes(q.id)} onChange={e => setBulkSelect(p => e.target.checked ? [...p, q.id] : p.filter(x => x !== q.id))} style={{ marginTop: "4px", accentColor: "#FFD700", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: dark ? "#fff" : "#111", fontSize: "13px", lineHeight: 1.5, marginBottom: "6px" }}>
                            <strong style={{ color: "#FFD700", marginRight: "6px" }}>Q{i+1}.</strong>{q.question_text}
                            {q.image_url && <span style={{ marginLeft: "8px", fontSize: "11px", color: "#818cf8" }}>🖼 has image</span>}
                          </div>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "11px" }}>
                            <span style={{ color: "#4ade80" }}>✓ {q.correct_answer?.toUpperCase()}</span>
                            <span style={{ color: "#666" }}>{q.subject || "General"}</span>
                            <span style={{ color: "#666" }}>{q.marks}m / -{q.negative_marks}m</span>
                            {q.difficulty && <span style={{ color: q.difficulty==="easy"?"#4ade80":q.difficulty==="hard"?"#ff6b6b":"#fb923c" }}>{q.difficulty}</span>}
                            {q.explanation && <span style={{ color: "#818cf8" }}>💡 explanation</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <button onClick={() => setPreviewQ(previewQ?.id === q.id ? null : q)} style={{ background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.25)", color: "#818cf8", padding: "5px 10px", borderRadius: "5px", cursor: "pointer", fontSize: "11px" }}>👁 Preview</button>
                          <button onClick={() => handleDuplicateQ(q)} style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80", padding: "5px 10px", borderRadius: "5px", cursor: "pointer", fontSize: "11px" }}>⧉ Dup</button>
                          <button onClick={() => handleEditQ(q)} style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700", padding: "5px 10px", borderRadius: "5px", cursor: "pointer", fontSize: "11px" }}>✏️ Edit</button>
                          <button onClick={() => handleDeleteQ(q.id)} style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.25)", color: "#ff6b6b", padding: "5px 10px", borderRadius: "5px", cursor: "pointer", fontSize: "11px" }}>🗑</button>
                        </div>
                      </div>
                      {previewQ?.id === q.id && (
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "14px", background: "rgba(0,0,0,0.15)" }}>
                          {q.image_url && <img src={q.image_url} alt="" style={{ maxHeight: 160, borderRadius: "8px", marginBottom: "12px", display: "block" }} onError={e => e.target.style.display="none"} />}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                            {["a","b","c","d"].filter(o => q[`option_${o}`]).map(o => (
                              <div key={o} style={{ padding: "8px 12px", borderRadius: "7px", fontSize: "13px", background: q.correct_answer===o ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.04)", color: q.correct_answer===o ? "#4ade80" : (dark?"#ccc":"#555"), border: q.correct_answer===o ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                                <strong>{o.toUpperCase()}.</strong> {q[`option_${o}`]}
                              </div>
                            ))}
                          </div>
                          {q.explanation && <div style={{ color: "#aaa", fontSize: "12px", padding: "10px", background: "rgba(255,215,0,0.04)", borderRadius: "6px", border: "1px solid rgba(255,215,0,0.1)" }}>💡 {q.explanation}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ADMIN PANEL
function AdminPanel({ user }) {
  const dark = useTheme();
  const [activeSection, setActiveSection] = useState(user?.isAdmin ? "overview" : "exams");
  const [metrics, setMetrics] = useState({ users: "—", tests: "—", attempts: "—", questions: "—", orgs: "—" });
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const refreshMetrics = () => {
    if (!user?.isAdmin) return;
    setMetricsLoading(true);
    // Use count=exact header for true counts (no wasted data transfer)
    const countOnly = (table) => fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id`, {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${user.token}`, "Prefer": "count=exact", "Range": "0-0" }
    }).then(r => parseInt(r.headers.get("content-range")?.split("/")[1] || "0")).catch(() => 0);
    const safe = (p) => p.catch(() => []);
    Promise.all([
      countOnly("profiles"),
      countOnly("tests"),
      countOnly("attempts"),
      countOnly("questions"),
      countOnly("organizations"),
      safe(supabaseRequest("/attempts?select=id,user_id,score,total_marks,status,created_at,correct_count,wrong_count,tests(name)&order=created_at.desc&limit=12", { token: user.token })),
      safe(supabaseRequest("/profiles?select=id,full_name,state,target_exam,created_at&order=created_at.desc&limit=6", { token: user.token })),
    ]).then(([uC, tC, aC, qC, oC, recentA, recentU]) => {
      setMetrics({ users: uC, tests: tC, attempts: aC, questions: qC, orgs: oC });
      setRecentAttempts(Array.isArray(recentA) ? recentA : []);
      setRecentUsers(Array.isArray(recentU) ? recentU : []);
      setMetricsLoading(false);
    });
  };

  useEffect(() => {
    if (user?.isAdmin && activeSection === "overview") refreshMetrics();
  }, [user, activeSection]);

  // Moderators get limited access
  const [isMod, setIsMod] = useState(false);
  useEffect(() => {
    if (user && !user.isAdmin) {
      supabaseRequest(`/roles?user_id=eq.${user.id}&role=eq.moderator&select=role`, { token: user.token })
        .then(r => { if (r?.length > 0) setIsMod(true); })
        .catch(() => {});
    }
  }, [user]);

  if (!user?.isAdmin && !isMod) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 1rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🔒</div>
          <h2 style={{ color: "#ff6b6b", fontFamily: "'Sora',sans-serif" }}>Access Denied</h2>
          <p style={{ color: "#666" }}>Admin or Moderator access only.</p>
        </div>
      </div>
    );
  }

  const SECTIONS = [
    { key: "overview", icon: "📊", label: "Overview",       adminOnly: false },
    { key: "questions", icon: "❓", label: "Questions",     adminOnly: true  },
    { key: "exams", icon: "📚", label: "Exams & Tests",     adminOnly: false },
    { key: "organizations", icon: "🏛", label: "Organizations", adminOnly: true },
    { key: "users", icon: "👥", label: "Users",             adminOnly: true  },
  ].filter(s => user?.isAdmin || !s.adminOnly);

  return (
    <div style={{ padding: "60px 0 0", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Mobile nav */}
      <div style={{ display: "block", padding: "10px 16px", borderBottom: "1px solid rgba(255,50,50,0.15)" }} className="admin-mobile-nav">
        <select value={activeSection} onChange={e => setActiveSection(e.target.value)}
          style={{ width: "100%", background: dark ? "rgba(255,255,255,0.06)" : "#fff", border: "1px solid rgba(255,50,50,0.3)", color: dark ? "#fff" : "#111", padding: "10px 12px", borderRadius: "8px", fontSize: "14px", outline: "none" }}>
          {SECTIONS.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
          {/* SECTIONS already filtered by role */}
        </select>
      </div>

      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <div style={{ width: "220px", flexShrink: 0, background: dark ? "rgba(255,50,50,0.04)" : "rgba(255,50,50,0.02)", borderRight: dark ? "1px solid rgba(255,50,50,0.12)" : "1px solid rgba(255,50,50,0.1)", padding: "20px 0", position: "sticky", top: 60, height: "calc(100vh - 60px)", overflowY: "auto" }} className="admin-sidebar">
          {/* Panel title */}
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ color: "#ff6b6b", fontSize: "11px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>{user?.isAdmin ? "⚙ Admin Panel" : "🛡 Mod Panel"}</div>
            {!user?.isAdmin && isMod && <div style={{ color: "#22d3ee", fontSize: "10px", marginTop:"4px" }}>Exams & Tests only</div>}
          </div>

          {/* Nav items with metric badges */}
          {SECTIONS.map(s => {
            const badge = user?.isAdmin ? {
              overview: null,
              questions: metrics.questions !== "—" ? metrics.questions : null,
              exams: metrics.tests !== "—" ? metrics.tests : null,
              organizations: metrics.orgs !== "—" ? metrics.orgs : null,
              users: metrics.users !== "—" ? metrics.users : null,
            }[s.key] : null;
            const isActive = activeSection === s.key;
            return (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                style={{ width:"100%", padding:"11px 16px", background:isActive?"rgba(255,50,50,0.12)":"transparent", border:"none", borderLeft:isActive?"3px solid #ff6b6b":"3px solid transparent", color:isActive?"#ff6b6b":(dark?"#777":"#888"), cursor:"pointer", textAlign:"left", fontSize:"14px", display:"flex", alignItems:"center", gap:"10px", transition:"all 0.15s" }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = dark?"#aaa":"#555"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = dark?"#777":"#888"; }}>
                <span style={{ fontSize: "15px" }}>{s.icon}</span>
                <span style={{ flex: 1 }}>{s.label}</span>
                {badge !== null && badge !== undefined && (
                  <span style={{ background:isActive?"rgba(255,100,100,0.2)":"rgba(255,255,255,0.06)", color:isActive?"#ff9999":"#555", fontSize:"10px", fontWeight:700, padding:"1px 7px", borderRadius:"10px", minWidth:"24px", textAlign:"center" }}>{badge}</span>
                )}
              </button>
            );
          })}

          <div style={{ margin: "16px 16px 0", height: "1px", background: "rgba(255,255,255,0.06)" }} />

          {/* Admin info + last refresh */}
          <div style={{ padding: "14px 16px", fontSize: "11px" }}>
            <div style={{ color: "#444", marginBottom: "2px" }}>Signed in as</div>
            <div style={{ color: "#666", wordBreak: "break-all", marginBottom: "10px" }}>{user.email}</div>
            {metricsLoading && <div style={{ color: "#555", fontSize: "10px", display:"flex", alignItems:"center", gap:"4px" }}><span style={{animation:"spin 1s linear infinite", display:"inline-block"}}>↻</span> Refreshing…</div>}
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: "28px", minWidth: 0, overflowX: "hidden" }} className="admin-main-content">

          {/* OVERVIEW */}
          {activeSection === "overview" && user?.isAdmin && (
            <div>
              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", flexWrap:"wrap", gap:"12px" }}>
                <div>
                  <h1 style={{ color:dark?"#fff":"#111", fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:"24px", margin:0 }}>Dashboard Overview</h1>
                  <p style={{ color:"#666", fontSize:"13px", marginTop:"4px" }}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
                </div>
                <button onClick={refreshMetrics} disabled={metricsLoading} style={{ display:"flex", alignItems:"center", gap:"6px", background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.3)", color:"#FFD700", padding:"8px 16px", borderRadius:"8px", cursor:metricsLoading?"not-allowed":"pointer", fontSize:"13px", fontWeight:700, opacity:metricsLoading?0.6:1 }}>
                  <span style={{ display:"inline-block", animation:metricsLoading?"spin 1s linear infinite":"none" }}>↻</span>
                  {metricsLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {/* Metric cards — clickable, navigate to section */}
              <div className="admin-metric-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:"12px", marginBottom:"20px" }}>
                {[
                  ["👥 Users", metrics.users, "#818cf8", "users"],
                  ["📚 Tests", metrics.tests, "#4ade80", "exams"],
                  ["📝 Attempts", metrics.attempts, "#FFD700", "users"],
                  ["❓ Questions", metrics.questions, "#fb923c", "questions"],
                  ["🏛 Orgs", metrics.orgs, "#38bdf8", "organizations"],
                ].map(([l,v,c,sec]) => (
                  <div key={l} onClick={() => setActiveSection(sec)} style={{ background:dark?"rgba(255,255,255,0.04)":"#fff", border:dark?`1px solid ${c}20`:"1px solid rgba(0,0,0,0.08)", borderRadius:"14px", padding:"18px 20px", cursor:"pointer", transition:"all 0.15s", boxShadow:dark?"none":"0 2px 8px rgba(0,0,0,0.04)" }}
                    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor=c+"55";}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderColor=dark?c+"20":"rgba(0,0,0,0.08)";}}>
                    <div style={{ color:dark?"#555":"#888", fontSize:"11px", marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.5px" }}>{l}</div>
                    <div style={{ color:c, fontSize:"2rem", fontWeight:900, fontFamily:"'Sora',sans-serif" }}>{metricsLoading?"…":v}</div>
                    <div style={{ color:c, fontSize:"10px", marginTop:"4px", opacity:0.6 }}>→ manage</div>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div style={{ marginBottom:"24px" }}>
                <div style={{ color:dark?"#444":"#999", fontSize:"11px", fontWeight:700, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:"10px" }}>Quick Actions</div>
                <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                  {[
                    ["➕ Add Questions","questions","linear-gradient(135deg,#FFD700,#FF8C00)","#000","none"],
                    ["📚 Manage Exams","exams","rgba(74,222,128,0.12)","#4ade80","1px solid rgba(74,222,128,0.25)"],
                    ["👥 Manage Users","users","rgba(129,140,248,0.12)","#818cf8","1px solid rgba(129,140,248,0.25)"],
                    ["🏛 Organizations","organizations","rgba(56,189,248,0.12)","#38bdf8","1px solid rgba(56,189,248,0.25)"],
                  ].map(([l,sec,bg,col,border]) => (
                    <button key={sec} onClick={() => setActiveSection(sec)} style={{ background:bg, border, color:col, padding:"9px 18px", borderRadius:"8px", cursor:"pointer", fontWeight:700, fontSize:"13px", transition:"all 0.15s" }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Two-column: Recent Attempts + Recent Signups */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }} className="admin-two-col">
                {/* Recent Attempts */}
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
                    <div style={{ color:dark?"#444":"#999", fontSize:"11px", fontWeight:700, letterSpacing:"1.5px", textTransform:"uppercase" }}>Recent Attempts</div>
                    <button onClick={() => setActiveSection("users")} style={{ background:"transparent", border:"none", color:"#555", fontSize:"11px", cursor:"pointer" }}>View all →</button>
                  </div>
                  {metricsLoading ? <div style={{ color:"#555", padding:"12px", textAlign:"center" }}>Loading…</div>
                  : recentAttempts.length === 0 ? <div style={{ color:"#555", padding:"20px", textAlign:"center", fontSize:"13px" }}>No attempts yet.</div>
                  : <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      {recentAttempts.map(a => {
                        const pct = a.total_marks > 0 ? Math.round((a.score / a.total_marks) * 100) : 0;
                        return (
                          <div key={a.id} style={{ background:dark?"rgba(255,255,255,0.04)":"#fff", border:dark?"1px solid rgba(255,255,255,0.07)":"1px solid rgba(0,0,0,0.07)", borderRadius:"10px", padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:"8px" }}>
                            <div style={{ minWidth:0 }}>
                              <div style={{ color:dark?"#ddd":"#111", fontSize:"12px", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.tests?.name || "Unknown Test"}</div>
                              <div style={{ color:"#555", fontSize:"10px" }}>{new Date(a.created_at).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
                            </div>
                            <div style={{ flexShrink:0, textAlign:"right" }}>
                              <div style={{ color:pct>=60?"#4ade80":pct>=40?"#fb923c":"#ff6b6b", fontWeight:800, fontSize:"14px" }}>{pct}%</div>
                              <div style={{ color:"#555", fontSize:"10px" }}>{a.score}/{a.total_marks}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>}
                </div>

                {/* Recent Signups */}
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
                    <div style={{ color:dark?"#444":"#999", fontSize:"11px", fontWeight:700, letterSpacing:"1.5px", textTransform:"uppercase" }}>Recent Signups</div>
                    <button onClick={() => setActiveSection("users")} style={{ background:"transparent", border:"none", color:"#555", fontSize:"11px", cursor:"pointer" }}>View all →</button>
                  </div>
                  {metricsLoading ? <div style={{ color:"#555", padding:"12px", textAlign:"center" }}>Loading…</div>
                  : recentUsers.length === 0 ? <div style={{ color:"#555", padding:"20px", textAlign:"center", fontSize:"13px" }}>No users yet.</div>
                  : <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                      {recentUsers.map(u => (
                        <div key={u.id} style={{ background:dark?"rgba(255,255,255,0.04)":"#fff", border:dark?"1px solid rgba(255,255,255,0.07)":"1px solid rgba(0,0,0,0.07)", borderRadius:"10px", padding:"10px 14px", display:"flex", alignItems:"center", gap:"10px" }}>
                          <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#818cf8,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:"13px", flexShrink:0 }}>{(u.full_name||"U").charAt(0).toUpperCase()}</div>
                          <div style={{ minWidth:0 }}>
                            <div style={{ color:dark?"#ddd":"#111", fontSize:"12px", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.full_name || <span style={{color:"#555"}}>No name</span>}</div>
                            <div style={{ color:"#555", fontSize:"10px" }}>{u.state||"—"} {u.target_exam ? "· "+u.target_exam : ""} · {u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN") : "—"}</div>
                          </div>
                        </div>
                      ))}
                    </div>}
                </div>
              </div>
            </div>
          )}

          {activeSection === "questions"     && user?.isAdmin && <AdminQuestions user={user} />}
          {activeSection === "organizations" && user?.isAdmin && <AdminOrganizations user={user} />}
          {activeSection === "exams"         && <AdminExams user={user} isMod={isMod} />}
          {activeSection === "users"         && user?.isAdmin && <AdminUsers user={user} />}
          {/* Moderator: show helpful message if they try to access admin-only section */}
          {!user?.isAdmin && isMod && ["questions","organizations","users"].includes(activeSection) && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 20px", textAlign:"center" }}>
              <div style={{ fontSize:"3rem", marginBottom:"16px" }}>🔒</div>
              <h3 style={{ color:"#ff6b6b", fontFamily:"'Sora',sans-serif", marginBottom:"8px" }}>Restricted Area</h3>
              <p style={{ color:"#555", fontSize:"14px" }}>This section is available to admins only.</p>
              <button onClick={() => setActiveSection("exams")} style={{ marginTop:"20px", background:"linear-gradient(135deg,#FFD700,#FF8C00)", border:"none", color:"#000", padding:"10px 24px", borderRadius:"8px", cursor:"pointer", fontWeight:700 }}>Go to Exams & Tests</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// FEATURES SECTION
function FeaturesSection() {
  const dark = useTheme();
  const features = [
    { icon: "🛡️", title: "Secure Exam Interface", desc: "Tab switch detection, anti-cheat system, auto-submit on suspicious activity" },
    { icon: "📊", title: "Real Analytics", desc: "Score, percentile, subject-wise breakdown, time analysis after every test" },
    { icon: "🏆", title: "Live Leaderboard", desc: "See your rank among all test-takers in real-time" },
    { icon: "📱", title: "Mobile First", desc: "Fully optimized for mobile. Take tests on any device, anywhere" },
    { icon: "⚡", title: "Auto-Save", desc: "Never lose your answers. Auto-saves every few seconds" },
    { icon: "🗂️", title: "PYQ Papers", desc: "Previous year questions with detailed solutions and explanations" },
  ];
  return (
    <section style={{ padding: "80px 1rem", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <h2 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem,4vw,2.8rem)", color: dark ? "#fff" : "#111" }}>
          Everything You Need to Succeed
        </h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
        {features.map(f => (
          <div key={f.title} style={{
            background: dark ? "rgba(255,255,255,0.03)" : "#fff",
            border: dark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.07)",
            borderRadius: "16px", padding: "24px",
            boxShadow: dark ? "none" : "0 2px 10px rgba(0,0,0,0.05)"
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>{f.icon}</div>
            <h3 style={{ color: dark ? "#fff" : "#111", fontWeight: 700, marginBottom: "8px", fontSize: "16px" }}>{f.title}</h3>
            <p style={{ color: dark ? "#666" : "#777", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// FOOTER
function Footer({ setPage }) {
  const dark = useTheme();
  return (
    <footer style={{
      borderTop: dark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)",
      padding: "48px 1rem",
      background: dark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.03)"
    }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "32px", marginBottom: "32px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "8px", background: "linear-gradient(135deg,#FFD700,#FF6B00)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "14px", color: "#000" }}>M</div>
              <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, color: dark ? "#E6A800" : "#C47A00" }}>MeritMatrix</span>
            </div>
            <p style={{ color: dark ? "#555" : "#888", fontSize: "13px", lineHeight: 1.6 }}>Odisha's premier mock test platform for defence & government exams.</p>
          </div>
          {[
            ["Exams", ["Odisha Police","Indian Army","Agniveer","SSC GD"]],
            ["Platform", ["How It Works","Pricing","Dashboard"]],
            ["Company", ["About","Contact","Privacy Policy","Terms"]],
          ].map(([title, links]) => (
            <div key={title}>
              <div style={{ color: dark ? "#aaa" : "#666", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>{title}</div>
              {links.map(l => (
                <div key={l} style={{ color: dark ? "#555" : "#999", fontSize: "13px", marginBottom: "8px", cursor: "pointer" }}
                  onMouseEnter={e => e.target.style.color= dark ? "#aaa" : "#333"}
                  onMouseLeave={e => e.target.style.color= dark ? "#555" : "#999"}
                >{l}</div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <span style={{ color: dark ? "#444" : "#aaa", fontSize: "13px" }}>© 2025 MeritMatrix. All rights reserved.</span>
          <span style={{ color: dark ? "#444" : "#aaa", fontSize: "13px" }}>Built for Odisha's aspirants 🇮🇳</span>
        </div>
      </div>
    </footer>
  );
}

// HOMEPAGE
function HomePage({ setPage, setActiveExam, user }) {
  return (
    <>
      <HeroSection setPage={setPage} user={user} />
      <LogoSlider />
      <ExamsPage setPage={setPage} setActiveExam={setActiveExam} />
      <FeaturesSection />
      <PricingPage setPage={setPage} user={user} />
    </>
  );
}

// ============================================================
// ROOT APP
// ============================================================
export default function App() {
  // Use sessionStorage for auth state — clears on browser close
  const [page, setPage] = useState(() => {
    try { return sessionStorage.getItem("mm_page") || "home"; } catch { return "home"; }
  });
  const setPagePersist = (p) => { setPage(p); try { sessionStorage.setItem("mm_page", p); } catch {} };

  const [user, setUser] = useState(() => {
    try {
      const s = sessionStorage.getItem("mm_user");
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const setUserPersist = (u) => {
    setUser(u);
    try {
      if (u) sessionStorage.setItem("mm_user", JSON.stringify(u));
      else sessionStorage.removeItem("mm_user");
    } catch {}
  };
  const [recoveryToken, setRecoveryToken] = useState(null); // for password reset flow
  const [activeExam, setActiveExam] = useLocalStorage("mm_activeExam", null);
  const [activeTest, setActiveTest] = useLocalStorage("mm_activeTest", null);
  const [dark, setDark] = useLocalStorage("mm_theme", true); // true=dark, false=light

  // On load: handle Supabase email verification link (hash token) OR restore session
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (accessToken && type === "recovery") {
      // Password reset flow — persist token to localStorage in case of re-render timing issues
      window.history.replaceState(null, "", window.location.pathname);
      setActiveTest(null);
      setActiveExam(null);
      sessionStorage.setItem("mm_recovery_token", accessToken);
      setRecoveryToken(accessToken);
      setPage("auth");
      return;
    }

    if (accessToken && (type === "signup" || type === "magiclink" || type === "email_change")) {
      (async () => {
        try {
          const res = await fetch(SUPABASE_URL + "/auth/v1/user", {
            headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + accessToken }
          });
          const userData = await res.json();
          if (userData?.id) {
            const sessionData = { access_token: accessToken, refresh_token: refreshToken, user: userData };
            sessionStorage.setItem("mm_session", JSON.stringify(sessionData));

            // ── Save pending profile (name+state stored before email confirmation) ──
            const pending = sessionStorage.getItem("mm_pending_profile");
            if (pending && type === "signup") {
              try {
                const profile = JSON.parse(pending);
                // Try PATCH first, then INSERT if no row exists yet
                try {
                  await supabaseRequest(`/profiles?id=eq.${userData.id}`, {
                    method: "PATCH", body: profile, token: accessToken, prefer: "return=minimal"
                  });
                } catch {
                  await supabaseRequest("/profiles", {
                    method: "POST", body: { id: userData.id, ...profile }, token: accessToken, prefer: "return=minimal"
                  });
                }
              } catch {}
              sessionStorage.removeItem("mm_pending_profile");
            }

            let isAdmin = false;
            try {
              const roles = await supabaseRequest("/roles?user_id=eq." + userData.id + "&select=role", { token: accessToken });
              isAdmin = roles?.some(r => r.role === "admin") || false;
            } catch {}
            window.history.replaceState(null, "", window.location.pathname);
            setUserPersist({ ...userData, token: accessToken, isAdmin });
            setPagePersist(isAdmin ? "admin" : "home");
          }
        } catch(e) { console.error("Auth callback error:", e); }
      })();
      return;
    }

    const session = sessionStorage.getItem("mm_session");
    if (session && !user) {
      try {
        const s = JSON.parse(session);
        if (s?.user && s?.access_token) {
          // Try to refresh token silently; fall back to stored token if refresh fails
          (async () => {
            let token = s.access_token;
            let userData = s.user;
            try {
              if (s.refresh_token) {
                const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                  method: "POST",
                  headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
                  body: JSON.stringify({ refresh_token: s.refresh_token }),
                });
                const refreshed = await res.json();
                if (refreshed?.access_token) {
                  token = refreshed.access_token;
                  userData = refreshed.user || userData;
                  sessionStorage.setItem("mm_session", JSON.stringify({ ...refreshed, user: userData }));
                }
              }
            } catch {}
            let isAdmin = false;
            try {
              const roles = await supabaseRequest("/roles?user_id=eq." + userData.id + "&select=role", { token });
              isAdmin = roles?.some(r => r.role === "admin") || false;
            } catch {}
            setUserPersist({ ...userData, token, isAdmin });
          })();
        }
      } catch {}
    }
  }, []);

  const handleLogin = (u) => { setUserPersist(u); if (u?.isAdmin) setPagePersist("admin"); else setPagePersist("home"); };
  const handleLogout = () => {
    setUserPersist(null);
    setActiveTest(null);
    setActiveExam(null);
    sessionStorage.clear(); // clear all session data
    sessionStorage.removeItem("mm_page");
    setPagePersist("home");
  };

  const showNav = page !== "exam-interface";
  const showFooter = !["exam-interface","exam-detail","admin","dashboard","auth"].includes(page);

  // Dynamic page title
  useEffect(() => {
    const meta = {
      home:            { title: "MeritMatrix — Odisha's #1 Mock Test Platform", desc: "Practice OSSSC, Police, SSB and defence exams with full mock tests, section-wise analysis and detailed scorecards. Trusted by thousands of aspirants in Odisha." },
      exams:           { title: "All Exams — MeritMatrix", desc: "Browse mock tests for OSSSC CRE, Sub-Inspector, Constable, NDA, CDS and more. Attempt free and premium mock tests." },
      pricing:         { title: "Pricing Plans — MeritMatrix", desc: "Affordable plans to access all mock tests on MeritMatrix. Free and premium options available." },
      auth:            { title: "Sign In — MeritMatrix", desc: "Login or create your free MeritMatrix account to start practising." },
      dashboard:       { title: "My Dashboard — MeritMatrix", desc: "View your test history, scores and performance analytics." },
      admin:           { title: "Admin Panel — MeritMatrix", desc: "" },
      "exam-detail":   { title: "Exam Details — MeritMatrix", desc: "View available mock tests, sectional tests and previous year papers." },
      "exam-interface":{ title: "Test in Progress — MeritMatrix", desc: "" },
    };
    const m = meta[page] || { title: "MeritMatrix", desc: "Odisha's #1 online mock test platform." };
    document.title = m.title;
    // Update meta description
    let descTag = document.querySelector('meta[name="description"]');
    if (!descTag) { descTag = document.createElement("meta"); descTag.name = "description"; document.head.appendChild(descTag); }
    if (m.desc) descTag.content = m.desc;
    // Update OG tags
    const setOg = (prop, val) => {
      if (!val) return;
      let el = document.querySelector(`meta[property="${prop}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute("property", prop); document.head.appendChild(el); }
      el.content = val;
    };
    setOg("og:title", m.title);
    setOg("og:description", m.desc);
    setOg("og:type", "website");
    setOg("og:site_name", "MeritMatrix");
    setOg("og:image", "https://meritmatrix.netlify.app/og-image.png");
    // Twitter card
    const setTw = (name, val) => {
      if (!val) return;
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
      el.content = val;
    };
    setTw("twitter:card", "summary_large_image");
    setTw("twitter:title", m.title);
    setTw("twitter:description", m.desc);
    // Canonical URL
    const base = "https://meritmatrix.netlify.app";
    const paths = { home: "/", exams: "/exams", pricing: "/pricing", auth: "/auth", dashboard: "/dashboard", "exam-detail": "/exams" };
    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) { canon = document.createElement("link"); canon.rel = "canonical"; document.head.appendChild(canon); }
    canon.href = base + (paths[page] || "/");
    // JSON-LD structured data on homepage only
    let ld = document.getElementById("mm-jsonld");
    if (page === "home") {
      if (!ld) { ld = document.createElement("script"); ld.type = "application/ld+json"; ld.id = "mm-jsonld"; document.head.appendChild(ld); }
      ld.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "EducationalOrganization",
        "name": "MeritMatrix",
        "url": "https://meritmatrix.netlify.app",
        "description": "Odisha's #1 online mock test platform for OSSSC, police and defence exams",
        "offers": { "@type": "Offer", "category": "Mock Tests" }
      });
    } else if (ld) { ld.remove(); }
  }, [page]);

  const bg = dark ? "#080a14" : "#f5f6fa";
  const fg = dark ? "#ffffff" : "#111827";

  // Set html lang + hide initial loader once React mounts
  useEffect(() => {
    document.documentElement.lang = "en";
    if (window.__hideLoader) window.__hideLoader();
  }, []);

  return (
    <ThemeContext.Provider value={dark}>
    <AuthContext.Provider value={{ user, setUser }}>
      <a href="#main-content" style={{ position:"absolute", left:"-9999px", top:"auto", width:1, height:1, overflow:"hidden" }} onFocus={e => { e.target.style.left="16px"; e.target.style.top="16px"; e.target.style.width="auto"; e.target.style.height="auto"; e.target.style.zIndex="99999"; e.target.style.padding="8px 16px"; e.target.style.background="#FFD700"; e.target.style.color="#000"; e.target.style.borderRadius="6px"; }} onBlur={e => { e.target.style.left="-9999px"; }}>Skip to main content</a>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { background: ${bg}; color: ${fg}; font-family: system-ui, -apple-system, sans-serif; overflow-x: hidden; transition: background 0.3s, color 0.3s; }
        button { font-family: inherit; }
        input, textarea { font-family: inherit; }
        input::placeholder { color: ${dark ? "#444" : "#aaa"}; }
        textarea::placeholder { color: ${dark ? "#444" : "#aaa"}; }
        input:focus, textarea:focus { border-color: rgba(255,215,0,0.4) !important; }
        
        /* ADD THIS LINE TO FIX DROPDOWNS: */
        option { background: ${bg}; color: ${fg}; }

        /* --- NEW SCROLLBAR STYLES START HERE --- */
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(150,150,150,0.3); border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        /* --- NEW SCROLLBAR STYLES END HERE --- */

        @keyframes slide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .slider-track { display: flex; animation: slide 30s linear infinite; width: max-content; }
        .slider-wrapper:hover .slider-track { animation-play-state: paused; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
          .question-grid-sidebar { display: none !important; }
          .admin-sidebar { display: none !important; }
          .admin-mobile-nav { display: block !important; }
          .exam-sidebar { display: none !important; }
          .palette-btn-mobile { display: flex !important; }
          .mobile-bottom-nav { display: flex !important; }
          .admin-main-content { padding: 16px !important; }
          .test-grid { grid-template-columns: 1fr !important; }
          .sec-grid { grid-template-columns: 1fr 1fr !important; }
          .exam-q-area { padding-bottom: 120px !important; }
          .exam-topbar-title { font-size: 12px !important; max-width: 120px !important; }
          .modal-grid { grid-template-columns: 1fr !important; }
          .results-stats { grid-template-columns: 1fr 1fr !important; }
          .section-pill { padding: 2px 6px !important; font-size: 10px !important; }
          .admin-exams-form-grid { grid-template-columns: 1fr !important; }
          .section-form-grid { grid-template-columns: 1fr 1fr !important; }
          .dashboard-attempts { padding: 12px !important; }
          .nav-user-email { display: none !important; }
        }
        @media (min-width: 769px) {
          .palette-btn-mobile { display: none !important; }
          .mobile-bottom-nav { display: none !important; }
          .exam-sidebar { display: block !important; }
          .admin-mobile-nav { display: none !important; }
          .admin-sidebar { display: block !important; }
        }
        @media (max-width: 480px) {
          .mobile-menu { display: flex !important; }
          .sec-grid { grid-template-columns: 1fr !important; }
          .section-form-grid { grid-template-columns: 1fr !important; }
          .exam-options { font-size: 14px !important; }
          .results-stats { grid-template-columns: 1fr 1fr !important; }
          .section-tabs-bar button { padding: 8px 10px !important; font-size: 11px !important; }
          .admin-metric-grid { grid-template-columns: 1fr 1fr !important; }
          .admin-two-col { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 769px) { .mobile-menu { display: none !important; } }
        .admin-mobile-nav { display: none !important; }
        @media (max-width: 768px) { .admin-mobile-nav { display: block !important; } }
        /* Smooth scrolling on mobile */
        @media (max-width: 768px) {
          .custom-scroll { -webkit-overflow-scrolling: touch; }
        }
        /* Fix iOS input zoom */
        @media (max-width: 768px) {
          input, select, textarea { font-size: 16px !important; }
        }
      `}</style>

      {showNav && (
        <Navbar page={page} setPage={setPagePersist} user={user} onLogout={handleLogout} dark={dark} setDark={setDark} />
      )}

      <main id="main-content" role="main" aria-label="Main content">
        {page === "home"           && <HomePage setPage={setPagePersist} setActiveExam={setActiveExam} user={user} />}
        {page === "exams"          && <ExamsPage setPage={setPagePersist} setActiveExam={setActiveExam} />}
        {page === "exam-detail"    && activeExam && <ExamDetailPage exam={activeExam} setPage={setPagePersist} setActiveTest={setActiveTest} user={user} />}
        {page === "auth"           && <AuthPage setPage={setPagePersist} onLogin={handleLogin} recoveryToken={recoveryToken} onRecoveryUsed={() => setRecoveryToken(null)} />}
        {page === "dashboard"      && <DashboardPage user={user} setPage={setPagePersist} setActiveTest={setActiveTest} />}
        {page === "exam-interface" && <ExamInterface setPage={setPagePersist} setDark={setDark} activeTest={activeTest} />}
        {page === "pricing"        && <PricingPage setPage={setPagePersist} />}
        {page === "admin"          && <AdminPanel user={user} setPage={setPagePersist} />}
        {!["home","exams","exam-detail","auth","dashboard","exam-interface","pricing","admin"].includes(page) && (
          <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", padding: "80px 1rem" }}>
            <div style={{ fontSize: "4rem" }}>🔍</div>
            <h2 style={{ color: dark ? "#fff" : "#111", fontFamily: "'Sora',sans-serif", fontWeight: 800 }}>Page not found</h2>
            <p style={{ color: dark ? "#666" : "#888" }}>This page doesn't exist.</p>
            <button onClick={() => setPagePersist("home")} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "12px 28px", borderRadius: "10px", cursor: "pointer", fontWeight: 700 }}>Go Home</button>
          </div>
        )}
      </main>

      {showFooter && <Footer setPage={setPagePersist} />}
    </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
