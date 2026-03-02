import { useState, useEffect, useRef, useContext, createContext, useCallback } from "react";

// ============================================================
// CONTEXTS
// ============================================================
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

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
function Navbar({ page, setPage, user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: "rgba(8,10,20,0.95)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(255,215,0,0.15)",
      padding: "0 1rem", height: "60px",
      display: "flex", alignItems: "center", justifyContent: "space-between"
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
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "18px", color: "#FFD700", letterSpacing: "-0.5px" }}>
          Merit<span style={{ color: "#fff" }}>Matrix</span>
        </span>
      </div>

      {/* Desktop Nav */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }} className="desktop-nav">
        {[["home","Home"],["exams","Exams"],["pricing","Pricing"]].map(([p,l]) => (
          <button key={p} onClick={() => setPage(p)} style={{
            background: page===p ? "rgba(255,215,0,0.15)" : "transparent",
            border: page===p ? "1px solid rgba(255,215,0,0.3)" : "1px solid transparent",
            color: page===p ? "#FFD700" : "#aaa",
            padding: "6px 14px", borderRadius: "6px", cursor: "pointer",
            fontSize: "14px", fontWeight: 500, transition: "all 0.2s"
          }}>{l}</button>
        ))}
        {user ? (
          <>
            <button onClick={() => setPage("dashboard")} style={{
              background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)",
              color: "#FFD700", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "14px"
            }}>Dashboard</button>
            {user.isAdmin && (
              <button onClick={() => setPage("admin")} style={{
                background: "rgba(255,50,50,0.15)", border: "1px solid rgba(255,50,50,0.3)",
                color: "#ff6b6b", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "14px"
              }}>Admin</button>
            )}
            <button onClick={onLogout} style={{
              background: "transparent", border: "1px solid #333",
              color: "#666", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "14px"
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
        color: "#FFD700", fontSize: "22px", cursor: "pointer"
      }} className="mobile-menu-btn">☰</button>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div style={{
          position: "absolute", top: "60px", left: 0, right: 0,
          background: "rgba(8,10,20,0.98)", borderBottom: "1px solid rgba(255,215,0,0.15)",
          padding: "1rem", display: "flex", flexDirection: "column", gap: "8px"
        }} className="mobile-menu">
          {[["home","🏠 Home"],["exams","📚 Exams"],["pricing","💎 Pricing"]].map(([p,l]) => (
            <button key={p} onClick={() => { setPage(p); setMenuOpen(false); }} style={{
              background: "transparent", border: "1px solid rgba(255,215,0,0.15)",
              color: "#fff", padding: "10px 16px", borderRadius: "8px",
              cursor: "pointer", fontSize: "15px", textAlign: "left"
            }}>{l}</button>
          ))}
          {user ? (
            <>
              <button onClick={() => { setPage("dashboard"); setMenuOpen(false); }} style={{
                background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)",
                color: "#FFD700", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "15px", textAlign: "left"
              }}>📊 Dashboard</button>
              <button onClick={onLogout} style={{
                background: "transparent", border: "1px solid #333",
                color: "#666", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "15px", textAlign: "left"
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
  // Duplicate for infinite scroll
  const items = [...logos, ...logos];
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      borderTop: "1px solid rgba(255,215,0,0.1)",
      borderBottom: "1px solid rgba(255,215,0,0.1)",
      padding: "24px 0", overflow: "hidden"
    }}>
      <p style={{ textAlign: "center", color: "#666", fontSize: "12px", letterSpacing: "2px", marginBottom: "20px", textTransform: "uppercase" }}>
        Trusted Exam Partners
      </p>
      <div style={{ overflow: "hidden" }} className="slider-wrapper">
        <div className="slider-track">
          {items.map((logo, i) => (
            <div key={i} style={{
              flex: "0 0 auto", width: "120px", height: "80px",
              margin: "0 16px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "8px", gap: "4px"
            }}>
              <img
                src={`/logos/${logo.file}`}
                alt={logo.name}
                loading="lazy"
                style={{ width: "48px", height: "48px", objectFit: "contain" }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
              <span style={{ color: "#aaa", fontSize: "9px", textAlign: "center", lineHeight: 1.2 }}>{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// HERO SECTION
function HeroSection({ setPage }) {
  return (
    <section style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "80px 1rem 60px",
      background: "radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.08) 0%, transparent 60%)",
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
          border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700",
          padding: "6px 16px", borderRadius: "20px", fontSize: "13px",
          marginBottom: "24px", fontWeight: 600
        }}>
          🎯 Odisha's #1 Defence Mock Test Platform
        </div>

        <h1 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 900,
          fontSize: "clamp(2.2rem, 6vw, 4.5rem)",
          lineHeight: 1.05, marginBottom: "20px", color: "#fff"
        }}>
          Crack Your{" "}
          <span style={{
            background: "linear-gradient(135deg, #FFD700, #FF8C00)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
          }}>Dream Exam</span>
          <br />with Smart Practice
        </h1>

        <p style={{ color: "#aaa", fontSize: "clamp(1rem, 2vw, 1.2rem)", lineHeight: 1.7, marginBottom: "36px", maxWidth: "600px", margin: "0 auto 36px" }}>
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
            background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", padding: "14px 32px", borderRadius: "10px",
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
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px", padding: "16px 24px", textAlign: "center"
            }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#FFD700", fontFamily: "'Sora',sans-serif" }}>{n}</div>
              <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// EXAM CARD — live Supabase data with logo
function ExamCard({ exam, setPage, setActiveExam }) {
  const color = exam.color || exam.organizations?.color || "#FFD700";
  const orgName = exam.organizations?.name || exam.org || "";
  const testCount = exam.test_count ?? 0;
  const [imgFailed, setImgFailed] = useState(false);
  const logoFile = LOGOS_CONFIG.find(l => l.name.toLowerCase() === orgName.toLowerCase())?.file || null;
  return (
    <div
      onClick={() => { setActiveExam(exam); setPage("exam-detail"); }}
      style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px", padding: "20px", cursor: "pointer",
        transition: "all 0.2s", position: "relative", overflow: "hidden"
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
          <div style={{ color: "#666", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>{orgName}</div>
          <div style={{ color: "#fff", fontSize: "15px", fontWeight: 700, lineHeight: 1.3 }}>{exam.name}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {exam.has_mock      && <span style={{ background: "rgba(255,255,255,0.06)", color: "#aaa", fontSize: "10px", padding: "3px 8px", borderRadius: "4px" }}>Mock Tests</span>}
        {exam.has_sectional && <span style={{ background: "rgba(255,255,255,0.06)", color: "#aaa", fontSize: "10px", padding: "3px 8px", borderRadius: "4px" }}>Sectional</span>}
        {exam.has_pyq       && <span style={{ background: "rgba(255,255,255,0.06)", color: "#aaa", fontSize: "10px", padding: "3px 8px", borderRadius: "4px" }}>PYQ</span>}
      </div>
      <div style={{ marginTop: "12px", color: "#666", fontSize: "12px" }}>
        {testCount} test{testCount !== 1 ? "s" : ""} available
      </div>
    </div>
  );
}

// EXAMS PAGE — fully dynamic from Supabase
function ExamsPage({ setPage, setActiveExam }) {
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
      <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 900, color: "#fff", marginBottom: "8px" }}>All Exams</h1>
      <p style={{ color: "#666", marginBottom: "32px" }}>Choose your exam and start preparing today</p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "28px" }}>
        {orgs.map(o => (
          <button key={o} onClick={() => setFilter(o)} style={{
            background: filter===o ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
            border: filter===o ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
            color: filter===o ? "#FFD700" : "#888", padding: "7px 16px",
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
          <p>No published exams yet. Check back soon!</p>
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
        background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
        color: "#aaa", padding: "8px 16px", borderRadius: "8px",
        cursor: "pointer", marginBottom: "24px", fontSize: "14px"
      }}>← Back to Exams</button>

      {/* Header */}
      <div style={{
        background: color + "15", border: `1px solid ${color}44`,
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
          <div style={{ color: "#aaa", fontSize: "13px" }}>{orgName}</div>
          <h1 style={{ color: "#fff", fontSize: "clamp(1.3rem,3vw,1.8rem)", fontWeight: 800, margin: 0 }}>{exam.name}</h1>
          {exam.description && <p style={{ color: "#666", fontSize: "13px", margin: "4px 0 0" }}>{exam.description}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "4px" }}>
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
          background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
          borderRadius: "14px", color: "#555"
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>📭</div>
          No {activeTab === "mock" ? "mock tests" : activeTab === "sectional" ? "sectional tests" : "PYQ papers"} published yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {byType[activeTab].map(test => (
            <div key={test.id} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px", padding: "16px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px"
            }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: "15px" }}>{test.name}</div>
                <div style={{ color: "#666", fontSize: "13px", marginTop: "4px" }}>
                  {test.duration_minutes} min • {test.total_marks} Marks • -{test.negative_value} negative
                </div>
                {test.instructions && <div style={{ color: "#555", fontSize: "12px", marginTop: "4px" }}>{test.instructions}</div>}
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
        // Signup — Supabase sends verification email via Resend
        const data = await supabaseAuth("signup", {
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" }
        });
        if (data.error) throw new Error(data.error.message || "Signup failed");
        // Show "check your email" screen
        setVerifyEmail(email);
        setLoading(false);
        return;
      } else {
        // Login
        const data = await supabaseAuth("token?grant_type=password", { email, password });
        if (data.error || data.error_description) throw new Error(data.error_description || data.error?.message || "Login failed");
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
    width: "100%", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.15)", color: "#fff",
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
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px", padding: "40px"
        }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "20px" }}>📧</div>
          <h2 style={{ color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: "1.6rem", marginBottom: "12px" }}>
            Check your email
          </h2>
          <p style={{ color: "#aaa", fontSize: "14px", lineHeight: 1.7, marginBottom: "8px" }}>
            We sent a verification link to
          </p>
          <p style={{ color: "#FFD700", fontWeight: 700, fontSize: "15px", marginBottom: "24px", wordBreak: "break-all" }}>
            {verifyEmail}
          </p>
          <p style={{ color: "#666", fontSize: "13px", lineHeight: 1.7, marginBottom: "28px" }}>
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
              background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
              color: "#aaa", padding: "12px 24px", borderRadius: "10px",
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
      background: "radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.06) 0%, transparent 60%)"
    }}>
      <div style={{
        width: "100%", maxWidth: "420px",
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "20px", padding: "clamp(24px,5vw,40px)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "12px",
            background: "linear-gradient(135deg, #FFD700, #FF6B00)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "22px", fontWeight: 900, color: "#000", margin: "0 auto 12px"
          }}>M</div>
          <h2 style={{ color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 800, margin: 0 }}>
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p style={{ color: "#666", fontSize: "14px", marginTop: "6px" }}>
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
            background: "transparent", border: "none", color: "#666",
            cursor: "pointer", fontSize: "14px", padding: "4px"
          }}>
            {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        <p style={{ color: "#444", fontSize: "12px", textAlign: "center", marginTop: "20px" }}>
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
// DASHBOARD
function DashboardPage({ user, setPage }) {
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
        <h1 style={{ color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: "clamp(1.5rem,4vw,2.2rem)", margin: 0 }}>
          Welcome back 👋
        </h1>
        <p style={{ color: "#666", fontSize: "14px", marginTop: "4px" }}>{user.email}</p>
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
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "14px", padding: "20px"
          }}>
            <div style={{ color: "#666", fontSize: "12px", marginBottom: "8px" }}>{l}</div>
            <div style={{ color: c, fontSize: "1.8rem", fontWeight: 900, fontFamily: "'Sora',sans-serif" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ color: "#aaa", fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>Quick Actions</h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button onClick={() => setPage("exams")} style={{
            background: "linear-gradient(135deg, #FFD700, #FF8C00)",
            border: "none", color: "#000", padding: "12px 24px",
            borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: 700
          }}>Browse Exams →</button>
          <button style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff", padding: "12px 24px", borderRadius: "10px", cursor: "pointer", fontSize: "14px"
          }}>View Results</button>
        </div>
      </div>

      {/* Recent Attempts */}
      <div>
        <h2 style={{ color: "#aaa", fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>Recent Attempts</h2>
        {loading ? (
          <div style={{ color: "#666", padding: "20px 0" }}>Loading...</div>
        ) : attempts.length === 0 ? (
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)",
            borderRadius: "16px", padding: "40px", textAlign: "center"
          }}>
            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📚</div>
            <p style={{ color: "#666" }}>No tests taken yet. Start your first test!</p>
            <button onClick={() => setPage("exams")} style={{
              marginTop: "16px", background: "rgba(255,215,0,0.1)",
              border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700",
              padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontSize: "14px"
            }}>Browse Exams</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {attempts.map((a, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px", padding: "14px 18px",
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px"
              }}>
                <div>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: "14px" }}>{a.tests?.name || "Test"}</div>
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

