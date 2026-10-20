import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

const ACTIVE_SUPABASE_URL = 'https://atuxocibsmflgwlwuvmv.supabase.co';
const ACTIVE_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0dXhvY2lic21mbGd3bHd1dm12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzEzOTUsImV4cCI6MjA5ODMwNzM5NX0.-z83TYdQ34a1-59Ij07ZuqFV-5XFUjyFT-9P5FUtlBY';

function resolveSupabaseUrl(): string {
  const raw = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  if (!raw || raw.includes('ievggapvfidhygkhtkug')) return ACTIVE_SUPABASE_URL;
  return raw;
}

function resolveSupabaseKey(): string {
  const raw = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
  const rawUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  if (!raw || rawUrl.includes('ievggapvfidhygkhtkug')) return ACTIVE_SUPABASE_ANON_KEY;
  return raw;
}

export const SUPABASE_URL = resolveSupabaseUrl();
export const SUPABASE_PUBLISHABLE_KEY = resolveSupabaseKey();

let supabaseClient: any;

try {
  supabaseClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
} catch (err) {
  console.error('Supabase client creation failed:', err);
  supabaseClient = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      setSession: () => Promise.resolve({ data: { session: null, user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInAnonymously: () => Promise.resolve({ data: null, error: new Error('Supabase not initialized') }),
      signInWithPassword: () => Promise.resolve({ data: null, error: new Error('Supabase not initialized') }),
      signUp: () => Promise.resolve({ data: null, error: new Error('Supabase not initialized') }),
      signInWithOAuth: () => Promise.resolve({ data: null, error: new Error('Supabase not initialized') }),
      updateUser: () => Promise.resolve({ data: null, error: new Error('Supabase not initialized') }),
      signOut: () => Promise.resolve(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
    }),
    functions: {
      invoke: () => Promise.resolve({ data: null, error: new Error('Supabase not initialized') }),
    },
  };
}

export const supabase = supabaseClient;
