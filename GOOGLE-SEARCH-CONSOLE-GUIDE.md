# NikNote — Search Console, GA4 & Meta Pixel Owner Setup Runbook

Canonical production domain: **`https://www.niknote.online`** (`niknote.online` redirects via HTTP `308` to `https://www.niknote.online`; DNS is hosted on Cloudflare: `byron.ns.cloudflare.com`, `maisie.ns.cloudflare.com`).

---

## 1. Google Search Console (Domain Verification & Sitemap Submission)

### Option A — DNS TXT Record (Recommended: covers `niknote.online`, `www.niknote.online`, HTTP & HTTPS)
1. Open [Google Search Console](https://search.google.com/search-console) and click **Add property**.
2. Under **Domain**, enter `niknote.online` and click **Continue**.
3. Copy the TXT record value shown by Google (`google-site-verification=...`).
4. In **Cloudflare Dashboard → `niknote.online` → DNS → Records**, click **Add record**:
   - **Type:** `TXT`
   - **Name:** `@`
   - **Content:** `google-site-verification=<YOUR_TOKEN_FROM_GOOGLE>`
   - **TTL:** `Auto`
   *(Do not modify existing `A`, `CNAME`, or `MX` records.)*
5. Click **Verify** in Google Search Console.

### Option B — HTML Meta Tag (Supported in `vite.config.ts` without code edits)
1. In Google Search Console, choose **URL prefix** → `https://www.niknote.online/` → **HTML tag**.
2. Copy only the `content` attribute value from `<meta name="google-site-verification" content="YOUR_TOKEN" />`.
3. In **Vercel → `niknote` → Settings → Environment Variables**, add:
   - `VITE_GSC_VERIFICATION` = `<YOUR_TOKEN>` (Production)
4. Trigger a redeploy; Vite automatically injects `<meta name="google-site-verification" content="..." />` into `<head>`.

### Submit the Production Sitemap
1. Once verified in Google Search Console, go to **Indexing → Sitemaps**.
2. Enter:
   ```text
   https://www.niknote.online/sitemap.xml
   ```
3. Click **Submit**.
4. Use **URL Inspection** to inspect and request indexing for:
   - `https://www.niknote.online/`
   - `https://www.niknote.online/welcome`
   - `https://www.niknote.online/ai`
   - `https://www.niknote.online/pdf-editor`
   - `https://www.niknote.online/pdf-tools`
   - `https://www.niknote.online/scan-notes`
   - `https://www.niknote.online/upgrade`
   - `https://www.niknote.online/blog`

---

## 2. Google Analytics 4 (`VITE_GA_MEASUREMENT_ID`)

GA4 support is implemented in `src/lib/tracking.ts` with Google Consent Mode (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization` defaulting to `denied` until the user grants consent in the Cookie Banner) and CSP allowlisting in `vercel.json`.

1. Open [Google Analytics](https://analytics.google.com) → **Admin → Data Streams → Web**.
2. Create a web stream for `https://www.niknote.online` (Name: `NikNote Web`).
3. Copy your Measurement ID (`G-XXXXXXXXXX`).
4. In **Vercel → `niknote` → Settings → Environment Variables**, add:
   - `VITE_GA_MEASUREMENT_ID` = `G-XXXXXXXXXX` (Production & Preview)
5. Redeploy the project.
6. Verify in **GA4 → Admin → DebugView** or **Reports → Realtime** (accept cookies on `https://www.niknote.online` first so consent-gated tags activate).

### Configured GA4 Events
`session_start`, `page_view` (SPA route-deduplicated), `sign_up`, `login`, `begin_checkout`, `purchase` (fires strictly after server-side Razorpay signature verification with `transaction_id`), `generate_lead`, `click_cta`, `start_note_creation`, `save_note`, `export_note`, `premium_upgrade_click`.

---

## 3. Meta Pixel & Conversions API (`VITE_META_PIXEL_ID`)

Meta Pixel support is implemented in `src/lib/tracking.ts` and loads **only** after the user grants **Marketing** consent in Cookie settings.

1. Open [Meta Events Manager](https://business.facebook.com/events_manager2) → **Connect Data Sources → Web → Meta Pixel**.
2. Copy the numeric **Dataset / Pixel ID** (15–16 digits).
3. In **Vercel → `niknote` → Settings → Environment Variables**, add:
   - `VITE_META_PIXEL_ID` = `<YOUR_NUMERIC_PIXEL_ID>`
4. Redeploy and test with **Meta Events Manager → Test Events** (accept Marketing cookies in the site banner first).

### Configured Meta Standard Events
- `PageView` (initial load + SPA route changes, deduplicated)
- `ViewContent` (landing, pricing, feature, B2B, and blog post views)
- `CompleteRegistration` (real email account creation only — never guest mode)
- `Lead` (B2B `/schools` inquiry submission — zero PII transmitted)
- `InitiateCheckout` (Razorpay checkout modal opened)
- `Purchase` (server-verified Razorpay payment only, deduplicated with `eventID: purchase_<razorpay_payment_id>`)

### Optional Server-Side Conversions API (CAPI)
- **Never** place a Meta Conversions API Access Token in `VITE_*` frontend variables.
- If enabling server-side CAPI deduplication later, store `META_CAPI_ACCESS_TOKEN` and `META_PIXEL_ID` exclusively in **Supabase Edge Function secrets** (`verify-razorpay-payment`) and pass `event_id: purchase_<razorpay_payment_id>` so Meta deduplicates browser + server `Purchase` events automatically.
