# Orion Store — copy-paste submission

Everything below is ready to paste. Nothing here publishes anything by itself.

## 1. Fork + edit

1. Open <https://github.com/RookieEnough/Orion-Data> → **Fork**.
2. In your fork open `apps.json` → pencil icon.
3. Scroll to the very end of the array. The last entry ends with `}` then `]`.
   - Add a comma after that `}`
   - Paste the object below, then keep the closing `]`
4. Commit directly to your fork's `main` with the message:
   `Add NikNote — handwritten-feeling study notes (online.niknote.app)`

```json
  {
    "id": "niknote",
    "name": "NikNote",
    "description": "Write study notes that look handwritten. NikNote turns any text, PDF page or lecture transcript into a real-looking notebook page — ruled, grid, Cornell or spiral, with your own ink colour, pen type and page texture. NikAI (the built-in assistant) explains topics, builds revision notes and quizzes you, and a study planner turns deadlines into sessions you can export to your calendar. Notes stay on your device; sync is opt-in. No ads, no trackers.",
    "icon": "https://raw.githubusercontent.com/nikhilnikhil4331/niknote/main/public/niknote-logo-512.png",
    "version": "1.0.0",
    "latestVersion": "Latest",
    "downloadUrl": "#",
    "repoUrl": "https://github.com/nikhilnikhil4331/niknote",
    "githubRepo": "nikhilnikhil4331/niknote",
    "releaseKeyword": "apk",
    "packageName": "online.niknote.app",
    "category": "Education",
    "platform": "Android",
    "size": "9 MB",
    "author": "Nikhil (nikhilnikhil4331)",
    "screenshots": [
      "https://raw.githubusercontent.com/nikhilnikhil4331/niknote/main/public/promo/feature-handwriting.jpg",
      "https://raw.githubusercontent.com/nikhilnikhil4331/niknote/main/public/promo/feature-ai-teacher.jpg",
      "https://raw.githubusercontent.com/nikhilnikhil4331/niknote/main/public/promo/exam-packs.jpg"
    ]
  }
```

Sanity check before committing: <https://jsonlint.com> — paste the whole file, it must parse.

## 2. Open the pull request

Title:

```
Add NikNote — handwritten-feeling study notes (online.niknote.app)
```

Body:

```
Adds NikNote, an open-source note-taking app for students.

- Package: online.niknote.app
- Source: https://github.com/nikhilnikhil4331/niknote
- Release (resolved by githubRepo + releaseKeyword "apk"):
  https://github.com/nikhilnikhil4331/niknote/releases/tag/v1.0.0
  assets: niknote-v1.0.0.apk, niknote-v1.0.0.aab
- APK is 9 MB, minSdk 24, targetSdk 36, single app per release.
- Icon and screenshots are direct raw.githubusercontent.com links.
- No ads, no trackers; notes are stored on device, sync is opt-in.
- Privacy policy: https://niknote.online/privacy

Happy to adjust any field (category, description length, screenshot count).
```

## 3. After the merge

The store reads `apps.json` directly, so the merge is the publish. Check in the app:
search "NikNote" → the entry should show 1.0.0 and download `niknote-v1.0.0.apk`.

## 4. Shipping the next version

1. `android/app/build.gradle` → raise `NIKNOTE_VERSION_CODE` default (2, 3, …) and `NIKNOTE_VERSION_NAME`.
2. `git tag v1.0.1 && git push origin v1.0.1` — CI attaches new APK + AAB to that release.
3. Orion picks it up automatically because `githubRepo` is unchanged; nothing in the catalogue needs editing.

Keep the asset name pattern `niknote-v<version>.apk` (it contains the `apk` keyword).
