# Customer Email Manager

The Email Manager is available in `/admin-panel-nikhil` (or `/admin-email`) and in the `/admin` dashboard. It uses the admin-authenticated `customer-email` Supabase Edge Function. Existing provider settings and mailbox data are stored in Supabase; opening the panel does not reset them.

The gateway supports Resend direct sending or a separately deployed Mailflare instance. Provider keys remain server-side. Resend sending requires a configured API key and a verified sender/domain. Inbox receiving requires a separately configured inbound webhook or Mailflare instance; sending configuration alone does not enable receiving.

Use **Email Manager → Setup & Connection** to inspect the saved configuration and send a test to an address you control. Never paste keys into source files or chat. A saved key does not by itself prove that the provider or domain is working.

The migrations in `supabase/migrations` describe the original schema. Review them before applying to an existing database, and do not overwrite existing settings. The Mailflare server itself is not included in this repository; see [Mailflare](https://github.com/hieunc229/mailflare) if a separate instance is needed.
