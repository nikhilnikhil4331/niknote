# 🔐 Google OAuth Consent Screen — Fix Guide

## Problem:
Jab koi Google se sign in karta hai, toh dikha raha hai:
**"Choose an account to continue to atuxocibsmflgwlwuvmv.supabase.co"**

Instead of:
**"Choose an account to continue to NikNote"**

## Yeh normal Supabase behavior hai — Google Cloud Console mein branding change karna padega.

---

## STEP 1: Google Cloud Console mein jao
🔗 https://console.cloud.google.com/apis/credentials/consent

1. **App name** change karo → `NikNote`
2. **User support email** → apna email daalo
3. **App logo** → `/public/niknote-logo-512.png` upload karo (already workspace mein hai)
4. **Application home page** → `https://niknote.online`
5. **Application privacy policy link** → `https://niknote.online/privacy`
6. **Application terms of service link** → `https://niknote.online/terms`
7. **Authorized domains** → `niknote.online` + `www.niknote.online`
8. **Developer contact info** → apna email

## STEP 2: PUBLISH THE APP! 🔴 CRITICAL
1. Same page pe neeche **"PUBLISH APP"** button hai
2. Click karo → confirm karo
3. Without publishing, sirf test users sign in kar sakte hain
4. Publishing ke baad sabhi users sign in kar payenge

## STEP 3: Add Redirect URL
🔗 https://console.cloud.google.com/apis/credentials

1. OAuth 2.0 Client ID mein jao
2. **Authorized redirect URIs** mein add karo:
   ```
   https://atuxocibsmflgwlwuvmv.supabase.co/auth/v1/callback
   ```
3. **Authorized JavaScript origins** mein add karo:
   ```
   https://niknote.online
   https://www.niknote.online
   ```

## STEP 4: GitHub OAuth Callback Fix
🔗 https://github.com/settings/developers

1. NikNote OAuth App mein jao
2. **Authorization callback URL** set karo:
   ```
   https://atuxocibsmflgwlwuvmv.supabase.co/auth/v1/callback
   ```

## STEP 5: Verify
1. Incognito browser mein jao → https://niknote.online
2. "Sign in with Google" click karo
3. Ab "Continue to NikNote" dikhna chahiye (publishing ke baad)
4. Sign in kaam karna chahiye

---

## Important Notes:
- Google verification (logo on consent screen) ke liye published app chahiye
- Verification process mein 1-7 days lag sakte hain
- Publishing immediate hota hai, but logo/branding propagation mein time lagta hai
- Agar "unverified app" warning aaye toh: Publishing se hat jayegi after domain verification
