import { useState, useRef, useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { supabase } from "./supabase.js";

const DAILY_LIMIT = 6;
const STRIPE_LINK = "https://buy.stripe.com/3cI28t8UB0cz9GR3x8cMM00";

const severityConfig = {
  low: { color: "#16a34a", label: "Low Severity", icon: "✓", bg: "#f0fdf4", border: "#bbf7d0" },
  medium: { color: "#d97706", label: "Medium Severity", icon: "⚠", bg: "#fffbeb", border: "#fde68a" },
  high: { color: "#dc2626", label: "High Severity", icon: "!", bg: "#fef2f2", border: "#fecaca" },
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
  const [email, setEmail] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [checkingPremium, setCheckingPremium] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const resultRef = useRef(null);

  useEffect(() => {
    const data = getUsageData();
    setUsageCount(data.count);
    const savedEmail = localStorage.getItem("user_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setEmailSubmitted(true);
      checkPremium(savedEmail);
    }
  }, []);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  async function checkPremium(userEmail) {
    setCheckingPremium(true);
    try {
      const { data } = await supabase
        .from("premium_users")
        .select("email")
        .eq("email", userEmail)
        .single();
      setIsPremium(!!data);
    } catch {
      setIsPremium(false);
    } finally {
      setCheckingPremium(false);
    }
  }

  async function handleEmailSubmit() {
    if (!email.trim()) return;
    localStorage.setItem("user_email", email);
    setEmailSubmitted(true);
    await checkPremium(email);
  }

  async function analyze() {
    if (!symptoms.trim()) return;
    const usage = getUsageData();
    if (!isPremium && usage.count >= DAILY_LIMIT) return;
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
      if (!isPremium) {
        const newCount = usage.count + 1;
        saveUsage(newCount);
        setUsageCount(newCount);
      }
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
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea:focus, input:focus { outline: none; }
        textarea::placeholder, input::placeholder { color: #94a3b8; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#1e40af", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, boxShadow: "0 2px 8px rgba(30,64,175,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, background: "rgba(255,255,255,0.2)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚕️</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>SymptomAI</div>
            <div style={{ color: "#93c5fd", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Medical Assistant</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isPremium ? (
            <div style={{ background: "#fbbf24", borderRadius: 20, padding: "5px 14px" }}>
              <span style={{ color: "#000", fontSize: 12, fontWeight: 700 }}>⭐ Premium</span>
            </div>
          ) : (
            <>
              <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "5px 12px" }}>
                <span style={{ color: remaining <= 2 ? "#fca5a5" : "#bfdbfe", fontSize: 12, fontWeight: 600 }}>{remaining}/{DAILY_LIMIT} free</span>
              </div>
              <a href={STRIPE_LINK} target="_blank" style={{ background: "#fbbf24", color: "#000", fontWeight: 700, fontSize: 12, padding: "6px 14px", borderRadius: 20, textDecoration: "none" }}>⭐ Premium</a>
            </>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #1e40af, #1d4ed8)", padding: "40px 24px 48px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 700, lineHeight: 1.3, marginBottom: 10 }}>
            AI-Powered Symptom Analysis
          </h1>
          <p style={{ color: "#93c5fd", fontSize: 15, lineHeight: 1.6 }}>
            Describe your symptoms and receive instant guidance from our medical AI assistant.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "-24px auto 0", padding: "0 20px 60px" }}>

        {/* Email check */}
        {!emailSubmitted && (
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: 28, animation: "fadeUp 0.3s ease" }}>
            <h2 style={{ color: "#1e293b", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Enter your email to continue</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>We use your email to check your premium status.</p>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              type="email"
              style={{ width: "100%", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, color: "#1e293b", fontSize: 15, fontFamily: "inherit", padding: "11px 14px", marginBottom: 16 }}
            />
            <button onClick={handleEmailSubmit} disabled={!email.trim()} style={{ width: "100%", padding: 14, background: email.trim() ? "#1e40af" : "#e2e8f0", color: email.trim() ? "#fff" : "#94a3b8", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: email.trim() ? "pointer" : "not-allowed" }}>
              Continue →
            </button>
          </div>
        )}

        {/* Form */}
        {emailSubmitted && !result && !loading && (
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: 28, animation: "fadeUp 0.3s ease" }}>
            {isPremium && (
              <div style={{ background: "#fef9c3", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span>⭐</span>
                <span style={{ color: "#92400e", fontSize: 13, fontWeight: 600 }}>Premium – Unlimited checks active</span>
              </div>
            )}
            <label style={{ color: "#374151", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
              Describe your symptoms
            </label>
            <textarea
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
              placeholder="e.g. I have had a persistent headache for 2 days, along with a sore throat and mild fever..."
              rows={5}
              style={{ width: "100%", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, color: "#1e293b", fontSize: 15, lineHeight: 1.7, resize: "none", fontFamily: "inherit", padding: "12px 14px", marginBottom: 16 }}
            />
            <label style={{ color: "#374151", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>Age <span style={{ color: "#6b7280", fontWeight: 400 }}>(optional)</span></label>
            <input
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="e.g. 34"
              style={{ width: "100%", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, color: "#1e293b", fontSize: 15, fontFamily: "inherit", padding: "11px 14px", marginBottom: 20 }}
            />
            {!isPremium && remaining === 0 ? (
              <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 12, padding: 20, textAlign: "center" }}>
                <p style={{ color: "#1e40af", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Daily limit reached</p>
                <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>Upgrade to Premium for unlimited daily checks.</p>
                <a href={STRIPE_LINK} target="_blank" style={{ display: "block", background: "#1e40af", color: "#fff", fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 10, textDecoration: "none", marginBottom: 10 }}>
                  ⭐ Upgrade to Premium – €4/month
                </a>
                <p style={{ color: "#94a3b8", fontSize: 12 }}>Or come back tomorrow for 6 more free checks</p>
              </div>
            ) : (
              <button onClick={analyze} disabled={!symptoms.trim()} style={{ width: "100%", padding: 15, background: symptoms.trim() ? "#1e40af" : "#e2e8f0", color: symptoms.trim() ? "#fff" : "#94a3b8", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, fontFamily: "inherit", cursor: symptoms.trim() ? "pointer" : "not-allowed" }}>
                Analyze Symptoms →
              </button>
            )}
            <p style={{ color: "#94a3b8", fontSize: 11, textAlign: "center", marginTop: 12 }}>
              🔒 Not a diagnosis. Always consult a healthcare professional.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: 48, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, border: "3px solid #e2e8f0", borderTop: "3px solid #1e40af", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ color: "#64748b", fontSize: 14, fontWeight: 500 }}>Analyzing your symptoms...</p>
          </div>
        )}

        {/* Error */}
        {error && !result && (
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: 24, textAlign: "center" }}>
            <p style={{ color: "#dc2626", fontWeight: 600, marginBottom: 8 }}>Something went wrong</p>
            <button onClick={() => setError(null)} style={{ background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontFamily: "inherit", cursor: "pointer" }}>Try Again</button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div ref={resultRef} style={{ animation: "fadeUp 0.4s ease" }}>
            <div style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ background: cfg.color, color: "#fff", fontWeight: 800, width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{cfg.icon}</span>
              <span style={{ color: cfg.color, fontWeight: 700, fontSize: 14 }}>{cfg.label}</span>
            </div>
            <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: 24, marginBottom: 16 }}>
              {lines.map((line, i) => {
                const isHeader = line.startsWith("##") || (line.endsWith(":") && line.length < 40);
                const clean = line.replace(/^#+\s*/, "").replace(/\*\*/g, "");
                return <p key={i} style={{ color: isHeader ? "#1e40af" : "#334155", fontSize: isHeader ? 11 : 15, fontWeight: isHeader ? 700 : 400, letterSpacing: isHeader ? 1.5 : 0, textTransform: isHeader ? "uppercase" : "none", marginBottom: isHeader ? 8 : 10, marginTop: isHeader && i > 0 ? 20 : 0, lineHeight: 1.7, borderLeft: isHeader ? "3px solid #1e40af" : "none", paddingLeft: isHeader ? 10 : 0 }}>{clean}</p>;
              })}
            </div>
            <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <p style={{ color: "#1e40af", fontSize: 12, lineHeight: 1.6 }}>⚕️ This analysis is AI-generated and does not constitute medical advice. Please consult a qualified healthcare professional.</p>
            </div>
            {!isPremium && (
              <a href={STRIPE_LINK} target="_blank" style={{ display: "block", background: "#fbbf24", color: "#000", fontWeight: 700, fontSize: 14, padding: 14, borderRadius: 10, textAlign: "center", textDecoration: "none", marginBottom: 12 }}>
                ⭐ Upgrade to Premium – €4/month – Unlimited checks
              </a>
            )}
            <button onClick={() => { setResult(null); setSymptoms(""); setAge(""); }} style={{ width: "100%", padding: 13, background: "transparent", color: "#1e40af", border: "1.5px solid #bfdbfe", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              ← New Symptom Check
            </button>
          </div>
        )}
      </div>
      <Analytics />
    </div>
  );
}