import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useHaptics } from '@/hooks/useHaptics';
import { NiknoteLoader } from '@/components/motion/NiknoteLoader';
import { supabase } from '@/integrations/supabase/client';
import { isCloudUserId } from '@/lib/cloudSyncEngine';

export function NiknoteAuth({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const { signIn, signUp, signInWithGoogle, signInAsGuest, user, loading: authLoading } = useAuth();
  const { triggerHaptic } = useHaptics();
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();

  const [authTab, setAuthTab] = useState<'guest' | 'login' | 'signup'>(mode === 'signup' ? 'signup' : 'guest');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [website, setWebsite] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);
  const [entering, setEntering] = useState(false);
  const [guestName, setGuestName] = useState('');

  useEffect(() => {
    setAuthTab(mode === 'signup' ? 'signup' : 'guest');
  }, [mode]);

  // Warm up tracker chunks in background so guest entry opens instantly
  useEffect(() => {
    const warm = () => {
      import('@/pages/MoneyTracker');
      import('@/pages/RoutineTracker');
    };
    const w = window as any;
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(warm, { timeout: 2500 })
      : window.setTimeout(warm, 1200);
    return () => {
      w.cancelIdleCallback ? w.cancelIdleCallback(id) : window.clearTimeout(id);
    };
  }, []);

  const resolveRedirectTarget = () => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem('niknote_post_auth_redirect');
    } catch {
      /* noop */
    }
    const requested = new URLSearchParams(location.search).get('redirect') ?? stored;
    return requested &&
      /^\/(?!\/)/.test(requested) &&
      !requested.includes('\\') &&
      !/^\/(login|signup|auth)(?:[/?#]|$)/.test(requested)
      ? requested
      : '/';
  };

  useEffect(() => {
    if (authLoading || !user || submitting.current) return;
    const target = resolveRedirectTarget();
    const timer = window.setTimeout(
      () => {
        try {
          sessionStorage.removeItem('niknote_post_auth_redirect');
        } catch {
          /* noop */
        }
        navigate(target, { replace: true });
      },
      success && !reduced ? 900 : 0
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, success, reduced, navigate, location.search, busy]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || website) return;
    const isSignup = authTab === 'signup';
    triggerHaptic('light');
    setError('');
    submitting.current = true;
    setBusy(true);
    try {
      const result = isSignup
        ? await signUp(email.trim(), password, name.trim())
        : await signIn(email.trim(), password);
      if (result.error) {
        setError(result.error.message);
        triggerHaptic('error');
      } else {
        setSuccess(true);
        triggerHaptic('success');
        setPassword('');
      }
    } catch {
      setError('Could not connect. Please try again.');
      triggerHaptic('error');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function guest() {
    if (busy) return;
    const label = guestName.trim().replace(/\s+/g, ' ').slice(0, 40);
    triggerHaptic('light');
    setError('');
    submitting.current = true;
    setBusy(true);
    setEntering(true);

    const r = await signInAsGuest(label || undefined, { allowOfflineFallback: true });
    submitting.current = false;
    setBusy(false);
    setEntering(false);

    if (r.error) {
      setError('Could not open guest workspace. Please try again.');
      triggerHaptic('error');
      return;
    }

    triggerHaptic('success');
    if (r.offline) {
      toast.success('Guest workspace ready offline — auto-syncs when online ✨');
    }

    if (label) {
      void (async () => {
        try {
          const res = (await Promise.race([
            supabase.auth.getUser(),
            new Promise<{ data: { user: null } }>((resolve) =>
              setTimeout(() => resolve({ data: { user: null } }), 5000)
            ),
          ])) as { data: { user?: { id: string } | null } | null };
          const uid = res?.data?.user?.id;
          if (!isCloudUserId(uid)) return;
          await Promise.race([
            (async () => {
              await supabase.auth.updateUser({ data: { full_name: label } });
              await supabase.from('profiles').update({ display_name: label }).eq('user_id', uid);
            })(),
            new Promise((res) => setTimeout(res, 6000)),
          ]);
        } catch {
          // Display name sync is optional — never block entry
        }
      })();
    }

    const target = resolveRedirectTarget();
    try {
      sessionStorage.removeItem('niknote_post_auth_redirect');
    } catch {
      /* noop */
    }
    navigate(target, { replace: true });
  }

  const handleGoogle = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    const res = await signInWithGoogle();
    if (res.error) {
      setBusy(false);
      setError(res.error.message);
      triggerHaptic('error');
    }
  };

  const signup = authTab === 'signup';

  return (
    <main className="nik-auth-page">
      {entering && <NiknoteLoader label="Opening guest workspace" />}
      <div className="nik-auth-backdrop" aria-hidden="true" />
      <Link
        to="/"
        className="nik-auth-back text-muted-foreground"
        onClick={() => triggerHaptic('selection')}
      >
        <ArrowLeft size={17} /> Home
      </Link>
      <motion.section
        key={authTab}
        className="nik-auth-content"
        initial={reduced ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <header className="text-center mb-7">
          <motion.img
            src="/niknote-logo.png"
            alt="Niknote"
            className="nik-auth-logo"
            initial={reduced ? false : { rotate: -8, scale: 0.88 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 16 }}
          />
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
            {authTab === 'signup'
              ? 'Create your Niknote account'
              : authTab === 'guest'
                ? 'Welcome to Niknote'
                : 'Sign in to Niknote'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {authTab === 'signup'
              ? 'Sync your notes, habits, boards & money across every device.'
              : authTab === 'guest'
                ? 'Instant private cloud workspace — just tell us your name or hit Continue.'
                : 'Welcome back. Your cloud-synced workspace is waiting.'}
          </p>
        </header>

        <div className="nik-auth-form-surface">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                role="status"
                aria-live="polite"
                className="nik-auth-success"
                initial={reduced ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="nik-auth-success-mark">
                  <motion.div
                    initial={reduced ? false : { scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 12 }}
                  >
                    {signup && !user ? <Mail size={34} /> : <Check size={38} />}
                  </motion.div>
                  {!reduced &&
                    Array.from({ length: 8 }, (_, i) => (
                      <span key={i} className={`nik-auth-spark nik-auth-spark-${i}`} />
                    ))}
                </div>
                <h2 className="text-xl font-semibold text-foreground">
                  {signup && !user ? 'Account created!' : 'You’re in!'}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {signup && !user ? (
                    <>
                      Sign in with <strong className="text-foreground break-all">{email}</strong> to open your synced workspace.
                    </>
                  ) : (
                    'Opening & syncing your workspace…'
                  )}
                </p>
                {signup && !user && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSuccess(false);
                      setAuthTab('login');
                    }}
                  >
                    Continue to Sign In <ArrowRight size={16} />
                  </Button>
                )}
              </motion.div>
            ) : authTab === 'guest' ? (
              <motion.form
                key="guest"
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void guest();
                }}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? {} : { opacity: 0, y: -8 }}
              >
                <div>
                  <Label htmlFor="guest-name">What should we call you?</Label>
                  <div className="relative mt-2">
                    <UserRound className="nik-auth-field-icon" size={18} />
                    <Input
                      id="guest-name"
                      placeholder="Your name (optional)"
                      autoComplete="nickname"
                      maxLength={40}
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      disabled={busy}
                      className="h-12 pl-11 bg-background/70"
                    />
                  </div>
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <motion.div whileTap={reduced ? {} : { scale: 0.97 }}>
                  <Button
                    type="submit"
                    data-testid="guest-continue-btn"
                    disabled={busy}
                    className="nik-auth-submit w-full h-12 gap-2"
                  >
                    {busy ? (
                      <>
                        <Loader2 size={18} className="animate-spin motion-reduce:animate-none" /> Opening your space…
                      </>
                    ) : (
                      <>
                        Continue as Guest
                        <ArrowRight size={18} />
                      </>
                    )}
                  </Button>
                </motion.div>
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  No email or password needed. Auto-syncs to your private cloud session in this browser. Add an email anytime in Account to open on any device.
                </p>
                <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setAuthTab('login');
                      triggerHaptic('selection');
                    }}
                    className="min-h-[44px] text-primary font-medium hover:underline"
                  >
                    Already have an account? Sign in
                  </button>
                  <span className="hidden sm:inline text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setAuthTab('signup');
                      triggerHaptic('selection');
                    }}
                    className="min-h-[44px] text-muted-foreground hover:text-foreground font-medium hover:underline"
                  >
                    Create account
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="form"
                onSubmit={submit}
                className="space-y-4"
                initial={false}
                exit={reduced ? {} : { opacity: 0, y: -8 }}
              >
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="auth-website">Website</label>
                  <input
                    id="auth-website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
                {signup && (
                  <div>
                    <Label htmlFor="auth-name">Full name</Label>
                    <div className="relative mt-2">
                      <UserRound className="nik-auth-field-icon" size={18} />
                      <Input
                        id="auth-name"
                        placeholder="Your name"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={100}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={busy}
                        className="h-12 pl-11 bg-background/70"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor="auth-email">Email</Label>
                  <div className="relative mt-2">
                    <Mail className="nik-auth-field-icon" size={18} />
                    <Input
                      id="auth-email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={busy}
                      className="h-12 pl-11 bg-background/70"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="auth-password">Password</Label>
                  <div className="relative mt-2">
                    <LockKeyhole className="nik-auth-field-icon" size={18} />
                    <Input
                      id="auth-password"
                      type={visible ? 'text' : 'password'}
                      placeholder={signup ? 'Create a password (8+ chars)' : 'Your password'}
                      autoComplete={signup ? 'new-password' : 'current-password'}
                      required
                      minLength={signup ? 8 : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy}
                      className="h-12 pl-11 pr-12 bg-background/70"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={visible ? 'Hide password' : 'Show password'}
                      onClick={() => {
                        setVisible(!visible);
                        triggerHaptic('selection');
                      }}
                      className="absolute right-1 top-1 h-10 w-10 text-muted-foreground"
                    >
                      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </Button>
                  </div>
                </div>
                {!signup && (
                  <div className="text-right -mt-2">
                    <Link to="/reset-password" className="text-xs text-primary font-medium hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                )}
                {error && (
                  <motion.p
                    key={error}
                    role="alert"
                    className="text-sm text-destructive"
                    animate={reduced ? {} : { x: [0, -5, 5, -3, 3, 0] }}
                    transition={{ duration: 0.35 }}
                  >
                    {error}
                  </motion.p>
                )}
                <motion.div whileTap={reduced ? {} : { scale: 0.97 }}>
                  <Button type="submit" disabled={busy} className="nik-auth-submit w-full h-12 gap-2">
                    {busy ? (
                      <>
                        <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />{' '}
                        {signup ? 'Creating account…' : 'Signing in…'}
                      </>
                    ) : (
                      <>
                        {signup ? 'Create Account' : 'Sign in'}
                        <ArrowRight size={18} />
                      </>
                    )}
                  </Button>
                </motion.div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={handleGoogle}
                  className="w-full h-11 font-medium"
                >
                  Continue with Google
                </Button>

                <div className="flex flex-wrap items-center justify-center gap-3 text-sm pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setAuthTab(signup ? 'login' : 'signup');
                    }}
                    className="min-h-[44px] text-primary font-medium hover:underline"
                  >
                    {signup ? 'Already have an account? Sign in' : 'New here? Create account'}
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setAuthTab('guest');
                    }}
                    className="min-h-[44px] text-muted-foreground hover:text-foreground font-medium hover:underline"
                  >
                    Continue as guest
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-5 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} /> Your notes. Synced safely across your devices.
        </p>
      </motion.section>
    </main>
  );
}
