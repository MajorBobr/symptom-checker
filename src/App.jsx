import { useState, useRef, useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";

const DAILY_LIMIT = 6;
const const STRIPE_LINK = "https://buy.stripe.com/3cI28t8UB0cz9GR3x8cMM00";

const severityConfig = {
  low: { color: "#10b981", label: "Low Severity", icon: "✓", bg: "#10b98120" },
  medium: { color: "#f59e0b", label: "Medium Severity", icon: "⚠", bg: "#f59e0b20" },
  high: { color: "#ef4444", label: "High Severity", icon: "!", bg: "#ef444420" },
};

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
  const resultRef = useRef(null);

  useEffect(() => {
    const data = getUsageData();
    setUsageCount(data.count);
  }, []);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  async function analyze() {
    if (!symptoms.trim()) return;
    const usage = getUsageData();
    if (usage.count >= DAILY_LIMIT) {
      setError(`You've used all ${DAILY_LIMIT} free checks for today.`);
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const prompt = `You are a helpful medical information assistant. A user reports the following symptoms${age ? ` (age: ${age})` : ""}:\n\n"${symptoms}"\n\nPlease provide:\n## Possible Causes\nList 2-3 most likely conditions briefly.\n\n## Severity Assessment\nState clearly: Low Severity / Medium Severity / High Severity and why.\n\n## Recommended Action\nWhat should they do?\n\n## When to Seek Immediate Help\nList warning signs that would require emergency care.\n\nBe concise, clear, and compassionate. Do not diagnose only inform.`;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await response.json();
      const text = data?.content?.[0]?.text;
      if (!text) throw new Error("No response");
      const newCount = usage.count + 1;
      saveUsage(newCount);
      setUsageCount(newCount);
      setResult(text);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const lines = result ? result.split("\n").filter(Boolean) : [];
  const lower = (result || "").toLowerCase();
  let severity = "medium";
  if (lower.includes("high severity") || lower.includes("emergency") || lower.includes("immediately")) severity = "high";
  else if (lower.includes("low severity") || lower.includes("mild")) severity = "low";
  const cfg = severityConfig[severity];
  const remaining = DAILY_LIMIT - usageCount;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", fontFamily: "'DM Sans', sans-serif", paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Syne:wght@700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea:focus, input:focus { outline: none; }
        textarea::placeholder, input::placeholder { color: #334155; }
      `}</style>

      <div style={{ borderBottom: "1px solid #1e293b", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1424", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #06b6d4, #0e7490)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚕</div>
          <div>
            <div style={{ color: "#f1f5f9", fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 16 }}>SymptomAI</div>
            <div style={{ color: "#64748b", fontSize: 11, letterSpacing: 1 }}>AI HEALTH CHECKER</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: remaining <= 2 ? "#ef444420" : "#06b6d420", border: `1px solid ${remaining <= 2 ? "#ef4444" : "#06b6d4"}40`, borderRadius: 20, padding: "6px 14px" }}>
            <span style={{ color: remaining <= 2 ? "#ef4444" : "#06b6d4", fontSize: 12, fontWeight: 700 }}>{remaining}/{DAILY_LIMIT} left</span>
          </div>
          <a href={STRIPE_LINK} target="_blank" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700, fontSize: 12, padding: "6px 14px", borderRadius: 20, textDecoration: "none" }}>⭐ Premium</a>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px 0" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 32, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.2, marginBottom: 10 }}>
            What are you<br /><span style={{ color: "#06b6d4" }}>feeling today?</span>
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>Describe your symptoms and get instant AI-powered guidance.</p>
        </div>

        {!result && !loading && (
          <div>
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <label style={{ color: "#64748b", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 10 }}>Your Symptoms</label>
              <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="e.g. I have a headache, sore throat, and mild fever since yesterday..." rows={5} style={{ width: "100%", background: "transparent", border: "none", color: "#f1f5f9", fontSize: 15, lineHeight: 1.7, resize: "none", fontFamily: "inherit" }} />
            </div>
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 16, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "#64748b", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", whiteSpace: "nowrap" }}>Age (opt.)</span>
              <input value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 28" style={{ background: "transparent", border: "none", color: "#f1f5f9", fontSize: 15, fontFamily: "inherit", flex: 1 }} />
            </div>
            {remaining === 0 ? (
              <div style={{ background: "#111827", border: "1px solid #f59e0b40", borderRadius: 14, padding: 24, textAlign: "center" }}>
                <p style={{ color: "#f59e0b", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Daily limit reached!</p>
                <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>You've used all 6 free checks. Upgrade to Premium for unlimited access!</p>
                <a href={STRIPE_LINK} target="_blank" style={{ display: "block", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700, fontSize: 15, padding: 16, borderRadius: 14, textAlign: "center", textDecoration: "none", marginBottom: 12 }}>
                  ⭐ Upgrade to Premium – €4/month
                </a>
                <p style={{ color: "#334155", fontSize: 12 }}>Or come back tomorrow for 6 more free checks</p>
              </div>
            ) : (
              <button onClick={analyze} disabled={!symptoms.trim()} style={{ width: "100%", padding: 16, background: symptoms.trim() ? "linear-gradient(135deg, #06b6d4, #0e7490)" : "#1e293b", color: symptoms.trim() ? "#000" : "#64748b", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: symptoms.trim() ? "pointer" : "not-allowed" }}>
                Analyze Symptoms →
              </button>
            )}
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "40px 0" }}>
            <div style={{ width: 48, height: 48, border: "3px solid #1e293b", borderTop: "3px solid #06b6d4", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "#64748b", fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>Analyzing symptoms...</p>
          </div>
        )}

        {error && (
          <div style={{ background: "#111827", border: "1px solid #f59e0b40", borderRadius: 14, padding: 24, textAlign: "center" }}>
            <p style={{ color: "#f59e0b", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Daily limit reached!</p>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>Upgrade to Premium for unlimited access!</p>
            <a href={STRIPE_LINK} target="_blank" style={{ display: "block", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700, fontSize: 15, padding: 16, borderRadius: 14, textAlign: "center", textDecoration: "none" }}>
              ⭐ Upgrade to Premium – €4/month
            </a>
          </div>
        )}

        {result && (
          <div ref={resultRef} style={{ animation: "fadeUp 0.4s ease" }}>
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.color}40`, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ background: cfg.color, color: "#000", fontWeight: 800, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{cfg.icon}</span>
                <span style={{ color: cfg.color, fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>{cfg.label.toUpperCase()}</span>
              </div>
              <div style={{ padding: "20px 24px" }}>
                {lines.map((line, i) => {
                  const isHeader = line.startsWith("##") || line.endsWith(":");
                  const clean = line.replace(/^#+\s*/, "").replace(/\*\*/g, "");
                  return <p key={i} style={{ color: isHeader ? "#06b6d4" : "#f1f5f9", fontSize: isHeader ? 13 : 15, fontWeight: isHeader ? 700 : 400, letterSpacing: isHeader ? 1.5 : 0, textTransform: isHeader ? "uppercase" : "none", marginBottom: isHeader ? 6 : 10, marginTop: isHeader && i > 0 ? 18 : 0, lineHeight: 1.7, borderLeft: isHeader ? "2px solid #06b6d4" : "none", paddingLeft: isHeader ? 10 : 0 }}>{clean}</p>;
                })}
              </div>
              <div style={{ margin: "0 24px 20px", padding: "12px 16px", background: "#1e293b60", borderRadius: 10, border: "1px solid #1e293b" }}>
                <p style={{ color: "#64748b", fontSize: 12, margin: 0, lineHeight: 1.6 }}>⚕️ This is AI-generated information only and is not a medical diagnosis. Always consult a qualified healthcare professional.</p>
              </div>
            </div>
            <a href={STRIPE_LINK} target="_blank" style={{ display: "block", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 14, textAlign: "center", textDecoration: "none", marginTop: 12, marginBottom: 12 }}>
              ⭐ Upgrade to Premium – €4/month
            </a>
            <button onClick={() => { setResult(null); setSymptoms(""); setAge(""); }} style={{ width: "100%", padding: 14, background: "transparent", color: "#06b6d4", border: "1px solid #0e7490", borderRadius: 14, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              ← Check New Symptoms
            </button>
          </div>
        )}
      </div>
      <Analytics />
    </div>
  );
}