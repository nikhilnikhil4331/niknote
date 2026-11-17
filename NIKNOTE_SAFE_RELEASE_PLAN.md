# NikNote Safe Release Plan

**Prepared:** 2026-11-04 (UTC)  
**Branch:** `arena/fa802f8f-niknote`  
**Status:** Planning only. No deployment, migration, live Edge Function update, or production mutation has been authorized by this plan. Production remains read-only.

## Current release decision

**Do not release these changes yet.** Local verification is green for tests, app typecheck, and build, but the full lint command still fails and several release-critical behaviors have not been verified outside mocks. The user chose **fix blockers first** after asking about deployment. This plan does not change that decision or grant production authorization.

Local verification currently recorded:

- Vitest: **53 files / 757 tests passed**.
- Focused guest, quota, document, and OCR suites: **7 files / 31 tests passed**.
- `npm run typecheck`: passed.
- `npm run build`: passed; **4,868 modules** transformed and **35 routes** prerendered.
- `git diff --check`: passed.
- `npm run lint`: **386 errors / 68 warnings**; repository lint debt remains.
- Selected new regression tests and `src/lib/documentExtraction.ts` pass ESLint. Deno, live Supabase/provider, browser, and production E2E checks were not run.

## Release-blocking gates

### 1. Reconcile the deployment target and inventory

- Treat the checked-in Supabase ref `ievggapvfidhygkhtkug` as **not** the release target; the earlier read-only review identified `atuxocibsmflgwlwuvmv` as production.
- In a separately authorized release task, verify the current project link from the connected account and compare exact names/definitions for Edge Functions, RPCs, migrations, storage buckets, and relevant policies. Do not rely on counts or comments alone.
- Resolve local/remote drift: earlier inventory reported 18 local deployable functions and 21 migrations versus 20 remote functions and 15 remote migrations. Local now has **22** migration files because the new quota migration is unapplied.
- No Supabase CLI deploy is safe until this reconciliation is complete. The connected function update tool cannot package the shared `_shared/aiSecurity.ts` dependency for every importing function.

### 2. Validate the anonymous quota migration outside production

Migration `supabase/migrations/20261104100000_harden_anon_ai_quota.sql` is local and unapplied. Before it can be considered deployable:

- Apply it to a disposable Supabase instance whose schema reproduces the intended existing `anon_ai_limits` table and `(bucket, window_start)` unique key.
- Verify repeatability, the effective function owner/security-definer behavior, RLS/table grants, and direct RPC denial for `anon` and `authenticated` JWTs.
- Verify service-role RPC success, the exact fixed limit/window, atomic behavior at the fifth/sixth concurrent reservation, cleanup behavior, and failure responses from `guest-session`.
- Verify the actual edge gateway overwrites or supplies the requester-IP headers used by `guest-session`. The final `x-forwarded-for` hop has not been independently verified in this workspace. If trustworthy identity is unavailable, do not present this IP bucket as an abuse-resistant quota.
- Prepare and peer-review the exact rollback/forward SQL against the target schema before any authorized production application. Do not improvise rollback against a live project.

### 3. Verify guest email ownership and recovery

- Use a non-production project with controlled mailboxes and the same secure-email-change settings as the intended release environment.
- Test an upgrade from the original guest session using authenticated `auth.updateUser`; confirm the user UUID, profile, and existing cloud rows remain unchanged.
- Verify whether confirmation is required at the old address, new address, or both. Generated `@guest.niknote.online` addresses may not have a reachable mailbox; this is an unresolved blocker until a tested product-safe route exists.
- Test pending state across refresh, app close/reopen, sign-out, invalid/expired credentials, successful confirmation, and login after the old address has changed. Confirm the saved password is current and that failed recovery never creates a second workspace.
- Do not change production email settings or weaken confirmation to make the flow pass.

### 4. Verify `/documents` and OCR end to end

In a controlled non-production Supabase/provider environment:

- Run Deno formatting/typecheck/bundle checks and deploy only to that test project.
- Verify PDFs are limited to 20 pages, OCR to 8 scanned pages, extracted text to 16,000 characters, and the request/response remains JSON (`content`, `processMode`, `userMode`; response includes processed text/content/mode).
- Test supported PDF/JPEG/PNG/WebP files, invalid types, large files, OCR body limits, malformed content, timeout/provider failures, auth failures, quota failures, and empty provider responses.
- Confirm actual platform request-body limits and test memory on representative mobile hardware. Unit mocks do not prove PDF.js raster memory bounds or provider behavior.

### 5. Broader release assurance

- Recheck effective RLS and storage bucket limits/permissions in the intended project; the earlier read-only review found public-facing analytics/error-log insert paths and private buckets without object-size/MIME limits.
- Run a browser-based desktop/mobile journey: signup/confirmation, guest upgrade/recovery, create/edit/save/reopen note, sync conflict/offline reconnect, OCR/PDF import, AI quota denial, premium entitlement, payment webhook, and admin-role denial.
- Capture viewport/device/browser, project ref, test account, build identifier, and whether each step changed remote state. Keep sensitive user content out of test logs.
- Run full test/typecheck/build again from the exact release candidate. Keep the repository-wide ESLint failure visible; require a changed-code lint gate and explicitly review remaining 386/68 debt.

## Deployment sequence — only after explicit authorization

1. Confirm the exact branch, commit, Vercel project, Supabase project, and named inventory in a read-only preflight.
2. Review the migration and function diffs, secrets/environment names, auth behavior, RLS/storage changes, and recovery plan. Take required backups and document rollback steps.
3. Deploy first to an approved preview/staging environment; run the acceptance matrix and inspect logs/quotas without exposing note content.
4. Obtain explicit production authorization for the specific Vercel and Supabase actions. Deploy the web app and database/functions in the reviewed order; do not use the legacy Supabase project ref.
5. Verify health and user journeys, monitor quota/auth/OCR errors, and stop/rollback on any identity, data-preservation, authorization, or confirmation failure.

Until those gates are met and explicitly authorized, keep all work local and production read-only.
