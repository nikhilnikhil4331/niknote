# NikNote payment confirmation email

## Receipt implementation

- `supabase/functions/_shared/payment-confirmation-email.ts` renders the responsive, table-based HTML receipt and plain-text alternative; validates the plan, amount, and Razorpay payment reference; and resolves only a real account or checkout email address. The receipt shows the INR plan/amount, transaction date, payment ID, and case-preserving `NN-{paymentId}` reference. It omits card, bank, UPI, and other payment credentials.
- The receipt sender reads the existing `public.mailflare_config` row through the Supabase service-role REST API, then sends through the configured Resend account. The provider API key stays in the database and is never returned to the browser or logged. Sender name/address and reply-to are validated before use.
- `supabase/functions/verify-razorpay-payment/index.ts` sends only after server-side Razorpay signature/capture/order checks and the atomic `activate_verified_purchase` RPC. It does not trust a frontend callback as payment proof. The stable `niknote-payment-{paymentId}` idempotency key makes verification/recovery retries safe.
- The order remains recoverable until the receipt send succeeds. If the sender config is missing, the provider fails, or there is no deliverable recipient, the function does not claim a receipt was sent or close the pending order; recovery can try again.
- `supabase/functions/razorpay-webhook/index.ts` contains a separate signed `payment.captured` recovery path. It verifies the exact raw-body HMAC and canonical Razorpay order/payment, then activates and emails only after the same server-side checks. That endpoint is not live until separately configured with `RAZORPAY_WEBHOOK_SECRET` and registered in Razorpay.
- The receipt requests Fredoka display text and Inter body text, with email-safe fallbacks. Inline styles, tables, mobile treatment, and image alt text provide graceful rendering when fonts or images are blocked.

## Provider and production state checked

- The production Supabase project `atuxocibsmflgwlwuvmv` has an active `customer-email` Edge Function (v3). Its `mailflare_config` row is set to `resend`, has a sender address, and has a stored Resend key. The delivery log contains six successful Resend sends. The key itself was not retrieved or exposed.
- The deployed `verify-razorpay-payment` was updated from v6 to v7 to use the existing server-side Resend configuration for receipts. Its JWT verification remains enabled. No test purchase or live email was sent from this workspace.
- No Supabase secret, Auth setting, schema, or data was changed. The sender configuration was read only; the only Supabase change was the payment-verification function code deployment.
- The branded account-email hook is a separate issue: `auth-email-hook` is not deployed, the Supabase Auth Send Email Hook is disabled with no URI, and SMTP is unset. The local hook source currently uses the Lovable signing/API contract, but the production project has no `LOVABLE_API_KEY`. Reusing the Resend sender for account emails requires a compatible hook implementation and an explicitly authorized Auth configuration change; do not enable an unready hook.
- The signed Razorpay webhook function is not deployed and `RAZORPAY_WEBHOOK_SECRET` is absent. Do not deploy/enable it until the real webhook secret is configured and Razorpay is pointed to the endpoint.

## Share and referral messages

- `share-invite.tsx` and `referral-invite.tsx` are preview-only templates. There is no authorized private-note invitation backend here to grant collaboration access or send those messages from NikNote.
- The referral and public-share actions create user-owned `mailto:` drafts. A draft does not send mail from NikNote and does not change private sharing permissions or grant unsupported rewards.

## Verification and remaining work

- Mocked receipt/payment tests cover plan and amount validation, recipient selection, sanitized sender configuration, Resend payload/idempotency, activation-before-email ordering, missing-sender/provider-failure recovery, webhook signatures, and duplicate delivery. They do not make a live charge or send a live test email.
- Production receipts now use the deployed v7 `verify-razorpay-payment` function. Validate a real delivery only with an authorized test purchase or a safe provider test flow; do not send a production charge merely to test email.
- To deliver branded signup/invite/reset messages, first authorize the separate Auth hook change and deploy a hook compatible with Supabase's Send Email contract. Keep the Auth hook disabled until that is implemented and verified.
- To activate webhook-only payment recovery, separately configure the real `RAZORPAY_WEBHOOK_SECRET` in Supabase and register `payment.captured` in Razorpay.
- A Vercel deployment does not deploy Supabase Edge Functions, change Supabase Auth settings, or configure Razorpay. Live rendering in Gmail, Outlook, and Apple Mail has not been tested from this workspace.
