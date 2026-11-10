import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
import { AdminEmailStudio } from '@/components/admin/AdminEmailStudio';

const recentRecipients = [
  { user_id: '7df1950e-477e-4f57-9a3d-c634edc5b2c1', email: 'asha@example.test', display_name: 'Asha', created_at: '2026-10-30T10:00:00Z', already_sent: false, sent_at: null },
  { user_id: '98a39efc-2bb7-487b-86f3-74042f53f3e8', email: 'dev@example.test', display_name: 'Dev', created_at: '2026-10-29T10:00:00Z', already_sent: true, sent_at: '2026-10-30T11:00:00Z' },
];

beforeEach(() => {
  invoke.mockReset();
  sessionStorage.clear();
  sessionStorage.setItem('admin_token', 'admin-session-test');
  invoke.mockImplementation(async (_name: string, options: { body: { action: string } }) => {
    if (options.body.action === 'list_recipients') return { data: { recipients: recentRecipients, truncated: false }, error: null };
    return { data: { accepted: 1, skipped: 0, failed: 0, results: [{ user_id: recentRecipients[0].user_id, email: recentRecipients[0].email, status: 'accepted', audit_logged: true }] }, error: null };
  });
});
afterEach(cleanup);

describe('admin NikNote Email Studio', () => {
  it('shows the refreshed email preview and marks previously welcomed users', async () => {
    render(<AdminEmailStudio />);
    expect(await screen.findByText('asha@example.test')).toBeInTheDocument();
    expect(screen.getByText('dev@example.test')).toBeInTheDocument();
    expect(screen.getByText('Welcome sent')).toBeInTheDocument();
    expect(screen.getByTitle('NikNote welcome email preview')).toHaveAttribute('srcdoc');
    expect(invoke).toHaveBeenCalledWith('admin-welcome-email', expect.objectContaining({
      body: { action: 'list_recipients', payload: { days: 30 } },
      headers: { 'x-admin-token': 'admin-session-test' },
    }));
  });

  it('requires a second confirmation and sends only selected account IDs', async () => {
    const user = userEvent.setup();
    render(<AdminEmailStudio />);
    const checkbox = await screen.findByRole('checkbox', { name: 'Select asha@example.test' });
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: 'Review send' }));
    expect(await screen.findByText(/This sends the fixed “Welcome · v1” template/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send to 1' }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('admin-welcome-email', expect.objectContaining({
      body: { action: 'send_welcome', payload: { days: 30, user_ids: [recentRecipients[0].user_id] } },
      headers: { 'x-admin-token': 'admin-session-test' },
    })));
    expect(await screen.findByText(/1 accepted by Resend/)).toBeInTheDocument();
    expect(screen.getByText(/Acceptance is not a delivery receipt/)).toBeInTheDocument();
  });
});
