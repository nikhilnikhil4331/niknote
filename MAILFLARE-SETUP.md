# NikNote × Mailflare — Custom Domain Customer Email Guide

[`hieunc229/mailflare`](https://github.com/hieunc229/mailflare) is installed inside [`./mailflare`](./mailflare) and integrated with NikNote's Admin Control Center (`/admin-panel-nikhil` and `/admin`) through the server-side `customer-email` Supabase Edge Function.

---

## 1. Architecture Overview

- **`./mailflare` (Self-Hosted Custom Domain Mail Server)**:
  Full Mailflare workspace supporting custom domain mailboxes (`support@niknote.online`, `hello@niknote.online`, `nikhil@niknote.online`, `billing@niknote.online`, `schools@niknote.online`), inbound routing, webmail inbox, calendar/booking, and outbound delivery via Cloudflare Email Sending, Resend (3,000 free emails/mo), Amazon SES, or any SMTP relay.
- **`supabase/functions/customer-email` (Secure Gateway)**:
  Admin-authenticated Edge Function that stores credentials encrypted-at-rest in `public.mailflare_config` (RLS service-role-only), sends individual or 1-to-1 personalized segment emails via Mailflare `POST /api/v1/send` (or Resend direct), reads customer replies via `GET /api/v1/messages`, and records an audit trail in `public.customer_email_logs`.
- **`src/components/admin/AdminMailflareStudio.tsx` (Admin Email Studio)**:
  Available in **Admin Control Center → Customer Email** (`/admin-panel-nikhil` and `/admin`), plus 1-click **"Email via Mailflare"** actions on users in Command Center and institution leads in Sales & Leads.

---

## 2. Deploy Mailflare for `@niknote.online`

### Option A — Deploy on Cloudflare Workers (Recommended)

> Keep the Worker name **`mailflare`** so Cloudflare Email Routing rules attach cleanly.

```bash
# 1. Install Mailflare dependencies
npm run mailflare:install

# 2. Authenticate Wrangler & deploy Worker
npm run mailflare:deploy

# 3. Store your scoped Cloudflare runtime token (DNS Edit + Email Routing Edit + Zone Read)
cd mailflare && npx wrangler secret put CF_TOKEN
```

### Option B — Self-Host with Docker

```bash
cp mailflare/.env.niknote.example mailflare/.env.docker
# Edit mailflare/.env.docker (set APP_URL=https://mail.niknote.online and RESEND_API_KEY or SMTP_URL)
npm run mailflare:docker
```

---

## 3. Connect Your Domain & Connect to NikNote Admin

1. Open your deployed Mailflare URL at **`/setup`** and create your admin account.
2. Add **`niknote.online`** under **Admin → Domains** and create your sender mailboxes (for example `support@niknote.online`, `hello@niknote.online`, `nikhil@niknote.online`).
   - *Free sending tip*: Under **Admin → Domains → Sending**, select **Resend** and paste a Resend API key (3,000 free emails/month).
3. In Mailflare, go to **Settings → API keys** and create a key:
   - Select your mailbox(es)
   - Check **`send`** (Send mail) and **`read`** (Read mail)
   - Copy the generated API key
4. Open **NikNote Admin (`/admin-panel-nikhil`) → Customer Email → Setup & Connection**:
   - **Mailflare Instance URL**: `https://mail.niknote.online` (or your `*.workers.dev` URL)
   - **Mailflare Mail API Key**: paste the key from step 3
   - Click **Auto-Detect Mailboxes** (or paste your `mbx_...` Mailbox ID)
   - Click **Save Settings** → **Send Test Email**

You can now send custom branded emails, reply to customer threads, and run personalized 1-to-1 announcements directly from NikNote Admin.
