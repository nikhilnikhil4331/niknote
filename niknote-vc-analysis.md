# NikNote — Venture Analysis

**As of:** 17 November 2026
**Subject:** NikNote (niknote.online) — AI handwriting notes, PDF studio, and study workspace for Indian students
**Founder:** Nikhil Jatav (solo)
**Analysis basis:** live production database (`atuxocibsmflgwlwuvmv` Supabase project), the deployed
repository at commit `872e51d` on `arena/fa802f8f-niknote`, and the Vercel production deployment
`dpl_Aydk2qC6YGGNy2hXRiz18FvMgXqR` (built 2026-11-17 14:58 UTC, READY, promoted to
`niknote.online`).

> **How to read this document.** Every figure marked **LIVE** or **CODE** was read directly from the
> production database or the deployed source on 17 Nov 2026 and can be re-derived. Every figure
> marked **ESTIMATE** is a projection, not a fact. Nothing here repeats the "183 users" or
> "2,500+ premium students" claims that earlier internal documents used — those were guest sessions
> and fabricated copy respectively, and both have been removed from the site.

---

## 1. Executive summary

NikNote is a **wide, working product with almost no distribution and no revenue**. That is the whole
investment case in one line.

What is genuinely built is not trivial: 61 client routes, 23 Supabase edge functions, 27 migrations,
52 test files, a real AI gateway that is live in production, a PDF/handwriting pipeline, and a
verified payment path through Razorpay. What is missing is the only two things that matter at this
stage: **people arriving**, and **a reason to pay that the code actually enforces**.

| Dimension | Assessment | Basis |
|---|---|---|
| Product breadth | Strong — exceeds a solo-founder MVP | CODE: 61 routes, 23 edge functions |
| Product depth on the core path | Working in production | LIVE: AI gateway returns `{"ok":true}`, Groq + Gemini healthy |
| Real registered humans | **5** | LIVE: `auth.users` excluding guest addresses |
| Paying customers | **0** | LIVE: `verified_payments` = 0 rows |
| Verified revenue, all time | **₹0** | LIVE: `sum(amount_paise)` = 0 |
| Weekly active note-creators | **6** | LIVE: distinct `user_id` in `notebooks`, last 7 days |
| Measurement | Effectively absent | LIVE: 33 analytics events total, ever |
| Monetisation enforcement | **Not enforced** | CODE: `incrementUsage()` has zero call sites |
| Defensibility today | Low | CODE: core feature is replicable; no seat/tenant layer exists |

**Bottom line for an investor:** this is a pre-seed *product* with a pre-launch *business*. The asset
is the founder's execution rate and the breadth of shipped surface area. The liability is that no
one has yet converted, and the pricing mechanism is structurally incapable of converting anyone
until it is fixed. Nothing in this document should be read as a forecast of venture-scale returns.

---

## 2. What the live data says (all figures LIVE, 17 Nov 2026)

### 2.1 The account base

| Metric | Value | Source |
|---|---|---|
| Total rows in `auth.users` | 470 | `auth.users` |
| Guest accounts (`@guest.niknote.online`) | 465 | same |
| **Real registered humans** | **5** | same, excluding guest addresses |
| Last real signup | **20 Oct 2026** | `max(created_at)` for non-guest |
| Signups, last 7 days | 97 | all guest |
| Signups, last 30 days | 466 | all guest |

The 5 real humans have not grown in 28 days. Every new account since 20 October is an
automatically-provisioned guest workspace, because `SIGNUP_ENABLED = false` in
`src/config/features.ts` — there is no path for a new person to create a real account.

This matters for valuation: **guest sessions are not a funnel top.** A guest is a workspace with no
email, no password, and no retention hook. They are the correct engineering choice for frictionless
trial (and `AUTO_GUEST = true` is what makes the handwriting demo instant), but they cannot be
counted as users, and no investor should accept them as such.

### 2.2 Engagement

