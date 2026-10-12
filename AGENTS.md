# Project decisions
- Use a route-aware mobile presentation shell backed by existing notebook and editor hooks; keep desktop routes unchanged so the redesign does not fork product data.
- Keep legal information in public React routes linked from the footer so visitors can read it without signing in.
- Route privileged AI requests through authenticated edge functions; browser bundles must never contain provider secrets.
- Treat authentication storage as essential and optional analytics as consent-dependent so declining tracking does not prevent sign-in.
- Activate paid subscriptions only after server-side provider verification and a unique payment claim; client callbacks and retries cannot grant access.- Keep tracker math (streaks, bill split) as pure helpers in src/lib/trackers.ts with bun tests beside them, so rules stay checkable without the UI.
- PDF import runs page-by-page in the browser (src/lib/pdfPipeline.ts): text-layer pages skip AI, only scanned pages hit OCR with bounded parallelism, so one bad page never fails the document.
