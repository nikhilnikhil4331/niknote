# NikNote — Verified Business Status (28 Oct 2026)

Every number below comes from the live Supabase project `atuxocibsmflgwlwuvmv`
and the live repository. Nothing here is estimated unless it is labelled
**ESTIMATE**.

---

## 1. The truth about where NikNote is today

| Metric | Value | Source |
|---|---|---|
| Accounts in the database | 184 | `auth.users` |
| **Real registered humans** | **5** | 179 of 184 are `@guest.niknote.online` auto-created guest sessions |
| Users who ever created a note | 11 | `notebooks` distinct `user_id` |
| Users who created a habit | 7 | `habits` |
| Users who created a task | 6 | `todos` |
| **Verified revenue collected** | **₹0** | `verified_payments` is empty |
| Unverified payment claim | ₹49 (weekly, `pay_TqeMJfubIVuR4O`) | `user_subscriptions` row with no matching verified record |
| Active paid subscriptions | **0** | the single weekly plan expired on 2026-10-28 |
| Signups last 7 days | 76 → 27 → 6 → 7 → 3 → 1 → 1 | `auth.users.created_at` |
| Analytics events ever recorded | 1 | `analytics_events` |
| Organic/paid traffic measurement | **none configured** | no GA4 / Meta IDs in Vercel env |

### What this means

NikNote launched once, spiked to ~76 guest sessions in a day, and has decayed
to roughly **1 new visitor a day**. There is no traffic, no measurement, and no
paying customer.

The 183 "users" figure used in the planning docs is not real. It is guest
sessions. Do not repeat that number to anyone — especially not to a school.

---

## 2. The ₹10,00,00,000 question

**₹10 crore is not achievable from here in the near term, and any plan that
claims otherwise is lying to you.**

The arithmetic is unforgiving. Revenue = paying customers × price.

| Price point | Customers needed for ₹10 Cr/yr |
|---|---|
| ₹99/month consumer (₹1,188/yr) | ~84,000 paying subscribers |
| ₹999/year teacher plan | ~1,00,000 teachers |
| ₹4,999/year tuition centre | ~20,000 tuition centres |
| ₹25,000/year school (old page) | ~4,000 schools |

NikNote currently has **5 real users and 0 paying customers**. Reaching 84,000
paying subscribers is a top-1% consumer app outcome in India and would require a
funded team, a working acquisition channel, and years — not a code change.

### Honest scenarios

**Conservative — next 12 months, solo founder, no ad budget**
- 20 tuition centres × ₹4,999 = ₹99,980
- 200 teacher plans × ₹999 = ₹1,99,800
- 300 consumer subs × ₹99 × 4 months avg = ₹1,18,800
- **Total ≈ ₹4.2 lakh**

**Base case — founder works sales 2 hrs/day + SEO compounds**
- 150 tuition centres × ₹4,999 = ₹7,49,850
- 1,500 teachers × ₹999 = ₹14,98,500
- 2,000 consumer subs × ₹99 × 6 months = ₹11,88,000
- **Total ≈ ₹34 lakh**

**Ambitious — content hits, a channel works, small paid budget**
- **Total ≈ ₹1.2–2 crore.** Still only 12–20% of the ₹10 Cr goal.

Anything above ₹2 crore requires hiring. That is the honest ceiling for a
solo founder with ₹0 marketing spend.

---

## 3. Six things blocking every rupee

### Blocker 0 — The paywall gates nothing, and the site still charges
**Found 29 Oct 2026. This is the most important finding in this document.**

NikNote sells subscriptions for things it gives away to everyone.

| What the code says | Where |
|---|---|
| `FREE_TRIAL = true` | `src/config/features.ts:5` |
| `isPremium: FREE_TRIAL \|\| isPremium` — every visitor counted as premium | `src/contexts/PremiumContext.tsx:212` |
| `checkFeatureAccess()` returns `limit: Infinity` when the flag is on | `PremiumContext.tsx:151` |
| `incrementUsage()` has **no call site in the app** | `PremiumContext.tsx:165` |
| `SIGNUP_ENABLED = false` — nobody can create a real account | `src/config/features.ts:4` |

