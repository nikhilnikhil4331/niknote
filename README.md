# NikNote — AI study notes + handwriting + PDF Studio

[![CI (web)](https://github.com/nikhilnikhil4331/niknote/actions/workflows/ci.yml/badge.svg)](https://github.com/nikhilnikhil4331/niknote/actions/workflows/ci.yml)
[![Android APK](https://github.com/nikhilnikhil4331/niknote/actions/workflows/android-apk.yml/badge.svg)](https://github.com/nikhilnikhil4331/niknote/actions/workflows/android-apk.yml)
[![Latest APK](https://img.shields.io/github/v/release/nikhilnikhil4331/niknote?label=APK&logo=android)](https://github.com/nikhilnikhil4331/niknote/releases/latest)

**Website:** https://www.niknote.online
**App (APK):** [Releases → latest `.apk`](https://github.com/nikhilnikhil4331/niknote/releases/latest)

NikNote ek **React + TypeScript (Vite)** app hai. Website aur Android APK — dono
**ek hi codebase** se bante hain (Capacitor ke through), is liye logo, icons, AI aur
saare features dono jagah same rehte hain. (PHP use nahi hota — jaan-boojh kar.)

---

## Features

| Feature | Kahan | Detail |
| --- | --- | --- |
| ✍️ Handwriting notes | `/` | Type karo → aapki handwriting me notebook pages |
| 🧠 NikAI (Astra Core) | `/ai` | Streaming chat, memory, Smart Notes, quiz, vision |
| 📄 **PDF Studio** | `/pdf-editor` | Kisi bhi PDF ko **detail me edit** karo — neeche dekho |
| 🩺 **Check-up** | `/checkup` | AI, PDF engine, OCR aur storage ek tap me test karo (APK/web dono) |
| 🔍 **AI probe** | `/api/ai?probe=1` · `/api/ai?models=1` | Asli completion se AI ka proof; provider ke live model ids dekho |
| 🧰 **PDF Tools** | `/pdf-tools` | Merge/split/compress · Word · Excel · OCR · Protect/Unlock · Watermark · Numbers · Photos |
| 🃏 Flashcards | `/flashcards` | Smart revision decks |
| 💰 Money / Routine / Habit | `/money` `/routine` `/habit` | Trackers |
| 📚 Documents | `/documents` | PDF/image upload → AI summary |

### PDF Studio (`/pdf-editor`)

- **Multi-page**: koi bhi page count open karo — thumbnails, page jump, prev/next,
  rotate, blank page (**same size / A4 / Letter**), duplicate, reorder, delete
- **Editing A→Z**: pen, highlighter, text (4 fonts, bold, size), box, circle, line,
  arrow, tick/cross/star stamps, photos, **haath se signature** (saved & reusable)
- **Undo/redo** (Ctrl+Z / Ctrl+Shift+Z), select → move/delete, eraser, zoom, shortcuts
- **Download** har jagah chalta hai: browser → normal download, phone → share sheet,
  APK → `Documents` folder + share sheet (progress ke saath "Saving page 3/12")
- Sab kuch **device par** hota hai — PDF kabhi upload nahi hoti

### PDF Tools (`/pdf-tools`)

Studio ka doosra half — jo kaam editing se pehle/baad me aate hain:

| Tool | Kya karta hai |
| --- | --- |
| **Merge** | 2+ PDFs ko order ke saath jodo (up/down se order badlo) |
| **Split** | Custom ranges (`1-3, 4-6`), har N pages, ya har page alag file |
| **Compress** | Smallest / Balanced / Sharper — scans 60-80% tak chhoti |
| **Watermark** | Text (DRAFT/CONFIDENTIAL/naam), center ya full page tile, opacity/angle/color |
| **Page numbers** | `Page {n} of {total}` template, 6 positions, start-at, cover skip |
| **Images → PDF** | JPG/PNG photos → A4/Letter/Legal/A5 ya image-size pages |
| **PDF → Word** | Asli `.docx` — headings auto-detect, page breaks, editable text |
| **PDF → Excel** | Asli `.xlsx` — har page ek sheet, column gaps se cells (tables seedha Excel me) |
| **OCR** | Scan/photo PDF me **invisible text layer** — search + copy yogya, English aur हिन्दी |
| **Protect / Unlock** | AES-256 password lagao, ya purana password hatao (asli decryption) |

Sab kuch **device par** hota hai (pdf-lib + pdf.js + tesseract.js) — koi file upload nahi.
Sirf OCR ko pehli baar model (~10 MB, CDN se) download karna padta hai, uske baad cache se offline.
Export ke liye wahi `saveFile` helper (APK → Documents + share sheet, phone → share sheet, desktop → download).

### Free / open-source jo use hota hai

| Library | License | Kaam |
| --- | --- | --- |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | MIT | PDF banana / edit karna |
| [@cantoo/pdf-lib](https://github.com/cantoo-scribe/pdf-lib) | MIT | AES-256 encrypt / decrypt |
| [pdf.js](https://github.com/mozilla/pdf.js) | Apache-2.0 | PDF padhna, pages render, text extract |
| [tesseract.js](https://github.com/naptha/tesseract.js) | Apache-2.0 | OCR (searchable PDF) |
| [docx](https://github.com/dolanmiu/docx) | MIT | `.docx` likhna |
| [JSZip](https://github.com/Stuk/jszip) | MIT / GPL-3.0 dual | `.xlsx` aur `.docx` zip packaging |
| [Noto Sans Devanagari](https://github.com/notofonts/devanagari) | OFL-1.1 | हिन्दी OCR text layer |

Sab kuch **browser/phone me hi** chalta hai — koi PDF kisi server par nahi jaati.

## Local development

```bash
npm install
npm run dev          # http://localhost:8080
npm test             # vitest
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

## APK banana

Sabse aasan — **GitHub se** (koi Android Studio nahi chahiye):

1. **Actions → Android APK → Run workflow**, ya `v1.0.0` tag push karo
2. APK download karo: workflow artifact se, ya **Releases** se (tag push par apna aap attach hota hai)

Apne computer par:

```bash
npm run icons          # website logo → launcher icons + splash screens
npm run android:sync   # icons + build + cap sync
npm run android:apk    # debug APK
```

Pura guide (signing, Play Store AAB, common errors): **[ANDROID-APK-GUIDE.md](./ANDROID-APK-GUIDE.md)**

## Brand

`public/niknote-logo.png` = single source of truth. Logo badalna ho to bas ye file
replace karke `npm run icons` chala do — website, PWA icons, Android launcher icons
(adaptive + round) aur splash screens sab update ho jate hain.
