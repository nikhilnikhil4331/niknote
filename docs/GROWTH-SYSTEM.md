# NikNote Growth System — audit, decisions, and operating manual

**Status of this document:** written against the code in this repository, not against a plan
document. Every claim below names the file that backs it, and every "verify" line is a command you
can run. Nothing here promises sign-ups, ranking, or revenue — the only success metric is
**genuinely retained active users**.

Last updated: 2026-10-21 · Branch: `arena/09510f5e-niknote`

---

## 1. Repository audit (what was actually here)

| Area | Before | Now |
| --- | --- | --- |
| Dead code | `src/services/{agents,knowledge,ocr,workflow}` — 4 modules, zero importers, still type-checked and shipped in the graph | Deleted. `scripts/check-dead-code.mjs` walks the real import graph from `src/main.tsx` + `src/App.tsx` and fails CI on new orphans |
| Admin metrics | `AdminPanelNikhil.tsx` seeded 30 days of `Math.random()` traffic, a 42K-user funnel, invented top exporters ("Rahul Sharma, 156 exports") and a hardcoded `avgSessionDuration: '12m'` | Real zero-state, real `activity_logs` loaders only, explicit "No funnel data yet — nothing here is estimated" |
| Admin "chat" | A floating widget that fabricated status messages ("Abhi 0 active users hain", "Deployment successful!") after a random delay | Deterministic navigation help; it says plainly that it is not monitoring |
| Analytics | `src/utils/analytics.ts` (event names ad hoc, props unvalidated) | `src/lib/growth/funnel.ts`: closed event vocabulary, allowlisted prop keys, consent-gated, `MIN_SAMPLE = 30` |
| SEO | `index.html` had generic meta; SPA served identical tags for every route; `robots.txt` vague | `src/lib/seo/meta.ts` + `SeoManager.tsx` per-route meta/JSON-LD, `NEVER_INDEX` list, generated `sitemap.xml` (27 URLs), `X-Robots-Tag: noindex` for private routes |
| Handwriting renderer | Global `skewX` on the line (reads like an italicised font); `paginateStructured` left headings alone at the bottom of a sheet | Per-word lean (`wordSlant`) + line drift, deterministic hash, ±18°. Widow control moves a heading to the next page |
| Lecture capture | Nothing | `src/pages/LectureMode.tsx` + `src/lib/lecture.ts`: record → transcript → structured note lines, fillers stripped, never invented |
| Study planning | Nothing | `src/pages/StudyPlanner.tsx` + `src/lib/studyPlan.ts`: task model, EDF scheduling inside a daily budget, RFC 5545 `.ics` export |
| Growth surfaces | Nothing | `src/components/growth/GrowthStudio.tsx` (5 tabs) + `src/lib/growth/*` (7 modules) behind the admin `growth` tab |

**Verify:**
```bash
npm run check:dead-code     # 70 known-orphan modules are baselined; new ones fail
npm test                    # 211 tests
npm run typecheck
```

---

## 2. Bottlenecks (ranked, with evidence)

1. **No trustworthy measurement.** The only dashboard numbers were random. Without a funnel you
   cannot tell whether a change helped, so every other priority is guesswork. *Evidence:* the
   deleted `generateDemoChartData()` in `AdminPanelNikhil.tsx`.
2. **The landing page and the editor compete for `/`.** `WorkspaceEntry` sends signed-in users to
   the editor and guests to marketing copy, but the page still carries product UI above the fold,
   so cold traffic has no single action. *Evidence:* `src/components/WorkspaceEntry.tsx`.
3. **First-note activation is the real funnel.** A visitor who never saves one note can never
   retain. Instrumentation now exists (`note_created`) but there is no onboarding step that
   *forces* a first note within the first session.
4. **Private surface was indexable.** Editor, admin, account and document routes rendered behind the
   same SPA shell as marketing. Fixed technically (see §5), but `robots.txt` is not a security
   boundary — auth + RLS remain the control.
5. **No outbound infrastructure.** There is no transactional or bulk email provider, so any
   outreach/partnership plan is blocked until one is chosen (§17) — and every send must stay
   human-approved (§8).

---

## 3. Roadmap (P0 → P7)

| Phase | Scope | State |
| --- | --- | --- |
| **P0** | Secrets/auth/core safety; delete dead services; CI dead-code gate; remove fabricated metrics | ✅ done |
| **P1** | Technical SEO + per-route meta; private routes non-indexable; sitemap pipeline | ✅ done |
| **P2** | Signup + first-note activation instrumentation | ✅ events live; onboarding step still open (§18) |
| **P3** | Analytics funnel + growth reporting dashboard + honest empty states | ✅ done |
| **P4** | Content pipeline (draft → fact-check → approve → publish) | ✅ workflow + validator; no channels connected |
| **P5** | Harvey-style partnership research + approval-gated outreach | ✅ research/scoring/draft; sending stays manual |
| **P6** | Experiments + retention | ✅ statistics helper; no experiment running |
| **P7** | Paid marketing | ⛔ blocked by rule: only after the funnel is measurable end-to-end |

