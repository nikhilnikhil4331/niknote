# NikNote Distribution Stack — Repository Evaluation

Date: 28 Oct 2026
Method: GitHub API queries executed from this session (`gh api`, `gh search repos`).
Star counts, licences and last-push dates below were read live, not recalled.

---

## 1. How the search was done (reproducible)

This was **not** an exhaustive review of GitHub. It was a targeted search across
the 38 capability areas in the brief, followed by in-depth inspection of the
candidates that could plausibly matter for a solo-founder product with ~1
visitor/day and ₹0 marketing budget.

```bash
# Metadata for every seed repository
gh api repos/{owner}/{repo} \
  --jq '"\(.full_name)\t\(.stargazers_count)\t\(.license.spdx_id)\t\(.pushed_at)"'

# Licence text, because several repos return NOASSERTION
gh api repos/{owner}/{repo}/license --jq '.content' | base64 -d | head

# Discovery beyond the seed list
gh search repos "programmatic seo"        --sort stars --limit 4
gh search repos "serp rank tracker"       --sort stars --limit 4
gh search repos "sitemap generator seo"   --sort stars --limit 4
gh search repos "structured data schema org" --sort stars --limit 4
gh search repos "open source seo audit"   --sort stars --limit 4
```

The discovery queries were the most informative part of the exercise: for
"programmatic seo", "serp rank tracker" and "sitemap generator", the top results
were **unmaintained or trivial** (24–63 stars, last push 2023–2025, no licence).
The ecosystem of small SEO tools is mostly abandoned side projects. That is a
real finding, not a gap in searching.

---

## 2. Evaluated repositories

| Repo | Function | Stars | Licence | Last push | Decision |
|---|---|---|---|---|---|
| n8n-io/n8n | Workflow automation | 208,889 | Sustainable Use (fair-code, **not OSI**) | 2026-10-28 | **REJECT** |
| PostHog/posthog | Product analytics | 40,493 | MIT core + commercial `ee/` | 2026-10-28 | **REJECT** |
| twentyhq/twenty | CRM | 60,009 | AGPL-3.0 + commercial `@license Enterprise` | 2026-10-28 | **REJECT** |
| gitroomhq/postiz-app | Social publishing | 39,919 | AGPL-3.0 | 2026-10-28 | **REJECT** |
| mautic/mautic | Email marketing automation | 10,860 | GPL-3.0 | 2026-10-27 | **REJECT** |
| growthbook/growthbook | A/B testing | 8,545 | MIT core + enterprise dir | 2026-10-28 | **REJECT** |
| plausible/analytics | Web analytics | 29,704 | AGPL-3.0 | 2026-10-28 | **REJECT** |
| kostja94/marketing-skills | Marketing skills for coding agents | 1,066 | MIT | 2026-10-26 | **INVESTIGATE** |
| dariubs/awesome-lead-generation | Curated lead-gen list | 88 | **No licence** | 2026-07-30 | **REJECT** |
| AgriciDaniel/claude-seo | SEO auditing tooling | 23,220 | MIT | 2026-10-22 | **INVESTIGATE** |
| StJudeWasHere/seonaut | SEO audit crawler | 845 | none declared | 2026-10-08 | REJECT |
| agamm/pseo-next | Programmatic SEO example | 63 | none declared | 2026-06-28 | REJECT |
| codinginflow/nextjs-programmatic-seo | Tutorial repo | 47 | none declared | 2025-02-05 | REJECT |

---

## 3. Why each rejection, honestly

**n8n — REJECT.** Not actually open source: the Sustainable Use License forbids
reselling and restricts commercial use, and content outside `main` is not
licensed at all. It is a ~1,000-file Node service that needs its own database,
queue and persistent host. NikNote has **no automation worth orchestrating yet**
— there is one lead form and one payment webhook path. Adding n8n would mean
operating a second platform to manage a business that currently has 5 users.
Revisit when there are repeatable multi-step workflows.

**PostHog — REJECT.** Excellent product, and the MIT core is genuinely open. But
self-hosting is ClickHouse + Kafka + Redis + Postgres, which is far beyond a
single Vercel hobby project. Its cloud tier is the sane option *later*. Right
now NikNote's problem is not analytics depth, it is **zero instruments**: events
never left the browser. That is fixed in-repo (see §4) in ~200 lines instead of
a new vendor. Revisit at ~1,000 weekly active users.

**twenty — REJECT.** AGPL-3.0 with a commercial carve-out, and a large
TypeScript monorepo with its own Postgres and Redis. NikNote's pipeline is
currently **zero leads**. A dedicated CRM is the right answer at 50+ active
opportunities, not at 0. The `sales_leads` table added in the previous session
answers the same questions with SQL.

**postiz-app — REJECT.** AGPL-3.0. AGPL's network clause matters: if the
publishing UI is offered to users over a network, the corresponding source must
be offered. That is a business risk for a future paid product. More decisive:
NikNote has **no social accounts to publish from**, so the tool would sit idle.

