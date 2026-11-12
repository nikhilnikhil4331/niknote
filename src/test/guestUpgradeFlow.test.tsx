import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { GuestUpgradeCard } from '@/components/auth/GuestUpgradeCard';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const mocks = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  invoke: vi.fn(),
  syncNow: vi.fn(async () => ({ ok: true })),
}));

vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/lib/cloudSyncEngine', () => ({
  CLOUD_SYNC_EVENT: 'test-cloud-sync',
  isCloudUserId: () => false,
  syncAllLocalDataToCloud: vi.fn(async () => undefined),
  updateSyncSnapshot: vi.fn(),
  useCloudSyncStatus: () => ({ state: 'idle', syncNow: mocks.syncNow }),
}));

const guestUser = {
  id: '550e8400-e29b-41d4-a716-446655440099',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'guest_abc@guest.niknote.online',
  is_anonymous: false,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Riya', is_guest: true },
  created_at: '2026-01-01T00:00:00.000Z',
};
const guestSession = {
  access_token: 'guest-access-token',
  refresh_token: 'guest-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  user: guestUser,
};

function renderUpgradeCard() {
  return render(
    <AuthProvider>
      <GuestUpgradeCard />
    </AuthProvider>
  );
}

function ResumeGuestHarness() {
  const { signInAsGuest, user, pendingGuestEmail } = useAuth();
  return (
    <>
      <button type="button" onClick={() => void signInAsGuest('Riya')}>
        Resume saved guest
      </button>
      <span data-testid="resumed-email">{user?.email || ''}</span>
      <span data-testid="pending-email">{pendingGuestEmail || ''}</span>
      {user && <GuestUpgradeCard />}
    </>
  );
}

function PendingSignOutHarness() {
  const { pendingGuestEmail, signOut } = useAuth();
  return (
    <>
      <span data-testid="pending-email">{pendingGuestEmail || ''}</span>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </>
  );
}

function SignUpAttemptHarness() {
  const { signUp } = useAuth();
  const [message, setMessage] = useState('');
  return (
    <>
      <button type="button" onClick={async () => {
        const result = await signUp('new@example.com', 'a-strong-password', 'New User');
        setMessage(result.error?.message || 'Unexpected signup success');
      }}>Attempt email sign-up</button>
      <span data-testid="signup-result">{message}</span>
    </>
  );
}

