// ============================================================
// Audit Reports — manual "Run audit" dashboard
// Uses editor-ai to generate structured reports across categories.
// Stored in localStorage so it stays scoped to the current browser.
// ============================================================
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Play, ClipboardCheck, Bug, Zap, Shield, Sparkles, Trash2, Loader2, Clock,
} from "lucide-react";
import { useAIStream } from "@/hooks/useAIStream";

type AuditType = "bugs" | "performance" | "security" | "ux" | "ai";

interface AuditReport {
  id: string;
  type: AuditType;
  title: string;
  createdAt: number;
  body: string;
}

const STORAGE_KEY = "niknote_audit_reports_v1";

const AUDIT_CONFIGS: Record<AuditType, {
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  instruction: string;
  seed: string;
}> = {
  bugs: {
    label: "Bug Audit",
    icon: Bug,
    color: "from-error to-nk-rose",
    instruction: `You are NikNote's Bug Hunter. Given the app context below, produce a structured bug audit report:
1. Top 5 likely bug areas, each with: severity (P0/P1/P2), symptom, likely cause, suggested fix.
2. Regression risks introduced by recent AI + editor changes.
3. Repro steps checklist.
Format as clean markdown with headings.`,
    seed: `NikNote is a React 18 + Vite + Supabase note-taking app for Indian students. It has: line-based editor, block editor, handwriting rendering, PDF export, Razorpay payments, MCP server, AI streaming via editor-ai edge function.`,
  },
  performance: {
    label: "Performance Audit",
    icon: Zap,
    color: "from-nk-warm-600 to-nk-rose",
    instruction: `You are NikNote's Performance Auditor. Produce a performance audit:
1. Likely bottlenecks (bundle, renders, DB, network) with evidence hooks.
2. Quick wins (< 1 day each) and structural bets.
3. Lighthouse-mobile target impact.
Format as markdown.`,
    seed: `React 18 + Vite + Supabase. Heavy pages: PremiumLanding, AgentConsole, BlockEditor. AI responses stream from editor-ai.`,
  },
  security: {
    label: "Security Audit",
    icon: Shield,
    color: "from-success to-success/70",
    instruction: `You are NikNote's Security Engineer. Produce a security audit:
1. Auth surfaces and risks.
2. RLS review checklist for user_owned tables.
3. Edge function hardening.
4. Secret handling.
5. Top 3 fixes to do this week.
Format as markdown.`,
    seed: `Supabase Auth (Google + Email). Edge functions: editor-ai, admin-auth, create-razorpay-order, verify-razorpay-payment, mcp. Storage bucket: handwriting-samples (private). Razorpay live mode active.`,
  },
  ux: {
    label: "UX Audit",
    icon: Sparkles,
    color: "from-nk-purple via-nk-rose to-nk-amber",
    instruction: `You are NikNote's UX Designer. Produce a UX audit:
1. Friction points across onboarding → note → export → upgrade.
2. Mobile-specific issues.
3. 5 delight moments to add.
4. Accessibility gaps.
Format as markdown.`,
    seed: `Mobile-first, glassmorphism theme, Framer Motion animations. Bottom nav on mobile with Content/Style/Preview steps. Onboarding is 5 steps.`,
  },
  ai: {
    label: "AI Audit",
    icon: ClipboardCheck,
    color: "from-nk-purple to-nk-rose",
    instruction: `You are NikNote's AI Reviewer. Produce an AI-quality audit:
1. Hallucination risks in current agents.
2. Prompt improvements for the Guru/Teacher agent.
3. Missing safety rails.
4. Rate-limiting review.
Format as markdown.`,
    seed: `AI is streamed via editor-ai edge function on Lovable AI Gateway using google/gemini-3.6-flash. 40+ agents defined in src/data/agents.ts. Free tier limits apply.`,
  },
};

export default function AuditReports() {
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [runningType, setRunningType] = useState<AuditType | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ai = useAIStream();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setReports(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  }, [reports]);

  // Stream into active report body
  useEffect(() => {
    if (!activeId) return;
    if (ai.status === "streaming" || ai.status === "done") {
      setReports((prev) => prev.map((r) => r.id === activeId ? { ...r, body: ai.output } : r));
    }
    if (ai.status === "error" && ai.error) {
      setReports((prev) => prev.map((r) => r.id === activeId ? { ...r, body: `⚠️ ${ai.error}` } : r));
    }
    if (ai.status === "done" || ai.status === "error") {
      setRunningType(null);
    }
  }, [ai.output, ai.status, ai.error, activeId]);

  const runAudit = (type: AuditType) => {
    if (runningType) return;
    const cfg = AUDIT_CONFIGS[type];
    const id = `${type}-${Date.now()}`;
    const report: AuditReport = {
      id, type, title: cfg.label, createdAt: Date.now(), body: "",
    };
    setReports((prev) => [report, ...prev]);
    setActiveId(id);
    setRunningType(type);
    ai.run({ action: "custom", text: cfg.seed, instruction: cfg.instruction });
  };

  const deleteReport = (id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const active = reports.find((r) => r.id === activeId) ?? reports[0];

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-5 h-5" /></Link>
          <ClipboardCheck className="w-5 h-5 text-accent-rose" />
          <h1 className="font-semibold">Audit Reports</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Run cards */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Run an audit
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.keys(AUDIT_CONFIGS) as AuditType[]).map((t) => {
              const cfg = AUDIT_CONFIGS[t];
              const Icon = cfg.icon;
              const isRunning = runningType === t;
              return (
                <motion.button
                  key={t}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => runAudit(t)}
                  disabled={!!runningType}
                  className="relative rounded-2xl p-4 text-left border border-border/60 bg-card hover:border-primary/40 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm font-semibold">{cfg.label}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-accent-rose">
                    {isRunning ? <><Loader2 className="w-3 h-3 animate-spin" /> Running…</> : <><Play className="w-3 h-3" /> Run</>}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Reports list + viewer */}
        <section className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              History
            </h3>
            {reports.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 rounded-xl border border-dashed border-border/60 text-center">
                No audits yet. Run one above.
              </div>
            )}
            {reports.map((r) => {
              const cfg = AUDIT_CONFIGS[r.type];
              const Icon = cfg.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveId(r.id)}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-2.5 ${
                    active?.id === r.id
                      ? "bg-primary/10 border-primary/40"
                      : "bg-card border-border/60 hover:border-primary/30"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteReport(r.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>
              );
            })}
          </div>

          <div>
            {active ? (
              <article className="rounded-2xl border border-border/60 bg-card p-5 md:p-6">
                <header className="flex items-center gap-3 mb-4 pb-4 border-b border-border/40">
                  {(() => {
                    const cfg = AUDIT_CONFIGS[active.type];
                    const Icon = cfg.icon;
                    return (
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    );
                  })()}
                  <div>
                    <h3 className="font-semibold">{active.title}</h3>
                    <div className="text-xs text-muted-foreground">
                      {new Date(active.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {runningType === active.type && (
                    <span className="ml-auto text-xs text-accent-rose flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Streaming…
                    </span>
                  )}
                </header>
                <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground/90">
                  {active.body || "Waiting for AI output…"}
                </pre>
              </article>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
                Select a report to view it.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
