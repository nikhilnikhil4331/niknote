// ============================================================
// NikNote 4.0 — Auth Context (CRASH-FIXED)
// Handles Supabase auth + Google OAuth gracefully
// No more refresh crashes or redirect loops
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithGitHub: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
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
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
        extraParams: { prompt: 'select_account' },
      });
      if (result.error) {
        return { error: result.error instanceof Error ? result.error : new Error(String(result.error)) };
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
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signInWithGitHub, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
