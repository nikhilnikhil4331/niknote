// ============================================================
// NikNote 4.0 — Auth Context (CRASH-FIXED)
// Handles Supabase auth + Google OAuth gracefully
// No more refresh crashes or redirect loops
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AUTO_GUEST } from '@/config/features';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithGitHub: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isGuest: boolean;
  signInAsGuest: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        // After Google sign-in, send user back to where they wanted to go
        if (event === 'SIGNED_IN' && session) {
          const target = sessionStorage.getItem('niknote_post_auth_redirect');
          // Auth pages navigate in-app themselves; a full reload here showed a long "Loading..." screen for guests.
          const onAuthPage = /^\/(login|signup|auth)(\/|$)/.test(window.location.pathname);
          if (target && !onAuthPage) {
            sessionStorage.removeItem('niknote_post_auth_redirect');
            if (window.location.pathname !== target) {
              setTimeout(() => window.location.assign(target), 0);
            }
          }
        }

        // Handle all auth events gracefully
        switch (event) {
          case 'TOKEN_REFRESHED':
            if (!session) {
              // Token refresh failed — clear stale session silently
              console.warn('Token refresh failed, clearing session');
              setSession(null);
              setUser(null);
            } else {
              setSession(session);
              setUser(session.user);
            }
            break;

          case 'SIGNED_OUT':
            setSession(null);
            setUser(null);
            break;

          case 'SIGNED_IN':
          case 'USER_UPDATED':
            setSession(session);
            setUser(session?.user ?? null);
            break;

          default:
            setSession(session);
            setUser(session?.user ?? null);
        }

        setLoading(false);
      }
    );

    // Then check for existing session (with mobile network timeout)
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: Session | null }; error: null }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null }, error: null }), 10000)
    );

    Promise.race([sessionPromise, timeoutPromise])
      .then(({ data, error }) => {
        if (!mounted) return;
        const session = data?.session ?? (data as any)?.session ?? null;
        if (error) {
          console.warn('Session fetch error:', error.message);
          setSession(null);
          setUser(null);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
        }
        if (!session && AUTO_GUEST && !/^\/(login|auth|reset-password)/.test(window.location.pathname)) {
          // One private anonymous identity per browser; listener sets user when ready.
          supabase.auth.signInAnonymously().catch(() => undefined).finally(() => { if (mounted) setLoading(false); });
          return;
        }
        setLoading(false);
      }).catch(() => {
        if (!mounted) return;
        // Network error on mobile — allow app to load anyway
        console.warn('Session fetch network error — allowing offline mode');
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
          },
        },
      });
      return { error: error as Error | null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign up failed') };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error as Error | null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign in failed') };
    }
  };

  const signInWithGoogle = useCallback(async () => {
    try {
      // Remember intended destination (e.g. ?redirect=/payment) for after sign-in
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
        sessionStorage.setItem('niknote_post_auth_redirect', redirect);
      }
      // Use our own Google OAuth credentials (shows "Niknote" on the Google screen)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) {
        return { error: error as Error };
      }
      return { error: null };
    } catch (err) {
      console.error('Google sign in error:', err);
      return { error: new Error('Google sign-in fail ho gaya. Dobara try karo.') };
    }
  }, []);

  const signInWithGitHub = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        if (error.message?.includes('provider') || error.message?.includes('not enabled') || error.message?.includes('Unsupported') || error.message?.includes('missing OAuth secret')) {
          return { error: new Error('GitHub sign-in abhi configured nahi hai. Email/Password use karo!') };
        }
        return { error: error as Error };
      }
      return { error: null };
    } catch (err) {
      console.error('GitHub sign in error:', err);
      return { error: new Error('GitHub sign-in fail ho gaya. Email/Password try karo!') };
    }
  }, []);

  // One in-flight guest request at a time, so rerenders never create extra anonymous users.
  const guestRef = React.useRef<Promise<{ error: Error | null }> | null>(null);
  const signInAsGuest = useCallback(() => {
    if (guestRef.current) return guestRef.current;
    guestRef.current = (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) return { error: null };
        const { error } = await supabase.auth.signInAnonymously();
        return { error: (error as Error) ?? null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error('Guest sign-in failed') };
      } finally { guestRef.current = null; }
    })();
    return guestRef.current;
  }, []);
  const isGuest = !!(user as any)?.is_anonymous;

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signInWithGitHub, signOut, isGuest, signInAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
};