// SECURE EXAM INTERFACE
function ExamInterface({ setPage, activeTest }) {
  const { user } = useAuth();
  const testName = activeTest?.name || "Mock Test";
  const DURATION = (activeTest?.duration || 10) * 60;

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [submitted, setSubmitted] = useState(false);
  const [warnings, setWarnings] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [score, setScore] = useState(null);
  const timerRef = useRef();

  // Fetch real questions from Supabase
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
          subject: q.subject,
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
    setScore(Math.max(0, s));
    setSubmitted(true);
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

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <div style={{ width: 48, height: 48, border: "4px solid rgba(255,215,0,0.2)", borderTop: "4px solid #FFD700", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color: "#aaa" }}>Loading questions...</p>
    </div>
  );

  if (loadError) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", maxWidth: "500px" }}>
        <div style={{ fontSize: "3rem", marginBottom: "16px" }}>⚠️</div>
        <h2 style={{ color: "#fff", fontWeight: 700, marginBottom: "12px" }}>No Questions Found</h2>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "24px" }}>{loadError}</p>
        <button onClick={() => setPage("exams")} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "12px 28px", borderRadius: "10px", cursor: "pointer", fontWeight: 700 }}>Back to Exams</button>
      </div>
    </div>
  );

  if (submitted && score !== null) {
    const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
    const pct = Math.round(score / totalMarks * 100);
    const correct = questions.filter(q => answers[q.id] === q.correct).length;
    const wrong = questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== q.correct).length;
    const subjects = {};
    questions.forEach(q => {
      const s = q.subject || "General";
      if (!subjects[s]) subjects[s] = { correct: 0, total: 0 };
      subjects[s].total++;
      if (answers[q.id] === q.correct) subjects[s].correct++;
    });
    return (
      <div style={{ minHeight: "100vh", padding: "40px 1rem 60px", maxWidth: "700px", margin: "0 auto" }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: "12px" }}>{pct >= 70 ? "🎉" : pct >= 40 ? "📊" : "💪"}</div>
          <h2 style={{ color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: "2rem", marginBottom: "8px" }}>Test Submitted!</h2>
          <p style={{ color: "#666", marginBottom: "24px" }}>{testName}</p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginBottom: "28px" }}>
            {[[`${score.toFixed(1)}/${totalMarks}`,"Score","#FFD700"],[`${pct}%`,"Percentage","#4ade80"],[`${correct}`,"Correct","#4ade80"],[`${wrong}`,"Wrong","#ff6b6b"],[`${TOTAL-correct-wrong}`,"Skipped","#818cf8"]].map(([v,l,c]) => (
              <div key={l} style={{ background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "14px 20px", minWidth: "80px" }}>
                <div style={{ color: c, fontSize: "1.8rem", fontWeight: 900 }}>{v}</div>
                <div style={{ color: "#666", fontSize: "11px" }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: "10px", padding: "16px", marginBottom: "24px", textAlign: "left" }}>
            <h3 style={{ color: "#FFD700", fontSize: "13px", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Subject Breakdown</h3>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "6px", height: "6px", overflow: "hidden", marginBottom: "12px" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#FFD700,#FF8C00)", transition: "width 1s" }} />
            </div>
            {Object.entries(subjects).map(([s,d]) => (
              <div key={s} style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontSize: "12px", marginBottom: "4px" }}>
                  <span>{s}</span><span style={{ color: "#4ade80" }}>{d.correct}/{d.total}</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "4px", height: "4px" }}>
                  <div style={{ width: `${Math.round(d.correct/d.total*100)}%`, height: "100%", background: "#4ade80", borderRadius: "4px" }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button onClick={() => setPage("exams")} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "12px 24px", borderRadius: "10px", cursor: "pointer", fontSize: "14px" }}>Back to Exams</button>
            <button onClick={() => setPage("dashboard")} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "12px 28px", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: 700 }}>Dashboard →</button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[current];
  return (
    <div style={{ minHeight: "100vh", background: "#080a14", padding: "0", userSelect: "none" }}>
      {showWarning && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, background: "rgba(255,50,50,0.95)", padding: "14px", textAlign: "center", color: "#fff", fontWeight: 700, fontSize: "14px" }}>
          ⚠️ Tab switching detected! Warning {warnings}/3. Auto-submit after 3 warnings.
          <button onClick={() => setShowWarning(false)} style={{ marginLeft: "12px", background: "transparent", border: "1px solid rgba(255,255,255,0.5)", color: "#fff", padding: "4px 10px", borderRadius: "4px", cursor: "pointer" }}>Dismiss</button>
        </div>
      )}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,10,20,0.98)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>{testName}</div>
        <div style={{ color: isRed ? "#ff4444" : "#4ade80", fontFamily: "monospace", fontSize: "1.4rem", fontWeight: 900, background: isRed ? "rgba(255,68,68,0.1)" : "rgba(74,222,128,0.1)", border: isRed ? "1px solid rgba(255,68,68,0.3)" : "1px solid rgba(74,222,128,0.3)", padding: "6px 16px", borderRadius: "8px" }}>{mm}:{ss}</div>
        <button onClick={handleSubmit} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 700 }}>Submit Test</button>
      </div>
      <div style={{ display: "flex", maxWidth: "1100px", margin: "0 auto", padding: "16px", gap: "16px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#666", fontSize: "12px", marginBottom: "8px" }}>Question {current + 1} of {TOTAL}</div>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "24px", marginBottom: "16px" }}>
            <p style={{ color: "#fff", fontSize: "clamp(15px,2.5vw,18px)", lineHeight: 1.7, margin: 0 }}>{q.text}</p>
            <div style={{ fontSize: "11px", color: "#555", marginTop: "8px" }}>+{q.marks} marks | -{q.negative} negative • {q.subject}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
            {q.options.map((opt, idx) => {
              const selected = answers[q.id] === idx;
              return (
                <button key={idx} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: idx }))} style={{
                  background: selected ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.04)",
                  border: selected ? "1px solid rgba(255,215,0,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  color: selected ? "#FFD700" : "#ddd", padding: "14px 18px", borderRadius: "10px",
                  cursor: "pointer", textAlign: "left", fontSize: "15px", transition: "all 0.15s",
                  display: "flex", alignItems: "center", gap: "12px"
                }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: selected ? "#FFD700" : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: selected ? "#000" : "#666", fontSize: "12px", fontWeight: 700 }}>
                    {["A","B","C","D"][idx]}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
            <button onClick={() => setCurrent(c => Math.max(0, c-1))} disabled={current===0} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: current===0?"#444":"#fff", padding: "12px 24px", borderRadius: "8px", cursor: current===0?"not-allowed":"pointer", fontSize: "14px" }}>← Prev</button>
            <button onClick={() => setAnswers(prev => { const n={...prev}; delete n[q.id]; return n; })} style={{ background: "transparent", border: "1px solid rgba(255,50,50,0.3)", color: "#ff6b6b", padding: "12px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}>Clear</button>
            <button onClick={() => setCurrent(c => Math.min(TOTAL-1, c+1))} disabled={current===TOTAL-1} style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)", border: "none", color: "#000", padding: "12px 24px", borderRadius: "8px", cursor: current===TOTAL-1?"not-allowed":"pointer", fontSize: "14px", fontWeight: 700 }}>Next →</button>
          </div>
        </div>
        <div style={{ width: "220px", flexShrink: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px", alignSelf: "flex-start", position: "sticky", top: "80px" }} className="question-grid-sidebar">
          <div style={{ color: "#aaa", fontSize: "12px", marginBottom: "12px", fontWeight: 600 }}>Question Palette</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
            {questions.map((qq, i) => {
              const isAnswered = answers[qq.id] !== undefined;
              const isCurrent = i === current;
              return (
                <button key={i} onClick={() => setCurrent(i)} style={{
                  width: "32px", height: "32px", borderRadius: "6px",
                  background: isAnswered ? "rgba(74,222,128,0.2)" : isCurrent ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.06)",
                  border: isAnswered ? "1px solid rgba(74,222,128,0.4)" : isCurrent ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.1)",
                  color: isAnswered ? "#4ade80" : isCurrent ? "#FFD700" : "#666",
                  cursor: "pointer", fontSize: "11px", fontWeight: 600
                }}>{i+1}</button>
              );
            })}
          </div>
          <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", color: "#555" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: 10, height: 10, borderRadius: "2px", background: "rgba(74,222,128,0.3)" }} />Answered ({Object.keys(answers).length})</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: 10, height: 10, borderRadius: "2px", background: "rgba(255,255,255,0.06)" }} />Remaining ({TOTAL - Object.keys(answers).length})</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// PRICING PAGE
function PricingPage({ setPage }) {
  const plans = [
    { name: "Free", price: 0, period: "forever", features: ["3 free mock tests per exam","Basic performance stats","Question review","Mobile app access"], cta: "Get Started", highlight: false },
    { name: "Pro", price: 299, period: "month", features: ["Unlimited mock tests","Sectional tests","PYQ papers","Advanced analytics","Live leaderboard","Priority support","Offline download"], cta: "Start Pro", highlight: true },
    { name: "Annual", price: 1999, period: "year", features: ["Everything in Pro","All future exams included","Personalized study plan","Doubt solving","Performance reports","Save ₹1,589 vs monthly"], cta: "Best Value", highlight: false },
  ];
  return (
    <div style={{ padding: "80px 1rem 60px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <h1 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: "clamp(2rem,5vw,3rem)", color: "#fff" }}>
          Simple, Transparent Pricing
        </h1>
        <p style={{ color: "#666", fontSize: "16px", marginTop: "8px" }}>No hidden charges. Cancel anytime.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
        {plans.map(plan => (
          <div key={plan.name} style={{
            background: plan.highlight ? "rgba(255,215,0,0.06)" : "rgba(255,255,255,0.03)",
            border: plan.highlight ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: "20px", padding: "32px", position: "relative",
            boxShadow: plan.highlight ? "0 0 40px rgba(255,215,0,0.08)" : "none"
          }}>
            {plan.highlight && (
              <div style={{
                position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                background: "linear-gradient(135deg, #FFD700, #FF8C00)",
                color: "#000", padding: "4px 16px", borderRadius: "20px",
                fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap"
              }}>Most Popular</div>
            )}
            <h3 style={{ color: plan.highlight ? "#FFD700" : "#fff", fontSize: "1.3rem", fontWeight: 800, margin: "0 0 8px" }}>{plan.name}</h3>
            <div style={{ marginBottom: "20px" }}>
              <span style={{ color: "#fff", fontSize: "2.8rem", fontWeight: 900, fontFamily: "'Sora',sans-serif" }}>
                {plan.price === 0 ? "Free" : `₹${plan.price}`}
              </span>
              {plan.price > 0 && <span style={{ color: "#666", fontSize: "14px" }}>/{plan.period}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "28px" }}>
              {plan.features.map(f => (
                <div key={f} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ color: "#4ade80", flexShrink: 0 }}>✓</span>
                  <span style={{ color: "#aaa", fontSize: "14px" }}>{f}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setPage("auth")} style={{
              width: "100%",
              background: plan.highlight ? "linear-gradient(135deg, #FFD700, #FF8C00)" : "rgba(255,255,255,0.08)",
              border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.15)",
              color: plan.highlight ? "#000" : "#fff",
              padding: "14px", borderRadius: "10px", cursor: "pointer",
              fontSize: "15px", fontWeight: 700
            }}>{plan.cta}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ADMIN PANEL
function AdminPanel({ user }) {
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
        background: "rgba(255,50,50,0.05)", borderRight: "1px solid rgba(255,50,50,0.15)",
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
            <h1 style={{ color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 800, marginBottom: "24px" }}>Dashboard Overview</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "16px" }}>
              {[["Total Users","—","#818cf8"],["Total Tests","—","#4ade80"],["Attempts","—","#FFD700"],["Questions","—","#fb923c"]].map(([l,v,c]) => (
                <div key={l} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"12px", padding:"20px" }}>
                  <div style={{color:"#555",fontSize:"12px",marginBottom:"8px"}}>{l}</div>
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

        {(activeSection === "exams" || activeSection === "users") && (
          <div>
            <h1 style={{ color: "#fff", fontFamily: "'Sora',sans-serif", fontWeight: 800, marginBottom: "16px", textTransform: "capitalize" }}>{activeSection}</h1>
            <p style={{ color: "#666" }}>Connect to Supabase to manage {activeSection}. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// FEATURES SECTION
function FeaturesSection() {
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
        <h2 style={{ fontFamily: "'Sora',sans-serif", fontWeight: 900, fontSize: "clamp(1.8rem,4vw,2.8rem)", color: "#fff" }}>
          Everything You Need to Succeed
        </h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
        {features.map(f => (
          <div key={f.title} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "16px", padding: "24px"
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>{f.icon}</div>
            <h3 style={{ color: "#fff", fontWeight: 700, marginBottom: "8px", fontSize: "16px" }}>{f.title}</h3>
            <p style={{ color: "#666", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// FOOTER
function Footer({ setPage }) {
  return (
    <footer style={{
      borderTop: "1px solid rgba(255,255,255,0.07)",
      padding: "48px 1rem",
      background: "rgba(0,0,0,0.3)"
    }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "32px", marginBottom: "32px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "8px", background: "linear-gradient(135deg,#FFD700,#FF6B00)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "14px", color: "#000" }}>M</div>
              <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, color: "#FFD700" }}>MeritMatrix</span>
            </div>
            <p style={{ color: "#555", fontSize: "13px", lineHeight: 1.6 }}>Odisha's premier mock test platform for defence & government exams.</p>
          </div>
          {[
            ["Exams", ["Odisha Police","Indian Army","Agniveer","SSC GD"]],
            ["Platform", ["How It Works","Pricing","Dashboard"]],
            ["Company", ["About","Contact","Privacy Policy","Terms"]],
          ].map(([title, links]) => (
            <div key={title}>
              <div style={{ color: "#aaa", fontSize: "12px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>{title}</div>
              {links.map(l => (
                <div key={l} style={{ color: "#555", fontSize: "13px", marginBottom: "8px", cursor: "pointer" }}
                  onMouseEnter={e => e.target.style.color="#aaa"}
                  onMouseLeave={e => e.target.style.color="#555"}
                >{l}</div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <span style={{ color: "#444", fontSize: "13px" }}>© 2024 MeritMatrix. All rights reserved.</span>
          <span style={{ color: "#444", fontSize: "13px" }}>Built for Odisha's aspirants 🇮🇳</span>
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

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { background: #080a14; color: #fff; font-family: system-ui, -apple-system, sans-serif; overflow-x: hidden; }
        button { font-family: inherit; }
        input, textarea { font-family: inherit; }
        input::placeholder { color: #444; }
        textarea::placeholder { color: #444; }
        input:focus, textarea:focus { border-color: rgba(255,215,0,0.4) !important; }

        /* Slider CSS */
        @keyframes slide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .slider-track { display: flex; animation: slide 30s linear infinite; width: max-content; }
        .slider-wrapper:hover .slider-track { animation-play-state: paused; }

        /* Responsive */
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
          .question-grid-sidebar { display: none !important; }
          .admin-sidebar { display: none; }
        }
        @media (max-width: 480px) {
          .mobile-menu { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-menu { display: none !important; }
        }
      `}</style>

      {showNav && (
        <Navbar page={page} setPage={setPage} user={user} onLogout={handleLogout} />
      )}

      <main>
        {page === "home"           && <HomePage setPage={setPage} setActiveExam={setActiveExam} />}
        {page === "exams"          && <ExamsPage setPage={setPage} setActiveExam={setActiveExam} />}
        {page === "exam-detail"    && activeExam && <ExamDetailPage exam={activeExam} setPage={setPage} setActiveTest={setActiveTest} user={user} />}
        {page === "auth"           && <AuthPage setPage={setPage} onLogin={handleLogin} />}
        {page === "dashboard"      && <DashboardPage user={user} setPage={setPage} />}
        {page === "exam-interface" && <ExamInterface setPage={setPage} activeTest={activeTest} />}
        {page === "pricing"        && <PricingPage setPage={setPage} />}
        {page === "admin"          && <AdminPanel user={user} />}
      </main>

      {showFooter && <Footer setPage={setPage} />}
    </AuthContext.Provider>
  );
}
