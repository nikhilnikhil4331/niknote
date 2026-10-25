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