---

## 4. Architecture decisions

| # | Decision | Why | Trade-off accepted |
| --- | --- | --- | --- |
| A1 | Growth code is a **separate module** (`src/lib/growth/*`) that the notes editor never imports | Notes must keep working if every growth feature is switched off, and a growth bug must never block saving | One more layer to read |
| A2 | Analytics is **local-first + consent-gated**, closed event vocabulary | No note text, title, email, prompt or query can structurally reach a store (props are allowlisted by key) | No server-side attribution until a backend exists |
| A3 | Retention is reported as `null` below 30 eligible users | A 3-user "100% retention" is noise presented as fact | Dashboard says "Not enough data" for a while |
| A4 | Approvals are a **type-level gate**: `decide()` throws without a named human | A flag is easy to flip; a throw is hard to ignore | Every approval needs a real person's name recorded |
| A5 | Outreach is **draft-only**; "Mark sent" does not exist | Sending on the user's behalf is irreversible and legally risky | Manual copy/paste per message |
| A6 | Prospect research uses **public business info only** — no scraping private profiles, no purchased lists, no platform-breaking automation | The alternative is a ban and a lawsuit | Smaller, slower prospect list |
| A7 | Content validator **rejects** `#1`, guarantees, `N% more/faster`, `N+ students/users/downloads`, "100% accurate" | Marketing copy is where honest products usually start lying | Some punchy drafts must be rewritten |
| A8 | Calendar export produces an `.ics` file; the UI never claims an event was created | Integration can fail; a false "added to your calendar" is a broken promise | One import step for the user |
| A9 | SEO lives in React (`SeoManager`) rather than server rendering | The app is a Vite SPA on Vercel; SSR would be a re-platform | No per-route OG tags for non-JS crawlers; sitemap + structured data compensate |
| A10 | Handwriting variation is **deterministic hash**, not `Math.random()` | Random per render causes jitter, and jitter reads as a bug | Needs a stable seed (line/word index) |

---

## 5. SEO changes

| File | Change | Verify |
| --- | --- | --- |
| `index.html` | Claims-free `twitter:title` / `twitter:description`; default `SoftwareApplication` JSON-LD | `grep -c "application/ld+json" index.html` → 5 |
| `src/lib/seo/meta.ts` | `SITE_ORIGIN`, per-route metadata table, `NEVER_INDEX` | `npm test -- seo` |
| `src/components/SeoManager.tsx` | Applies title/description/OG/canonical/JSON-LD on route change; mounted in `App.tsx` | Dev tools → Elements → `<head>` |
| `public/robots.txt` | Allow public marketing, disallow `/admin`, `/account`, `/editor`, `/notebooks`, `/documents`, `/history`, `/lecture`, `/planner`, `/audit`; sitemap line | `curl https://www.niknote.online/robots.txt` |
| `scripts/generate-sitemap.mjs` | Static marketing routes + `Blog.tsx` post list → `public/sitemap.xml` (27 URLs, `lastmod`) | `npm run sitemap && grep -c "<url>" public/sitemap.xml` |
| `vercel.json` | `X-Robots-Tag: noindex` on private paths, alongside the SPA rewrite and security headers | `curl -I https://www.niknote.online/admin` |

**Rule kept:** only marketing routes are indexable; notes, dashboard, editor, account, admin and
document content are excluded *and* protected by auth. `robots.txt` is treated as a request, not a
security boundary.

---

## 6. Landing / conversion changes

- `WorkspaceEntry` keeps the marketing hero for guests and routes signed-in users straight to the
  editor — one primary action per audience.
- Activation events now fire at the real moments: `visitor_landing` (`App.tsx`),
  `signup_started` / `signup_completed` (`NiknoteAuth.tsx`), `note_created` (`Index.tsx`,
  `LectureMode.tsx`), `pdf_imported`, `handwriting_used`, `ai_used`.
- No testimonials, user counts, scarcity timers or "trusted by" logos were added — none could be
  substantiated from this repo.

---

## 7. Content workflow

```
idea → draft (src/lib/growth/content.ts) → claim validator → human fact-check → approval queue → publish (manual)
```

