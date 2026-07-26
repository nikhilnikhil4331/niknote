// ============================================================
// NikNote Company Handbook — 10 Volumes
// The constitution + operating manuals for the product.
// ============================================================

export interface HandbookSection {
  id: string;
  title: string;
  body: string;
}

export interface HandbookVolume {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  sections: HandbookSection[];
}

const p = (s: string) => s.trim();

export const HANDBOOK: HandbookVolume[] = [
  {
    id: "constitution",
    number: 1,
    title: "Company Constitution",
    subtitle: "Who we are, what we believe, how we decide.",
    icon: "📜",
    sections: [
      { id: "vision", title: "Vision", body: p(`Become the default AI-first workspace for students, researchers and knowledge workers — starting from India, growing to the world. Every learner deserves a beautiful, intelligent notebook that thinks with them.`) },
      { id: "mission", title: "Mission", body: p(`Give every student a private AI teammate that captures ideas as handwriting, understands documents, plans study, and turns effort into results.`) },
      { id: "philosophy", title: "Product Philosophy", body: p(`Fast, quiet, beautiful. Never in the way. Every pixel earns its place. AI shows up when asked, disappears when done. If a feature does not help a real student pass a real exam or finish real work, it does not ship.`) },
      { id: "student-first", title: "Student First Principles", body: p(`1. Free tier must be genuinely useful.\n2. Works on a low-end Android in poor network.\n3. Hindi, English and Hinglish are equal citizens.\n4. Never shame the user for not paying.\n5. Privacy: notes are the user's, never training data.`) },
      { id: "ai-first", title: "AI First Principles", body: p(`AI is a collaborator, not a replacement. Every AI action is: (a) previewable, (b) reversible, (c) explainable. No silent rewrites. No black-box magic.`) },
      { id: "decisions", title: "Decision Making Framework", body: p(`For every feature ask: does it help a student learn faster, remember longer, or earn more? If not two of three — do not build.`) },
      { id: "strategy", title: "Long-term Strategy", body: p(`Own the note-taking + study-planning + AI-tutor loop. Expand into research and small teams. Monetize with a fair freemium — coins, referrals, and a premium tier that removes limits, never gates learning.`) },
      { id: "standards", title: "Product Standards", body: p(`- Time-to-first-word under 2s on a mid-range Android.\n- No layout jank on paste or streaming.\n- Zero data loss — every keystroke persists.\n- Accessibility AA minimum.\n- All AI responses cite the block they changed.`) },
    ],
  },
  {
    id: "ceo",
    number: 2,
    title: "CEO Operating Manual",
    subtitle: "Roadmap, market, growth, metrics.",
    icon: "🧭",
    sections: [
      { id: "roadmap", title: "Product Roadmap", body: p(`Q1: Editor Infinity + AI Agents. Q2: Handwriting DNA v3 + PDF AI. Q3: Study Planner + Flashcards. Q4: Teams + School B2B.`) },
      { id: "priority", title: "Feature Priority", body: p(`P0: retention drivers (streaks, notebooks, AI). P1: monetization (referrals, coins, upgrade). P2: delight (motion, sound, themes).`) },
      { id: "market", title: "Market Research", body: p(`Primary: Indian students grade 8 → college, JEE/NEET/UPSC aspirants. Secondary: professionals taking notes. Signals: handwritten notes market, Notion growth in India, Anki popularity.`) },
      { id: "competitors", title: "Competitor Analysis", body: p(`Notion — too heavy, not AI-native. Goodnotes — no AI. Anki — powerful but ugly. NikNote wins on: handwriting realism + integrated AI + India-first pricing.`) },
      { id: "psychology", title: "User Psychology", body: p(`Students want to feel prepared. Show progress (streaks, coins, badges). Reduce blank-page anxiety with AI drafts. Celebrate small wins loudly.`) },
      { id: "growth", title: "Growth Strategy", body: p(`Referral loops (2-way premium). WhatsApp share of handwritten PDFs as viral surface. School partnerships. Content SEO on exam topics.`) },
      { id: "release", title: "Release Planning", body: p(`Weekly small releases. Monthly headline feature. Every release ships with a changelog, a tweet, and a WhatsApp broadcast.`) },
      { id: "metrics", title: "Success Metrics", body: p(`North star: weekly active notebooks per user. Guardrails: D1/D7 retention, PDF exports/week, free→paid conversion, NPS.`) },
    ],
  },
  {
    id: "cto",
    number: 3,
    title: "CTO Operating Manual",
    subtitle: "Architecture, code, data, security.",
    icon: "🛠️",
    sections: [
      { id: "arch", title: "Architecture", body: p(`React 18 + Vite + TS on the client. Supabase (Postgres + Auth + Edge Functions + Storage) on the server. Lovable AI Gateway for LLMs. No custom backend server.`) },
      { id: "folders", title: "Folder Structure", body: p(`src/components — UI. src/pages — routes. src/hooks — logic. src/services — domain engines. src/contexts — global state. supabase/functions — server logic.`) },
      { id: "code", title: "Code Standards", body: p(`Strict TS. No any without a comment. Small components (<300 lines). Semantic tokens only — no hardcoded colors. Named exports. Prefer composition over inheritance.`) },
      { id: "api", title: "API Standards", body: p(`All server calls via supabase.functions.invoke or typed client. No raw SQL from client. Errors return { error: string } with proper HTTP status.`) },
      { id: "db", title: "Database", body: p(`RLS on every table. GRANTs in the same migration as CREATE TABLE. User-owned rows scoped by auth.uid(). Roles in user_roles table only.`) },
      { id: "auth", title: "Authentication", body: p(`Supabase Auth. Google + Email/Password + Apple. Session in httpOnly cookies where possible. Admin dual-auth (role + env creds).`) },
      { id: "payments", title: "Payments", body: p(`Razorpay live for India. Server-side HMAC verification. Idempotent order creation. Never trust client-side amount.`) },
      { id: "ocr", title: "OCR", body: p(`Gemini Pro Vision for handwriting. Adaptive thresholding pre-processing. Devanagari + Latin. Layout preservation.`) },
      { id: "ai", title: "AI", body: p(`Lovable AI Gateway. Default google/gemini-3.6-flash. Stream responses. Rate limit per user/hour. Fallback model on 429.`) },
      { id: "perf", title: "Performance", body: p(`Route-level code splitting. Virtualize long lists. Debounce autosave (500ms). Skeleton loaders everywhere.`) },
      { id: "security", title: "Security", body: p(`RLS, JWT verify in edge functions, magic-byte image validation, no SVG upload, rate limits, secrets never in VITE_ vars.`) },
      { id: "devops", title: "DevOps", body: p(`Lovable-managed deploys. GitHub Actions for security scans on PR. Sentry-style error tracking via error_logs table.`) },
    ],
  },
  {
    id: "uiux",
    number: 4,
    title: "UI/UX Bible",
    subtitle: "Design language, motion, accessibility.",
    icon: "🎨",
    sections: [
      { id: "lang", title: "Design Language", body: p(`Premium Modern Glassmorphism. Backdrop blur, soft shadows, generous whitespace. Feels like an Apple product with an Indian soul.`) },
      { id: "type", title: "Typography", body: p(`Space Grotesk for display. Inter for body. Handwriting fonts for note preview. No serifs anywhere.`) },
      { id: "color", title: "Color System", body: p(`Semantic tokens in index.css. Primary: warm gradient. Neutrals: cool grey. Never use text-white / bg-black directly.`) },
      { id: "motion", title: "Motion", body: p(`Framer Motion 11.x only. Ease [0.25,0.1,0.25,1]. 200–300ms defaults. Every transition earns its place.`) },
      { id: "components", title: "Components", body: p(`shadcn/ui base. Extend via className, never rewrite. All interactive elements ≥ 44px on mobile.`) },
      { id: "a11y", title: "Accessibility", body: p(`WCAG AA. Keyboard-first. Focus rings visible. Screen-reader labels on every icon button. Prefers-reduced-motion respected.`) },
      { id: "responsive", title: "Responsive Rules", body: p(`Mobile first. Bottom sheets on mobile, side panels on desktop. Test at 360, 414, 768, 1280, 1920.`) },
      { id: "interaction", title: "Interaction Design", body: p(`Haptics on primary actions. Sound (subtle) on success. Optimistic UI everywhere. Loading > 300ms shows a skeleton, not a spinner.`) },
      { id: "student", title: "Student Experience", body: p(`Streaks visible, celebrations loud, penalties invisible. Encourage, never scold.`) },
      { id: "premium", title: "Premium Feel", body: p(`Glass, gradients, micro-interactions. Even the free tier feels premium. Paid unlocks capacity, not quality.`) },
    ],
  },
  {
    id: "ai-bible",
    number: 5,
    title: "AI Bible",
    subtitle: "Agents, memory, RAG, prompts.",
    icon: "🧠",
    sections: [
      { id: "agents", title: "AI Agents", body: p(`Curated agents in src/data/agents.ts. Each has a role, system prompt, tools, and a routing keyword set. Router picks best fit.`) },
      { id: "memory", title: "Memory", body: p(`Short-term: current thread. Long-term: user profile + saved facts. Shared: cross-agent scratchpad. All in Supabase, scoped by RLS.`) },
      { id: "ocr", title: "OCR", body: p(`Gemini Pro Vision. Confidence score returned. If < 0.7 → ask user to re-scan.`) },
      { id: "pdf", title: "PDF AI", body: p(`Chunk by page + heading. Embed. Answer with citations back to page numbers.`) },
      { id: "flash", title: "Flashcards", body: p(`Generated from selected text. Cloze + Q&A modes. SM-2 spaced repetition.`) },
      { id: "quiz", title: "Quiz Engine", body: p(`MCQ, short answer, true/false. Difficulty-adaptive. Explanations mandatory.`) },
      { id: "kg", title: "Knowledge Graph", body: p(`Extract entities + relations per notebook. Render as force-directed graph. Click node → linked notes.`) },
      { id: "voice", title: "Voice AI", body: p(`Whisper for transcription. Commands via keyword spotting. Push-to-talk on mobile.`) },
      { id: "research", title: "Research AI", body: p(`Web search + paper summarization + citation extraction. Always cite sources.`) },
      { id: "prompts", title: "Prompt Standards", body: p(`Every system prompt states: role, audience, output format, forbidden behaviors, language rules.`) },
      { id: "halluc", title: "Hallucination Reduction", body: p(`Ground in user's notes when possible. Prefer "I don't know" over made-up facts. Show confidence when uncertain.`) },
      { id: "tools", title: "Tool Calling", body: p(`JSON-schema validated. Idempotent. Timeout at 20s. Retry once.`) },
      { id: "mcp", title: "MCP Rules", body: p(`OAuth 2.1 via Supabase. RLS scopes every tool to caller. No service-role in MCP handlers.`) },
      { id: "rag", title: "RAG", body: p(`pgvector for embeddings. Top-k=6 default. Re-rank with cross-encoder for premium users.`) },
    ],
  },
  {
    id: "qa",
    number: 6,
    title: "QA Bible",
    subtitle: "How we hunt bugs and prove quality.",
    icon: "🔍",
    sections: [
      { id: "bugs", title: "Bug Hunting", body: p(`Exploratory sessions weekly. Every reported bug gets a repro + failing test before fix.`) },
      { id: "perf", title: "Performance", body: p(`Lighthouse ≥ 90 mobile. TTI < 3s on 4G. Memory < 150MB after 30min use.`) },
      { id: "regression", title: "Regression", body: p(`Smoke tests on every deploy: signup → note → export PDF → payment.`) },
      { id: "ai-test", title: "AI Testing", body: p(`Golden prompt set. Run monthly. Compare against baseline. Flag drift.`) },
      { id: "pdf-test", title: "PDF Testing", body: p(`Every page size + orientation + margin combo. Visual diff.`) },
      { id: "ocr-test", title: "OCR Testing", body: p(`Held-out set of 50 handwritten pages. Track WER (word error rate).`) },
      { id: "pay-test", title: "Payment Testing", body: p(`Razorpay test mode + live smoke. Verify webhook + subscription state.`) },
      { id: "a11y", title: "Accessibility", body: p(`Axe + manual keyboard sweep on every release.`) },
      { id: "mobile", title: "Mobile", body: p(`Real device: Redmi Note (Android 11), iPhone SE (iOS 15). Every release.`) },
      { id: "sec", title: "Security", body: p(`Scan on every PR. Zero high/critical merges.`) },
      { id: "reports", title: "Reports", body: p(`Audit dashboard generates bug/perf/security/UX reports on demand.`) },
      { id: "auto", title: "Automation", body: p(`Playwright for critical paths. Vitest for logic. No unit tests for UI copy.`) },
    ],
  },
  {
    id: "security-bible",
    number: 7,
    title: "Security Bible",
    subtitle: "Auth, encryption, secrets, backup.",
    icon: "🔐",
    sections: [
      { id: "auth", title: "Authentication", body: p(`Supabase Auth only. No anonymous sign-ups. Email verified before premium features.`) },
      { id: "authz", title: "Authorization", body: p(`RLS on every table. has_role() security-definer function. Never trust client role claims.`) },
      { id: "enc", title: "Encryption", body: p(`TLS 1.3 in transit. At rest via Postgres. Sensitive columns via pgcrypto.`) },
      { id: "rl", title: "Rate Limits", body: p(`Per user + per IP. AI: 30/hour free, 300/hour premium. Login: 5/15min.`) },
      { id: "api", title: "API Security", body: p(`JWT verify in edge functions. Zod validation on every input. CORS locked to our origins.`) },
      { id: "upload", title: "File Upload", body: p(`Magic byte check. Max 5MB. Whitelist: png/jpg/pdf. No SVG.`) },
      { id: "secrets", title: "Secrets", body: p(`Supabase secrets only. Never in VITE_. Rotated quarterly.`) },
      { id: "backup", title: "Backup", body: p(`Daily Postgres snapshots. 30-day retention. Test restore monthly.`) },
      { id: "recovery", title: "Recovery", body: p(`RTO: 1 hour. RPO: 24 hours. Runbook in /admin.`) },
    ],
  },
  {
    id: "perf-bible",
    number: 8,
    title: "Performance Bible",
    subtitle: "Speed as a feature.",
    icon: "⚡",
    sections: [
      { id: "lazy", title: "Lazy Loading", body: p(`React.lazy per route. Images with loading="lazy" + native aspect ratio.`) },
      { id: "virt", title: "Virtualization", body: p(`Long lists (>100) use react-window.`) },
      { id: "stream", title: "Streaming", body: p(`All AI responses stream. First token in <800ms target.`) },
      { id: "cache", title: "Caching", body: p(`React Query 60s stale. Service Worker for static assets.`) },
      { id: "bundle", title: "Bundle Splitting", body: p(`Vendor chunk stable. Route chunks < 200KB gzipped.`) },
      { id: "db", title: "Database Optimization", body: p(`GIN index on tag arrays. B-tree on user_id + created_at. EXPLAIN every new query.`) },
      { id: "img", title: "Image Optimization", body: p(`WebP with jpg fallback. Responsive srcset. <300KB above the fold.`) },
      { id: "mem", title: "Memory Optimization", body: p(`Clean up listeners in useEffect returns. AbortController on fetch. Weakmaps for caches.`) },
    ],
  },
  {
    id: "self-os",
    number: 9,
    title: "Self Improvement OS",
    subtitle: "The audit loop — human-triggered, AI-executed.",
    icon: "🔄",
    sections: [
      { id: "loop", title: "The Loop", body: p(`Admin triggers an audit. AI runs: read → analyze → report. Human reviews. Human decides what to ship.\n\nWe do not auto-apply changes to production code — that is a human decision.`) },
      { id: "cadence", title: "Cadence", body: p(`Weekly: performance + UX audit. Monthly: architecture + security. Quarterly: full product review.`) },
      { id: "outputs", title: "Outputs", body: p(`Every audit produces a report saved in the /audit dashboard: findings, severity, suggested fix, effort estimate.`) },
      { id: "triage", title: "Triage", body: p(`P0 = user-facing broken. P1 = degraded. P2 = polish. P0 fixed same day. P1 in-sprint. P2 backlog.`) },
    ],
  },
  {
    id: "sops",
    number: 10,
    title: "Engineering SOPs",
    subtitle: "How we work, step by step.",
    icon: "📋",
    sections: [
      { id: "coding", title: "Coding SOP", body: p(`1. Read the file. 2. Make the smallest change. 3. Typecheck. 4. Smoke test. 5. Commit with a message that names the user impact.`) },
      { id: "testing", title: "Testing SOP", body: p(`New logic → vitest. New UI flow → Playwright. Bug fix → regression test first.`) },
      { id: "deploy", title: "Deployment SOP", body: p(`Merge to main auto-deploys. Watch error_logs for 15 min. Rollback = revert commit.`) },
      { id: "release", title: "Release SOP", body: p(`Version bump. Changelog. Tweet. WhatsApp broadcast. In-app "What's new" toast.`) },
      { id: "security", title: "Security SOP", body: p(`PR blocks on high/critical scanner findings. Rotate secrets quarterly. Review RLS on every new table.`) },
      { id: "research", title: "Research SOP", body: p(`Question → 3 sources → summary with citations → decision.`) },
      { id: "design", title: "Design SOP", body: p(`Sketch → static mock → prototype → user test with 3 students → build.`) },
      { id: "docs", title: "Documentation SOP", body: p(`Every new feature updates the Handbook. Every new endpoint updates the API section.`) },
      { id: "prompt", title: "Prompt SOP", body: p(`Draft → test on 10 real inputs → measure → refine → version.`) },
      { id: "agent", title: "Agent SOP", body: p(`New agent needs: name, role, system prompt, 5 test prompts, routing keywords, expected output format.`) },
      { id: "planning", title: "Planning SOP", body: p(`Every sprint: pick 1 north-star goal, 3 features, 5 fixes. No more.`) },
    ],
  },
];

export function findVolume(id: string) {
  return HANDBOOK.find((v) => v.id === id);
}
