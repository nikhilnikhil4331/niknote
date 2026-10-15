import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Turns the current guest into a permanent account WITHOUT changing the user ID,
 * so every note, board, money entry and habit stays attached.
 * Step 1: add an email (confirmation link). Step 2 (after confirming): set a password.
 */
export function GuestUpgradeCard() {
  const { user, isGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const needsPassword = !isGuest && typeof window !== 'undefined' && localStorage.getItem('nn-guest-linking') === user?.id;
  if (!user || (!isGuest && !needsPassword)) return null;

  const linkEmail = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error('Enter a valid email');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${window.location.origin}/account-details` });
    setBusy(false);
    if (error) return toast.error(error.message);
    localStorage.setItem('nn-guest-linking', user.id);
    setSent(true);
  };
  const setPw = async () => {
    if (password.length < 8) return toast.error('Use at least 8 characters');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    localStorage.removeItem('nn-guest-linking');
    toast.success('Account saved — sign in with your email and password on any device');
    setPassword('');
  };

  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3 text-left" aria-label="Keep your guest work">
      {needsPassword ? <>
        <h3 className="font-semibold text-foreground">Last step: set a password</h3>
        <p className="text-sm text-muted-foreground">Your email is confirmed and your work is kept. Add a password to sign in from other devices.</p>
        <Input type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={password} onChange={e => setPassword(e.target.value)} />
        <Button className="w-full" disabled={busy} onClick={setPw}>Save password</Button>
      </> : sent ? <>
        <h3 className="font-semibold text-foreground">Check your email</h3>
        <p className="text-sm text-muted-foreground">Open the link sent to <strong className="break-all">{email}</strong>. Your guest notes and trackers stay with you, then you can set a password.</p>
      </> : <>
        <h3 className="font-semibold text-foreground">You're using Niknote as a guest</h3>
        <p className="text-sm text-muted-foreground">Your work lives only in this browser's session. Clearing site data or signing out loses access. Add an email to keep everything.</p>
        <Input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        <Button className="w-full" disabled={busy} onClick={linkEmail}>Keep my work</Button>
      </>}
    </section>
  );
}
