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

Repo me do workflows hain:

| Workflow | Kab chalta hai | Output |
| --- | --- | --- |
| `.github/workflows/ci.yml` | har push / PR | type-check + tests + web build |
| `.github/workflows/android-release.yml` | `v*` tag, ya manual run | **signed APK + AAB** release me |

APK nikalne ke 3 tareeke:

1. **Actions → Android release → Run workflow** → run khatam hone par
   **Artifacts → niknote-android-x.y.z** download karo (APK + AAB dono).
2. **Release (share karne layak link):**
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
   → GitHub Release ban jata hai jisme `niknote-v1.1.0.apk` aur `.aab` lage hote hain.
   Direct link: `https://github.com/nikhilnikhil4331/niknote/releases/latest`
3. Manual run me `version_name` / `version_code` bhar do (har release me code badhana zaroori hai).

**Apni signing key (Play Store ke liye):** repo settings → Secrets me ye 4 add karo:

| Secret | Kya hai |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `.jks` file ka base64 (`base64 -w0 niknote-release.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | alias (default `niknote`) |
| `ANDROID_KEY_PASSWORD` | key password (na do to keystore password) |

Secrets na hone par bhi build hota hai — debug key se signed (sideload ke liye theek,
Play Store ke liye apni key zaroori).

### Apne computer par

Do raste hain:

#### A) Android Studio se (sabse aasan)

```bash
npm run android:open       # Android Studio khul jayega
```

Android Studio me: **Build → Build Bundle(s)/APK(s) → Build APK(s)**
APK yahan milega: `android/app/build/outputs/apk/debug/app-debug.apk`

#### B) Command line se (Android SDK installed hona chahiye)

```bash
npm run android:apk        # debug APK
npm run android:aab        # Play Store ke liye release bundle
```

## 3. Play Store / share karne ke liye release APK (local)

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
- Package id: **`online.niknote.app`** (v1.0.0 release se same — is liye purane APK ke
  upar update seedha install ho jayega).
- Version: `android/app/build.gradle` me `versionName` / `versionCode`. CI release me
  `NIKNOTE_VERSION_NAME` / `NIKNOTE_VERSION_CODE` env se aata hai.
