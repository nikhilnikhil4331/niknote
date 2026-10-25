# NikNote — APK (Android app) banane ka pura guide

> NikNote **PHP me nahi** bani hai. Yeh ek **React + TypeScript (Vite)** app hai jo
> **Capacitor** ke through native Android app (APK) me convert hoti hai.
> Website aur APK — dono **ek hi codebase** se bante hain, is liye logo, icons aur AI
> dono jagah same rehte hain.

---

## 1. Ek baar ka setup

```bash
npm install                # dependencies
npm run icons              # website logo se saare app icons + splash banata hai
npm run android:sync       # icons + production build + native project sync
```

`npm run icons` yahi kaam karta hai:

- `public/niknote-logo.png` (website ka official logo) se sparkle mark nikalta hai
- PWA / favicon / apple-touch icons (`public/icons/*`)
- Android launcher icons — legacy, round aur **adaptive (Android 8+)**
  → `android/app/src/main/res/mipmap-*/`
- Android splash screens (portrait + landscape, har density)
  → `android/app/src/main/res/drawable-*/splash.png`

Matlab: **website ka logo = phone app ka logo**. Kabhi mismatch nahi hoga.
Logo badalna ho to sirf `public/niknote-logo.png` replace karo aur `npm run icons` chala do.

## 2. APK build karna

### ⭐ Sabse aasan — GitHub Actions (Android Studio ki zaroorat nahi)

Repo me do workflows already hain:

| Workflow | Kab chalta hai | Output |
| --- | --- | --- |
| `.github/workflows/ci.yml` | har push / PR | type-check + tests + web build |
| `.github/workflows/android-apk.yml` | `v*` tag, PR, ya manual | ready APK |

APK nikalne ke 3 tareeke:

1. **Actions → Android APK → Run workflow** → run khatam hone par neeche
   **Artifacts → niknote-apk** download karo.
2. **Release (share karne layak link):**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   → GitHub automatically **Release** banata hai jisme `niknote-xxxxxxx.apk` laga hota hai.
   Link: `https://github.com/nikhilnikhil4331/niknote/releases/latest`
3. `workflow_dispatch` me `release: true` tick karo.

### Apne computer par

Do raste hain:

### A) Android Studio se (sabse aasan)

```bash
npm run android:open       # Android Studio khul jayega
```

Android Studio me: **Build → Build Bundle(s)/APK(s) → Build APK(s)**
APK yahan milega: `android/app/build/outputs/apk/debug/app-debug.apk`

### B) Command line se (Android SDK installed hona chahiye)

```bash
npm run android:apk        # debug APK
npm run android:aab        # Play Store ke liye release bundle
```

## 3. Play Store / share karne ke liye release APK

```bash
keytool -genkeypair -v -keystore niknote-release.jks \
  -alias niknote -keyalg RSA -keysize 2048 -validity 10000
```

`android/key.properties` banao:

```properties
storeFile=/absolute/path/niknote-release.jks
storePassword=******
keyAlias=niknote
keyPassword=******
```

Phir `npm run android:aab` — `android/app/build/outputs/bundle/release/app-release.aab`.

## 4. App ke andar kya same rehta hai

| Cheez | Website | APK |
| --- | --- | --- |
| Logo / launcher icon | `public/niknote-logo.png` | same logo se generate |
| Splash screen | boot screen | same logo, white background |
| NikAI | `/api/ai` gateway | wahi cloud gateway (device se direct) |
| PDF Studio | `/pdf-editor` | same screen, fully on-device |
| PDF download | browser download | **Documents folder + share sheet** (Filesystem + Share plugins) |
| Notes / Handwriting | local + Supabase | local + Supabase |

## 5. Common problems

- **"Logo purana dikh raha hai"** → APK uninstall karke naya install karo. Android
  launcher icons cache karta hai.
- **PDF save nahi ho raha** → APK me file `Documents/NikNote` folder me jati hai aur share
  sheet khulta hai (WhatsApp/Drive/Email). Nahi dikh raha to phone ke **Files → Documents**
  me dekho.
- **AI kaam nahi kar raha** → internet check karo. APK me AI cloud gateway se chalta hai
  (`https://www.niknote.online/api/ai`). Agar aapke paas apna key hai to
  NikAI → profile menu → **Cloud & API Keys** me Groq/Gemini key daal do.
- **Gradle build fail** → `android/local.properties` me apna SDK path do:
  `sdk.dir=/Users/you/Library/Android/sdk`
- **White screen** → `npm run android:sync` dobara chalao (web assets APK ke andar copy hote hain).

## 6. Package id / app name

- App name: `NikNote` (`android/app/src/main/res/values/strings.xml`)
- Package id: `app.lovable.c3b001c91ebc4b888264e21284718120`
  (Play Store par pehli upload ke baad ye badalna possible nahi hota — chaho to
  upload se **pehle** `capacitor.config.ts`, `strings.xml` aur
  `android/app/build.gradle` (`applicationId`) me apna id daal do, e.g. `online.niknote.app`.)
