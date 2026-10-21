# 🔴 NIKNOTE — SUPABASE FRESH START GUIDE
# Bilkul zero se start — sab delete karke naya setup
# Time: 15-20 minutes

============================================================
📁 STEP 0: SUPABASE PROJECT OPEN KARO
============================================================

👉 Is link pe jaao:
https://supabase.com/dashboard/project/ievggapvfidhygkhtkug

Ya agar naya project banana hai:
https://supabase.com/dashboard → New Project

Agar NAYA project bana rahe ho, toh naya project ID milega
→ Usko .env file mein update karna padega (Step 8 mein bataya hai)


============================================================
🗑️ STEP 1: PURANA DATA DELETE KARO (Agar existing project use kar rahe ho)
============================================================

1. Left menu → "Table Editor"
2. Ek ek table pe jaao → ⋮ (3 dots) → "Delete table"
3. Yeh sab tables delete karo:
   - profiles
   - handwriting_models
   - notebooks
   - notebook_pages
   - billing_plans
   - user_subscriptions
   - user_roles
   - activity_logs
   - error_logs
   - app_settings
   - badges
   - feature_usage
   - rate_limits

⚠️ Agar koi table nahi dikhta, toh skip karo — matlab already empty hai


============================================================
📊 STEP 2: NAYA DATABASE SETUP — SQL EDITOR
============================================================

1. Left menu → "SQL Editor"
2. "New query" click karo
3. NEECHE ka POORA SQL copy-paste karo
4. "Run" click karo ✅

--- COPY FROM HERE ---

-- ============================================
-- NIKNOTE 4.0 — FRESH DATABASE SETUP
-- ============================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = user_id);

-- 2. HANDWRITING MODELS
CREATE TABLE IF NOT EXISTS public.handwriting_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Handwriting',
  sample_image_url TEXT,
  suggested_font TEXT NOT NULL DEFAULT 'caveat',
  font_size INTEGER NOT NULL DEFAULT 24,
  line_spacing INTEGER NOT NULL DEFAULT 32,
  word_spacing INTEGER NOT NULL DEFAULT 4,
  baseline_jitter BOOLEAN NOT NULL DEFAULT true,
  stroke_randomness BOOLEAN NOT NULL DEFAULT true,
  ink_color TEXT NOT NULL DEFAULT 'blue',
  slant NUMERIC DEFAULT 0,
  stroke_thickness NUMERIC DEFAULT 1,
  pen_pressure_feel NUMERIC DEFAULT 0.5,
  letter_spacing_variation NUMERIC DEFAULT 0,
  analysis_notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.handwriting_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own handwriting" ON public.handwriting_models FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own handwriting" ON public.handwriting_models FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own handwriting" ON public.handwriting_models FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own handwriting" ON public.handwriting_models FOR DELETE USING (auth.uid() = user_id);

-- 3. NOTEBOOKS
CREATE TABLE IF NOT EXISTS public.notebooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  folder TEXT DEFAULT NULL,
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notebooks" ON public.notebooks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notebooks" ON public.notebooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notebooks" ON public.notebooks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notebooks" ON public.notebooks FOR DELETE USING (auth.uid() = user_id);

-- 4. NOTEBOOK PAGES
CREATE TABLE IF NOT EXISTS public.notebook_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID REFERENCES public.notebooks(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL DEFAULT 1,
  lines JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.notebook_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pages" ON public.notebook_pages FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.notebooks WHERE id = notebook_id));
CREATE POLICY "Users can insert own pages" ON public.notebook_pages FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM public.notebooks WHERE id = notebook_id));
CREATE POLICY "Users can update own pages" ON public.notebook_pages FOR UPDATE USING (auth.uid() = (SELECT user_id FROM public.notebooks WHERE id = notebook_id));
CREATE POLICY "Users can delete own pages" ON public.notebook_pages FOR DELETE USING (auth.uid() = (SELECT user_id FROM public.notebooks WHERE id = notebook_id));

-- 5. BILLING PLANS
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  interval TEXT NOT NULL DEFAULT 'month',
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read plans" ON public.billing_plans FOR SELECT USING (auth.role() = 'authenticated');

-- 6. USER SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.billing_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  razorpay_payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subs" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);

-- 7. USER ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- 8. ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  details JSONB DEFAULT '{}',
  device_type TEXT,
  page_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own logs" ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);

-- 9. ERROR LOGS
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  page_url TEXT,
  user_agent TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can insert errors" ON public.error_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 10. APP SETTINGS
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 11. BADGES
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  requirement JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- 12. FEATURE USAGE
CREATE TABLE IF NOT EXISTS public.feature_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feature TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own usage" ON public.feature_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own usage" ON public.feature_usage FOR SELECT USING (auth.uid() = user_id);

-- 13. RATE LIMITS
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 14. REALTIME ENABLE
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.error_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions;

-- 15. DEFAULT BILLING PLAN (Free)
INSERT INTO public.billing_plans (code, name, price_cents, interval, features)
VALUES ('free', 'Free Plan', 0, 'month', '["5 AI requests/day", "Basic handwriting", "PDF export"]')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.billing_plans (code, name, price_cents, interval, features)
VALUES ('premium', 'Premium Plan', 19900, 'month', '["Unlimited AI", "All handwriting styles", "Priority support", "Cloud backup"]')
ON CONFLICT (code) DO NOTHING;

--- END COPY ---


============================================================
🔐 STEP 3: AUTHENTICATION SETTINGS
============================================================

1. Left menu → "Authentication" → "Providers"
2. "Email" → Already ON ✅ (check kar lo)
3. "Phone" → OFF karo (agar nahi chahiye)