- `validateContent()` blocks banned claims; `publish` requires `verifiedFacts` + an approving human.
- `AUTONOMOUS_*` flags in `src/lib/growth/approvals.ts` are all `false`.
- Social/ads/article bodies are drafts only; nothing posts itself.

**Verify:** `npm test -- growth` → "rejects #1 claims", "publish needs a verified fact" cases.

---

## 8. Partnership & outreach workflow

Adapted from the *ideas* in `ethanplusai/harvey` (pipeline = prospects → campaign generation →
reply handling → approval queue → analytics → budget controls). **No code was copied** (see §11).

1. `prospects.ts` — add prospects with **public** business info; scoring requires a recorded public
   channel and at least one public evidence field (≥12 chars).
2. `outreach.ts` — drafts carry a greeting, an identified sender, one concrete reason, an opt-out
   sentence, and pass `lintOutreach()` before they can be queued.
3. `approvals.ts` — a named human approves; `decide()` throws otherwise.
4. Sending is done by a human, outside the app. Opt-outs are recorded and respected.
5. Budget controls default to `0` paise — no spend path exists without explicit approval.

**Not done, deliberately:** no LinkedIn automation, no purchased lists, no profile scraping, no
auto-replies, no send API.

---

## 9. Analytics + dashboard

- **Store:** `localStorage` key `niknote.growth.events.v1` (`src/lib/growth/store.ts`).
- **Events (closed set, unknown names are dropped):** `visitor_landing`, `signup_started`,
  `signup_completed`, `note_created`, `first_note_created`, `ai_used`, `pdf_imported`,
  `handwriting_used`, `premium_viewed`, `subscription_completed`, `account_deleted`.
- **Props:** allowlisted keys only (`source`, `page`, `feature`, `method`, `plan`, `count`, `ok`,
  `daysSinceFirst`). Any key matching `note|content|text|title|body|email|password|token|key|prompt|
  document|file` is dropped by construction, and values are capped at 48 characters.
- **Consent:** no consent = no write.
- **Reporting:** funnel + retention rates are `null` under `MIN_SAMPLE = 30` and the UI says so.
- **Experiments:** `zTest` + `evaluateExperiment` refuse to call a winner on a small sample
  (48 vs 52 → "don't decide yet"; 1000 v 1000 moving 100 → 105 → not significant).

**Dashboard:** `src/components/growth/GrowthStudio.tsx`, mounted as the `Growth` tab in
`src/pages/AdminPanelNikhil.tsx`. Tabs: Funnel, Prospects, Approvals, Content, Experiments.

---

## 10. Security review

| Check | Result |
| --- | --- |
| Note content in analytics | Structurally impossible (allowlisted prop keys) |
| Secrets | Only `VITE_*` values reach the browser bundle. `VITE_GEMINI_KEY` / `VITE_GROQ_KEY` are public-by-design but rate-limit-free — **see §18** |
| Private routes | `NEVER_INDEX` + `X-Robots-Tag: noindex` + auth; RLS remains the real control |
| Outreach/email | No send path exists; drafts are text a human copies |
| Spend | Budget defaults to 0; no payment code touched |
| Production data | Tests use fixtures only; nothing writes to Supabase |
| New dependencies | **Zero** added for growth, lecture, planner, or dead-code checking |

---

## 11. Licence inventory

| Repo | Licence | Use in NikNote |
| --- | --- | --- |
| `ethanplusai/harvey` | MIT (self-described; verify before reuse) | **Ideas only** — pipeline shape, approval queue, budget controls. No code copied |
| `WeKnora` | MIT | Studied retrieval/citation patterns; our search is original (`knowledgeIndex.ts`) |
| `openwhispr` | MIT | Confirmed our browser-native dictation approach |
| `VoiceStudio` | **AGPL-3.0-only** | **Not used, not merged** — copyleft |
| `openproject` | GPL-3.0 | Vocabulary only (work-package wording) |
| `cal.com` | MIT (core) | `.ics` interop confirmed against RFC 5545; no code copied |
| `open-seo` | MIT | Checklist only |
| `open-higgsfield` | **No licence found (404)** | Nothing copied |
| `chatwoot` | MIT (core) | Wording for opt-out flows only |

Full machine-readable list: `docs/license-inventory.json` (707 packages, **0 copyleft**).
Notice file: `THIRD_PARTY_NOTICES.md`.

**Rule:** licence check is mandatory before copying. Open source is not zero running cost — the
providers below are paid or rate-limited.

---

## 12. Environment variables

Build-time (Vercel → Project → Settings → Environment Variables, Production + Preview):

| Variable | Purpose | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL | public |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon/publishable key | public; RLS must do the work |
| `VITE_SUPABASE_PROJECT_ID` | project ref | public |
| `VITE_GEMINI_KEY` | AI provider | **ships in the bundle** — restrict + quota (§18) |
| `VITE_GROQ_KEY` | AI provider fallback | same |

