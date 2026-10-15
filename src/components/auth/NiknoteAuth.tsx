import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useHaptics } from '@/hooks/useHaptics';
import { SIGNUP_ENABLED } from '@/config/features';

export function NiknoteAuth({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const signup = mode === 'signup' && SIGNUP_ENABLED;
  const { signIn, signUp, signInAsGuest, user, loading: authLoading } = useAuth();
  const { triggerHaptic } = useHaptics();
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [website, setWebsite] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (authLoading || !user || submitting.current) return;
    let stored: string | null = null;
    try { stored = sessionStorage.getItem('niknote_post_auth_redirect'); sessionStorage.removeItem('niknote_post_auth_redirect'); } catch { /* noop */ }
    const requested = new URLSearchParams(location.search).get('redirect') ?? stored;
    const target = requested && /^\/(?!\/)/.test(requested) && !requested.includes('\\') && !/^\/(login|signup|auth)(?:[/?#]|$)/.test(requested) ? requested : '/';
    const timer = window.setTimeout(() => navigate(target, { replace: true }), success && !reduced ? 1400 : 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, user, success, reduced, navigate, location.search, busy]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || website) return;
    triggerHaptic('light');
    setError('');
    submitting.current = true;
    setBusy(true);
    try {
      const result = signup ? await signUp(email.trim(), password, name.trim()) : await signIn(email.trim(), password);
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
    triggerHaptic('light'); setError(''); submitting.current = true; setBusy(true);
    const r = await signInAsGuest();
    submitting.current = false; setBusy(false);
    if (r.error) { setError('Guest mode is unavailable right now. Please try again.'); triggerHaptic('error'); }
    else triggerHaptic('success');
  }

  const otherPath = `${signup ? '/login' : '/signup'}${location.search}`;
  return (
    <main className="nik-auth-page">
      <div className="nik-auth-backdrop" aria-hidden="true" />
      <Link to="/" className="nik-auth-back text-muted-foreground" onClick={() => triggerHaptic('selection')}><ArrowLeft size={17} /> Home</Link>
      <motion.section key={mode} className="nik-auth-content" initial={reduced ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
        <header className="text-center mb-7">
          <motion.img src="/niknote-logo.png" alt="Niknote" className="nik-auth-logo" initial={reduced ? false : { rotate: -8, scale: .88 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 16 }} />
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">{signup ? 'Sign up with Niknote' : SIGNUP_ENABLED ? 'Sign in to Niknote' : 'Use Niknote free'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{signup ? 'Your next chapter starts here.' : 'Welcome back. Your notes are waiting.'}</p>
        </header>
        <div className="nik-auth-form-surface">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div key="success" role="status" aria-live="polite" className="nik-auth-success" initial={reduced ? false : { opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="nik-auth-success-mark">
                  <motion.div initial={reduced ? false : { scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 12 }}>{signup && !user ? <Mail size={34} /> : <Check size={38} />}</motion.div>
                  {!reduced && Array.from({ length: 8 }, (_, i) => <span key={i} className={`nik-auth-spark nik-auth-spark-${i}`} />)}
                </div>
                <h2 className="text-xl font-semibold text-foreground">{signup && !user ? 'Check your email' : signup ? <>Welcome to <img src="/niknote-logo.png" alt="Niknote" className="inline-block h-10 w-28 object-contain align-middle" /></> : 'You’re back!'}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{signup && !user ? <>Open the confirmation link sent to <strong className="text-foreground break-all">{email}</strong> to finish signing up.</> : 'Opening your workspace…'}</p>
                {signup && !user && <><p className="text-xs text-muted-foreground">Can’t find it? Check your spam folder.</p><Button asChild variant="outline" className="w-full"><Link to={otherPath}>Back to sign in <ArrowRight size={16} /></Link></Button></>}
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} className="space-y-4" initial={false} exit={reduced ? {} : { opacity: 0, y: -8 }}>
                <div className="sr-only" aria-hidden="true"><label htmlFor="auth-website">Website</label><input id="auth-website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></div>
                {signup && <div><Label htmlFor="auth-name">Full name</Label><div className="relative mt-2"><UserRound className="nik-auth-field-icon" size={18} /><Input id="auth-name" placeholder="Your name" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} disabled={busy} className="h-12 pl-11 bg-background/70" /></div></div>}
                <div><Label htmlFor="auth-email">Email</Label><div className="relative mt-2"><Mail className="nik-auth-field-icon" size={18} /><Input id="auth-email" type="email" placeholder="you@example.com" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} className="h-12 pl-11 bg-background/70" /></div></div>
                <div><Label htmlFor="auth-password">Password</Label><div className="relative mt-2"><LockKeyhole className="nik-auth-field-icon" size={18} /><Input id="auth-password" type={visible ? 'text' : 'password'} placeholder={signup ? 'Create a password' : 'Your password'} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} className="h-12 pl-11 pr-12 bg-background/70" /><Button type="button" variant="ghost" size="icon" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => { setVisible(!visible); triggerHaptic('selection'); }} className="absolute right-1 top-1 h-10 w-10 text-muted-foreground">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</Button></div>{signup && <p className="mt-2 text-xs text-muted-foreground">At least 8 characters</p>}</div>
                {!signup && <div className="text-right -mt-2"><Link to="/reset-password" className="text-xs text-primary font-medium hover:underline">Forgot password?</Link></div>}
                {error && <motion.p key={error} role="alert" className="text-sm text-destructive" animate={reduced ? {} : { x: [0, -5, 5, -3, 3, 0] }} transition={{ duration: .35 }}>{error}</motion.p>}
                <motion.div whileTap={reduced ? {} : { scale: .97 }}><Button type="submit" disabled={busy || authLoading} className="nik-auth-submit w-full h-12 gap-2">{busy ? <><Loader2 size={18} className="animate-spin motion-reduce:animate-none" /> {signup ? 'Creating account…' : 'Signing in…'}</> : <>{signup ? 'Sign up with Niknote' : 'Sign in'}<ArrowRight size={18} /></>}</Button></motion.div>
                {signup && <p className="text-xs text-muted-foreground text-center leading-relaxed">By signing up, you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>}
                {!SIGNUP_ENABLED && <div className="pt-1 space-y-2"><Button type="button" variant="outline" onClick={guest} disabled={busy || authLoading} className="w-full h-12">Try Niknote free — continue as guest</Button><p className="text-xs text-muted-foreground text-center leading-relaxed">New accounts are paused. Guest notes are saved privately to this browser's session; clearing site data can lose access.</p></div>}
                {SIGNUP_ENABLED && <p className="text-sm text-muted-foreground text-center pt-2">{signup ? 'Already part of Niknote? ' : 'New user of Niknote? '}<Link to={otherPath} className="text-primary font-semibold underline-offset-4 hover:underline" onClick={() => triggerHaptic('selection')}>{signup ? 'Sign in' : 'Sign up'}</Link></p>}
              </motion.form>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-5 text-xs text-muted-foreground flex items-center justify-center gap-1.5"><ShieldCheck size={14} /> Your notes. Your space.</p>
      </motion.section>
    </main>
  );
}