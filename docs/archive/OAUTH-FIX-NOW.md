# 🚨 GOOGLE OAUTH FIX — EXACT STEPS (2 MIN)

## Current Status:
- ✅ Website code is PERFECT — Google button, GitHub button sab hai
- ❌ Supabase mein Google ka Client ID + Secret missing hai
- ❌ Supabase mein GitHub provider enable nahi hai

---

## 🔵 OPTION 1: GOOGLE OAUTH (Recommended)

### Step 1: Supabase Dashboard kholein
👉 Open: https://supabase.com/dashboard/project/ievggapvfidhygkhtkug/auth/providers

### Step 2: Google provider pe click karo
- Scroll down → "Google" pe click karo
- Enable toggle ON hai (already) ✅

### Step 3: Credentials enter karo
Agar tere paas already Google Cloud Console se Client ID + Secret hai, toh:
- **Client ID** box mein paste karo
- **Client Secret** box mein paste karo
- Click **Save**

### Step 4: Agar credentials nahi hain, toh banao:
1. 👉 Open: https://console.cloud.google.com/apis/credentials
2. Top pe project select karo ya "New Project" banao (name: NikNote)
3. Left menu → "OAuth consent screen"
4. User Type: **External** → Create
5. App name: `NikNote` → email fill karo → Save and Continue (3 pages)
6. Left menu → "Credentials" → "+ CREATE CREDENTIALS" → "OAuth client ID"
7. Application type: **Web application**
8. Name: `NikNote Web`
9. **Authorized JavaScript origins**:
   - Add: `https://niknote.online`
10. **Authorized redirect URIs** (MOST IMPORTANT!):
    - Add: `https://ievggapvfidhygkhtkug.supabase.co/auth/v1/callback`
11. Click **Create**
12. Copy **Client ID** and **Client Secret**
13. Go back to Supabase Dashboard → Paste → Save ✅

---

## 🐙 OPTION 2: GITHUB OAUTH (EASIER — 1 MIN!)

### Step 1: GitHub OAuth App banao
👉 Open: https://github.com/settings/developers

1. Click **"New OAuth App"** (or "OAuth Apps" → "New OAuth App")
2. Fill:
   - Application name: `NikNote`
   - Homepage URL: `https://niknote.online`
   - Authorization callback URL: `https://ievggapvfidhygkhtkug.supabase.co/auth/v1/callback`
3. Click **"Register application"**
4. Copy **Client ID** (page pe dikhega)
5. Click **"Generate a new client secret"** → Copy **Client Secret**

### Step 2: Supabase mein GitHub enable karo
👉 Open: https://supabase.com/dashboard/project/ievggapvfidhygkhtkug/auth/providers

1. Scroll down → Click **"GitHub"**
2. Toggle **Enable** → ON
3. Paste **Client ID**
4. Paste **Client Secret**
5. Click **Save** ✅

### Step 3: Test karo!
👉 Open: https://niknote.online/login

Click **"Continue with GitHub"** → GitHub login page aana chahiye! 🎉

---

## 🔑 IMPORTANT URL (Copy karke rakhho):
```
Supabase Callback URL: https://ievggapvfidhygkhtkug.supabase.co/auth/v1/callback
Website: https://niknote.online
```

Yeh URL dona jagah (Google Cloud Console + GitHub OAuth App) mein add karni hai!
