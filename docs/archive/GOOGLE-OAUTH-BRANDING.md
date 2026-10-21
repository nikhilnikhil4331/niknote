# 🔑 Google OAuth Consent Screen — NikNote Branding Setup
# ============================================================
# YEH FILE EXACT STEPS HAI — EK EK KARKE FOLLOW KARO
# ============================================================

## Problem:
Google sign-in pe "Continue to atuxocibsmflgwlwuvmv.supabase.co" dikha raha hai
instead of "Continue to NikNote" with NikNote logo.

## Solution:
Google Cloud Console mein OAuth Consent Screen configure karo.

---

## STEP 1: OAuth Consent Screen Setup
-----------------------------------------

1. Jao: https://console.cloud.google.com/apis/credentials/consent
   (Make sure correct project select hai — jahan Client ID bana hai)

2. **User Type**: Select "External" → Click "CREATE"

3. **App Information**:
   - App name: `NikNote`
   - User support email: Your email
   - App logo: Upload NikNote logo (public/niknote-logo.png)
     ⚠️ Logo must be 120x120 to 1200x1200 pixels, PNG/JPG

4. **App Domain**:
   - Application home page: `https://niknote.online`
   - Application privacy policy link: `https://niknote.online` (temporary)
   - Application terms of service link: `https://niknote.online` (temporary)
   - Authorized domains: Add `niknote.online`

5. **Developer Contact Information**:
   - Email addresses: Your email

6. Click "SAVE AND CONTINUE"

---

## STEP 2: Add Scopes
-----------------------------------------

1. Click "ADD OR REMOVE SCOPES"
2. Select these scopes:
   - `.../auth/userinfo.email` ✅
   - `.../auth/userinfo.profile` ✅
   - `openid` ✅
3. Click "UPDATE" → "SAVE AND CONTINUE"

---

## STEP 3: Add Test Users (if still in Testing mode)
-----------------------------------------

1. Add your email as test user
2. Click "ADD USERS" → "SAVE AND CONTINUE"

---

## STEP 4: 🚀 PUBLISH THE APP (MOST IMPORTANT!)
-----------------------------------------

1. Go back to: https://console.cloud.google.com/apis/credentials/consent
2. You'll see "Publishing status: Testing"
3. Click **"PUBLISH APP"**
4. Confirm by clicking "CONFIRM"

⚠️ BINA PUBLISH KIYE KOI BHI USER SIGN IN NAHI KAR PAYEGA!
Testing mode mein sirf tum (test user) hi login kar sakte ho.

---

## STEP 5: Verify Redirect URL
-----------------------------------------

1. Jao: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. Check **"Authorized redirect URIs"** mein yeh hai:
   ```
   https://atuxocibsmflgwlwuvmv.supabase.co/auth/v1/callback
   ```
4. Check **"Authorized JavaScript origins"** mein yeh hai:
   ```
   https://niknote.online
   ```
5. If not present, ADD them → Click SAVE

---

## STEP 6: Update GitHub OAuth App
-----------------------------------------

1. Jao: https://github.com/settings/developers
2. Click your OAuth App
3. Update fields:
   - Application name: `NikNote`
   - Homepage URL: `https://niknote.online`
   - Application description: `AI-Powered Study App for Indian Students`
   - Authorization callback URL: `https://atuxocibsmflgwlwuvmv.supabase.co/auth/v1/callback`
   - Upload NikNote logo as application logo
4. Click "Update application"

---

## AFTER COMPLETING ALL STEPS:
-----------------------------------------

Google sign-in pe ab dikhega:
✅ NikNote logo
✅ "Continue to NikNote" (instead of supabase.co)
✅ Professional look

GitHub sign-in pe:
✅ NikNote branding on GitHub auth page
✅ Proper callback

---

## QUICK VERIFICATION:
-----------------------------------------

After setup, test:
1. Go to https://niknote.online/login
2. Click "Continue with Google"
3. Should show "NikNote" logo + "Continue to NikNote" ✅
4. Click "Continue with GitHub"
5. Should redirect to GitHub with NikNote app name ✅