**mautic — REJECT.** GPL-3.0 PHP/MySQL application. Requires a PHP host, which
NikNote does not have. Lifecycle email is better served by a transactional API
(Resend/Postmark free tier) driven from Supabase — and even that needs a
credential the founder must supply.

**growthbook — REJECT (the important one).** A/B testing is not a tooling
problem here, it is a **statistical power problem**. At roughly 1 visitor per
day, detecting a realistic effect size needs thousands of visitors per variant.
Running "experiments" now would produce noise and false confidence. Shipping an
experimentation platform would *feel* like progress while measuring nothing.
This is exactly the kind of tool-acquisition the brief warns against.

**plausible — REJECT.** AGPL-3.0, Elixir/ClickHouse/Postgres. Same reasoning as
PostHog. The first-party funnel views added in-repo already answer "where do
people drop off", which is the actual question.

**awesome-lead-generation — REJECT.** 88 stars, **no licence file**, last pushed
July 2026. Without a licence there is no permission to reuse the content
(default copyright). It is also only a link list. Useful as a reading pointer,
not as a dependency.

**kostja94/marketing-skills — INVESTIGATE.** MIT, small, actively maintained.
Zero infrastructure — it is prompt/skill material for coding agents. Low risk,
plausibly useful as a checklist source. Not a runtime dependency.

**AgriciDaniel/claude-seo — INVESTIGATE.** MIT, 23k stars, Python. Genuine
auditing capability. Not integrated yet because the audit it performs (crawl,
titles, canonicals, structured data) is **already covered** by the prerender
work plus `src/test/prerender.test.ts`, which runs in CI on every push.

---

## 4. The stack that was actually chosen

The honest conclusion: **NikNote needed no new platform.** Every gap in the
brief was closable with infrastructure already paid for or already in the repo.

| Capability | Decision | What was done |
|---|---|---|
| A. SEO & site quality | **Built in-repo** | `scripts/prerender.mjs` — 35 routes now emit distinct HTML with real titles, canonicals, JSON-LD and internal links |
| B. Website analytics | **Built in-repo** | `src/lib/serverAnalytics.ts` — events now persist to Supabase (`analytics_events`) instead of dying in localStorage |
| C. Conversion tracking | **Built in-repo** | Funnel events wired: `pricing_viewed`, `checkout_started`, `payment_succeeded`, `payment_failed`, `signup_completed`, `first_note_created` |
| D/E. Social production & publishing | **BLOCKED** | No social accounts exist. Content prepared, nothing published |
| F. Lead capture | **Fixed previous session** | `sales_leads` + hardened `b2b-lead` edge function (v5) |
| G. CRM / pipeline | **SQL, not a platform** | `sales_leads` stages + `revenue_reconciliation` view |
| H. Email lifecycle | **BLOCKED** | No email provider credential (Resend/Postmark/SES) |
| I. Customer feedback | Exists | `feedback` table with abuse limits already in place |
| J. Conversion experiments | **Deferred deliberately** | Insufficient traffic for valid inference (see growthbook) |
| K. Automation | **Not yet justified** | No proven repeated workflow to automate |
| L. Growth reporting | **Built in-repo** | `acquisition_funnel_daily` and `channel_performance` SQL views |

### Security work that came with it

`analytics_events` previously granted `SELECT, INSERT, UPDATE, DELETE, TRUNCATE`
to `anon`. RLS blocked reads, but the grant surface was far wider than needed
and **nothing validated what was written**. Now:

- `anon` and `authenticated` hold `INSERT` only.
- `validate_analytics_event()` rejects unknown event types, payloads over 2 KB,
  and any payload containing note/PII keys.
- `NEW.user_id` is forced to `auth.uid()`, so a client cannot write events as
  another user.

Verified live against the database:

```
insert ... ('made_up_event')        -> ERROR 22023: Unsupported event type
insert ... ('{"note":"private"}')   -> ERROR 22023: Event payload contains disallowed field
insert ... ('{"page":"/blog"}')     -> accepted
```

---

## 5. What is still missing, and why

| Missing | Blocker | Who can unblock |
|---|---|---|
| Working AI | No `GEMINI_API_KEY` / `GROQ_API_KEY` secret | Founder — free key at aistudio.google.com/apikey |
| Search Console data | Needs a verification token in `VITE_GSC_VERIFICATION` | Founder — one paste from GSC |
| Google Analytics / Meta | Needs `VITE_GA_MEASUREMENT_ID`, `VITE_META_PIXEL_ID` | Founder, optional — first-party data now suffices |
| Lifecycle email | Needs an email provider key | Founder |
| Social distribution | No accounts, and none should be automated | Founder must own the accounts |
| Outbound sales | Requires a real phone number and human follow-up | Founder |

None of these can be responsibly faked, automated around, or bypassed. They are
credential and human-presence blockers, stated plainly.