| Metric | Value | Source |
|---|---|---|
| Notebooks created, all time | 81 | `notebooks` |
| Notebooks created, last 7 days | 32 | same |
| Distinct authors, last 7 days | **6** | same |
| Distinct authors, all time | 20 | same |
| Most recent notebook created | 17 Nov 2026, 15:04 UTC | same |
| Users who ever made a habit | 8 | `habits` |
| Users who ever made a task | 7 | `todos` |
| New habits, last 30 days | 25 | `habits` |

The product **is** being used — by a handful of people, some of whom appear to be returning. 32
notebooks across 6 authors in a week is real usage, not a dead shell. But 6 weekly authors against
470 accounts is a **1.3% activation rate**, which points at onboarding and at the fact that most of
those accounts are guests who never came back.

### 2.3 Revenue

| Metric | Value | Source |
|---|---|---|
| Verified payments, all time | **0 rows** | `verified_payments` |
| Verified revenue, all time | **₹0** | `sum(amount_paise)/100` |
| Subscription rows | 1 | `user_subscriptions` |
| Subscription status | `active` but period ended **28 Oct 2026** | `current_period_end` |
| Working sales leads | **0** | `sales_leads` |

There is exactly one subscription row: a ₹49 weekly plan whose period expired on 28 October. It has
no matching row in `verified_payments`, so under the app's own `revenue_reconciliation` view it is
classified as an **unverified claim**, not revenue. The honest all-time revenue figure is **₹0**.

### 2.4 Measurement

| Metric | Value |
|---|---|
| Analytics events recorded, all time | **33** |
| Most recent analytics event | 14 Nov 2026 |
| GA4 / Meta Pixel IDs configured in Vercel | **none** |
| Knowledge documents in the RAG store | 0 |

33 events ever is not a measurement system; it is a rounding error. The tracking code
(`src/lib/tracking.ts`) is complete and correct — it reads `VITE_GA_MEASUREMENT_ID` — but that
environment variable is not set in the Vercel project, so it initialises nothing. The company
currently **cannot state its own traffic, conversion rate, or cost of acquisition**, because it is
not measured.

---

## 3. The product (CODE)

### 3.1 Surface area

| Asset | Count |
|---|---|
| Client routes (`src/App.tsx`) | 61 |
| Vercel rewrites | 19 |
| Supabase edge functions | 23 |
| Database migrations | 27 |
| Test files | 52 |
| Blog posts | 18 |
| Prerendered HTML routes | 35 |

The deployed build prerenders 35 distinct HTML documents with their own titles, canonicals and
structured data, which is the correct fix for a client-rendered SPA's indexing problem.

### 3.2 What actually works in production

- **AI gateway.** `GET /api/ai` on production returns
  `{"ok":true,"engine":"NikAI Astra Neural Core","providers":{"groq":true,"gemini":true,"openai":false}}`.
  The primary path is healthy.
- **Payments.** Razorpay order creation and verification are implemented server-side
  (`create-razorpay-order`, `verify-razorpay-payment`), restricted to two plan codes — `weekly`
  at ₹49 and `monthly` at ₹99 — with signature verification and an amount cross-check against the
  created order.
- **PDF / handwriting pipeline.** Text-to-handwriting export, PDF studio, and OCR extraction are
  shipped, with bounded inputs (page caps, byte caps, text caps) added during the November hardening
  pass.
- **Build health.** 52 test files, typecheck and build passing; 35 routes prerendered.

### 3.3 The monetisation defect (most important technical finding)

The product charges money for something the code gives away.

```
src/config/features.ts
  SIGNUP_ENABLED = false
  FREE_TRIAL     = false
  AUTO_GUEST     = true

src/contexts/PremiumContext.tsx
  line 151  if (FREE_TRIAL || isPremium) return { allowed: true, used: 0, limit: Infinity }
  line 164  const incrementUsage = useCallback(...)      // defined
```