YEH IMPORTANT HAI:
4. "Authentication" → "URL Configuration"
5. "Site URL" mein likho: https://niknote.online
6. "Redirect URLs" mein ADD karo:
   - https://niknote.online
   - https://niknote.online/
   - http://localhost:5173 (development ke liye)
7. "Save" click karo ✅


============================================================
🔵 STEP 4: GOOGLE OAUTH SETUP (The Fix!)
============================================================

PEHLE: Google Cloud Console mein jaao
👉 https://console.cloud.google.com/apis/credentials

1. Project select karo ya "New Project" banao (Name: NikNote)

2. Left menu → "OAuth consent screen"
   - User Type: EXTERNAL → Create
   - App name: NikNote
   - User support email: tera email
   - Developer contact: tera email
   - Save and Continue (3 pages skip)
   - ⚠️ "PUBLISH APP" click karo! (Test mode mein rehne se sirf tum hi login kar sakte ho)

3. Left menu → "Credentials"
   - "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Application type: Web application
   - Name: NikNote Web

   - **Authorized JavaScript origins**:
     ```
     https://niknote.online
     ```

   - **Authorized redirect URIs** (CRITICAL!):
     ```
     https://ievggapvfidhygkhtkug.supabase.co/auth/v1/callback
     ```

   - Click "Create"
   - 📋 COPY Client ID (xxx.apps.googleusercontent.com)
   - 📋 COPY Client Secret (GOCSPX-xxx)

4. AB SUPABASE mein jaao:
   👉 https://supabase.com/dashboard/project/ievggapvfidhygkhtkug/auth/providers

5. "Google" pe click karo
6. **Authorized Client IDs** → paste Client ID ⚠️
7. **Client Secret (for OAuth)** → paste Client Secret ⚠️
8. Click **SAVE** ← YEH MAT BHOOLNA! 🚨
9. Wapas Google pe click karke dekho — fields mein value dikhna chahiye
   Agar dikha → SAVE ho gaya ✅
   Agar khaali → Save nahi hua, dobara karo!


============================================================
🐙 STEP 5: GITHUB OAUTH SETUP (Easier alternative)
============================================================

1. 👉 https://github.com/settings/developers → "New OAuth App"
   - Application name: NikNote
   - Homepage URL: https://niknote.online
   - Callback URL: https://ievggapvfidhygkhtkug.supabase.co/auth/v1/callback
   - "Register application"
   - Copy Client ID
   - "Generate a new client secret" → Copy

2. Supabase mein:
   👉 https://supabase.com/dashboard/project/ievggapvfidhygkhtkug/auth/providers
   - "GitHub" click karo
   - Enable → ON
   - Paste Client ID + Secret
   - **SAVE** click karo 🚨


============================================================
⚡ STEP 6: EDGE FUNCTIONS ENVIRONMENT VARIABLES
============================================================

1. Left menu → "Edge Functions"
2. Yeh variables set karo (agar OpenAI key hai toh):

   "openai-brain" function pe click karo → "Settings" (gear icon)
   - OPENAI_API_KEY = sk-xxxxx (agar hai toh)
   - SUPABASE_SERVICE_ROLE_KEY = (Supabase se milta hai, Step 7 mein)

3. "admin-auth" function:
   - ADMIN_PIN = 4331

4. Sab other functions ke liye:
   - SUPABASE_SERVICE_ROLE_KEY = (Step 7 se copy)


============================================================
🔑 STEP 7: SERVICE ROLE KEY NIKALO
============================================================

1. Left menu → "Settings" → "API"
2. "Project API keys" section mein:
   - anon public = (yeh already .env mein hai ✅)
   - service_role secret = 📋 COPY KARO (sirf ek baar dikhta hai)

3. Yeh service_role key Edge Functions mein lagao (Step 6)


============================================================
🔄 STEP 8: .ENV FILE UPDATE (Agar naya project banaya)
============================================================

AGAR SAME PROJECT hai (ievggapvfidhygkhtkug):
→ Kuch change nahi karna, sab same rahega ✅

AGAR NAYA PROJECT banaya:
→ .env file mein naye values daalo:
   VITE_SUPABASE_URL = https://XXXX.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY = eyJhbG...
   VITE_SUPABASE_PROJECT_ID = XXXX


============================================================
✅ STEP 9: VERIFY — SAB TEST KARO
============================================================

1. 👉 https://niknote.online/login
   - Email/Password sign up karo → kaam karna chahiye ✅
   - "Continue with Google" click karo → Google popup aana chahiye ✅
   - "Continue with GitHub" click karo → GitHub page aana chahiye ✅

2. 👉 https://niknote.online/
   - Type karo → handwriting mein convert hona chahiye ✅
   - Color change karo → change hona chahiye ✅
   - Export PDF → kaam karna chahiye ✅

3. 👉 https://niknote.online/ai
   - "Explain Newton laws" type karo → instant response aana chahiye ✅


============================================================
🆘 COMMON ISSUES:
============================================================

❌ "missing OAuth secret" → Supabase mein Client ID + Secret SAVE nahi hua
   → Step 4 dobara karo, SAVE button zaroor click karo

❌ Google popup nahi aata → OAuth consent screen PUBLISH nahi kiya
   → Google Cloud Console → OAuth consent screen → "PUBLISH APP"

❌ "provider is not enabled" → GitHub enable nahi kiya
   → Step 5 karo

❌ Login page blank → .env mein galat Supabase URL/Key
   → Step 8 check karo

❌ Tables not found → Step 2 ka SQL run nahi kiya
   → SQL Editor mein dobara run karo
