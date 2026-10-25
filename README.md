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
| 🧰 **PDF Tools** | `/pdf-tools` | Merge, split, compress, watermark, page numbers, photos → PDF |
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

Sab kuch offline chalta hai (pdf-lib + pdf.js), koi upload nahi — export ke liye wahi
`saveFile` helper (APK → Documents + share sheet, phone → share sheet, desktop → download).

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
