# NikNote

**Handwritten-feeling notes, powered by NikAI.** A study workspace for students: a real-feeling notebook
editor (paper, ink, margins), PDF → notes import, lecture mode, a study planner with `.ics` export, and
one AI assistant (NikAI) that can turn anything into revision-ready pages.

Live: **[niknote.online](https://niknote.online)** · Built by [@nikhilnikhil4331](https://github.com/nikhilnikhil4331)

---

## What's inside

| Area | Highlights |
| --- | --- |
| **Notes editor** | Line-based editor + block editor, handwriting typography, ink/paper realism (smudges, fold marks, coffee stains), Cornell/grid/dotted page styles, PDF export |
| **Handwriting DNA** | Upload a handwriting sample → measured ink metrics → closest font + calibrated 14-axis style, saved per device |
| **PDF → notes** | Import a PDF page, keep structure, re-render it in your own handwriting style |
| **NikAI** | Chat, inline writing tools, `@AI` mentions, vision, quizzes. Gemini first, Groq fallback, all through a server-side proxy with a per-user hourly quota |
| **Lecture mode** | Live transcript cleanup into structured notes (filler stripping, cue detection) |
| **Study planner** | Deadlines + priority → suggested sessions; exports an `.ics` file your calendar app imports |
| **Notebooks, habits, money, flashcards** | Supporting study surfaces, all offline-first in `localStorage` with optional Supabase sync |
| **Payments** | Razorpay subscriptions, server-verified signatures |
| **Admin** | `/admin` (noindex, role-gated): users, payments, audit reports, and the Growth Studio |

## Stack

- **Client:** React 18 + TypeScript + Vite, Tailwind + shadcn/ui, Framer Motion (reduced-motion aware)
- **Backend:** Supabase (Postgres + Auth + Edge Functions + Storage)
- **Edge:** `api/ai.ts` on Vercel (server-side AI keys + quota) and Supabase functions for the heavier jobs
- **Hosting:** Vercel, static SPA + edge functions, CSP/HSTS headers in `vercel.json`
- **Tests:** Vitest + Testing Library (244 tests), TypeScript typecheck, and a dead-code gate in CI

## Getting started

```bash
npm install
npm run dev          # http://localhost:8080
npm run verify       # typecheck + tests + dead-code check (what CI runs)
npm run build        # production build (also regenerates public/sitemap.xml)
```

### Environment

Copy the keys you need into `.env.local` (never commit it):

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (public) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (public, RLS does the work) |
| `VITE_SUPABASE_PROJECT_ID` | Project ref (public) |
| `VITE_AI_PROXY` | `1` routes NikAI through the `ai-proxy` edge function |

Server-only secrets (Vercel env / Supabase secrets, never in the bundle):

| Secret | Used by | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | `api/ai.ts`, `ai-proxy` | AI providers |
| `GROQ_API_KEY`, `OPENAI_API_KEY` | Supabase AI functions | document processing, OCR, handwriting analysis, receipt scan |
| `RESEND_API_KEY` (or `EMAIL_API_KEY`) | `auth-email-hook` | transactional auth email |
| `AUTH_EMAIL_HOOK_SECRET` | `auth-email-hook` | verifies Supabase's signed auth-hook webhook |
| `AI_HOURLY_LIMIT`, `AI_ANON_HOURLY_LIMIT` | `api/ai.ts` | quota knobs (default 40 signed-in / 15 signed-out per hour) |

> No provider key ever reaches the browser. `src/test/aiKeyHygiene.test.ts` fails the build if a
> `VITE_*_KEY` slips back into `src/`.

## Repository layout

```
api/                 Vercel edge endpoints (/api/ai — keys + quota live here)
src/
  components/        UI, editor, handwriting, growth studio, onboarding
  lib/               aiEngine, handwriting DNA, growth analytics, planner, lecture, SEO
  pages/             routes (marketing routes are the only indexable ones)
  test/              Vitest suites
supabase/
  functions/         edge functions (ai-proxy, editor-ai, auth-email-hook, …)
  migrations/        additive SQL migrations (live parity documented in docs/)
scripts/             sitemap generator, dead-code check
docs/                growth system, open-source analysis, licence inventory
docs/archive/        older audits, OAuth runbooks and launch notes (kept for history)
```

## Docs

- [`docs/GROWTH-SYSTEM.md`](docs/GROWTH-SYSTEM.md) — funnel, Growth Studio, AI quota, email workflow, deploy + manual steps
- [`docs/OPEN-SOURCE-ANALYSIS.md`](docs/OPEN-SOURCE-ANALYSIS.md) — licence review of the projects we learned from
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) — attribution and licence texts
- [`docs/license-inventory.json`](docs/license-inventory.json) — machine-readable dependency licences
- [`AGENTS.md`](AGENTS.md) — conventions for automated contributors

## Principles

1. **Notes are the product.** AI is a helper; every AI feature degrades to a working editor.
2. **Honest UI.** No fake counts, no invented testimonials, no claims we cannot verify, and no
   "calendar event created" message unless an integration actually succeeded.
3. **Local-first.** Your notes live in your browser; sync is opt-in.
4. **Nothing auto-sends.** Outreach, publishing and spend all wait for a human.

## Licence

Source is published for transparency and collaboration. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)
for the licences of bundled dependencies.
