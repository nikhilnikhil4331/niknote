// ============================================================
// NikNote 4.0 — Bulletproof Auth + Cloud Guest Provisioning + Sync
// Works with native Supabase Anonymous Auth, Edge Guest Provisioning,
// AND 100% Zero-Error Offline Device Guest Mode with Automatic Cloud Promotion!
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AUTO_GUEST } from '@/config/features';
import {
  CLOUD_SYNC_EVENT,
  isCloudUserId,
  syncAllLocalDataToCloud,
  updateSyncSnapshot,
} from '@/lib/cloudSyncEngine';

const GUEST_VAULT_KEY = 'niknote.guest.vault.v1';
const OFFLINE_GUEST_KEY = 'niknote.offline.guest.v1';

interface GuestVault {
  email: string;
  password: string;
  userId?: string;
  name?: string;
}

// Module-level single-flight lock so React StrictMode double mounts + manual clicks
// NEVER fire parallel guest provisioning requests or mint duplicate cloud accounts.
let globalGuestProvisionInFlight: Promise<{
  error: Error | null;
  session?: Session | null;
  user?: User | null;
}> | null = null;

function readGuestVault(): GuestVault | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GUEST_VAULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.email && parsed?.password) return parsed as GuestVault;
    return null;
  } catch {
    return null;
  }
}

function writeGuestVault(vault: GuestVault | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!vault) localStorage.removeItem(GUEST_VAULT_KEY);
    else localStorage.setItem(GUEST_VAULT_KEY, JSON.stringify(vault));
  } catch {
    // ignore storage errors
  }
}

function readOfflineGuestUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(OFFLINE_GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.id) return parsed as User;
    return null;
  } catch {
    return null;
  }
}

