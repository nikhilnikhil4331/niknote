# 🔐 Google OAuth Setup Guide — NikNote

## Problem:
`{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: missing OAuth secret"}`

## Matlab:
Supabase mein Google provider ON hai, lekin Google Cloud Console ka **Client ID** aur **Client Secret** daala hi nahi hai. Code bilkul sahi hai — bas credentials missing hain.

---

## ✅ Fix — Step by Step (5 min ka kaam)

### Step 1: Google Cloud Console pe jaao
👉 https://console.cloud.google.com/

### Step 2: Naya Project banao (ya existing select karo)
- Top pe project dropdown click karo → "New Project"
- Name: `NikNote` → Create

### Step 3: OAuth Consent Screen setup
1. Left menu → "OAuth consent screen"
2. User Type: **External** → Create
3. Fill karo:
   - App name: `NikNote`
   - User support email: tera email
   - Developer contact: tera email
4. Click "Save and Continue"
5. Scopes page → just click "Save and Continue"
6. Test users → Add tera email → "Save and Continue"

### Step 4: Credentials banao
1. Left menu → "Credentials"
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Application type: **Web application**
4. Name: `NikNote Web`
5. **Authorized JavaScript origins** (IMPORTANT!):
   - Click "Add URI" → `https://niknote.online`
   - Click "Add URI" → `http://localhost:5173`
6. **Authorized redirect URIs** (MOST IMPORTANT!):
   - Click "Add URI" → `https://ievggapvfidhygkhtkug.supabase.co/auth/v1/callback`
   - Click "Add URI" → `https://niknote.online`
7. Click **"Create"**

### Step 5: Client ID aur Secret copy karo
- Popup mein dikhega:
  - **Your Client ID**: `xxxxxxx.apps.googleusercontent.com`
  - **Your Client Secret**: `GOCSPX-xxxxxxxxx`
- Dono copy kar lo!

### Step 6: Supabase Dashboard mein paste karo
1. 👉 https://supabase.com/dashboard → Teri project select karo
2. Left menu → **Authentication** → **Providers**
3. **Google** pe click karo
4. **Client ID** paste karo
5. **Client Secret** paste karo
6. Click **"Save"**

### Step 7: TEST KARO! 🎉
1. Jaao → https://niknote.online/login
2. "Continue with Google" click karo
3. Google account select karo
4. ✅ Redirect ho ke login ho jaana chahiye!

---

## ⚡ Quick Alternative: GitHub OAuth (Easier!)

Agar Google zyada complicated lag raha hai, GitHub OAuth 2 min mein ho jaata hai:

### Step 1: GitHub pe OAuth App banao
👉 https://github.com/settings/developers → "New OAuth App"

- Application name: `NikNote`
- Homepage URL: `https://niknote.online`
- Callback URL: `https://ievggapvfidhygkhtkug.supabase.co/auth/v1/callback`
- Click "Register application"

### Step 2: Client ID + Secret copy karo
- Client ID dikhega page pe
- "Generate a new client secret" click karo → Secret copy karo

### Step 3: Supabase mein configure
1. Supabase Dashboard → Authentication → Providers
2. **GitHub** enable karo
3. Client ID + Secret paste karo
4. Save!

### Step 4: Test!
Login page pe "Continue with GitHub" button click karo — kaam ho jaayega! 🎉

---

## 📝 Summary

| Provider | Difficulty | Time |
|----------|-----------|------|
| Email/Password | ✅ Already working | 0 min |
| GitHub | 🟢 Easy | 2 min |
| Google | 🟡 Medium | 5 min |

**Sabse pehle GitHub try karo — sabse easy hai!**
