# Project decisions
- Keep legal information in public React routes linked from the footer so visitors can read it without signing in.
- Route privileged AI requests through authenticated edge functions; browser bundles must never contain provider secrets.
- Treat authentication storage as essential and optional analytics as consent-dependent so declining tracking does not prevent sign-in.