`incrementUsage()` is defined but **has zero call sites anywhere in `src/`** — the only other
reference is a comment in `Upgrade.tsx` acknowledging that `FREE_LIMITS` is inert. A usage counter
that is never incremented means `used < limit` stays true forever, so no free-tier limit can ever
fire.

Consequence: the ₹49 and ₹99 plans sell features that every visitor already has. The `/schools` page
now states this honestly ("Free editor" at ₹0, and a "Not included in any plan today" disclosure),
which is a real improvement in consumer-protection posture — but it also means **the payment pages
cannot convert, because there is nothing to buy.**

This is a decision, not a backlog item: either stop charging during launch, or wire the counters and
ship a tier that gates something. Until one of those happens, revenue is structurally zero regardless
of traffic.

### 3.4 Security and cost exposure

Two `VITE_`-prefixed AI keys (`VITE_GROQ_KEY`, `VITE_GEMINI_KEY`) are configured in the Vercel
project. Vite inlines `VITE_*` variables into the **browser bundle**, and `api/ai.ts` additionally
accepts an `x-groq-key` request header. Both keys are therefore extractable from shipped JavaScript
and spendable by anyone who does so. This is a live quota-theft exposure on a Hobby plan, and fixing
it means moving all AI calls behind the edge function — an architectural change, not a rename.

Positively, the deployed `vercel.json` carries a strict CSP, HSTS, `X-Frame-Options: DENY`,
`nosniff`, and a restricted `Permissions-Policy`. There are also regression tests asserting that
provider keys never reach the client bundle (`src/test/clientEnvSafety.test.ts`) — the intent is
right even though the current deployment still leaks them through `VITE_` naming.

---

## 4. Market and competitive position

### 4.1 What NikNote sells

Text → handwritten-looking PDF, plus an AI study workspace (notes, flashcards, habits, OCR, PDF
tools) aimed at Indian school and college students.

### 4.2 The pricing problem is a competitor problem

| Competitor | Offer | Price | Friction |
|---|---|---|---|
| LikhAI (likhai.in) | Text → handwriting PDF | **₹5/page** | No account |
| Assignment King | Handwritten assignments | from **₹6/page** | No account |
| NikNote | Same core feature + workspace | ₹49 / 7 days or ₹99 / 30 days | Account required |

The buying occasion is a student with an assignment due tomorrow. That student will pay ₹29 once,
immediately, for one PDF. They will not enter a subscription for it — and the two competitors
already sell exactly that impulse purchase, at a per-unit price, without asking for an account.

NikNote's only offers are subscriptions. The product is therefore priced against the wrong occasion.
Pay-per-download at ₹10–20 would not be a discount; it would be a different and better-matched
product.

### 4.3 Distribution

No acquisition channel is running. Signups are ~1–10 guests/day with two visible spikes (15 on 10 Nov,
56 on 13 Nov) that look like directed attention rather than organic growth. SEO is the only
asset-based channel, and it is early: 18 blog posts, 35 prerendered routes, sitemap present, Google
Search Console verification wired via `VITE_GSC_VERIFICATION`.

The honest read: **distribution has not started.** Everything before this point has been product
work.

---

## 5. Unit economics (ESTIMATE)

All figures in this section are ESTIMATE unless marked LIVE. Payment pricing is CODE.

| Input | Value | Source |
|---|---|---|
| Weekly plan | ₹49 | CODE: `create-razorpay-order` |
| Monthly plan | ₹99 | CODE, same |
| Monthly ARPU if all users take monthly | ₹99 | derived |
| Hosting | Vercel Hobby | LIVE: project plan = hobby |
| Database | Supabase free tier | configuration |
| AI inference | Groq / Gemini free-tier rates | configuration |

**The uncomfortable arithmetic.** At ₹99/month:

| Paying subscribers | Annual revenue |
|---|---|
| 10 | ₹11,880 |
| 100 | ₹1,18,800 |
| 1,000 | ₹11,88,000 |
| 10,000 | ₹1,18,80,000 (₹1.19 Cr) |
| 84,000 | ≈ ₹10 Cr |