describe('guest account email-confirmation upgrade', () => {
  let authChangeSpy: ReturnType<typeof vi.spyOn>;
  let getSessionSpy: ReturnType<typeof vi.spyOn>;
  let updateUserSpy: ReturnType<typeof vi.spyOn>;
  let signOutSpy: ReturnType<typeof vi.spyOn>;
  let invokeSpy: ReturnType<typeof vi.spyOn>;
  let signUpSpy: ReturnType<typeof vi.spyOn> | undefined;
  let setSessionSpy: ReturnType<typeof vi.spyOn> | undefined;
  let anonSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    localStorage.clear();
    mocks.toast.success.mockReset();
    mocks.toast.error.mockReset();
    mocks.invoke.mockReset();
    authChangeSpy = vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>);
    getSessionSpy = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: guestSession },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    signOutSpy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signOut>>);
    updateUserSpy = vi.spyOn(supabase.auth, 'updateUser').mockResolvedValue({
      data: {
        user: {
          ...guestUser,
          user_metadata: { ...guestUser.user_metadata, is_guest: false },
          new_email: 'riya@example.com',
          email_change_sent_at: '2026-11-04T00:00:00.000Z',
        },
      },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.updateUser>>);
    invokeSpy = vi.spyOn(supabase, 'functions', 'get').mockReturnValue({
      invoke: mocks.invoke,
    } as unknown as typeof supabase.functions);
  });

  afterEach(() => {
    authChangeSpy.mockRestore();
    getSessionSpy.mockRestore();
    updateUserSpy.mockRestore();
    signOutSpy.mockRestore();
    invokeSpy.mockRestore();
    signUpSpy?.mockRestore();
    setSessionSpy?.mockRestore();
    anonSpy?.mockRestore();
    localStorage.clear();
  });

  it('blocks email account creation when the central signup flag is disabled', async () => {
    signUpSpy = vi.spyOn(supabase.auth, 'signUp');
    render(
      <AuthProvider>
        <SignUpAttemptHarness />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Attempt email sign-up' }));
    expect(await screen.findByTestId('signup-result')).toHaveTextContent(/Email sign-up is currently disabled/);
    expect(signUpSpy).not.toHaveBeenCalled();
  });

  it('changes email on the existing authenticated account and reports confirmation as pending', async () => {
    const { unmount } = renderUpgradeCard();
    await screen.findByText('Guest Workspace Active');

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'Riya@Example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Create password (8+ characters)'), { target: { value: 'a-strong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Permanent Account & Sync' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Confirmation is pending for riya@example.com/);
    expect(updateUserSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'riya@example.com',
        password: 'a-strong-password',
        data: expect.objectContaining({ full_name: 'Riya', is_guest: false }),
      }),
      { emailRedirectTo: `${window.location.origin}/` }
    );
    expect(mocks.invoke).not.toHaveBeenCalled();
    const guestVault = JSON.parse(localStorage.getItem('niknote.guest.vault.v1') || 'null');
    expect(guestVault).toMatchObject({
      email: guestUser.email,
      password: 'a-strong-password',
      userId: guestUser.id,
      pendingEmail: 'riya@example.com',
    });
    expect(mocks.toast.success).toHaveBeenCalledWith(expect.stringContaining('remains a guest'));

    unmount();
    renderUpgradeCard();
    expect(await screen.findByRole('status')).toHaveTextContent(/Confirmation is pending for riya@example.com/);
  });

  it('keeps saved credentials and pending status when the user signs out to resume later', async () => {
    const pendingVault = {
      email: guestUser.email,
      password: 'a-strong-password',
      userId: guestUser.id,
      name: 'Riya',
      pendingEmail: 'riya@example.com',
    };
    localStorage.setItem('niknote.guest.vault.v1', JSON.stringify(pendingVault));
    render(
      <AuthProvider>
        <PendingSignOutHarness />
      </AuthProvider>
    );

    expect(await screen.findByTestId('pending-email')).toHaveTextContent('riya@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(signOutSpy).toHaveBeenCalledOnce());
    expect(screen.getByTestId('pending-email')).toHaveTextContent('riya@example.com');
    expect(JSON.parse(localStorage.getItem('niknote.guest.vault.v1') || 'null')).toMatchObject(pendingVault);
  });

  it('does not create a replacement workspace when both saved pending-email logins fail', async () => {
    window.history.replaceState({}, '', '/login');
    const pendingVault = {
      email: guestUser.email,
      password: 'a-strong-password',
      userId: guestUser.id,
      name: 'Riya',
      pendingEmail: 'riya@example.com',
    };
    localStorage.setItem('niknote.guest.vault.v1', JSON.stringify(pendingVault));
    getSessionSpy.mockResolvedValue({
      data: { session: null }, error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    mocks.invoke.mockResolvedValue({
      data: { error: 'Saved guest workspace could not be resumed' },
      error: { status: 401, message: 'Unauthorized' },
    } as unknown as Awaited<ReturnType<typeof supabase.functions.invoke>>);
    anonSpy = vi.spyOn(supabase.auth, 'signInAnonymously').mockResolvedValue({
      data: { user: null, session: null }, error: new Error('Must not create a replacement guest'),
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInAnonymously>>);
    render(
      <AuthProvider>
        <ResumeGuestHarness />
      </AuthProvider>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Resume saved guest' }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    expect(mocks.invoke.mock.calls[0][1]).toMatchObject({ body: { email: guestUser.email } });
    expect(mocks.invoke.mock.calls[1][1]).toMatchObject({ body: { email: 'riya@example.com' } });
    expect(anonSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('resumed-email')).toBeEmptyDOMElement();
    expect(screen.getByTestId('pending-email')).toHaveTextContent('riya@example.com');
    expect(localStorage.getItem('niknote.offline.guest.v1')).toBeNull();
    expect(localStorage.getItem('niknote.guest.vault.v1')).not.toBeNull();
  });

  it('can resume the same account by its verified target email if the old guest address has changed', async () => {
    window.history.replaceState({}, '', '/login');
    const pendingVault = {
      email: guestUser.email,
      password: 'a-strong-password',
      userId: guestUser.id,
      name: 'Riya',
      pendingEmail: 'riya@example.com',
    };
    localStorage.setItem('niknote.guest.vault.v1', JSON.stringify(pendingVault));
    getSessionSpy.mockResolvedValue({
      data: { session: null }, error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    const upgradedUser = {
      ...guestUser,
      email: 'riya@example.com',
      email_confirmed_at: '2026-11-04T00:00:00.000Z',
      user_metadata: { ...guestUser.user_metadata, is_guest: false },
    };
    const upgradedSession = { ...guestSession, user: upgradedUser };
    setSessionSpy = vi.spyOn(supabase.auth, 'setSession').mockResolvedValue({
      data: { session: upgradedSession, user: upgradedUser }, error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.setSession>>);
    mocks.invoke.mockImplementation(async (_functionName: unknown, request: unknown) => {
      const requestedEmail = (request as { body?: { email?: string } })?.body?.email;
      if (requestedEmail === guestUser.email) {
        return {
          data: { error: 'Saved guest workspace could not be resumed' },
          error: { status: 401, message: 'Unauthorized' },
        };
      }
      return {
        data: {
          access_token: 'confirmed-access-token',
          refresh_token: 'confirmed-refresh-token',
          email: 'riya@example.com',
          password: 'a-strong-password',
          user: upgradedUser,
          resumed: true,
        },
        error: null,
      };
    });
    anonSpy = vi.spyOn(supabase.auth, 'signInAnonymously').mockResolvedValue({
      data: { user: null, session: null }, error: new Error('Must not create a replacement guest'),
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInAnonymously>>);
    render(
      <AuthProvider>
        <ResumeGuestHarness />
      </AuthProvider>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Resume saved guest' }));
    await waitFor(() => expect(screen.getByTestId('resumed-email')).toHaveTextContent('riya@example.com'));
    expect(screen.getByTestId('pending-email')).toBeEmptyDOMElement();
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    expect(mocks.invoke.mock.calls[0][1]).toMatchObject({ body: { email: guestUser.email } });
    expect(mocks.invoke.mock.calls[1][1]).toMatchObject({ body: { email: 'riya@example.com' } });
    expect(setSessionSpy).toHaveBeenCalledOnce();
    expect(anonSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('niknote.guest.vault.v1')).toBeNull();
  });

  it('resumes the saved pending guest UUID before attempting anonymous account creation', async () => {
    window.history.replaceState({}, '', '/');
    const pendingVault = {
      email: guestUser.email,
      password: 'a-strong-password',
      userId: guestUser.id,
      name: 'Riya',
      pendingEmail: 'riya@example.com',
    };
    localStorage.setItem('niknote.guest.vault.v1', JSON.stringify(pendingVault));
    let restoredSession: typeof guestSession | null = null;
    getSessionSpy.mockImplementation(async () => ({
      data: { session: restoredSession }, error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>));
    const resumedUser = { ...guestUser, user_metadata: { ...guestUser.user_metadata, is_guest: false } };
    const resumedSession = { ...guestSession, user: resumedUser };
    setSessionSpy = vi.spyOn(supabase.auth, 'setSession').mockImplementation(async () => {
      restoredSession = resumedSession;
      return {
        data: { session: resumedSession, user: resumedUser }, error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.setSession>>;
    });
    mocks.invoke.mockResolvedValue({
      data: {
        access_token: 'resumed-access-token',
        refresh_token: 'resumed-refresh-token',
        email: guestUser.email,
        password: 'a-strong-password',
        user: resumedUser,
        resumed: true,
      },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.functions.invoke>>);
    anonSpy = vi.spyOn(supabase.auth, 'signInAnonymously').mockResolvedValue({
      data: { user: null, session: null }, error: new Error('Should not create another guest'),
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInAnonymously>>);
    render(
      <AuthProvider>
        <ResumeGuestHarness />
      </AuthProvider>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Resume saved guest' }));
    expect(await screen.findByText('Guest Workspace Active')).toBeTruthy();
    expect(await screen.findByRole('status')).toHaveTextContent(/Confirmation is pending for riya@example.com/);
    expect(mocks.invoke).toHaveBeenCalledWith('guest-session', {
      body: {
        action: 'create',
        guest_name: 'Riya',
        email: guestUser.email,
        password: 'a-strong-password',
      },
    });
    expect(setSessionSpy).toHaveBeenCalledOnce();
    expect(anonSpy).not.toHaveBeenCalled();
  });
});