Consequences:

1. **Free users and paying users get identical access.** Premium buys nothing.
   The one customer who ever paid ₹49 got no feature they did not already have.
   That is a consumer-protection exposure under the Consumer Protection Act
   2019, and a chargeback risk on UPI.
2. **`/upgrade` and `/payment` were advertising fictional deltas.** "Unlimited
   Exports" (exports were never capped), "Priority AI" (no priority queue was
   built), "2,500+ students already premium" (5 real users).
3. **The `FREE_LIMITS` table cannot work as written.** Even with
   `FREE_TRIAL = false`, nothing ever increments a usage counter, so
   `used < limit` stays true forever and no limit ever fires.
4. **`SIGNUP_ENABLED = false` explains the account data.** 184 auth users, 179
   of them anonymous guests, because a real signup cannot happen.

What was shipped on 29 Oct: the pricing page now states the truth ("Free for
everyone") rather than inventing deltas, and the false claims are gone. **The
paywall was deliberately not turned on**, because flipping `FREE_TRIAL` without
first wiring `incrementUsage()` into the AI and style call sites would lock two
gates (AI Style Matcher, Handwriting Import) and leave the rest open — a worse
state than either extreme.

**Decision needed from the founder (see §5):** either (a) stop taking money and
tell visitors the product is free during launch, or (b) wire the counters and
launch a real paid tier.

### Blocker 1 — The AI works on the main path, but the fallback paths are dead
**Corrected 28 Oct 2026.** An earlier version of this document claimed "the AI
does not work at all". That was wrong, and the correction matters.

Verified live against production:

```
GET https://www.niknote.online/api/ai
{"ok":true,"engine":"NikAI Astra Neural Core",
 "providers":{"groq":true,"gemini":true,"openai":false}}
```

The primary AI gateway is the Vercel edge function `api/ai.ts`, and it is
healthy: Groq and Gemini both respond. The keys live in the Vercel project as
`VITE_GROQ_KEY` and `VITE_GEMINI_KEY`.

What is genuinely broken is the **fallback** layer. The Supabase edge functions
`openai-brain`, `editor-ai` and `ai-writing-assist` read `LOVABLE_API_KEY`,
`OPENAI_API_KEY`, `GEMINI_API_KEY` or `GROQ_API_KEY` from **Supabase** secrets,
and none of those exist. `aiEngine.ts` invokes `openai-brain` directly, so any
feature that reaches only that path fails.

Secondary but real: because the Vercel keys are named with a `VITE_` prefix,
Vite inlines them into the public browser bundle, and `api/ai.ts` also accepts
an `x-groq-key` header. Anyone can extract those keys from the JS and spend
your Groq/Google quota. Fixing it properly means routing every AI call through
`/api/ai` and holding the keys server-side only — an architectural change, not
a one-line edit, and it must not be attempted half-way or AI breaks.

**So the earlier "five-minute fix" framing was wrong.** Adding a Supabase
`GEMINI_API_KEY` is still worth doing to repair the fallback paths, but it is
not the headline blocker. Nobody was failing to use AI because of a missing key.

### Blocker 2 — Nobody is visiting
1 signup/day. No acquisition channel is running. SEO takes 3–6 months;
social needs an account and consistency; ads need money you should not spend yet.
The site is a client-rendered SPA, so every blog post serves the same
`index.html` — Google sees almost nothing unique per URL.

### Blocker 3 — The pricing model fights the buying occasion
A direct competitor, **LikhAI (likhai.in)**, sells the same core feature —
text → handwriting PDF — at **₹5/page, pay-per-download, no account**.
Assignment King does handwritten work at ₹6/page.

A student with an assignment due tomorrow will pay ₹29 once. They will not
enter a ₹99/month subscription. NikNote's only offers are ₹49/week and
₹99/month. Plan 1 in the sales playbook fixes this — but changing money code
without being able to test against Razorpay is dangerous, so it is specified
rather than shipped untested.

### Blocker 4 — The B2B pages were selling things that do not exist
Before today the `/schools` page advertised, for ₹25,000–₹2,00,000/year:
"teacher dashboard", "bulk student import", "white-label", "SSO",
"account manager", "LMS integration", plus invented testimonials from
"Principal, Delhi Public School" and "HOD Mathematics, IIT Delhi".

There is **zero** seat, tenant, or multi-user code in the codebase. A school
paying ₹2,00,000 would have received one login.

This has been corrected today — see section 4. Selling the old version risked
refunds, a consumer-protection complaint, and permanent reputational damage.

### Blocker 5 — Revenue was not auditable
`verified_payments` had 0 rows while a paid subscription existed. The books
could not be reconciled. There is now a `revenue_reconciliation` view that
classifies every payment as `verified_revenue`, `unverified_claim` or
`no_payment`.

---

## 4. What was actually fixed today

| Change | Why it matters |
|---|---|
| Created `sales_leads` table with a real pipeline (`new → contacted → demo → proposal → won/lost`) | B2B leads were previously written into `error_logs` as a text string and lost forever. Every lead is now a durable row. |
| Rewrote and redeployed the `b2b-lead` edge function (v5) | Validates email, infers segment, upserts the lead, and returns a real error instead of silently swallowing failures. |
| Created `revenue_reconciliation` view | Makes it impossible to claim unverified money as revenue. Currently shows ₹0 verified / 1 unverified ₹49 claim. |
| Rewrote `/schools` pricing: ₹999 teacher, ₹4,999 tuition centre, ₹0 30-day pilot | Matches what the product can actually deliver today. Indian coaching software benchmarks ₹6,000–₹20,000/yr, so these are defensible entry prices. |
| Removed all fabricated testimonials and fake stats sitewide | Removed "2,500+ students", "99.9% uptime", "4.8★", and six invented student reviews claiming exam results. Replaced with honest "early access" positioning. |
| Added a "not included in any plan today" disclosure | Lists teacher dashboard, bulk import, SSO, white-label, LMS integration as not yet built. |
| Fixed `/schools` meta title and FAQ claims | No longer promises a teacher dashboard or a 14-day trial that does not exist. |

Verified after the changes: `tsc --noEmit` clean, `npm run build` succeeds,
**228/228 tests pass**.

---

## 5. The one thing to do next — a decision, not a task

The pricing question is now the top of the queue, and it is not an engineering
choice. `/upgrade` currently tells the truth — every feature is free for
everyone — which means the page cannot sell anything. Pick one:

| Option | What it needs | Revenue | Risk |
|---|---|---|---|
| **A. Stop charging during launch** | One banner; turns `/payment` off | ₹0 until launch | None. Stops taking money for nothing. |
| **B. Launch a real paid tier** | Wire `incrementUsage()` into the AI, style, flashcard and dictation call sites; set `FREE_TRIAL = false`; re-enable `SIGNUP_ENABLED`; size the free tier so guests can still try the handwriting feature | Real, if anyone visits | Free users lose access they have today; a botched gate breaks the editor |
| **C. Switch to pay-per-download** | A one-off ₹10–20 per PDF gate. LikhAI sells at ₹5/page, Assignment King from ₹6/page, both without an account | Small, immediate, impulse-friendly | Needs a Razorpay order type that is not a subscription |

Today's numbers, for scale: 184 auth users (179 anonymous guests), 0 active paid
subscriptions, ₹49 lifetime revenue, 0 leads, 0 verified payments. The binding
constraint is still traffic, but B or C has to be true before traffic can turn
into money.

### The one thing to do next (after the decision)


**Get real traffic in front of the working product.** AI is live; the product
functions. What NikNote does not have is anyone arriving.

1. **Submit the sitemap in Google Search Console.** 35 URLs now render as 35
   distinct documents with their own titles, canonicals and structured data.
   None of that matters until Google is told they exist. (Needs the founder's
   Google account — `VITE_GSC_VERIFICATION` is already wired in `vite.config.ts`.)
2. **Post the first three reels** from `CONTENT-PACK.md`.
3. **Send 25 messages** to tuition centres using `SALES-PLAYBOOK.md`.

Then read `acquisition_funnel_daily` and `channel_performance` — both are now
populated by real events instead of localStorage guesses.