Local: `.env.local` with the same keys. Never commit it.

---

## 13. Migrations

**None added.** Every growth/lecture/planner feature ships against `localStorage` and existing
tables (`activity_logs`, `profiles`, `pages`, `user_subscriptions`). No destructive migration, no
schema change, no production data mutation.

If the funnel should leave the device later, the smallest safe next step is one append-only table
(`growth_events`: `id`, `user_id`, `name`, `props jsonb`, `created_at`) with RLS `insert` for the
authenticated user and `select` for admins only. That is a deliberate product decision, not
something this change assumes.

---

## 14. Tests

| File | Covers |
| --- | --- |
| `src/test/seo.test.ts` | Meta table, `NEVER_INDEX`, sitemap coverage, robots rules |
| `src/test/growth.test.ts` | Event vocabulary, prop filtering, consent, `MIN_SAMPLE`, claim validator, approvals (`AUTONOMOUS_*` all `false`), `zTest` |
| `src/test/lectureAndPlan.test.ts` | Filler stripping, cue→markdown, ICS folding/CRLF/UID, EDF planning |
| `src/test/handwritingDna.test.tsx` | Ink measurement, DNA→settings, per-word lean, page render, PDF→notes, widow control |
| `src/test/plannerAndLectureUi.test.tsx` | Lecture screen builds and saves a real note; planner schedules + exports `.ics` without claiming events |

**Total: 211 tests across 17 files.** Run: `npm test`, `npm run verify` (typecheck + tests +
dead-code), CI mirror in `.github/workflows/ci.yml`.

---

## 15. Deploy instructions

1. `npm run verify` — must be green.
2. `npm run build` — Vite build; `prebuild` regenerates `public/sitemap.xml`.
3. Deploy the **current branch** (`arena/09510f5e-niknote`) to the `prj_pboLILJsBUImA8NiOyE4XNGyTFvC`
   Vercel project; aliases `niknote.online` and `www.niknote.online`.
4. Smoke check: `/`, `/lecture`, `/planner`, `/robots.txt`, `/sitemap.xml`, and that `/admin` is
   `noindex` and still gated.

Rollback: promote the previous READY deployment in Vercel; the client reads only `localStorage`, so
no data migration is involved.

---

## 16. Manual steps (a human must do these)

1. **Vercel env vars** — confirm all five `VITE_*` values exist for Production (§12).
2. **Search Console** — submit `https://www.niknote.online/sitemap.xml`; request indexing for the
   marketing routes only.
3. **AI key hygiene** — restrict `VITE_GEMINI_KEY` / `VITE_GROQ_KEY` by quota and (if supported)
   HTTP referrer; they are visible to anyone who opens dev tools.
4. **Email provider decision** before any outreach (§17) — plus a real sender identity and an
   unsubscribe path.
5. **First outreach batch** — research by hand, review every draft, send manually.
6. **Growth Studio smoke test** — open `/admin` → Growth, confirm empty states read "no data yet".

---

## 17. Recurring costs

| Item | Cost now | Trigger |
| --- | --- | --- |
| Vercel hosting | existing plan | traffic |
| Supabase | existing plan | rows/storage |
| Gemini / Groq | pay-per-use (keys are public → monitor) | every AI answer |
| Custom domain | already paid | annual |
| **Email provider** (not chosen) | ~$0–20/mo at low volume (e.g. a transactional tier) | first outreach |
| Search Console / analytics | ₹0 | — |
| Paid acquisition | **₹0, blocked** until the funnel is measurable end-to-end | P7 |

Open source is free to *use*, not free to *run*: the AI providers and any future email provider are
recurring line items.

---

## 18. What is still incomplete (honest list)

1. **No server-side funnel.** Events live on the device; cross-device attribution needs the table in §13.
2. **First-note onboarding** — instrumentation exists, the guided step does not.
3. **Public AI key exposure** — the app works, but a determined user can drain quota. Needs a proxy
   function with its own rate limit (a real server change, deliberately out of scope here).
4. **No email/outreach provider wired** — deliberate, pending a decision.
5. **70 baselined orphan modules** (`scripts/dead-code-baseline.json`) — dead but not deleted;
   deleting them is a separate, reviewable cleanup.
6. **`avgSessionDuration` shows "—"** — no session-tracking table exists; a fake number was removed
   instead of invented.
7. **Per-route OG tags for non-JS crawlers** require SSR; current mitigation is sitemap + JSON-LD.
8. **Experiments** have statistics helpers but no running experiment; P6 has not started.
