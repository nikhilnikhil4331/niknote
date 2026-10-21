# 🔑 OAUTH REDIRECT URLs — MUST ADD!
# ============================================================

## ⚠️ IMPORTANT: Tumhe yeh 2 steps khud karne honge!

### Step 1: Google Cloud Console mein Redirect URL add karo

1. Jao: https://console.cloud.google.com/apis/credentials
2. Apna OAuth 2.0 Client ID click karo
3. "Authorized redirect URIs" section mein ADD karo:
   ```
   https://atuxocibsmflgwlwuvmv.supabase.co/auth/v1/callback
   ```
4. "Authorized JavaScript origins" mein ADD karo:
   ```
   https://niknote.online
   ```
5. Click SAVE

### Step 2: GitHub OAuth App mein Callback URL update karo

1. Jao: https://github.com/settings/developers
2. Apni OAuth App click karo
3. "Authorization callback URL" update karo to:
   ```
   https://atuxocibsmflgwlwuvmv.supabase.co/auth/v1/callback
   ```
4. Click "Update application"

### Step 3: Google OAuth Consent Screen PUBLISH karo

1. Jao: https://console.cloud.google.com/apis/credentials/consent
2. Agar status "Testing" hai, toh "PUBLISH APP" click karo
3. Confirm karo

### Yeh karne ke baad:
- Google Sign-In kaam karega ✅
- GitHub Sign-In kaam karega ✅
- Users directly login kar sakenge ✅

### Current Status:
- ✅ Supabase mein Google OAuth ENABLED (Client ID + Secret saved)
- ✅ Supabase mein GitHub OAuth ENABLED (Client ID + Secret saved)
- ✅ Both providers return 302 redirect (verified)
- ⬜ Google Cloud Console redirect URL (tumhe karna hai)
- ⬜ GitHub OAuth callback URL (tumhe karna hai)
- ⬜ Google OAuth consent screen publish (tumhe karna hai)

### New Supabase Project Details:
- Project Name: "google Auth"
- Project Ref: atuxocibsmflgwlwuvmv
- URL: https://atuxocibsmflgwlwuvmv.supabase.co
- Callback: https://atuxocibsmflgwlwuvmv.supabase.co/auth/v1/callback
