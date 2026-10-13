import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Stage = 'request' | 'sent' | 'checking' | 'update' | 'done' | 'expired';

/** Reads a recovery link: `#access_token=...&type=recovery`, `#error=...`, or `?code=` (PKCE). */
const firstHash = typeof window !== 'undefined' ? window.location.hash : '';
const firstSearch = typeof window !== 'undefined' ? window.location.search : '';
function linkState(): 'recovery' | 'error' | 'none' {
  const h = new URLSearchParams((window.location.hash || (window.location.pathname === '/reset-password' ? firstHash : '')).slice(1));
  const q = new URLSearchParams(window.location.search || firstSearch);
  if (h.get('error') || q.get('error')) return 'error';
  if (h.get('type') === 'recovery' || h.get('access_token') || q.get('code')) return 'recovery';
  return 'none';
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const initial = linkState();
  const [stage, setStage] = useState<Stage>(initial === 'recovery' ? 'checking' : initial === 'error' ? 'expired' : 'request');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial !== 'recovery') return;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) setStage('update');
    });
    const q = new URLSearchParams(window.location.search).get('code');
    (async () => {
      if (q) {
        const { error } = await supabase.auth.exchangeCodeForSession(q);
        if (error) return setStage('expired');
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) setStage('update');
      else setTimeout(async () => {
        const { data: d } = await supabase.auth.getSession();
        setStage(d.session ? 'update' : 'expired');
      }, 2500);
    })();
    return () => sub.subscription.unsubscribe();
  }, [initial]);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) return setError(error.message.includes('rate') ? 'Too many requests. Please wait a minute and try again.' : 'Could not send the email. Please try again.');
    setStage('sent');
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(/same|different/i.test(error.message) ? 'Choose a password different from your old one.' : error.message.includes('weak') || error.message.includes('pwned') ? 'This password is too easy to guess. Try a stronger one.' : 'Could not update the password. Please request a new link.');
    window.history.replaceState(null, '', '/reset-password');
    setStage('done');
    setTimeout(() => navigate('/', { replace: true }), 1800);
  };

  return (
    <main className="nik-auth-page">
      <div className="nik-auth-backdrop" aria-hidden="true" />
      <Link to="/login" className="nik-auth-back text-muted-foreground"><ArrowLeft size={17} /> Sign in</Link>
      <section className="nik-auth-content">
        <header className="text-center mb-7">
          <img src="/niknote-logo.png" alt="Niknote" className="nik-auth-logo" />
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">{stage === 'update' ? 'Set a new password' : 'Reset your password'}</h1>
        </header>
        <div className="nik-auth-form-surface space-y-4">
          {stage === 'request' && (
            <form onSubmit={sendLink} className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter your email and we’ll send you a reset link.</p>
              <div><Label htmlFor="rp-email">Email</Label><div className="relative mt-2"><Mail className="nik-auth-field-icon" size={18} /><Input id="rp-email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} className="h-12 pl-11 bg-background/70" /></div></div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full h-12" disabled={busy}>{busy ? <Loader2 className="animate-spin" size={18} /> : 'Send reset link'}</Button>
            </form>
          )}
          {stage === 'sent' && <div role="status" className="text-center space-y-3"><Mail className="mx-auto text-primary" size={34} /><p className="text-sm text-muted-foreground">If an account exists for <strong className="text-foreground break-all">{email}</strong>, a reset link is on its way. Check spam too. Open only the newest email — each link works once.</p></div>}
          {stage === 'checking' && <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="animate-spin" size={18} /> Checking your link…</div>}
          {stage === 'expired' && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">This reset link has expired or was already used. Links work only once — request a new one below.</p>
              <Button className="w-full" onClick={() => { window.history.replaceState(null, '', '/reset-password'); setStage('request'); }}>Send a new link</Button>
            </div>
          )}
          {stage === 'update' && (
            <form onSubmit={savePassword} className="space-y-4">
              <div><Label htmlFor="rp-new">New password</Label><div className="relative mt-2"><LockKeyhole className="nik-auth-field-icon" size={18} /><Input id="rp-new" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} className="h-12 pl-11 bg-background/70" /></div></div>
              <div><Label htmlFor="rp-confirm">Confirm password</Label><div className="relative mt-2"><LockKeyhole className="nik-auth-field-icon" size={18} /><Input id="rp-confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy} className="h-12 pl-11 bg-background/70" /></div></div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full h-12" disabled={busy}>{busy ? <Loader2 className="animate-spin" size={18} /> : 'Save new password'}</Button>
            </form>
          )}
          {stage === 'done' && <div role="status" className="text-center space-y-2"><Check className="mx-auto text-primary" size={36} /><p className="text-sm text-muted-foreground">Password updated. Opening your workspace…</p></div>}
        </div>
      </section>
    </main>
  );
}
