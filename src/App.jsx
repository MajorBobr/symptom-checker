import { useState, useRef, useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { supabase } from "./supabase.js";

const DAILY_LIMIT = 3;
const STRIPE_LINK = "https://buy.stripe.com/3cI28t8UB0cz9GR3x8cMM00";
const ACCENT = "#732553";
const TAN = "#E9D8C8";
const DARK = "#142030";

const severityConfig = {
  low: { color: "#16a34a", label: "Low Severity", icon: "✓" },
  medium: { color: "#d97706", label: "Medium Severity", icon: "⚠" },
  high: { color: "#dc2626", label: "High Severity", icon: "!" },
};

const features = [
  { icon: "🧠", title: "AI Symptom Analysis", desc: "Describe your symptoms in plain text and get instant AI-powered guidance based on clinical knowledge.", free: true },
  { icon: "⚡", title: "Urgency Guidance", desc: "Know exactly whether to go to the ER, see a doctor soon, or rest at home.", free: true },
  { icon: "📋", title: "Full Symptom History", desc: "Every assessment is saved. Track patterns over time and share reports with your doctor.", free: false },
  { icon: "🔄", title: "Unlimited Checks", desc: "Free users get 3 checks/day. Premium users get unlimited daily symptom analysis.", free: false },
  { icon: "📊", title: "Severity Tracking", desc: "Monitor how your symptoms change over time with detailed severity assessments.", free: false },
  { icon: "🔒", title: "Ad-Free Experience", desc: "Premium users enjoy a completely ad-free, distraction-free health assistant.", free: false },
];

function getUsageData() {
  const today = new Date().toDateString();
  const raw = localStorage.getItem("symptom_usage");
  if (!raw) return { date: today, count: 0 };
  const data = JSON.parse(raw);
  if (data.date !== today) return { date: today, count: 0 };
  return data;
}

function saveUsage(count) {
  const today = new Date().toDateString();
  localStorage.setItem("symptom_usage", JSON.stringify({ date: today, count }));
}

export default function App() {
  const [symptoms, setSymptoms] = useState("");
  const [age, setAge] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usageCount, setUsageCount] = useState(0);
  const [email, setEmail] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [page, setPage] = useState("home"); // home | app
  const resultRef = useRef(null);
  const appRef = useRef(null);

  useEffect(() => {
    const data = getUsageData();
    setUsageCount(data.count);
    const savedEmail = localStorage.getItem("user_email");
    const savedDark = localStorage.getItem("dark_mode") === "true";
    setDarkMode(savedDark);
    if (savedEmail) { setEmail(savedEmail); setEmailSubmitted(true); checkPremium(savedEmail); }
  }, []);

  useEffect(() => {
    if (result && resultRef.current) resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  function toggleDark() { const n = !darkMode; setDarkMode(n); localStorage.setItem("dark_mode", n); }

  async function checkPremium(userEmail) {
    try {
      const { data } = await supabase.from("premium_users").select("email").eq("email", userEmail.trim()).single();
      setIsPremium(!!data);
      if (data) loadHistory(userEmail.trim());
    } catch { setIsPremium(false); }
  }

  async function loadHistory(userEmail) {
    try {
      const { data } = await supabase.from("symptom_history").select("*").eq("email", userEmail).order("created_at", { ascending: false }).limit(10);
      if (data) setHistory(data);
    } catch {}
  }

  async function saveToHistory(userEmail, s, r) {
    try { await supabase.from("symptom_history").insert({ email: userEmail, symptoms: s, result: r }); loadHistory(userEmail); } catch {}
  }

  async function handleEmailSubmit() {
    if (!email.trim()) return;
    localStorage.setItem("user_email", email.trim());
    setEmailSubmitted(true);
    await checkPremium(email.trim());
  }

  async function analyze() {
    if (!symptoms.trim()) return;
    const usage = getUsageData();
    if (!isPremium && usage.count >= DAILY_LIMIT) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const prompt = `You are a helpful medical information assistant. A user reports the following symptoms${age ? ` (age: ${age})` : ""}:\n\n"${symptoms}"\n\nPlease provide:\n## Possible Causes\nList 2-3 most likely conditions briefly.\n\n## Severity Assessment\nState clearly: Low Severity / Medium Severity / High Severity and why.\n\n## Recommended Action\nWhat should they do?\n\n## When to Seek Immediate Help\nList warning signs that would require emergency care.\n\nBe concise, clear, and compassionate. Do not diagnose only inform.`;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] })
      });
      const data = await response.json();
      const text = data?.content?.[0]?.text;
      if (!text) throw new Error("No response");
      if (!isPremium) { const n = usage.count + 1; saveUsage(n); setUsageCount(n); }
      else saveToHistory(email.trim(), symptoms, text);
      setResult(text);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  const lines = result ? result.split("\n").filter(Boolean) : [];
  const lower = (result || "").toLowerCase();
  let severity = "medium";
  if (lower.includes("high severity") || lower.includes("emergency") || lower.includes("immediately")) severity = "high";
  else if (lower.includes("low severity") || lower.includes("mild")) severity = "low";
  const cfg = severityConfig[severity];
  const remaining = DAILY_LIMIT - usageCount;

  const d = darkMode;
  const bg = d ? DARK : TAN;
  const card = d ? "#1E3442" : "#f5ede3";
  const cardBorder = d ? "#2d4a5e" : "#d4b896";
  const textMain = d ? TAN : "#2a1520";
  const textMuted = d ? "#85A3B2" : "#6b4a5a";
  const inputBg = d ? DARK : "#ede0d0";
  const inputBorder = d ? "#2d4a5e" : "#c4a882";

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Inter', 'Segoe UI', sans-serif", transition: "background 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea:focus, input:focus { outline: none; }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* NAV */}
      <nav style={{ background: d ? "#1E3442" : "#fff", borderBottom: `1px solid ${cardBorder}`, padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setPage("home")}>
          <div style={{ width: 34, height: 34, background: ACCENT, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚕️</div>
          <span style={{ color: textMain, fontWeight: 800, fontSize: 18, letterSpacing: -0.5 }}>SymptomAI</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <a href="#features" style={{ color: textMuted, fontSize: 14, textDecoration: "none", fontWeight: 500 }}>Features</a>
          <a href="#pricing" style={{ color: textMuted, fontSize: 14, textDecoration: "none", fontWeight: 500 }}>Pricing</a>
          <button onClick={toggleDark} style={{ background: "transparent", border: `1px solid ${cardBorder}`, borderRadius: 20, padding: "5px 12px", color: textMain, cursor: "pointer", fontSize: 14 }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
          {isPremium && (
            <button onClick={() => setShowHistory(!showHistory)} style={{ background: `${ACCENT}20`, border: `1px solid ${ACCENT}40`, borderRadius: 20, padding: "5px 14px", color: ACCENT, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600 }}>
              📋 History
            </button>
          )}
          {isPremium ? (
            <div style={{ background: ACCENT, borderRadius: 20, padding: "6px 16px" }}>
              <span style={{ color: TAN, fontSize: 13, fontWeight: 800 }}>⭐ Premium</span>
            </div>
          ) : (
            <a href="#pricing" style={{ background: ACCENT, color: TAN, fontWeight: 700, fontSize: 13, padding: "8px 20px", borderRadius: 20, textDecoration: "none" }}>Get Started</a>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: "80px 40px", width: "100%", display: "flex", alignItems: "center", gap: 60 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`, borderRadius: 20, padding: "6px 14px", marginBottom: 24 }}>
            <span style={{ width: 8, height: 8, background: ACCENT, borderRadius: "50%", display: "inline-block" }}></span>
            <span style={{ color: ACCENT, fontSize: 13, fontWeight: 600 }}>AI-powered health guidance</span>
          </div>
          <h1 style={{ color: textMain, fontSize: 52, fontWeight: 800, lineHeight: 1.15, marginBottom: 20, letterSpacing: -1.5 }}>
           Your symptoms,<br />analyzed instantly. <span style={{ color: ACCENT }}>Stop guessing,<br />start knowing.</span>
          <p style={{ color: textMuted, fontSize: 16, lineHeight: 1.8, marginBottom: 36, maxWidth: 480 }}>
            SymptomAI analyzes your symptoms, tracks your history, and helps you decide when to see a clinician — based on clinical knowledge. Educational only, never a substitute for professional care.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="#checker" style={{ background: ACCENT, color: TAN, fontWeight: 700, fontSize: 15, padding: "14px 32px", borderRadius: 12, textDecoration: "none" }}>
              Check Symptoms Free →
            </a>
            <a href="#pricing" style={{ background: "transparent", color: textMain, fontWeight: 600, fontSize: 15, padding: "14px 32px", borderRadius: 12, textDecoration: "none", border: `1.5px solid ${cardBorder}` }}>
              View Pricing
            </a>
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 32 }}>
            {[["3", "free checks/day"], ["∞", "for Premium"], ["100%", "AI-powered"]].map(([val, label]) => (
              <div key={label}>
                <div style={{ color: ACCENT, fontWeight: 800, fontSize: 22 }}>{val}</div>
                <div style={{ color: textMuted, fontSize: 12 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 340, height: 340, background: `radial-gradient(circle, ${ACCENT}30, transparent 70%)`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 120 }}>
            🩺
          </div>
        </div>
      </section>

      {/* CHECKER */}
      <section id="checker" style={{ maxWidth: 800, margin: "0 auto", padding: "0 32px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ color: textMain, fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Check Your Symptoms</h2>
          <p style={{ color: textMuted, fontSize: 15 }}>Free to use · No account required · Instant AI analysis</p>
        </div>

        {showHistory && isPremium && (
          <div style={{ background: card, borderRadius: 20, border: `1px solid ${cardBorder}`, padding: 28, marginBottom: 20 }}>
            <h3 style={{ color: textMain, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📋 Your History</h3>
            {history.length === 0 ? <p style={{ color: textMuted, fontSize: 14 }}>No history yet.</p> :
              history.map((item, i) => (
                <div key={i} style={{ borderBottom: `1px solid ${cardBorder}`, paddingBottom: 12, marginBottom: 12 }}>
                  <p style={{ color: textMuted, fontSize: 11, marginBottom: 4 }}>{new Date(item.created_at).toLocaleDateString()}</p>
                  <p style={{ color: textMain, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{item.symptoms.substring(0, 80)}...</p>
                  <p style={{ color: textMuted, fontSize: 13 }}>{item.result.substring(0, 120)}...</p>
                </div>
              ))}
          </div>
        )}

        {!emailSubmitted ? (
          <div style={{ background: card, borderRadius: 20, border: `1px solid ${cardBorder}`, padding: 32 }}>
            <h2 style={{ color: textMain, fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Enter your email</h2>
            <p style={{ color: textMuted, fontSize: 14, marginBottom: 24 }}>Used to check premium status and save your history.</p>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" type="email"
              style={{ width: "100%", background: inputBg, border: `1.5px solid ${inputBorder}`, borderRadius: 12, color: textMain, fontSize: 15, fontFamily: "inherit", padding: "13px 16px", marginBottom: 16 }} />
            <button onClick={handleEmailSubmit} disabled={!email.trim()}
              style={{ width: "100%", padding: 15, background: email.trim() ? ACCENT : inputBorder, color: email.trim() ? TAN : textMuted, border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: email.trim() ? "pointer" : "not-allowed" }}>
              Continue →
            </button>
          </div>
        ) : !result && !loading ? (
          <div style={{ background: card, borderRadius: 20, border: `1px solid ${cardBorder}`, padding: 32 }}>
            {isPremium && (
              <div style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}40`, borderRadius: 12, padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <span>⭐</span><span style={{ color: ACCENT, fontSize: 13, fontWeight: 700 }}>Premium active – Unlimited checks + History saved</span>
              </div>
            )}
            {!isPremium && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                <div style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`, borderRadius: 20, padding: "4px 12px" }}>
                  <span style={{ color: ACCENT, fontSize: 12, fontWeight: 700 }}>{remaining}/{DAILY_LIMIT} free checks left today</span>
                </div>
              </div>
            )}
            <label style={{ color: textMain, fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Your Symptoms</label>
            <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)}
              placeholder="e.g. I have had a persistent headache for 2 days, along with a sore throat and mild fever..." rows={5}
              style={{ width: "100%", background: inputBg, border: `1.5px solid ${inputBorder}`, borderRadius: 12, color: textMain, fontSize: 15, lineHeight: 1.7, resize: "none", fontFamily: "inherit", padding: "13px 16px", marginBottom: 20 }} />
            <label style={{ color: textMain, fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Age <span style={{ color: textMuted, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
            <input value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 34"
              style={{ width: "100%", background: inputBg, border: `1.5px solid ${inputBorder}`, borderRadius: 12, color: textMain, fontSize: 15, fontFamily: "inherit", padding: "13px 16px", marginBottom: 24 }} />
            {!isPremium && remaining === 0 ? (
              <div style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}30`, borderRadius: 16, padding: 24, textAlign: "center" }}>
                <p style={{ color: ACCENT, fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Daily limit reached</p>
                <p style={{ color: textMuted, fontSize: 14, marginBottom: 20 }}>Upgrade to Premium for unlimited access!</p>
                <a href="#pricing" style={{ display: "block", background: ACCENT, color: TAN, fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 12, textDecoration: "none", marginBottom: 10 }}>
                  ⭐ View Premium Plans
                </a>
                <p style={{ color: textMuted, fontSize: 12 }}>Or come back tomorrow for 3 more free checks</p>
              </div>
            ) : (
              <button onClick={analyze} disabled={!symptoms.trim()}
                style={{ width: "100%", padding: 16, background: symptoms.trim() ? ACCENT : inputBorder, color: symptoms.trim() ? TAN : textMuted, border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, fontFamily: "inherit", cursor: symptoms.trim() ? "pointer" : "not-allowed" }}>
                Analyze Symptoms →
              </button>
            )}
            <p style={{ color: textMuted, fontSize: 11, textAlign: "center", marginTop: 14 }}>🔒 Not a diagnosis. Always consult a healthcare professional.</p>
          </div>
        ) : null}

        {loading && (
          <div style={{ background: card, borderRadius: 20, border: `1px solid ${cardBorder}`, padding: 56, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, border: `3px solid ${inputBorder}`, borderTop: `3px solid ${ACCENT}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ color: textMuted, fontSize: 14 }}>Analyzing your symptoms...</p>
          </div>
        )}

        {error && !result && (
          <div style={{ background: card, borderRadius: 20, border: `1px solid ${cardBorder}`, padding: 28, textAlign: "center" }}>
            <p style={{ color: "#dc2626", fontWeight: 600, marginBottom: 12 }}>Something went wrong</p>
            <button onClick={() => setError(null)} style={{ background: ACCENT, color: TAN, border: "none", borderRadius: 10, padding: "10px 24px", fontFamily: "inherit", cursor: "pointer", fontWeight: 700 }}>Try Again</button>
          </div>
        )}

        {result && (
          <div ref={resultRef} style={{ animation: "fadeUp 0.4s ease" }}>
            <div style={{ background: `${cfg.color}20`, border: `1.5px solid ${cfg.color}50`, borderRadius: 14, padding: "14px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ background: cfg.color, color: "#fff", fontWeight: 800, width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{cfg.icon}</span>
              <span style={{ color: cfg.color, fontWeight: 700, fontSize: 15 }}>{cfg.label}</span>
            </div>
            <div style={{ background: card, borderRadius: 20, border: `1px solid ${cardBorder}`, padding: 32, marginBottom: 16 }}>
              {lines.map((line, i) => {
                const isHeader = line.startsWith("##") || (line.endsWith(":") && line.length < 40);
                const clean = line.replace(/^#+\s*/, "").replace(/\*\*/g, "");
                return <p key={i} style={{ color: isHeader ? ACCENT : textMain, fontSize: isHeader ? 11 : 15, fontWeight: isHeader ? 800 : 400, letterSpacing: isHeader ? 2 : 0, textTransform: isHeader ? "uppercase" : "none", marginBottom: isHeader ? 8 : 10, marginTop: isHeader && i > 0 ? 24 : 0, lineHeight: 1.7, borderLeft: isHeader ? `3px solid ${ACCENT}` : "none", paddingLeft: isHeader ? 12 : 0 }}>{clean}</p>;
              })}
            </div>
            <div style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}30`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <p style={{ color: textMuted, fontSize: 12, lineHeight: 1.6 }}>⚕️ AI-generated. Not medical advice. Always consult a healthcare professional.</p>
            </div>
            {!isPremium && (
              <a href="#pricing" style={{ display: "block", background: ACCENT, color: TAN, fontWeight: 700, fontSize: 14, padding: 15, borderRadius: 12, textAlign: "center", textDecoration: "none", marginBottom: 12 }}>
                ⭐ Upgrade to Premium – Unlimited + History
              </a>
            )}
            <button onClick={() => { setResult(null); setSymptoms(""); setAge(""); }}
              style={{ width: "100%", padding: 14, background: "transparent", color: ACCENT, border: `1.5px solid ${ACCENT}50`, borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              ← New Symptom Check
            </button>
          </div>
        )}
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "80px 40px", background: d ? "#1a2d3d" : "#ede0d0" }}>
        <div style={{ width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ color: textMain, fontSize: 36, fontWeight: 800, marginBottom: 12 }}>Everything you need</h2>
            <p style={{ color: textMuted, fontSize: 16 }}>Smart health guidance, not random internet advice</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {features.map((f, i) => (
              <div key={i} style={{ background: card, borderRadius: 16, border: `1px solid ${cardBorder}`, padding: 28, position: "relative" }}>
                {!f.free && (
                  <div style={{ position: "absolute", top: 16, right: 16, background: ACCENT, color: TAN, fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20, letterSpacing: 1 }}>PRO</div>
                )}
                <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ color: textMain, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: textMuted, fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "80px 40px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ color: textMain, fontSize: 36, fontWeight: 800, marginBottom: 12 }}>Simple pricing</h2>
            <p style={{ color: textMuted, fontSize: 16 }}>Start free, upgrade when you need more</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Free */}
            <div style={{ background: card, borderRadius: 20, border: `1px solid ${cardBorder}`, padding: 36 }}>
              <div style={{ display: "inline-block", background: `${ACCENT}15`, color: ACCENT, fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 20, marginBottom: 20, letterSpacing: 1 }}>YOUR PLAN</div>
              <h3 style={{ color: textMain, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Standard</h3>
              <p style={{ color: textMuted, fontSize: 14, marginBottom: 20 }}>Core symptom guidance</p>
              <div style={{ color: textMain, fontSize: 48, fontWeight: 800, marginBottom: 28 }}>Free</div>
              {["3 free checks per day", "AI symptom analysis", "Urgency level indicator", "Severity assessment"].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ color: "#16a34a", fontWeight: 700 }}>✓</span>
                  <span style={{ color: textMain, fontSize: 14 }}>{item}</span>
                </div>
              ))}
            </div>
            {/* Premium */}
            <div style={{ background: ACCENT, borderRadius: 20, padding: 36, position: "relative" }}>
              <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "#fbbf24", color: "#000", fontSize: 11, fontWeight: 800, padding: "4px 16px", borderRadius: 20, letterSpacing: 1, whiteSpace: "nowrap" }}>MOST POPULAR</div>
              <h3 style={{ color: TAN, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Premium</h3>
              <p style={{ color: `${TAN}80`, fontSize: 14, marginBottom: 20 }}>Unlimited access + history</p>
              <div style={{ marginBottom: 28 }}>
                <span style={{ color: TAN, fontSize: 48, fontWeight: 800 }}>€4</span>
                <span style={{ color: `${TAN}80`, fontSize: 16 }}>/month</span>
              </div>
              {["Everything in Free", "Unlimited daily checks", "Full symptom history", "Severity tracking", "Ad-free experience", "Priority support"].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ color: TAN, fontWeight: 700 }}>✓</span>
                  <span style={{ color: TAN, fontSize: 14 }}>{item}</span>
                </div>
              ))}
              <a href={STRIPE_LINK} target="_blank" style={{ display: "block", background: TAN, color: ACCENT, fontWeight: 800, fontSize: 15, padding: 16, borderRadius: 12, textAlign: "center", textDecoration: "none", marginTop: 28 }}>
                Subscribe to Premium →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: d ? "#1E3442" : "#ede0d0", borderTop: `1px solid ${cardBorder}`, padding: "32px 40px", textAlign: "center" }}>
        <p style={{ color: textMuted, fontSize: 13 }}>© 2025 SymptomAI · Not a medical device · Always consult a healthcare professional</p>
      </footer>

      <Analytics />
    </div>
  );
}