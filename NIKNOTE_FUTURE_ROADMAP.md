# NikNote Future Roadmap

**Planning date:** 2026-11-04 (UTC)  
**Purpose:** Evidence-based next steps from the functionality, design-system, QA, security, and performance audits. This is a proposal, not a commitment or deployment authorization.

## Prioritization guide

- **P0 — release safety:** resolve risks that can point a deployment at the wrong project, bypass account-ownership expectations, or leave security controls unproven. Production remains read-only until separately authorized.
- **P1 — reliability and product integrity:** prevent silent data loss, abuse, and misleading unfinished experiences; close integration gaps.
- **P2 — usability, accessibility, performance:** make the system measurable, consistent, and usable across devices.
- **P3 — expansion:** add new product capabilities after reliability and integration gates are met.

## P0 — before any authorized production release

1. **Reconcile the deployment target.** The checked-in `supabase/config.toml` points at legacy project `ievggapvfidhygkhtkug`; production was identified as `atuxocibsmflgwlwuvmv`. Verify current account/project linkage in a controlled read-only check, enumerate every function/RPC/migration by name, and only change targets in an explicitly approved deployment task.
2. **Finish and verify guest email ownership conversion.** Local source now replaces the admin `email_confirm: true` upgrade with authenticated `auth.updateUser`, retains the active guest UUID, and saves pending-email status/credentials for recovery. The original generated guest address may be unable to receive any required old-address confirmation. Test both old/new confirmation requirements, duplicate addresses, session continuity, credential rotation, and abandoned confirmation in a controlled project before calling this ready; production auth settings remain unchanged.
3. **Verify effective production RLS and storage policy.** Recheck public-facing `analytics_events`/`error_logs` insert policies, the permissive `error_logs` check, private bucket restrictions, and user-owned row/object access. Prepare a reviewed remediation proposal; do not apply it without schema-change authorization.
4. **Validate guest quota hardening before release.** Read-only production catalog inspection confirmed `consume_anon_quota` was `SECURITY DEFINER`, callable by `anon`/`authenticated`, and trusted caller-selected bucket/limit/window. Local source now includes an unapplied migration that revokes public execution, requires the service-role claim, fixes the limit/window, and restricts bucket format; `guest-session` derives a keyed bucket from a request IP and fails closed. Unit/static harnesses pass, but gateway IP-header trust, target-schema compatibility, and actual RPC privilege denial remain unverified. `consume_ai_quota` still has no local migration despite being present remotely; reconcile both RPCs and history before a release task.
5. **Replace check-then-insert rate limiting.** Move legacy Edge Function limits to an atomic reservation primitive, and run concurrent-request tests. Confirm behavior when storage is slow, unavailable, or at the limit.
6. **Reconcile private upload delivery.** Confirm actual bucket visibility; replace `getPublicUrl` use for private objects with an authenticated path or time-limited signed URL. Add server/bucket MIME and object-size controls.

**Release gate:** Local audit patches are uncommitted and undeployed. Do not deploy any item in this list or change production secrets/schema/settings as part of this roadmap without the user's explicit authorization.

## P1 — reliability and product completeness

1. **Complete security regression tests:** live RLS ownership tests, user-to-user denial, concurrent quota tests, uploaded content policy tests, guest upgrade ownership tests, and configured/degraded provider tests.
2. **Cloud sync acceptance:** use a two-device browser harness to test clean pull, local-only changes, remote-only changes, both-side conflict, failed reads/writes, offline retry, deletion/restore, and duplicate/replayed requests. Preserve the current local-first recovery behavior.
3. **Complete live acceptance for Document Intelligence.** The local UI now performs bounded PDF/OCR extraction and sends the extracted `content` with processing modes; `process-document` validates bounded JSON and responds with JSON, with mocked contract tests passing. Exercise the real function/provider on a controlled project, verify gateway body limits, and test auth/quota errors before release.
4. **Resolve unintegrated modules:** decide whether to integrate or retire `FileUploadZone`, `WorkflowCanvas`, `AgentConsole`, `KnowledgeEngine`, and unused search components. A visible Run button must execute the real workflow or clearly communicate that it is a prototype; do not fake a successful run.
5. **Define workflow security/product boundary:** keep arbitrary JS disabled until there is a real isolated sandbox with resource/time limits, network policy, secrets isolation, and a threat model. Add migrations/quotas only after user-data model review.
6. **Finish upload/OCR product boundaries:** `/documents` now uses one bounded local extraction + JSON processing contract. Still define retention/provider disclosures, test the live upload limits, and retire or align latent components such as `FileUploadZone` that use an obsolete payload shape.
7. **Operational observability:** add server-side latency/error/abuse metrics that avoid sensitive note content and validate them against the privacy/consent policy. Keep admin metrics protected by server roles.

## P2 — accessibility, design system, and performance

1. **Make one semantic design-token source authoritative.** Connect colors, type, spacing, radii, elevation, focus, and motion to CSS/Tailwind/component use; remove duplicate/dead tokens or add tests proving generated styles consume them.
2. **Finish appearance themes.** Either implement the ten editor theme variants across shared components with screenshot tests, or simplify the UI to the modes that work. Apply the `css` theme output and all intended classes consistently.
3. **Contrast and keyboard QA.** Validate real light/dark/gradient/alpha states; fix normal-size text contrast; test focus rings, keyboard navigation, target sizes, screen readers, zoom/reflow, and reduced motion.
4. **Font reliability.** Add/remove Cedarville consistently; test font swap/offline behavior; consider self-hosting fonts where license and size permit.
5. **Performance budgets and code splitting.** Bring initial app JS toward the proposed 250 KiB gzip shell budget, split PDF/OCR/admin/AI routes, resolve mixed import patterns, and profile PDF worker startup and memory.
6. **Browser/device coverage.** Add Playwright or equivalent route-and-journey tests for mobile and desktop. Test at 360/375/390/430 px, safe areas, Android share/save, Safari/iOS, dark mode, and reduced motion.
7. **Lint debt:** reduce full-repository ESLint errors in small, baseline-tracked batches; preserve a clear changed-file lint gate so new code does not inherit the repository-wide diagnostic count.

## P3 — product expansion after safety gates

- Turn local-only Playground into optional account sync only after a data model, conflict policy, privacy choice, and export/recovery path are designed.
- Finish a real workflow editor/runner with save, versioning, stop/resume, observability, and permissioned integrations.
- Improve study/AI tools with user-controlled context sharing, explicit provider/retention disclosures, and accessible structured outputs.
- Improve PDF workflows with resumable jobs and clear local-versus-server processing indicators; keep browser-only behavior where that is a product promise.
- Add multilingual UI and richer templates only with translation completeness, font coverage, and cross-device verification.

## Suggested milestones and exit criteria

| Milestone | Main outcome | Exit criteria |
|---|---|---|
| M0: Safe release candidate | Correct target, verified policy/RPC inventory, email ownership flow | Named inventory reconciled, security checklist signed off, no unreviewed production mutation, tested rollback plan. |
| M1: Reliable core | Notes/cloud sync and AI/OCR failure paths | Two-device sync matrix passes; quota failures are explicit; no silent overwrites; upload sizes/types enforced. |
| M2: Integrated experience | Live vs prototype module map | Every routed product claim maps to a tested implementation or is removed/labeled. |
| M3: Accessible and fast | Unified tokens, contrast, code split | Browser accessibility run completed, performance budgets measured on mobile and desktop, regressions tracked. |
| M4: Product expansion | Syncable Playground and real workflows | Explicit data/permission model, isolated execution where needed, user-visible recovery and privacy controls. |