To gross ₹10 Cr/year at consumer prices requires roughly **84,000 paying subscribers**. For scale:
India has a very large student population, but reaching 84,000 *paying* subscribers is a top-1%
consumer-app outcome requiring a funded team, a proven channel, and years. It is not reachable from
5 real users and ₹0 revenue by iterating on the product.

B2B is the only path where the arithmetic softens, because revenue per deal is 10–100× consumer:

| B2B price (annual) | Deals needed for ₹1 Cr |
|---|---|
| ₹4,999 tuition centre | 2,001 |
| ₹25,000 school | 400 |
| ₹1,00,000 institution | 100 |

**But** the codebase contains no seat, tenant, role, or multi-user layer. As of today a school paying
any of those prices would receive individual logins and nothing institutional. The `/schools` page
is now honest about this. Selling institutional contracts before building the tenant layer would be
selling a product that does not exist.

**Cost side.** At current volumes, infrastructure cost is effectively zero (Hobby plan, free-tier
database and AI). The binding constraint is not cost — it is willingness to pay, and traffic.

---

## 6. What an investor would underwrite, and what they would not

### Underwritable

1. **Execution velocity.** 61 routes, 23 edge functions, 27 migrations, 52 test files, and a
   hardening pass that added input bounds and fail-closed rate limiting across five functions — by
   one founder, with tests. This is an unusually high ship rate.
2. **A working core in production.** The handwriting pipeline and AI gateway are live and healthy
   right now. This is not a demo.
3. **Honesty debt already paid down.** Fabricated testimonials, invented "2,500+ students", fake
   uptime and star ratings, and non-existent B2B features have all been removed from the live site.
   That is rare, and it materially lowers diligence risk — the marketing now matches the code.
4. **A real reconciliation layer.** `verified_payments`, `revenue_reconciliation`, and `sales_leads`
   exist. Revenue claims are auditable, which is exactly what a diligent investor checks first.

### Not underwritable today

1. **Zero revenue, zero paying customers, zero verified payments.**
2. **Monetisation is not enforced** — the free tier has no working limit, so the product is
   functionally free and the paywall sells nothing.
3. **No distribution.** No channel, no measured traffic, no CAC, no funnel.
4. **No retention cohort.** 6 weekly authors out of 470 accounts is not evidence of a retention
   curve; it is a sample too small to fit one.
5. **No moat.** The core feature is replicable and already replicated by cheaper, frictionless
   competitors. Breadth of surface area is not defensibility.
6. **Solo-founder concentration.** Payments, schema, AI credentials, and release all rest on one
   person, with no documented handover.

---

## 7. Honest scenarios (ESTIMATE)

Three paths, all assuming a solo founder with no meaningful ad budget. These are planning envelopes,
not forecasts, and the base case is deliberately modest.

**Conservative — next 12 months, founder does product only, no sales**

- ~0–20 tuition centres × ₹4,999 = ₹0–1,00,000
- ~200 teacher plans × ₹999 = ₹1,99,800
- ~300 consumer subs × ₹99 × ~4 months = ₹1,18,800
- **≈ ₹3–4 lakh total.** Effectively a hobby with revenue.

**Base — founder works sales 2 hrs/day, SEO compounds, paywall fixed**

- ~150 tuition centres × ₹4,999 = ₹7,49,850
- ~1,500 teachers × ₹999 = ₹14,98,500
- ~2,000 consumer subs × ₹99 × ~6 months = ₹11,88,000
- **≈ ₹34 lakh.** A viable solo-founder business.

**Ambitious — a content channel works and a small paid budget is deployed**

- **≈ ₹1.2–2 crore.** Roughly 12–20% of a ₹10 Cr goal, and it requires the base case to hold *and* a
  channel to break out.

Beyond ₹2 crore requires hiring, and hiring requires either revenue or capital. That is the ceiling
for this structure.

---

## 8. Risks, ranked