function buildOfflineGuestUser(displayName?: string): User {
  const existing = readOfflineGuestUser();
  const cleanName =
    (displayName || existing?.user_metadata?.full_name || 'Guest').trim().slice(0, 40) || 'Guest';
  const id =
    existing?.id ||
    `local-guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const offlineUser = {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email: '',
    app_metadata: { provider: 'local_guest', providers: ['local_guest'] },
    user_metadata: {
      full_name: cleanName,
      is_guest: true,
      is_local_guest: true,
    },
    is_anonymous: true,
    created_at: existing?.created_at || new Date().toISOString(),
  } as unknown as User;

  try {
    localStorage.setItem(OFFLINE_GUEST_KEY, JSON.stringify(offlineUser));
  } catch {
    // ignore
  }
  return offlineUser;
}

export function isGuestUser(u: User | null | undefined): boolean {
  if (!u) return false;
  return Boolean(
    (u as any).is_anonymous ||
      u.user_metadata?.is_guest ||
      u.user_metadata?.is_local_guest ||
      (typeof u.email === 'string' && u.email.endsWith('@guest.niknote.online'))
  );
}

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
  signInAsGuest: (
    displayName?: string,
    opts?: { allowOfflineFallback?: boolean }
  ) => Promise<{ error: Error | null; offline?: boolean }>;
  upgradeGuestAccount: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ error: Error | null }>;
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
  const [user, setUser] = useState<User | null>(() => readOfflineGuestUser());
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const guestRef = useRef<Promise<{ error: Error | null; offline?: boolean }> | null>(null);

  const timed = (p: Promise<any>, ms: number, label: string): Promise<any> =>
    Promise.race([
      p,
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
    ]);

  // Core helper: provisions or resumes a REAL cloud guest session via single-flight lock:
  // 1) Existing session -> 2) Native Supabase signInAnonymously -> 3) Edge function `guest-session`
  const provisionCloudGuest = useCallback(
    async (
      displayName?: string
    ): Promise<{ error: Error | null; session?: Session | null; user?: User | null }> => {
      if (globalGuestProvisionInFlight) {
        return globalGuestProvisionInFlight;
      }

      globalGuestProvisionInFlight = (async () => {
        try {
          try {
            const { data: sessionData } = await timed(
              supabase.auth.getSession(),
              4000,
              'Guest sign-in is taking too long — check your internet'
            );
            if (sessionData?.session?.user) {
              setSession(sessionData.session);
              setUser(sessionData.session.user);
              return { error: null, session: sessionData.session, user: sessionData.session.user };
            }
          } catch {
            // continue to sign-in strategies
          }

          // Strategy 1: Native GoTrue anonymous auth (fast path when enabled, and preserves unit-test mocks)
          let firstErr: Error | null = null;
          try {
            const anonRes = await timed(
              supabase.auth.signInAnonymously(
                displayName
                  ? { options: { data: { full_name: displayName, is_guest: true } } }
                  : undefined
              ),
              8000,
              'Guest sign-in is taking too long — check your internet'
            );
            if (!anonRes?.error) {
              return {
                error: null,
                session: anonRes?.data?.session ?? null,
                user: anonRes?.data?.user ?? null,
              };
            }
            firstErr = anonRes.error as Error;
          } catch (err) {
            firstErr = err instanceof Error ? err : new Error('Guest sign-in failed');
          }

          // Strategy 2: Provision or resume real Supabase cloud guest session via Edge Function `guest-session`
          const canInvokeEdge =
            typeof supabase.functions?.invoke === 'function' &&
            (import.meta.env.MODE !== 'test' || Boolean((supabase.functions.invoke as any)?.mock));

          if (canInvokeEdge) {
            try {
              const storedVault = readGuestVault();
              const invokeRes = await timed(
                supabase.functions.invoke('guest-session', {
                  body: {
                    action: 'create',
                    guest_name: displayName || storedVault?.name || 'Guest',
                    ...(storedVault
                      ? { email: storedVault.email, password: storedVault.password }
                      : {}),
                  },
                }),
                7000,
                'Guest sign-in is taking too long — check your internet'
              );

              const payload = invokeRes?.data;
              if (!invokeRes?.error && payload?.access_token && payload?.refresh_token) {
                if (payload.email && payload.password) {
                  writeGuestVault({
                    email: payload.email,
                    password: payload.password,
                    userId: payload.user?.id,
                    name: displayName || storedVault?.name || 'Guest',
                  });
                }
                try {
                  localStorage.removeItem(OFFLINE_GUEST_KEY);
                } catch {
                  // ignore
                }

                if (typeof supabase.auth.setSession === 'function') {
                  const setRes = await supabase.auth.setSession({
                    access_token: payload.access_token,
                    refresh_token: payload.refresh_token,
                  });
                  const resolvedSession = setRes?.data?.session ?? null;
                  const resolvedUser = setRes?.data?.user ?? payload.user ?? null;
                  if (resolvedUser) {
                    setSession(resolvedSession);
                    setUser(resolvedUser);
                  }
                  return { error: null, session: resolvedSession, user: resolvedUser };
                }

                if (payload.user) {
                  setUser(payload.user);
                  return { error: null, user: payload.user };
                }
              }
              if (invokeRes?.error) {
                firstErr =
                  invokeRes.error instanceof Error
                    ? invokeRes.error
                    : new Error(String(invokeRes.error.message || invokeRes.error));
              }
            } catch (edgeErr) {
              firstErr = edgeErr instanceof Error ? edgeErr : new Error('Guest cloud session failed');
            }
          }

          return { error: firstErr || new Error('Guest sign-in failed') };
        } finally {
          globalGuestProvisionInFlight = null;
        }
      })();

      return globalGuestProvisionInFlight;
    },
    []
  );

  const signInAsGuest = useCallback(
    (displayName?: string, opts?: { allowOfflineFallback?: boolean }) => {
      if (guestRef.current) return guestRef.current;
      const allowFallback = opts?.allowOfflineFallback !== false;
      guestRef.current = (async () => {
        try {
          const result = await provisionCloudGuest(displayName);
          if (!result.error) {
            if (isCloudUserId(result.user?.id)) {
              void syncAllLocalDataToCloud(result.user.id, { pullCloud: true });
            }
            return { error: null, offline: false };
          }

          // Zero-error guarantee across ALL Guest entry buttons: open instant device guest
          // workspace immediately and auto-promote to Supabase Cloud when network returns!
          if (allowFallback) {
            const localUser = buildOfflineGuestUser(displayName);
            setUser(localUser);
            setSession(null);
            updateSyncSnapshot({ state: 'offline', errorMessage: null });
            return { error: null, offline: true };
          }

          return { error: result.error };
        } finally {
          guestRef.current = null;
        }
      })();
      return guestRef.current;
    },
    [provisionCloudGuest]
  );

  const upgradeGuestAccount = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const cleanEmail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        return { error: new Error('Please enter a valid email address') };
      }
      if (password.length < 8) {
        return { error: new Error('Password must be at least 8 characters') };
      }

      try {
        let activeSession = session;
        if (!activeSession?.access_token && typeof supabase.functions?.invoke === 'function') {
          const prov = await provisionCloudGuest(fullName);
          activeSession = prov.session ?? null;
        }

        if (typeof supabase.functions?.invoke === 'function' && activeSession?.access_token) {
          const { data, error } = await supabase.functions.invoke('guest-session', {
            body: {
              action: 'upgrade',
              email: cleanEmail,
              password,
              full_name: fullName,
            },
            headers: {
              Authorization: `Bearer ${activeSession.access_token}`,
            },
          });

          if (!error && !data?.error) {
            writeGuestVault(null);
            try {
              localStorage.removeItem(OFFLINE_GUEST_KEY);
            } catch {
              // ignore
            }
            if (
              data?.access_token &&
              data?.refresh_token &&
              typeof supabase.auth.setSession === 'function'
            ) {
              const setRes = await supabase.auth.setSession({
                access_token: data.access_token,
                refresh_token: data.refresh_token,
              });
              if (setRes?.data?.user) {
                setSession(setRes.data.session);
                setUser(setRes.data.user);
                if (isCloudUserId(setRes.data.user.id)) {
                  void syncAllLocalDataToCloud(setRes.data.user.id, { pullCloud: true });
                }
              }
            }
            return { error: null };
          }

          if (data?.error) {
            return { error: new Error(String(data.error)) };
          }
        }

        const { error } = await supabase.auth.updateUser({
          email: cleanEmail,
          password,
          data: { is_guest: false, ...(fullName ? { full_name: fullName } : {}) },
        });
        if (!error) writeGuestVault(null);
        return { error: (error as Error) ?? null };
      } catch (err) {
        return { error: err instanceof Error ? err : new Error('Could not upgrade guest account') };
      }
    },
    [session, provisionCloudGuest]
  );

  // Real-time bidirectional sync on login + whenever ANY note/tracker updates locally or tab regains focus!
  useEffect(() => {
    if (!isCloudUserId(user?.id)) return;
    const uid = user.id;
    void syncAllLocalDataToCloud(uid, { pullCloud: true });

    let debounceTimer: number | undefined;
    const scheduleSync = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        void syncAllLocalDataToCloud(uid, { pullCloud: true });
      }, 800);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleSync();
    };

    window.addEventListener(CLOUD_SYNC_EVENT, scheduleSync);
    window.addEventListener('focus', scheduleSync);
    window.addEventListener('online', scheduleSync);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      window.removeEventListener(CLOUD_SYNC_EVENT, scheduleSync);
      window.removeEventListener('focus', scheduleSync);
      window.removeEventListener('online', scheduleSync);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user?.id]);

  // Auto-promote offline guest to cloud session as soon as internet reconnects
  useEffect(() => {
    if (!user?.user_metadata?.is_local_guest) return;
    const onOnline = () => {
      void signInAsGuest(user.user_metadata?.full_name, { allowOfflineFallback: false }).then(
        (res) => {
          if (!res.error) {
            updateSyncSnapshot({ state: 'synced', errorMessage: null });
          }
        }
      );
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [user, signInAsGuest]);

  useEffect(() => {
    let mounted = true;
    const shouldAutoGuest =
      AUTO_GUEST && !/^\/(login|auth|reset-password)/.test(window.location.pathname);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, nextSession: Session | null) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && nextSession) {
        const target = sessionStorage.getItem('niknote_post_auth_redirect');
        const onAuthPage = /^\/(login|signup|auth)(\/|$)/.test(window.location.pathname);
        if (target && !onAuthPage) {
          sessionStorage.removeItem('niknote_post_auth_redirect');
          if (window.location.pathname !== target) {
            setTimeout(() => window.location.assign(target), 0);
          }
        }
      }

      switch (event) {
        case 'TOKEN_REFRESHED':
          if (!nextSession) {
            setSession(null);
            setUser(readOfflineGuestUser());
          } else {
            setSession(nextSession);
            setUser(nextSession.user);
          }
          break;

        case 'SIGNED_OUT':
          setSession(null);
          setUser(null);
          break;

        case 'SIGNED_IN':
        case 'USER_UPDATED':
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
          break;

        default:
          if (nextSession?.user) {
            setSession(nextSession);
            setUser(nextSession.user);
          } else {
            setSession(null);
            setUser(readOfflineGuestUser());
            // Do NOT prematurely mark loading=false on INITIAL_SESSION while AUTO_GUEST is provisioning!
            if (event === 'INITIAL_SESSION' && shouldAutoGuest) {
              return;
            }
          }
      }

      setLoading(false);
    });

    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: Session | null }; error: null }>(
      (resolve) => setTimeout(() => resolve({ data: { session: null }, error: null }), 10000)
    );

    Promise.race([sessionPromise, timeoutPromise])
      .then(({ data, error }) => {
        if (!mounted) return;
        const activeSession = data?.session ?? (data as any)?.session ?? null;
        if (error) {
          setSession(null);
          setUser(readOfflineGuestUser());
        } else if (activeSession?.user) {
          setSession(activeSession);
          setUser(activeSession.user);
        } else {
          setSession(null);
          setUser(readOfflineGuestUser());
        }

        if (!activeSession && shouldAutoGuest) {
          (async () => {
            await provisionCloudGuest();
            if (mounted) setLoading(false);
          })();
          return;
        }
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setUser(readOfflineGuestUser());
        setLoading(false);
      });

    return () => {
      mounted = false;
      globalGuestProvisionInFlight = null;
      subscription.unsubscribe();
    };
  }, [provisionCloudGuest]);

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
      if (!error) {
        writeGuestVault(null);
        try {
          localStorage.removeItem(OFFLINE_GUEST_KEY);
        } catch {
          // ignore
        }
      }
      return { error: error as Error | null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Sign in failed') };
    }
  };

  const signInWithGoogle = useCallback(async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
        sessionStorage.setItem('niknote_post_auth_redirect', redirect);
      }
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
      return { error: err instanceof Error ? err : new Error('Google sign-in failed') };
    }
  }, []);

  const signInWithGitHub = useCallback(async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
        sessionStorage.setItem('niknote_post_auth_redirect', redirect);
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        return { error: error as Error };
      }
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('GitHub sign-in failed') };
    }
  }, []);

  const signOut = async () => {
    writeGuestVault(null);
    try {
      localStorage.removeItem(OFFLINE_GUEST_KEY);
    } catch {
      // ignore
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithGitHub,
        signOut,
        isGuest: isGuestUser(user),
        signInAsGuest,
        upgradeGuestAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
