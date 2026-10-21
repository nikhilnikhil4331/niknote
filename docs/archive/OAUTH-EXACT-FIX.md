# 🚨 EXACT FIX — Step by Step with URL

## Problem RIGHT NOW:
- Google: ON hai ✅ but "missing OAuth secret" ❌ (Client ID + Secret daala hi nahi)
- GitHub: OFF hai ❌ (Enable hi nahi kiya)

---

## ✅ FIX GOOGLE — Is LINK pe jaao:

### 👉 STEP 1: Open this EXACT URL:
```
https://supabase.com/dashboard/project/ievggapvfidhygkhtkug/auth/providers
```

### 👉 STEP 2: "Google" pe click karo
- Scroll down thoda — "Google" dikhega expanded card mein
- "Authorized Client IDs" aur "Client Secret (for OAuth)" fields honge

### 👉 STEP 3: Agar fields KHAAALI hain — iska matlab credentials daale hi nahi!

Tujhe pehle Google Cloud Console se credentials banane padenge:

#### 3a. Google Cloud Console kholo:
```
https://console.cloud.google.com/apis/credentials
```

#### 3b. Project select karo (ya "NikNote" banao)

#### 3c. "OAuth consent screen" jaao (left menu)
- User Type: External → Create
- App name: NikNote
- Email fill karo
- Scopes page: skip (Save and Continue)
- Test users: apna email add karo
- "Back to Dashboard" → "PUBLISH APP" click karo ⚠️ (IMPORTANT!)

#### 3d. "Credentials" jaao (left menu)
- "+ CREATE CREDENTIALS" → "OAuth client ID"
- Application type: **Web application**
- Name: NikNote Web
- **Authorized JavaScript origins**:
  ```
  https://niknote.online
  ```
- **Authorized redirect URIs**:
  ```
  https://ievggapvfidhygkhtkug.supabase.co/auth/v1/callback
  ```
- Click "Create"

#### 3e. Client ID aur Secret COPY karo
- Popup mein dikhega — DONO copy karo!

### 👉 STEP 4: Wapas Supabase pe jaao
```
https://supabase.com/dashboard/project/ievggapvfidhygkhtkug/auth/providers
```
- Google click karo
- **Authorized Client IDs** → paste Client ID
- **Client Secret (for OAuth)** → paste Client Secret
- Click **SAVE** ⚠️ (IMPORTANT! Save click karna mat bhoolna!)

### 👉 STEP 5: TEST KARO!
```
https://niknote.online/login
```
"Continue with Google" click karo → Google login page aana chahiye! 🎉

---

## ✅ FIX GITHUB — Is LINK pe jaao:

### 👉 STEP 1: GitHub pe OAuth App banao
```
https://github.com/settings/developers
```
- "New OAuth App" click karo
- Application name: **NikNote**
- Homepage URL: **https://niknote.online**
- Callback URL: **https://ievggapvfidhygkhtkug.supabase.co/auth/v1/callback**
- "Register application" click karo
- Client ID copy karo
- "Generate a new client secret" click karo → Secret copy karo

### 👉 STEP 2: Supabase mein GitHub enable karo
```
https://supabase.com/dashboard/project/ievggapvfidhygkhtkug/auth/providers
```
- Scroll down → **GitHub** click karo
- **Enable** toggle → ON karo
- **Client ID** paste karo
- **Client Secret** paste karo
- Click **SAVE** ⚠️

### 👉 STEP 3: TEST KARO!
```
https://niknote.online/login
```
"Continue with GitHub" click karo → GitHub login page aana chahiye! 🎉

---

## ⚠️ COMMON MISTAKES:

1. **Save button click nahi kiya** — Sabse common! Credentials paste karke Save bhool jaate hain
2. **Wrong redirect URI** — EXACTLY yeh daalo: `https://ievggapvfidhygkhtkug.supabase.co/auth/v1/callback`
3. **OAuth consent screen publish nahi kiya** — Google mein "PUBLISH APP" click karna zaroori hai
4. **Galat project** — Check karo ki sahi Supabase project mein configure kar rahe ho (project ID: ievggapvfidhygkhtkug)
5. **Client ID aur Secret ulta paste kiya** — Double check karo

## 🔑 CONFIRM KARO YEH:
After saving, wapas Google provider pe click karo — agar "Authorized Client IDs" field mein kuch likha dikhega, matlab SAVE ho gaya!
