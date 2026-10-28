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

## 3. Five things blocking every rupee

### Blocker 1 — The AI does not work. At all. (highest impact, 5-minute fix)
Every AI edge function requires `LOVABLE_API_KEY`, `OPENAI_API_KEY`,
`GEMINI_API_KEY` or `GROQ_API_KEY`. **None of those secrets exist in the
project.** The configured secrets are only Supabase + Razorpay.

The deployed `ai-proxy` function is well written and already handles this
correctly — it returns `503 provider_not_configured`. But that means every
"AI Generate", "AI Solver", handwriting analysis, document processing and AI
writing assist call fails for every user.

The product's entire headline promise is offline.

**Fix (only Nikhil can do this):**
1. Get a free key at https://aistudio.google.com/apikey (Gemini, free tier)
2. Add it as a Supabase secret named `GEMINI_API_KEY`
3. Redeploy `ai-proxy` and `editor-ai`

That is it. It costs ₹0 and unblocks the premium pitch.

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

## 5. The one thing to do next

If you do only one thing this week:

**Add a free Gemini API key as a Supabase secret named `GEMINI_API_KEY`.**

Until the AI works, the premium product being sold does not exist. Everything
else — pricing, SEO, sales calls — is building on sand.
