import { useState } from 'react';
import { Cloud, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCloudSyncStatus } from '@/lib/cloudSyncEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Turns the current guest workspace into a permanent Email + Password account
 * WITHOUT changing user_id — so every note, notebook, board, money entry, and habit
 * stays 100% intact and opens across all phones & laptops.
 */
export function GuestUpgradeCard() {
  const { user, isGuest, pendingGuestEmail, signOut, signInAsGuest, upgradeGuestAccount } = useAuth();
  const sync = useCloudSyncStatus(user?.id);
  const [confirmNew, setConfirmNew] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user || !isGuest) return null;

  const savePermanentAccount = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error('Enter a valid email address');
    if (password.length < 8) return toast.error('Password must be at least 8 characters');
    setBusy(true);
    const result = await upgradeGuestAccount(
      email.trim(),
      password,
      user.user_metadata?.full_name
    );
    setBusy(false);
    if (result.error) return toast.error(result.error.message);
    setEmail('');
    setPassword('');
    if (result.confirmationRequired) {
      toast.success('Confirmation email sent. Your workspace remains a guest until you confirm.');
    } else {
      toast.success('Account email updated and workspace synced ☁️');
    }
  };

  const handleManualSync = async () => {
    setBusy(true);
    if (user.user_metadata?.is_local_guest) {
      const promoted = await signInAsGuest(user.user_metadata?.full_name);
      setBusy(false);
      if (promoted.error) {
        toast.error('Still offline — your notes stay safely saved on this device.');
      } else {
        toast.success('Connected & synced to NikNote Cloud ☁️');
      }
      return;
    }
    const res = await sync.syncNow();
    setBusy(false);
    if (res.ok) {
      toast.success('All notes, habits, boards & money entries synced to cloud ☁️');
    } else {
      toast.error(res.error || 'Could not reach cloud right now');
    }
  };

  return (
    <section
      className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3 text-left"
      aria-label="Keep your guest work"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">Guest Workspace Active</h3>
        <button
          type="button"
          onClick={handleManualSync}
          disabled={busy || sync.state === 'syncing'}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-background transition"
        >
          {sync.state === 'syncing' ? (
            <>
              <RefreshCw size={12} className="animate-spin text-primary" /> Syncing…
            </>
          ) : sync.state === 'synced' ? (
            <>
              <CheckCircle2 size={12} className="text-emerald-500" /> Cloud Synced
            </>
          ) : (
            <>
              <Cloud size={12} className="text-primary" /> Sync Now
            </>
          )}
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Save an email &amp; password below to keep all your notes, habits, boards &amp; money entries across every phone and PC without losing anything.
      </p>

      <Input
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        type="password"
        autoComplete="new-password"
        placeholder="Create password (8+ characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button className="w-full" disabled={busy} onClick={savePermanentAccount}>
        {busy ? 'Saving & syncing…' : 'Save Permanent Account & Sync'}
      </Button>

      {pendingGuestEmail && (
        <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
          Confirmation is pending for <strong>{pendingGuestEmail}</strong>. This workspace and its cloud data remain on the current guest account until Supabase finishes verification.
          {user.email?.endsWith('@guest.niknote.online') && ' The current address is system-generated; if verification is also required there and you cannot access it, keep this session open and do not clear this browser’s saved site data.'}
        </p>
      )}

      {confirmNew ? (
        <div
          role="alertdialog"
          aria-label="Start a new guest workspace"
          className="rounded-xl border border-destructive/40 p-3 space-y-2"
        >
          <p className="text-sm text-foreground">
            {pendingGuestEmail
              ? 'Email confirmation is still pending. Signing out keeps the saved guest credentials on this browser; return and choose guest sign-in to resume this same workspace.'
              : 'Starting a new workspace clears this browser session. Add an email above first if you want to keep your notes.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmNew(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={async () => {
                await signOut();
                window.location.assign('/login');
              }}
            >
              {pendingGuestEmail ? 'Sign out & resume later' : 'Start new'}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" className="w-full" onClick={() => setConfirmNew(true)}>
          {pendingGuestEmail ? 'Sign out (keep pending guest workspace)' : 'Sign out / start a new guest workspace'}
        </Button>
      )}
    </section>
  );
}
