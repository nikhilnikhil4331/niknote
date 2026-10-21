# Publishing NikNote as an Android app (Orion Store first)

NikNote is a Vite SPA. The Android build wraps the **bundled** `dist` output in a Capacitor
WebView, so the APK works offline and does not depend on the website being reachable.

- Package name: `online.niknote.app` (never change it — Android treats a different id as a new app)
- minSdk 24 (Android 7.0) · targetSdk 36
- Version lives in `android/app/build.gradle` (`appVersionName`, `appVersionCode`)
- Signing: your own keystore, kept outside the repo

---

## 1. Build the APK / AAB

Two ways, same result:

**A. GitHub Actions (recommended, nothing to install)**

1. Repo → **Actions** → **Android release** → **Run workflow**.
   Optional inputs: `version_name` (`1.0.1`), `version_code` (`2`) — every published build must use a
   higher `versionCode`.
2. Download the artefact `niknote-android-<version>`: it contains
   `niknote-v<version>.apk` (sideload stores, direct download) and `.aab` (Google Play).
3. For a real release, push a tag (`git tag v1.0.0 && git push origin v1.0.0`) — the workflow then
   attaches both files to a GitHub **Release**, which is exactly what Orion reads.

**B. Locally**

```bash
npm ci
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease    # or bundleRelease for Play
# output: android/app/build/outputs/apk/release/app-release.apk
```

You need JDK 21 + Android SDK for the local route.

### Signing (do this before the first public release)

```bash
keytool -genkeypair -v -keystore niknote-release.jks -alias niknote \
  -keyalg RSA -keysize 2048 -validity 10000
```

Add to GitHub → Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 niknote-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `niknote` (optional, this is the default) |
| `ANDROID_KEY_PASSWORD` | key password (optional, defaults to the keystore password) |

Without those secrets the workflow still builds, but signed with the **debug key**. That installs fine
today, however Android only accepts updates signed with the same key — so if you publish a debug-signed
build now and later switch to your own keystore, users have to uninstall and reinstall. Generate the
keystore first, then publish.

---

## 2. Orion Store

Orion has no upload form and no server: it is a **public JSON catalogue** that points at release assets.

### Route A — pull request to the catalogue (most reliable)

1. Fork [`RookieEnough/Orion-Data`](https://github.com/RookieEnough/Orion-Data).
2. Append the object from [`store/orion-listing.json`](../store/orion-listing.json) to the end of
   `apps.json` (keep the array valid — comma before it, no trailing comma after it).
3. Make sure the GitHub Release exists first: Orion resolves the newest release of
   `githubRepo` and looks for an asset whose name contains `releaseKeyword` (`apk`). The asset from our
   workflow is `niknote-v1.0.0.apk` ✔.
4. Open the PR with a one-line description and the release link. The maintainer merges it into `main`;
   the store reads that file directly, so a merge *is* the publish.

### Route B — in-app submission

Orion Store app → **Submit an app** → paste an Obtainium export (or the repo URL
`https://github.com/nikhilnikhil4331/niknote`) → it opens a pre-filled GitHub issue in the catalogue
repo. Same data as the JSON above.

### Catalogue rules that matter here

- **Assets must be direct image links.** Use `raw.githubusercontent.com`, not `github.com/.../blob/...`
  (that is an HTML page and the parser breaks). The JSON above already uses raw links.
- `packageName` must match the APK exactly (`online.niknote.app`).
- `releaseKeyword` should be `apk` while a release carries a single app; keep the APK filename stable.
- Icons/screenshots are not hosted by Orion, so they must stay reachable at those raw URLs.
- Current screenshot entries point at the promo cards in `public/promo/`. They show real NikNote output
  but they are marketing compositions — replace them with 3–4 real device screenshots before you ask
  for review (that is also the honest thing to do).

---

## 3. Google Play (when you want it)

Same AAB from the workflow, different paperwork:

1. Play Console → create app → package `online.niknote.app`.
2. Upload `niknote-v<version>.aab`, fill listing (title ≤30 chars, short description ≤80, full ≤4000).
3. Data safety: collect **email** (account), **notes content** only if the user signs in for sync
   (stored in Supabase), diagnostics **none**. No ads, no third-party analytics.
4. Privacy policy URL: `https://niknote.online/privacy` (the app already ships this route).
5. Content rating questionnaire, target audience 13+, no ads declaration.
6. Closed testing (12 testers / 14 days) before production — Play requires it for new personal accounts.

Nothing in the repo needs to change for Play: the AAB is already produced by the same workflow.

---

## Before you publish — quick checklist

- [ ] `npm run verify` green, `npm run build` produces `dist/`
- [ ] `android/app/build.gradle` versionCode increased since the last release
- [ ] First release signed with your keystore (not debug)
- [ ] `https://niknote.online/privacy` loads and matches what the app actually does
- [ ] App opens offline (airplane mode) and a note survives an app restart
- [ ] GitHub Release has `niknote-v<version>.apk` attached
- [ ] Catalogue entry added with a raw icon URL and `packageName: online.niknote.app`

## Known limits of the current APK

- Google sign-in inside a WebView can be blocked by Google's OAuth policy; email/password works.
  If you want Google sign-in in the app, add `@codetrix-studio/capacitor-google-auth` or move to
  Custom Tabs (`@capacitor/browser`) — a separate change, not done here.
- The APK ships the web bundle, so a web fix reaches users only with a new APK version (that is the
  trade-off for offline support).
- Play tracks (`versionCode`) are manual by design; there is no auto-bump.
