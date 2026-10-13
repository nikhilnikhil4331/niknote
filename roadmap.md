# Launch-readiness checklist
- [x] Mobile draft identity persists on change, not cleanup; regression tests passed and authenticated create/open/new/reload/save preserved older content with no duplicate on repeat save; temporary test notes removed
- [x] Niknote-only email pages, Google/GitHub buttons/setup removed, animations and supported-device haptics; mobile/desktop and real invalid-login response checked, authenticated /money return checked
- [ ] New account email-confirmation and successful password sign-in end-to-end (requires an accessible test mailbox/account password; hosted email auth confirmed enabled, no settings changed)
- [x] Legal pages and working policy links
- [x] Remove browser-exposed private AI credentials and secure feedback submission
- [x] Cookie choice, privacy-aware analytics and metadata consistency
- [x] HTTPS headers, sitemap, robots, images, contrast and mobile checks
- [x] Verify public routes, forms and launch signals at desktop and mobile widths
- [x] Require captured, matching provider payments and prevent duplicate subscription activation
- [x] Enforce feedback rate limits on the server and compress the promotional video
- [ ] Confirm a live Razorpay transaction end-to-end (requires an actual authorized purchase)
- [ ] Confirm production deployment and cached social preview refresh (requires publishing and external crawler cache refresh)
# Niknote expansion (SmartNote modules)
- [x] Reference-style mobile home, drawer, notes, editor, AI, appearance, templates and profile; verified 375/390/430px without overflow, saved-note reopen, draft persistence and PDF download
- [x] Money Tracker (/money): transactions, categories, budget, goals + confetti, charts, split bill, PDF report, swipe delete, haptics
- [x] Daily Routine (/routine): habit blocks + streaks, to-do priorities + drag reorder, Pomodoro, water/sleep/exercise/mood, weekly report
- [x] Native app shell (Capacitor config + native haptics)
- [x] Link Money/Routine from main app navigation (Apps tab + dock)
- [x] Pen types (ballpoint, gel, fountain, pencil, marker), paper textures, smudge/fold/eraser/coffee/shadow/tilt effects; all 14 paper styles on mobile
- [ ] PDF upload → rewrite in handwriting, 300 DPI, batch, DOCX export
- [ ] Receipt scanner, bill reminders/notifications
- [ ] Premium extras: Hindi/Urdu UI, template library, signature generator, AI summary in handwriting, scan notes, biometric lock, student mode
- [x] New mobile UI: floating glass tab bar, app dock, Apps hub
- [x] Bottom dock on notebooks, flashcards, history, account, achievements, AI pages, documents, handbook, feedback, upgrade

- [x] PDF reading: page-by-page, parallel scan pages, cache, per-page retry
- [ ] AI brief part 2: background jobs on server, handwriting sample cleanup, realistic generation (see AI improvement brief)
