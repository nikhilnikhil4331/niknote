# Customer Email Manager

The Email Manager is available in `/admin-panel-nikhil` (or `/admin-email`) and in the `/admin` dashboard. It uses the admin-authenticated `customer-email` Supabase Edge Function. Existing provider settings and mailbox data are stored in Supabase; opening the panel does not reset them.

The gateway supports Resend direct sending or a separately deployed Mailflare instance. Provider keys remain server-side. Resend sending requires a configured API key and a verified sender/domain. Inbox receiving requires a separately configured inbound webhook or Mailflare instance; sending configuration alone does not enable receiving.

Use **Email Manager → Setup & Connection** to inspect the saved configuration and send a test to an address you control. Never paste keys into source files or chat. A saved key does not by itself prove that the provider or domain is working.

## Resend incoming mail (manual sync)

1. In Resend, enable **Receiving** for the verified `niknote.online` domain and copy the exact receiving MX record shown in that domain's dashboard. Before changing the root-domain MX, inventory all existing MX records; changing them can redirect or interrupt existing mail. Back up the records and only proceed after confirming the intended service. Do not alter unrelated DNS, SPF, or DKIM records. Follow Resend's current custom-domain receiving instructions.
2. Add the receiving MX record through Namecheap Advanced DNS as directed by Resend, then verify receiving in Resend. Changing the root MX routes mail for the entire domain, not just `support`.
3. Deploy `resend-inbox-sync` to the actual active project, with gateway JWT verification disabled: it performs its own admin session/JWT role validation before reading server-side credentials. It uses the Resend API key already stored in `mailflare_config` (or the server-side `RESEND_API_KEY` fallback). That key must have permissions to list and retrieve received email; a sending-only key may not. Never paste API keys into chat or source code.
4. In Email Manager, press **Sync Resend** to import recent messages for enabled, registered mailboxes. The sync checks the latest 30 messages only, so it is not a complete historical import. Deleted messages can be re-imported if they remain in those 30; move messages to Trash rather than permanently deleting them until they age out. Only attachment metadata is imported; downloading attachments is not supported. No inbound webhook is required for this manual sync.
5. Send a non-sensitive test email from an external address to `support@niknote.online`, sync, and verify it appears and can be replied to. Sending and receiving must each be tested separately. Avoid sharing real OTPs or other secrets during testing.

Resend and Namecheap credentials and settings cannot be configured by this repository alone. This does not automatically enable receiving or prove the existing sending key has the required permissions.

## Production release protection

Vercel's project build command runs `node scripts/check-email-manager.mjs` for production before `npm run build`. A production checkout missing the guard, admin routes, manager, retro template, or Resend sync fails instead of replacing the live site. `npm run build` and CI also run the guard from this branch. If a release fails, merge the current production features into the release branch and rerun the build. The guard is a structural check, not an end-to-end mail test. Project build-command changes, repository-level build overrides, rollbacks or promotion of an already-built older deployment can bypass it. Keep production changes integrated in the release branch and review deployments before promoting them; update the guard deliberately if these integrations are refactored.

The migrations in `supabase/migrations` describe the original schema. Review them before applying to an existing database, and do not overwrite existing settings. The Mailflare server itself is not included in this repository; see [Mailflare](https://github.com/hieunc229/mailflare) if a separate instance is needed.
