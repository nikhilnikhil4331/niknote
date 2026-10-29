import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
import { AdminSalesOverview } from '@/components/admin/AdminSalesOverview';

beforeEach(() => { invoke.mockReset(); sessionStorage.clear(); });
afterEach(cleanup);

describe('admin verified-sales view', () => {
  it('shows verified gross captures and leads with a settlement caveat', async () => {
    sessionStorage.setItem('admin_token', 'local-mock-token');
    invoke.mockResolvedValue({ data: { verifiedPayments: 1, grossVerifiedPaise: 4900, institutionLeads: 1, recentLeads: [
      { id: 'lead-test', name: 'Teacher', email: 'teacher@example.test', phone: null, institution: 'Example School', students: 75, message: 'Need worksheets', stage: 'new', created_at: '2026-10-29T00:00:00Z' },
    ] }, error: null });
    render(<AdminSalesOverview />);
    expect(await screen.findByText('₹49')).toBeInTheDocument();
    expect(screen.getByText(/not bank settlements/i)).toBeInTheDocument();
    expect(screen.getByText('Example School')).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('sales-overview', expect.objectContaining({ headers: { 'x-admin-token': 'local-mock-token' } }));
  });
  it('shows an error rather than fabricated or zero sales when data cannot be loaded', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('offline') });
    render(<AdminSalesOverview />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load'));
    expect(screen.queryByText('₹0')).not.toBeInTheDocument();
  });
});
