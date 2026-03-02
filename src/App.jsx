import { useState, useEffect, useRef, useContext, createContext, useCallback } from "react";

// ============================================================
// CONTEXTS
// ============================================================
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const ThemeContext = createContext("dark");
const useTheme = () => useContext(ThemeContext);

// ============================================================
// SUPABASE CONFIG (replace with real values)
// ============================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";

async function supabaseRequest(endpoint, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${options.token || SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...options.headers,
    },
    method: options.method || "GET",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Request failed");
  }
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
  console.error("Full Supabase error:", JSON.stringify(data));
  throw new Error(data.error_description || data.msg || data.message || "Auth failed");
}
  return data;
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
// EXAM DATA CONFIG
// ============================================================
const EXAMS_CONFIG = [
  { id: 1, org: "Odisha Police", name: "Constable Recruitment", logo: "odishapolice.webp", color: "#0033a0", tests: 45, tag: "Trending" },
  { id: 2, org: "Indian Army", name: "Agniveer GD", logo: "indianarmy.webp", color: "#cc0000", tests: 60, tag: "Popular" },
  { id: 3, org: "SSC GD", name: "SSC GD Constable", logo: "crpf.webp", color: "#2d5a27", tests: 80, tag: "Hot" },
  { id: 4, org: "OSSSC", name: "RI / ARI / Amin", logo: "odishashashan.webp", color: "#555", tests: 35, tag: "New" },
  { id: 5, org: "Indian Navy", name: "Agniveer SSR / MR", logo: "indiannavy.webp", color: "#1a3a6b", tests: 50, tag: "Popular" },
  { id: 6, org: "Indian Air Force", name: "Agniveer Vayu", logo: "iaf.webp", color: "#0a6ab5", tests: 55, tag: "Trending" },
  { id: 7, org: "CISF", name: "Constable / HC", logo: "cisf.webp", color: "#8b0000", tests: 30, tag: "" },
  { id: 8, org: "BSF", name: "GD Constable", logo: "bsf.webp", color: "#003399", tests: 28, tag: "" },
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
function HeroSection({ setPage }) {
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
          🎯 Odisha's #1 Defence Mock Test Platform
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
          Mock tests, sectional tests & PYQs for Odisha Police, Army, Navy, Air Force, Agniveer, SSC GD and more. Real exam simulation. Real results.
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
          <button onClick={() => setPage("auth")} style={{
            background: "transparent", border: dark ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(0,0,0,0.2)",
            color: dark ? "#fff" : "#333", padding: "14px 32px", borderRadius: "10px",
            cursor: "pointer", fontSize: "16px"
          }}>
            Start Free Trial
          </button>
        </div>

        {/* Stats row */}
        <div style={{
          marginTop: "60px", display: "flex", gap: "24px",
          justifyContent: "center", flexWrap: "wrap"
        }}>
          {[["10+","Exam Categories"],["500+","Practice Tests"],["Live","Leaderboard"]].map(([n,l]) => (
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
              has_sectional: types.includes("sectional"),
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

// EXAM DETAIL PAGE — fully dynamic from Supabase
function ExamDetailPage({ exam, setPage, setActiveTest, user }) {
  const dark = useTheme();
  const [activeTab, setActiveTab] = useState("mock");
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const color = exam.color || exam.organizations?.color || "#FFD700";
  const orgName = exam.organizations?.name || exam.org || "";

  useEffect(() => {
    supabaseRequest(`/tests?exam_id=eq.${exam.id}&is_published=eq.true&order=created_at.asc&select=*`, {})
      .then(data => { setTests(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [exam.id]);

  const byType = {
    mock:      tests.filter(t => t.test_type === "mock"),
    sectional: tests.filter(t => t.test_type === "sectional"),
    pyq:       tests.filter(t => t.test_type === "pyq"),
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
        {[["mock","Mock Tests"],["sectional","Sectional"],["pyq","PYQ"]].map(([k,l]) => (
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
          <span style={{ color: dark ? "#555" : "#888" }}>No {activeTab === "mock" ? "mock tests" : activeTab === "sectional" ? "sectional tests" : "PYQ papers"} published yet.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {byType[activeTab].map(test => (
            <div key={test.id} style={{
              background: dark ? "rgba(255,255,255,0.04)" : "#fff",
              border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
              borderRadius: "12px", padding: "16px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
              boxShadow: dark ? "none" : "0 1px 4px rgba(0,0,0,0.06)"
            }}>
              <div>
                <div style={{ color: dark ? "#fff" : "#111", fontWeight: 600, fontSize: "15px" }}>{test.name}</div>
                <div style={{ color: dark ? "#666" : "#888", fontSize: "13px", marginTop: "4px" }}>
                  {test.duration_minutes} min • {test.total_marks} Marks • -{test.negative_value} negative
                </div>
                {test.instructions && <div style={{ color: dark ? "#555" : "#888", fontSize: "12px", marginTop: "4px" }}>{test.instructions}</div>}
              </div>
              <button
                onClick={() => {
                  if (!user) { setPage("auth"); return; }
                  setActiveTest({ name: test.name, test_id: test.id, duration: test.duration_minutes, limit: test.total_marks });
                  setPage("exam-interface");
                }}
                style={{
                  background: "linear-gradient(135deg, #FFD700, #FF8C00)",
                  border: "none", color: "#000", padding: "10px 22px",
                  borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 700
                }}
              >
                {user ? "Start Test" : "Login to Start"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// AUTH PAGE — with email verification flow
function AuthPage({ setPage, onLogin }) {
  const dark = useTheme();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifyEmail, setVerifyEmail] = useState(""); // show "check email" screen

  // On mount: check if user landed back from email verification link
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const accessToken = params.get("access_token");
    const type = params.get("type");

    if (accessToken && (type === "signup" || type === "magiclink" || type === "recovery")) {
      // Exchange token for session
      (async () => {
        try {
          const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${accessToken}` }
          });
          const userData = await res.json();
          if (userData?.id) {
            const sessionData = { access_token: accessToken, user: userData };
            localStorage.setItem("mm_session", JSON.stringify(sessionData));
            let isAdmin = false;
            try {
              const roles = await supabaseRequest(`/roles?user_id=eq.${userData.id}&select=role`, { token: accessToken });
              isAdmin = roles?.some(r => r.role === "admin") || false;
            } catch {}
            // Clear the hash from URL
            window.history.replaceState(null, "", window.location.pathname);
            onLogin({ ...userData, token: accessToken, isAdmin });
            setPage("dashboard");
          }
        } catch(e) {
          setError("Verification failed. Please try signing in again.");
        }
      })();
    }
  }, []);

  const handleAuth = async () => {
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
          localStorage.setItem("mm_session", JSON.stringify(data));
          let isAdmin = false;
          try {
            const roles = await supabaseRequest(`/roles?user_id=eq.${data.user?.id}&select=role`, { token: data.access_token });
            isAdmin = roles?.some(r => r.role === "admin") || false;
          } catch {}
          onLogin({ ...data.user, token: data.access_token, isAdmin });
          setPage("dashboard");
        } else {
          // Confirm email is ON — show check email screen
          setVerifyEmail(email);
        }
        setLoading(false);
        return;
      } else {
        // Login
        const data = await supabaseAuth("token?grant_type=password", { email, password });
        if (data.error || data.error_description) throw new Error(data.error_description || data.error?.message || "Invalid email or password");
        localStorage.setItem("mm_session", JSON.stringify(data));
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
        </div>

        <p style={{ color: dark ? "#444" : "#888", fontSize: "12px", textAlign: "center", marginTop: "20px" }}>
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
// DASHBOARD
function DashboardPage({ user, setPage }) {
  const dark = useTheme();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabaseRequest(`/attempts?user_id=eq.${user.id}&select=*,tests(name),score,total_marks,created_at&order=created_at.desc&limit=10`, { token: user.token })
      .then(data => { setAttempts(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const totalAttempts = attempts.length;
  const avgScore = attempts.length ? Math.round(attempts.reduce((s,a) => s + (a.score/a.total_marks*100), 0) / attempts.length) : 0;

  return (
    <div style={{ padding: "80px 1rem 60px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: dark ? "#fff" : "#111", fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: "clamp(1.5rem,4vw,2.2rem)", margin: 0 }}>
          Welcome back 👋
        </h1>
        <p style={{ color: dark ? "#666" : "#888", fontSize: "14px", marginTop: "4px" }}>{user.email}</p>
      </div>

      {/* Stats */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px", marginBottom: "32px"
      }}>
        {[
          ["📝 Tests Taken", totalAttempts, "#FFD700"],
          ["🎯 Avg Score", `${avgScore}%`, "#4ade80"],
          ["🏆 Rank", "—", "#818cf8"],
          ["⚡ Streak", "0 days", "#fb923c"],
        ].map(([l,v,c]) => (
          <div key={l} style={{
            background: dark ? "rgba(255,255,255,0.04)" : "#fff",
            border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
            borderRadius: "14px", padding: "20px",
            boxShadow: dark ? "none" : "0 2px 8px rgba(0,0,0,0.05)"
          }}>
            <div style={{ color: dark ? "#666" : "#888", fontSize: "12px", marginBottom: "8px" }}>{l}</div>
            <div style={{ color: c, fontSize: "1.8rem", fontWeight: 900, fontFamily: "'Sora',sans-serif" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ color: dark ? "#aaa" : "#888", fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>Quick Actions</h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button onClick={() => setPage("exams")} style={{
            background: "linear-gradient(135deg, #FFD700, #FF8C00)",
            border: "none", color: "#000", padding: "12px 24px",
            borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: 700
          }}>Browse Exams →</button>
          <button style={{
            background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.12)",
            color: dark ? "#fff" : "#333", padding: "12px 24px", borderRadius: "10px", cursor: "pointer", fontSize: "14px"
          }}>View Results</button>
        </div>
      </div>

      {/* Recent Attempts */}
      <div>
        <h2 style={{ color: dark ? "#aaa" : "#888", fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>Recent Attempts</h2>
        {loading ? (
          <div style={{ color: "#666", padding: "20px 0" }}>Loading...</div>
        ) : attempts.length === 0 ? (
          <div style={{
            background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
            border: dark ? "1px dashed rgba(255,255,255,0.1)" : "1px dashed rgba(0,0,0,0.12)",
            borderRadius: "16px", padding: "40px", textAlign: "center"
          }}>
            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📚</div>
            <p style={{ color: "#666" }}>No tests taken yet. Start your first test!</p>
            <button onClick={() => setPage("exams")} style={{
              marginTop: "16px", background: "rgba(255,215,0,0.1)",
              border: "1px solid rgba(255,215,0,0.4)", color: dark ? "#FFD700" : "#92600A",
              padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontSize: "14px"
            }}>Browse Exams</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {attempts.map((a, i) => (
              <div key={i} style={{
                background: dark ? "rgba(255,255,255,0.04)" : "#fff",
                border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                borderRadius: "10px", padding: "14px 18px",
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px"
              }}>
                <div>
                  <div style={{ color: dark ? "#fff" : "#111", fontWeight: 600, fontSize: "14px" }}>{a.tests?.name || "Test"}</div>
                  <div style={{ color: "#555", fontSize: "12px" }}>{new Date(a.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#4ade80", fontWeight: 700 }}>{a.score}/{a.total_marks}</div>
                  <div style={{ color: "#666", fontSize: "12px" }}>{Math.round(a.score/a.total_marks*100)}%</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// SECURE EXAM INTERFACE — Advanced
function ExamInterface({ setPage, activeTest }) {
  const dark = useTheme();
  const { user } = useAuth();
  const testName = activeTest?.name || "Mock Test";
  const DURATION = (activeTest?.duration || 10) * 60;

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState({});       // qid -> option index
  const [marked, setMarked] = useState({});          // qid -> true (marked for review)
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [submitted, setSubmitted] = useState(false);
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
        setQuestions(data.map(q => ({
          id: q.id,
          text: q.question_text,
          options: [q.option_a, q.option_b, q.option_c, q.option_d],
          correct: ["a","b","c","d"].indexOf(q.correct_answer?.toLowerCase()),
          marks: q.marks || 1,
          negative: q.negative_marks ?? 0.25,
          subject: q.subject || "General",
          explanation: q.explanation || "",
        })));
        setLoading(false);
      })
      .catch(err => { setLoadError("Failed to load questions: " + err.message); setLoading(false); });
  }, []);

  const TOTAL = questions.length;

  const handleSubmit = useCallback(() => {
    if (submitted) return;
    clearInterval(timerRef.current);
    let s = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct) s += q.marks;
      else if (answers[q.id] !== undefined) s -= q.negative;
    });
    setScore(Math.max(0, parseFloat(s.toFixed(2))));
    setSubmitted(true);
    setShowPalette(false);
  }, [answers, submitted, questions]);

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
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current); handleSubmit(); return 0; } return t - 1; });
    }, 1000);
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
    const pct = Math.round(score / totalMarks * 100);
    const correct = questions.filter(q => answers[q.id] === q.correct).length;
    const wrong = questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== q.correct).length;
    const skippedQ = TOTAL - correct - wrong;
    const timeTaken = DURATION - timeLeft;
    const mm2 = String(Math.floor(timeTaken/60)).padStart(2,"0");
    const ss2 = String(timeTaken%60).padStart(2,"0");

    const subjects = {};
    questions.forEach(q => {
      const s = q.subject || "General";
      if (!subjects[s]) subjects[s] = { correct: 0, wrong: 0, skipped: 0, total: 0, marks: 0 };
      subjects[s].total++;
      if (answers[q.id] === q.correct) { subjects[s].correct++; subjects[s].marks += q.marks; }
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
      <div style={{ minHeight: "100vh", background: dark ? "#080a14" : "#f5f6fa", padding: "20px 1rem 60px" }}>
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
            <div style={{ color: dark ? "#aaa" : "#777", fontSize: "15px", marginTop: "6px" }}>{score.toFixed(1)} out of {totalMarks} marks</div>
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "8px", height: "8px", margin: "16px 0 8px", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#FFD700,#FF8C00)", borderRadius: "8px", transition: "width 1.5s ease" }} />
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginBottom: "20px", animation: "fadeUp 0.7s ease" }}>
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
                  const isCorrect = userAns === q.correct;
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
                              const isUserChoice = userAns === idx;
                              const isCorrectOpt = q.correct === idx;
                              let bg = "rgba(255,255,255,0.04)";
                              let border = "1px solid rgba(255,255,255,0.08)";
                              let col = "#aaa";
                              if (isCorrectOpt) { bg = "rgba(74,222,128,0.12)"; border = "1px solid rgba(74,222,128,0.4)"; col = "#4ade80"; }
                              if (isUserChoice && !isCorrectOpt) { bg = "rgba(255,100,100,0.1)"; border = "1px solid rgba(255,100,100,0.4)"; col = "#ff6b6b"; }
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
        <div style={{ color: dark ? "#fff" : "#111", fontSize: "14px", fontWeight: 700 }}>Question Palette</div>
        {onClose && <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#aaa", fontSize: "20px", cursor: "pointer", lineHeight: 1 }}>×</button>}
      </div>
      {/* Legend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "14px", fontSize: "11px" }}>
        {[
          { c: "#4ade80", l: `Answered (${answered})` },
          { c: "#ff6b6b", l: `Skipped (${skipped})` },
          { c: "#fb923c", l: `Marked (${markedCount})` },
          { c: "#555", l: `Not visited` },
        ].map(({ c, l }) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "2px", background: c + "44", border: `1px solid ${c}88`, flexShrink: 0 }} />
            <span style={{ color: "#666" }}>{l}</span>
          </div>
        ))}
      </div>
      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
        {questions.map((qq, i) => {
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
          <span>Total Questions</span><span style={{ color: "#aaa" }}>{TOTAL}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#555", fontSize: "12px", marginBottom: "6px" }}>
          <span>Attempted</span><span style={{ color: "#4ade80" }}>{answered}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#555", fontSize: "12px" }}>
          <span>Remaining</span><span style={{ color: "#ff6b6b" }}>{TOTAL - answered}</span>
        </div>
      </div>
      <button onClick={handleSubmit} style={{
        width: "100%", marginTop: "14px",
        background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none",
        color: "#000", padding: "13px", borderRadius: "10px",
        cursor: "pointer", fontSize: "15px", fontWeight: 800
      }}>Submit Test ✓</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#080a14", userSelect: "none" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      `}</style>

      {/* Warning banner */}
      {showWarning && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, background: "linear-gradient(135deg,rgba(255,50,50,0.97),rgba(200,0,0,0.97))", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>⚠️ Tab switch detected! Warning {warnings}/3 — Auto-submit at 3</span>
          <button onClick={() => setShowWarning(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Dismiss</button>
        </div>
      )}

      {/* Top Bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: dark ? "rgba(8,10,20,0.98)" : "rgba(255,255,255,0.98)", backdropFilter: "blur(12px)",
        borderBottom: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.1)",
        padding: "0 16px", height: "58px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"
      }}>
        {/* Left: Test name */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: dark ? "#fff" : "#111", fontWeight: 700, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{testName}</div>
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

        {/* Right: Mobile palette btn + Submit */}
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button onClick={() => setShowPalette(true)} className="palette-btn-mobile" style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            color: "#aaa", padding: "7px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "13px"
          }}>📋</button>
          <button onClick={handleSubmit} style={{
            background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none",
            color: "#000", padding: "8px 16px", borderRadius: "8px",
            cursor: "pointer", fontSize: "13px", fontWeight: 800
          }}>Submit</button>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", maxWidth: "1200px", margin: "0 auto", padding: "16px", gap: "20px" }}>

        {/* Question area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Question header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: dark ? "#FFD700" : "#92600A", padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>Q {current+1}</span>
              <span style={{ background: "rgba(255,255,255,0.06)", color: "#888", padding: "3px 10px", borderRadius: "6px", fontSize: "12px" }}>{q.subject}</span>
              <span style={{ color: "#4ade80", fontSize: "12px" }}>+{q.marks}</span>
              <span style={{ color: "#ff6b6b", fontSize: "12px" }}>-{q.negative}</span>
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
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "clamp(16px,3vw,28px)", marginBottom: "14px" }}>
            <p style={{ color: dark ? "#fff" : "#111", fontSize: "clamp(15px,2.5vw,18px)", lineHeight: 1.8, margin: 0, fontWeight: 500 }}>{q.text}</p>
          </div>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
            {q.options.map((opt, idx) => {
              const selected = answers[q.id] === idx;
              return (
                <button key={idx} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: idx }))} style={{
                  background: selected ? "rgba(255,215,0,0.12)" : (dark ? "rgba(255,255,255,0.04)" : "#fafafa"),
                  border: selected ? "2px solid rgba(255,215,0,0.6)" : (dark ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(0,0,0,0.1)"),
                  color: selected ? "#E6A800" : (dark ? "#ddd" : "#222"),
                  padding: "clamp(12px,2vw,16px) clamp(14px,2vw,20px)",
                  borderRadius: "12px", cursor: "pointer", textAlign: "left",
                  fontSize: "clamp(14px,2vw,16px)", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: "14px",
                  boxShadow: selected ? "0 0 0 1px rgba(255,215,0,0.15)" : "none"
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: selected ? "#FFD700" : "rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: selected ? "#000" : "#777", fontSize: "13px", fontWeight: 800,
                    transition: "all 0.15s"
                  }}>{["A","B","C","D"][idx]}</span>
                  <span style={{ lineHeight: 1.5 }}>{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => setCurrent(c => Math.max(0, c-1))} disabled={current===0} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: current===0 ? (dark ? "#333" : "#bbb") : (dark ? "#fff" : "#111"), padding: "11px 22px",
              borderRadius: "9px", cursor: current===0 ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: 600
            }}>← Prev</button>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setAnswers(prev => { const n={...prev}; delete n[q.id]; return n; })} style={{
                background: "transparent", border: "1px solid rgba(255,100,100,0.3)",
                color: "#ff6b6b", padding: "11px 16px", borderRadius: "9px", cursor: "pointer", fontSize: "13px"
              }}>Clear</button>
              <button onClick={() => { setMarked(prev => ({ ...prev, [q.id]: true })); setCurrent(c => Math.min(TOTAL-1, c+1)); }} style={{
                background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)",
                color: "#fb923c", padding: "11px 14px", borderRadius: "9px", cursor: "pointer", fontSize: "13px"
              }}>Mark & Next</button>
            </div>

            <button onClick={() => setCurrent(c => Math.min(TOTAL-1, c+1))} disabled={current===TOTAL-1} style={{
              background: current===TOTAL-1 ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#FFD700,#FF8C00)",
              border: "none", color: current===TOTAL-1 ? "#333" : "#000",
              padding: "11px 22px", borderRadius: "9px",
              cursor: current===TOTAL-1 ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: 700
            }}>Next →</button>
          </div>
        </div>

        {/* Desktop Sidebar */}
        <div className="exam-sidebar" style={{
          width: "250px", flexShrink: 0, alignSelf: "flex-start",
          position: "sticky", top: "74px",
          background: dark ? "rgba(255,255,255,0.03)" : "#fff",
          border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
          borderRadius: "16px", overflow: "hidden",
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
function PricingPage({ setPage }) {
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
        <button onClick={() => setPage("auth")} style={{
          background: "linear-gradient(135deg, #FFD700, #FF8C00)",
          border: "none", color: "#000", padding: "16px 48px",
          borderRadius: "12px", cursor: "pointer", fontSize: "17px", fontWeight: 800,
          boxShadow: "0 4px 20px rgba(255,215,0,0.3)"
        }}>Start Practicing Free →</button>
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

// ADMIN EXAMS COMPONENT
function AdminExams({ user }) {
  const dark = useTheme();
  const [exams, setExams] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editExam, setEditExam] = useState(null);
  const [expandedExam, setExpandedExam] = useState(null);
  const [tests, setTests] = useState({});
  const [showTestForm, setShowTestForm] = useState(null);
  const [editTest, setEditTest] = useState(null);
  const [msg, setMsg] = useState("");

  const emptyExam = { name: "", organization_id: "", description: "", is_published: false, is_free: false };
  const emptyTest = { name: "", test_type: "mock", duration_minutes: 60, total_marks: 100, negative_value: 0.25, instructions: "", is_published: false };
  const [examForm, setExamForm] = useState(emptyExam);
  const [testForm, setTestForm] = useState(emptyTest);

  const loadExams = () => {
    setLoading(true);
    supabaseRequest("/exams?select=*,organizations(name,color)&order=created_at.desc", { token: user.token })
      .then(data => { setExams(data || []); setLoading(false); })
      .catch(() => setLoading(false));
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

  const saveExam = async () => {
    try {
      if (editExam) {
        await supabaseRequest(`/exams?id=eq.${editExam.id}`, { method: "PATCH", body: examForm, token: user.token });
        setMsg("✅ Exam updated!");
      } else {
        await supabaseRequest("/exams", { method: "POST", body: examForm, token: user.token });
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
    try {
      const body = { ...testForm, exam_id: examId };
      if (editTest) {
        await supabaseRequest(`/tests?id=eq.${editTest.id}`, { method: "PATCH", body: testForm, token: user.token });
      } else {
        await supabaseRequest("/tests", { method: "POST", body, token: user.token });
      }
      setShowTestForm(null); setEditTest(null); setTestForm(emptyTest); loadTests(examId);
      setMsg("✅ Test saved!");
    } catch(e) { setMsg("❌ " + e.message); }
  };

  const deleteTest = async (testId, examId) => {
    if (!confirm("Delete this test?")) return;
    await supabaseRequest(`/tests?id=eq.${testId}`, { method: "DELETE", token: user.token });
    loadTests(examId);
  };

  const inputS = { width: "100%", background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.15)", color: dark ? "#fff" : "#111", padding: "10px 12px", borderRadius: "8px", fontSize: "14px", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ maxWidth: "900px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ color: dark ? "#fff" : "#111", fontFamily: "'Sora',sans-serif", fontWeight: 800 }}>Exams & Tests</h1>
        <button onClick={() => { setShowForm(true); setEditExam(null); setExamForm(emptyExam); }} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: 700 }}>+ New Exam</button>
      </div>

      {msg && <div style={{ color: msg.startsWith("✅") ? "#4ade80" : "#ff6b6b", marginBottom: "16px", fontSize: "14px" }}>{msg}</div>}

      {/* Exam Form */}
      {showForm && (
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: "14px", padding: "20px", marginBottom: "20px" }}>
          <h3 style={{ color: dark ? "#FFD700" : "#92600A", marginBottom: "16px" }}>{editExam ? "Edit Exam" : "New Exam"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ color: "#aaa", fontSize: "12px" }}>Exam Name *</label>
              <input value={examForm.name} onChange={e => setExamForm(p => ({...p, name: e.target.value}))} style={inputS} placeholder="e.g. Constable Recruitment 2025" />
            </div>
            <div>
              <label style={{ color: "#aaa", fontSize: "12px" }}>Organization</label>
              <select value={examForm.organization_id} onChange={e => setExamForm(p => ({...p, organization_id: e.target.value}))}
                style={{ ...inputS, background: "#1a1a2e" }}>
                <option value="">-- Select Organization --</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ color: "#aaa", fontSize: "12px" }}>Description</label>
            <input value={examForm.description} onChange={e => setExamForm(p => ({...p, description: e.target.value}))} style={inputS} placeholder="Short description" />
          </div>
          <div style={{ display: "flex", gap: "20px", marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#aaa", fontSize: "14px", cursor: "pointer" }}>
              <input type="checkbox" checked={examForm.is_published} onChange={e => setExamForm(p => ({...p, is_published: e.target.checked}))} /> Published
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#aaa", fontSize: "14px", cursor: "pointer" }}>
              <input type="checkbox" checked={examForm.is_free} onChange={e => setExamForm(p => ({...p, is_free: e.target.checked}))} /> Free
            </label>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={saveExam} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: 700 }}>Save</button>
            <button onClick={() => { setShowForm(false); setEditExam(null); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#aaa", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: "#666", padding: "20px" }}>Loading...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {exams.length === 0 && <div style={{ color: "#555", textAlign: "center", padding: "40px" }}>No exams yet. Create your first exam!</div>}
          {exams.map(exam => (
            <div key={exam.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button onClick={() => { const id = exam.id; setExpandedExam(expandedExam === id ? null : id); if (expandedExam !== id) loadTests(id); }} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", width: 28, height: 28, borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>
                    {expandedExam === exam.id ? "▼" : "▶"}
                  </button>
                  <div>
                    <div style={{ color: dark ? "#fff" : "#111", fontWeight: 600 }}>{exam.name}</div>
                    <div style={{ color: "#555", fontSize: "12px" }}>{exam.organizations?.name || "No org"} • {exam.is_published ? <span style={{ color: "#4ade80" }}>Published</span> : <span style={{ color: "#ff6b6b" }}>Draft</span>} {exam.is_free && <span style={{ color: "#4ade80" }}> • Free</span>}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => { setEditExam(exam); setExamForm({ name: exam.name, organization_id: exam.organization_id || "", description: exam.description || "", is_published: exam.is_published, is_free: exam.is_free }); setShowForm(true); }} style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Edit</button>
                  <button onClick={() => deleteExam(exam.id)} style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)", color: "#ff6b6b", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Delete</button>
                </div>
              </div>

              {/* Tests section */}
              {expandedExam === exam.id && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px", background: "rgba(0,0,0,0.2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ color: "#aaa", fontSize: "13px", fontWeight: 600 }}>Tests</div>
                    <button onClick={() => { setShowTestForm(exam.id); setEditTest(null); setTestForm(emptyTest); }} style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>+ Add Test</button>
                  </div>

                  {/* Test Form */}
                  {showTestForm === exam.id && (
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "10px", padding: "16px", marginBottom: "12px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                        <div><label style={{ color: "#aaa", fontSize: "11px" }}>Test Name *</label><input value={testForm.name} onChange={e => setTestForm(p => ({...p, name: e.target.value}))} style={inputS} placeholder="e.g. Mathematics Practice Set 1" /></div>
                        <div><label style={{ color: "#aaa", fontSize: "11px" }}>Type</label>
                          <select value={testForm.test_type} onChange={e => setTestForm(p => ({...p, test_type: e.target.value}))} style={{ ...inputS, background: "#1a1a2e" }}>
                            <option value="mock">Mock Test</option>
                            <option value="sectional">Sectional Test</option>
                            <option value="pyq">PYQ</option>
                          </select>
                        </div>
                        <div><label style={{ color: "#aaa", fontSize: "11px" }}>Duration (mins)</label><input type="number" value={testForm.duration_minutes} onChange={e => setTestForm(p => ({...p, duration_minutes: parseInt(e.target.value)}))} style={inputS} /></div>
                        <div><label style={{ color: "#aaa", fontSize: "11px" }}>Total Marks</label><input type="number" value={testForm.total_marks} onChange={e => setTestForm(p => ({...p, total_marks: parseInt(e.target.value)}))} style={inputS} /></div>
                        <div><label style={{ color: "#aaa", fontSize: "11px" }}>Negative Marks</label><input type="number" step="0.25" value={testForm.negative_value} onChange={e => setTestForm(p => ({...p, negative_value: parseFloat(e.target.value)}))} style={inputS} /></div>
                        <div><label style={{ color: "#aaa", fontSize: "11px" }}>Instructions</label><input value={testForm.instructions} onChange={e => setTestForm(p => ({...p, instructions: e.target.value}))} style={inputS} placeholder="Optional" /></div>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#aaa", fontSize: "13px", cursor: "pointer", marginBottom: "12px" }}>
                        <input type="checkbox" checked={testForm.is_published} onChange={e => setTestForm(p => ({...p, is_published: e.target.checked}))} /> Published
                      </label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => saveTest(exam.id)} style={{ background: "linear-gradient(135deg,#4ade80,#22c55e)", border: "none", color: "#000", padding: "8px 20px", borderRadius: "6px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>Save Test</button>
                        <button onClick={() => { setShowTestForm(null); setEditTest(null); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#aaa", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {(tests[exam.id] || []).length === 0 ? (
                    <div style={{ color: "#444", fontSize: "13px", padding: "8px 0" }}>No tests yet.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(tests[exam.id] || []).map(test => (
                        <div key={test.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                          <div>
                            <div style={{ color: "#ddd", fontSize: "13px", fontWeight: 600 }}>{test.name}</div>
                            <div style={{ color: "#555", fontSize: "11px" }}>{test.test_type} • {test.duration_minutes}min • {test.total_marks}marks • {test.is_published ? <span style={{ color: "#4ade80" }}>Published</span> : <span style={{ color: "#ff6b6b" }}>Draft</span>}</div>
                          </div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button onClick={() => { setEditTest(test); setTestForm({ name: test.name, test_type: test.test_type, duration_minutes: test.duration_minutes, total_marks: test.total_marks, negative_value: test.negative_value, instructions: test.instructions || "", is_published: test.is_published }); setShowTestForm(exam.id); }} style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.2)", color: dark ? "#FFD700" : "#92600A", padding: "4px 10px", borderRadius: "5px", cursor: "pointer", fontSize: "12px" }}>Edit</button>
                            <button onClick={() => deleteTest(test.id, exam.id)} style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.2)", color: "#ff6b6b", padding: "4px 10px", borderRadius: "5px", cursor: "pointer", fontSize: "12px" }}>Del</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ADMIN USERS COMPONENT
function AdminUsers({ user }) {
  const dark = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabaseRequest("/profiles?select=*&order=created_at.desc&limit=100", { token: user.token })
      .then(data => { setUsers(data || []); setLoading(false); })
      .catch(() => {
        // Try auth users endpoint as fallback
        supabaseRequest("/users?select=*&order=created_at.desc&limit=100", { token: user.token })
          .then(data => { setUsers(data || []); setLoading(false); })
          .catch(() => setLoading(false));
      });
  }, []);

  const filtered = users.filter(u => u.email?.toLowerCase().includes(search.toLowerCase()) || u.id?.includes(search));

  return (
    <div style={{ maxWidth: "900px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ color: dark ? "#fff" : "#111", fontFamily: "'Sora',sans-serif", fontWeight: 800 }}>Users</h1>
        <div style={{ color: "#666", fontSize: "13px" }}>Total: {users.length}</div>
      </div>

      <input
        placeholder="Search by email or ID..."
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: "100%", background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.15)", color: dark ? "#fff" : "#111", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", outline: "none", marginBottom: "16px", boxSizing: "border-box" }}
      />

      {loading ? <div style={{ color: "#666" }}>Loading users...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.length === 0 && <div style={{ color: "#555", textAlign: "center", padding: "40px" }}>No users found.</div>}
          {filtered.map(u => (
            <div key={u.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <div style={{ color: dark ? "#fff" : "#111", fontWeight: 600, fontSize: "14px" }}>{u.email || "No email"}</div>
                <div style={{ color: "#555", fontSize: "11px", fontFamily: "monospace" }}>{u.id}</div>
              </div>
              <div style={{ color: "#555", fontSize: "12px" }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ADMIN PANEL
function AdminPanel({ user }) {
  const dark = useTheme();
  const [activeSection, setActiveSection] = useState("overview");
  const [csvContent, setCsvContent] = useState("");
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvError, setCsvError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  if (!user?.isAdmin) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 1rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🔒</div>
          <h2 style={{ color: "#ff6b6b", fontFamily: "'Sora',sans-serif" }}>Access Denied</h2>
          <p style={{ color: "#666" }}>Admin access only. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  const parseCSV = (text) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) { setCsvError("CSV must have header + at least 1 row"); return []; }
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g,""));
    const required = ["question_text","option_a","option_b","option_c","option_d","correct_answer","marks"];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length) { setCsvError(`Missing columns: ${missing.join(", ")}`); return []; }

    const rows = [];
    const errors = [];
    lines.slice(1).forEach((line, i) => {
      if (!line.trim()) return;
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g,""));
      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
      if (!row.question_text) { errors.push(`Row ${i+2}: Empty question`); return; }
      if (!["a","b","c","d"].includes(row.correct_answer?.toLowerCase())) {
        errors.push(`Row ${i+2}: correct_answer must be a/b/c/d`); return;
      }
      rows.push(row);
    });
    if (errors.length) { setCsvError(errors.slice(0,3).join("; ")); }
    else setCsvError("");
    return rows;
  };

  const handleCSVChange = (text) => {
    setCsvContent(text);
    const rows = parseCSV(text);
    setCsvPreview(rows.slice(0, 5));
  };

  const handleBulkUpload = async () => {
    const rows = parseCSV(csvContent);
    if (!rows.length || csvError) return;
    setUploading(true); setUploadMsg("");
    try {
      const questions = rows.map(r => ({
        question_text: r.question_text,
        option_a: r.option_a, option_b: r.option_b,
        option_c: r.option_c, option_d: r.option_d,
        correct_answer: r.correct_answer.toLowerCase(),
        marks: parseFloat(r.marks) || 1,
        negative_marks: parseFloat(r.negative_marks) || 0,
        subject: r.subject || "General",
        explanation: r.explanation || "",
      }));
      await supabaseRequest("/questions", {
        method: "POST", body: questions, token: user.token,
        prefer: "return=minimal"
      });
      setUploadMsg(`✅ ${questions.length} questions uploaded successfully!`);
      setCsvContent(""); setCsvPreview([]);
    } catch(e) {
      setUploadMsg(`❌ Upload failed: ${e.message}`);
    } finally { setUploading(false); }
  };

  const sections = ["overview","questions","exams","users"];
  return (
    <div style={{ padding: "60px 0 0", minHeight: "100vh", display: "flex" }}>
      {/* Sidebar */}
      <div style={{
        width: "200px", flexShrink: 0,
        background: dark ? "rgba(255,50,50,0.05)" : "rgba(255,50,50,0.03)", borderRight: dark ? "1px solid rgba(255,50,50,0.15)" : "1px solid rgba(255,50,50,0.12)",
        padding: "20px 0", position: "sticky", top: 0, height: "100vh"
      }} className="admin-sidebar">
        <div style={{ padding: "0 16px 16px", color: "#ff6b6b", fontSize: "12px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>
          Admin Panel
        </div>
        {sections.map(s => (
          <button key={s} onClick={() => setActiveSection(s)} style={{
            width: "100%", padding: "12px 16px", background: activeSection===s ? "rgba(255,50,50,0.1)" : "transparent",
            border: "none", borderLeft: activeSection===s ? "2px solid #ff6b6b" : "2px solid transparent",
            color: activeSection===s ? "#ff6b6b" : "#888",
            cursor: "pointer", textAlign: "left", fontSize: "14px", textTransform: "capitalize"
          }}>{s}</button>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "24px", minWidth: 0, overflowX: "auto" }}>
        {activeSection === "overview" && (
          <div>
            <h1 style={{ color: dark ? "#fff" : "#111", fontFamily: "'Sora',sans-serif", fontWeight: 800, marginBottom: "24px" }}>Dashboard Overview</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "16px" }}>
              {[["Total Users","—","#818cf8"],["Total Tests","—","#4ade80"],["Attempts","—","#FFD700"],["Questions","—","#fb923c"]].map(([l,v,c]) => (
                <div key={l} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"12px", padding:"20px" }}>
                  <div style={{color: dark ? "#555" : "#888",fontSize:"12px",marginBottom:"8px"}}>{l}</div>
                  <div style={{color:c,fontSize:"2rem",fontWeight:900,fontFamily:"'Sora',sans-serif"}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === "questions" && (
          <div style={{ maxWidth: "800px" }}>
            <h1 style={{ color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 800, marginBottom: "24px" }}>Question Upload</h1>

            {/* CSV Template Download hint */}
            <div style={{
              background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.2)",
              borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#aaa"
            }}>
              <strong style={{color:"#FFD700"}}>CSV Format:</strong> question_text, option_a, option_b, option_c, option_d, correct_answer (a/b/c/d), marks, negative_marks, subject, explanation
            </div>

            <textarea
              placeholder={"question_text,option_a,option_b,option_c,option_d,correct_answer,marks,negative_marks,subject,explanation\nWhat is 2+2?,1,2,3,4,d,1,0.25,Maths,Two plus two equals four"}
              value={csvContent}
              onChange={e => handleCSVChange(e.target.value)}
              style={{
                width: "100%", height: "200px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff", borderRadius: "10px", padding: "14px",
                fontSize: "13px", fontFamily: "monospace", resize: "vertical", boxSizing: "border-box",
                outline: "none"
              }}
            />

            {csvError && (
              <div style={{ color: "#ff6b6b", fontSize: "13px", marginTop: "8px" }}>{csvError}</div>
            )}

            {csvPreview.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ color: "#aaa", fontSize: "12px", marginBottom: "8px" }}>Preview ({csvPreview.length} rows):</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", color: "#aaa" }}>
                    <thead>
                      <tr>{["Question","A","B","C","D","Correct","Marks"].map(h => (
                        <th key={h} style={{ background: "rgba(255,255,255,0.08)", padding: "6px 10px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ padding: "6px 10px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.question_text}</td>
                          <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{row.option_a}</td>
                          <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{row.option_b}</td>
                          <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{row.option_c}</td>
                          <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{row.option_d}</td>
                          <td style={{ padding: "6px 10px", color: "#4ade80", whiteSpace: "nowrap" }}>{row.correct_answer}</td>
                          <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{row.marks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {uploadMsg && (
              <div style={{ marginTop: "12px", color: uploadMsg.startsWith("✅") ? "#4ade80" : "#ff6b6b", fontSize: "14px" }}>{uploadMsg}</div>
            )}

            <button
              onClick={handleBulkUpload}
              disabled={uploading || !csvContent || !!csvError}
              style={{
                marginTop: "16px",
                background: uploading || !csvContent || csvError ? "#333" : "linear-gradient(135deg, #FFD700, #FF8C00)",
                border: "none", color: uploading || !csvContent || csvError ? "#666" : "#000",
                padding: "12px 28px", borderRadius: "10px",
                cursor: uploading || !csvContent || csvError ? "not-allowed" : "pointer",
                fontSize: "14px", fontWeight: 700
              }}
            >
              {uploading ? "Uploading..." : "Upload Questions"}
            </button>
          </div>
        )}

        {activeSection === "exams" && <AdminExams user={user} />}
        {activeSection === "users" && <AdminUsers user={user} />}
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
          <span style={{ color: dark ? "#444" : "#aaa", fontSize: "13px" }}>© 2024 MeritMatrix. All rights reserved.</span>
          <span style={{ color: dark ? "#444" : "#aaa", fontSize: "13px" }}>Built for Odisha's aspirants 🇮🇳</span>
        </div>
      </div>
    </footer>
  );
}

// HOMEPAGE
function HomePage({ setPage, setActiveExam }) {
  return (
    <>
      <HeroSection setPage={setPage} />
      <LogoSlider />
      <ExamsPage setPage={setPage} setActiveExam={setActiveExam} />
      <FeaturesSection />
      <PricingPage setPage={setPage} />
    </>
  );
}

// ============================================================
// ROOT APP
// ============================================================
export default function App() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useLocalStorage("mm_user", null);
  const [activeExam, setActiveExam] = useState(null);
  const [activeTest, setActiveTest] = useState(null);
  const [dark, setDark] = useLocalStorage("mm_theme", true); // true=dark, false=light

  // On load: handle Supabase email verification link (hash token) OR restore session
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const accessToken = params.get("access_token");
    const type = params.get("type");

    if (accessToken && (type === "signup" || type === "magiclink" || type === "recovery")) {
      (async () => {
        try {
          const res = await fetch(SUPABASE_URL + "/auth/v1/user", {
            headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + accessToken }
          });
          const userData = await res.json();
          if (userData?.id) {
            const sessionData = { access_token: accessToken, user: userData };
            localStorage.setItem("mm_session", JSON.stringify(sessionData));
            let isAdmin = false;
            try {
              const roles = await supabaseRequest("/roles?user_id=eq." + userData.id + "&select=role", { token: accessToken });
              isAdmin = roles?.some(r => r.role === "admin") || false;
            } catch {}
            window.history.replaceState(null, "", window.location.pathname);
            setUser({ ...userData, token: accessToken, isAdmin });
            setPage("dashboard");
          }
        } catch {}
      })();
      return;
    }

    const session = localStorage.getItem("mm_session");
    if (session && !user) {
      try {
        const s = JSON.parse(session);
        if (s?.user && s?.access_token) {
          setUser({ ...s.user, token: s.access_token, isAdmin: false });
        }
      } catch {}
    }
  }, []);

  const handleLogin = (u) => setUser(u);
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("mm_session");
    localStorage.removeItem("mm_user");
    setPage("home");
  };

  const showNav = page !== "exam-interface";
  const showFooter = !["exam-interface","exam-detail","admin","dashboard","auth"].includes(page);

  const bg = dark ? "#080a14" : "#f5f6fa";
  const fg = dark ? "#ffffff" : "#111827";

  return (
    <ThemeContext.Provider value={dark}>
    <AuthContext.Provider value={{ user, setUser }}>
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
          .admin-sidebar { display: none; }
          .exam-sidebar { display: none !important; }
          .palette-btn-mobile { display: flex !important; }
          .mobile-bottom-nav { display: flex !important; }
        }
        @media (min-width: 769px) {
          .palette-btn-mobile { display: none !important; }
          .mobile-bottom-nav { display: none !important; }
          .exam-sidebar { display: block !important; }
        }
        @media (max-width: 480px) { .mobile-menu { display: flex !important; } }
        @media (min-width: 769px) { .mobile-menu { display: none !important; } }
      `}</style>

      {showNav && (
        <Navbar page={page} setPage={setPage} user={user} onLogout={handleLogout} dark={dark} setDark={setDark} />
      )}

      <main>
        {page === "home"           && <HomePage setPage={setPage} setActiveExam={setActiveExam} dark={dark} />}
        {page === "exams"          && <ExamsPage setPage={setPage} setActiveExam={setActiveExam} dark={dark} />}
        {page === "exam-detail"    && activeExam && <ExamDetailPage exam={activeExam} setPage={setPage} setActiveTest={setActiveTest} user={user} dark={dark} />}
        {page === "auth"           && <AuthPage setPage={setPage} onLogin={handleLogin} dark={dark} />}
        {page === "dashboard"      && <DashboardPage user={user} setPage={setPage} dark={dark} />}
        {page === "exam-interface" && <ExamInterface setPage={setPage} activeTest={activeTest} dark={dark} />}
        {page === "pricing"        && <PricingPage setPage={setPage} dark={dark} />}
        {page === "admin"          && <AdminPanel user={user} dark={dark} />}
      </main>

      {showFooter && <Footer setPage={setPage} dark={dark} />}
    </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
