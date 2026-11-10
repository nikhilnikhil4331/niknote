# NikNote payment confirmation email

## Implementation

- `supabase/functions/_shared/payment-confirmation-email.ts` renders the branded, responsive table-based HTML receipt and plain-text alternative, validates plan/amount/payment reference, resolves a deliverable account or Razorpay checkout email, and sends through the Lovable transactional email API already used by `auth-email-hook`. The HTML requests Fredoka for display text and Inter for body text, with email-safe fallbacks when remote fonts are blocked.
- `supabase/functions/verify-razorpay-payment/index.ts` sends only after server-side Razorpay capture validation and the atomic `activate_verified_purchase` RPC. Frontend checkout callbacks are never treated as proof of payment.
- `supabase/functions/razorpay-webhook/index.ts` is the new signed `payment.captured` webhook path. It verifies the raw-body HMAC, fetches the canonical payment and order from Razorpay, checks the server-created `checkout_orders` row and fixed plan amount, activates idempotently, then sends the receipt.
- Receipt delivery uses the stable `niknote-payment-{paymentId}` idempotency key. The order remains recoverable until the provider accepts the receipt; verification and webhook retries can safely retry delivery.
- The email contains the plan, INR amount, Razorpay payment ID, transaction date, and a case-preserving `NN-{paymentId}` reference. It deliberately omits card, bank, UPI, and contact details. Guest-generated `@guest.niknote.online` addresses are not used as destinations; the Razorpay checkout email is used when present.
- `src/pages/Payment.tsx` and `src/styles/niknote-payment.css` apply the same warm-ivory, blue, yellow, coral, green, and dark-outline identity to checkout and the verified-payment screen. The illustration is `public/images/email/niknote-payment-confirmation-hero.jpg`.

## Other email types and invite drafts

- `supabase/functions/auth-email-hook/index.ts` maps the six account emails (signup, auth invite, magic link, password recovery, email change, and reauthentication) to a shared NikNote shell. The shell uses Fredoka for headings and Inter for body text when a client permits the Google Fonts stylesheet, with Inter/Aptos/Segoe UI/Arial fallbacks. Each email kind retains its own branded accent; the layout and core styles remain inline for email-client compatibility.
- `share-invite.tsx` and `referral-invite.tsx` are registered in the protected template preview renderer. They are templates only; there is no authorized private-note invitation backend in this repository to send a collaboration invite or grant access.
- The referral widget and public-share panel create plain-text `mailto:` drafts in the user's own mail app. Referral drafts use the user's referral link; note-share drafts are available only for a public share URL. This does not send mail from NikNote or change private sharing permissions.

## Required production configuration (not performed here)

1. Set the Razorpay webhook secret as Supabase function secret `RAZORPAY_WEBHOOK_SECRET`. This is separate from `RAZORPAY_KEY_SECRET`.
2. In Razorpay's webhook settings, point to `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook` and subscribe to **`payment.captured`**. `supabase/config.toml` disables gateway JWT verification for this endpoint; the handler instead authenticates the exact request body with the webhook HMAC.
3. Set `LOVABLE_API_KEY` (and optional `LOVABLE_SEND_URL`) as Supabase function secrets and verify that `noreply@notify.niknote.online` / `notify.niknote.online` are approved for transactional sends.
4. The connected production Supabase project was checked read-only: `auth-email-hook` is not deployed, the Auth send-email hook is disabled, and SMTP is unset. Deploy/configure that hook before expecting branded signup/invite/reset emails to send. The payment/webhook functions also need deploying separately from Vercel.
5. Vercel preview deployment does not deploy Supabase functions, change Supabase Auth settings, or add secrets. Do not send or paste secret values into chat; add them directly in the Supabase secrets UI.

Without the Razorpay dashboard webhook configuration, browser verification and its recovery flow still send receipts when their server-side checks succeed, but webhook-only recovery is not active. Missing mail credentials or an invalid sender configuration leave a verified purchase active and its order recoverable; the UI offers a receipt retry. No production settings or data were changed in this work.

## Verification and limits

- Mocked tests cover HTML/plain text, escaping, fixed price/plan checks, private credentials, recipient selection, idempotency, provider outage retries, webhook signature rejection, captured-payment verification, and duplicate webhook delivery.
- Live mail delivery and rendering in Gmail, Outlook, and Apple Mail have **not** been run from this workspace. The template uses inline styles and table layout, with a small-screen media query and alt-text fallbacks; validate using test inboxes or an email-rendering service after a separately authorized deployment.