| # | Risk | Severity | Evidence |
|---|---|---|---|
| 1 | Cannot charge anyone — paywall enforces nothing | **Critical** | `incrementUsage()` has 0 call sites |
| 2 | No distribution, no measurement | **Critical** | 33 analytics events ever; no GA4 ID |
| 3 | AI keys extractable from browser bundle, quota theft | **High** | `VITE_`-prefixed keys + `x-groq-key` header |
| 4 | Account creation disabled — no real signup possible | **High** | `SIGNUP_ENABLED = false` |
| 5 | Priced against the wrong buying occasion | **High** | ₹49/₹99 subscription vs ₹5–6/page rivals |
| 6 | No tenant layer; B2B cannot be delivered | **Medium** | no seat/role/tenant code |
| 7 | Guest-account debt (465 rows) and orphaned subscription row | **Medium** | `auth.users`, `user_subscriptions` |
| 8 | Solo-founder concentration | **Medium** | all functions on one person |
| 9 | Unapplied migrations / unverified production schema | **Medium** | quota hardening migration not applied |

---

## 9. What would change the picture

Four things, in the order that would move an investor's view most:

1. **Make the paywall real, or stop charging.** Wire `incrementUsage()` into the AI, style,
   flashcard and dictation call sites; set `FREE_TRIAL = false`; re-enable `SIGNUP_ENABLED`. Or
   publish "free during launch" and disable `/payment`. Either resolves the credibility problem.
   The second is one day of work; the first is a week and carries editor-breakage risk.
2. **Switch to pay-per-download.** A one-off ₹10–20 per PDF gate matches how the competitors sell and
   how students actually buy. Needs a Razorpay order type that is not a subscription.
3. **Instrument, then acquire.** Set `VITE_GA_MEASUREMENT_ID`, submit the sitemap in Search Console,
   post the first three reels, and send 25 tuition-centre messages. Then read the funnel instead of
   guessing at it.
4. **Produce one retention number.** A repeat-usage cohort over 30 days, however small, converts
   "6 weekly authors" from an anecdote into a datapoint.

---

## 10. Verdict

**Stage:** pre-seed product, pre-launch business.
**Ask posture:** this document is an analysis, not a fundraise; no valuation is asserted here.
**Strongest argument for backing it:** a founder who ships this much, tests it, corrects his own
public claims, and builds an auditable revenue ledger is a founder worth a conversation — the
scarcest input in a consumer app is not code, it is that combination of velocity and honesty.
**Strongest argument against:** after all of that work there are 5 real users, ₹0 revenue, no
channel, and a paywall that cannot take money. Until one paying customer exists, this is a very
well-built product in search of a business.

The next 30 days should not add features. They should produce one rupee of verified revenue and one
measured acquisition channel. Everything else is sequence risk.

---

### Appendix — verification commands

The LIVE figures above were produced on 17 Nov 2026 against Supabase project
`atuxocibsmflgwlwuvmv`:

```sql
select count(*) from auth.users;                                            -- 470
select count(*) from auth.users where email like '%@guest.niknote.online';   -- 465
select count(*) from verified_payments;                                     -- 0
select coalesce(sum(amount_paise),0)/100.0 from verified_payments;          -- 0
select count(*), count(distinct user_id) from notebooks
  where created_at > now() - interval '7 days';                             -- 32, 6
select count(*) from analytics_events;                                      -- 33
select count(*) from sales_leads;                                           -- 0
select max(created_at) from auth.users
  where email not like '%@guest.niknote.online';                            -- 2026-10-20
```

CODE references resolve at `872e51d` on `arena/fa802f8f-niknote`:
`src/config/features.ts`, `src/contexts/PremiumContext.tsx`,
`supabase/functions/create-razorpay-order/index.ts`, `api/ai.ts`, `vercel.json`,
`src/lib/tracking.ts`.

Project ref as recorded in the analysis run: `atuxocibsmflgwlwuvmv`.
