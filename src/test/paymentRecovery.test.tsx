import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  user: { id: 'test-user', email: 'student@example.test', user_metadata: {} },
  isGuest: false,
  isPremium: false,
  invoke: vi.fn(), getSession: vi.fn(), refreshHook: vi.fn(), refreshContext: vi.fn(),
  trackVerifiedPurchase: vi.fn(), trackPaymentSucceeded: vi.fn(), trackPaymentFailed: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mock.user, isGuest: mock.isGuest, loading: false }) }));
vi.mock('@/hooks/usePremium', () => ({ usePremium: () => ({ isPremium: mock.isPremium, refresh: mock.refreshHook }) }));
vi.mock('@/contexts/PremiumContext', () => ({ usePremiumContext: () => ({ refresh: mock.refreshContext }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mock.invoke }, auth: { getSession: mock.getSession } } }));
vi.mock('@/components/auth/GuestUpgradeCard', () => ({ GuestUpgradeCard: () => <div>Save account form</div> }));
vi.mock('@/hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('@/lib/tracking', () => ({ trackBeginCheckout: vi.fn(), trackVerifiedPurchase: mock.trackVerifiedPurchase }));
vi.mock('@/utils/analytics', () => ({ trackCheckoutStarted: vi.fn(), trackPaymentSucceeded: mock.trackPaymentSucceeded, trackPaymentFailed: mock.trackPaymentFailed }));
vi.mock('sonner', () => ({ toast: mock.toast }));
import PaymentPage from '@/pages/Payment';

let checkoutOptions: any;
let opened: ReturnType<typeof vi.fn>;
function renderPayment(path = '/payment?plan=weekly') {
  return render(<MemoryRouter initialEntries={[path]}><PaymentPage /></MemoryRouter>);
}

describe('checkout recovery (Razorpay mocked; no real charge)', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks(); mock.isGuest = false; mock.isPremium = false;
    checkoutOptions = null; opened = vi.fn();
    mock.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null });
    mock.refreshHook.mockResolvedValue(undefined); mock.refreshContext.mockResolvedValue(undefined);
    (window as any).Razorpay = class {
      constructor(options: any) { checkoutOptions = options; }
      on = vi.fn(); open = opened;
    };
    mock.invoke.mockImplementation(async (name: string) => {
      if (name === 'create-razorpay-order') return { data: { orderId: 'order_Test1', keyId: 'rzp_live_mock', amount: 4900, currency: 'INR' }, error: null };
      return { data: null, error: new Error('pending') };
    });
  });
  afterEach(() => { cleanup(); delete (window as any).Razorpay; });

  it('states the one-time amount, opens only a matching live order, and remembers it', async () => {
    renderPayment();
    expect(screen.getAllByText(/no automatic renewal/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /pay ₹49 for 7 days/i }));
    await waitFor(() => expect(opened).toHaveBeenCalledOnce());
    expect(checkoutOptions.amount).toBe(4900);
    expect(checkoutOptions.order_id).toBe('order_Test1');
    expect(localStorage.getItem('niknote:checkout:pending:test-user')).toBe('order_Test1');
  });

  it('keeps an uncertain payment out of failed-sales analytics and recovers without another charge', async () => {
    renderPayment();
    fireEvent.click(screen.getByRole('button', { name: /pay ₹49/i }));
    await waitFor(() => expect(opened).toHaveBeenCalledOnce());
    await act(async () => checkoutOptions.handler({ razorpay_order_id: 'order_Test1', razorpay_payment_id: 'pay_Test1', razorpay_signature: 'sig' }));
    expect(screen.getByText(/payment confirmation pending/i)).toBeTruthy();
    expect(screen.getByText(/do not pay again/i)).toBeTruthy();
    expect(mock.trackPaymentFailed).not.toHaveBeenCalled();
    expect(mock.trackVerifiedPurchase).not.toHaveBeenCalled();
    mock.invoke.mockResolvedValueOnce({ data: { success: true, recovered: [{ paymentId: 'pay_Test1', planCode: 'weekly' }] }, error: null });
    fireEvent.click(screen.getByRole('button', { name: /already paid\? check payment/i }));
    await screen.findByText('Payment verified');
    expect(mock.invoke.mock.calls.filter(([name]) => name === 'create-razorpay-order')).toHaveLength(1);
    expect(mock.refreshHook).toHaveBeenCalled();
    expect(mock.refreshContext).toHaveBeenCalled();
    expect(mock.trackVerifiedPurchase).toHaveBeenCalledWith(expect.objectContaining({ transactionId: 'pay_Test1', value: 49 }));
  });

  it('can check an older remembered order after reopening the page', async () => {
    localStorage.setItem('niknote:checkout:pending:test-user', 'order_Older');
    mock.invoke.mockResolvedValueOnce({ data: { success: false }, error: null });
    mock.invoke.mockResolvedValueOnce({ data: { success: true, recovered: [{ paymentId: 'pay_Older', planCode: 'monthly' }] }, error: null });
    renderPayment();
    fireEvent.click(screen.getByRole('button', { name: /already paid\? check payment/i }));
    await screen.findByText('Payment verified');
    expect(mock.invoke).toHaveBeenNthCalledWith(2, 'verify-razorpay-payment', { body: { recover: true, orderId: 'order_Older' } });
    expect(mock.invoke.mock.calls.some(([name]) => name === 'create-razorpay-order')).toBe(false);
  });

  it('does not open checkout without a connected session', async () => {
    mock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    renderPayment();
    fireEvent.click(screen.getByRole('button', { name: /pay ₹49/i }));
    await screen.findByText(/connected account is needed/i);
    expect(opened).not.toHaveBeenCalled();
    expect(mock.invoke).not.toHaveBeenCalled();
  });

  it('warns guests how to protect account access before paying', () => {
    mock.isGuest = true; renderPayment();
    expect(screen.getByText(/guest workspace/i)).toBeTruthy();
    expect(screen.getByText('Save account form')).toBeTruthy();
  });
});
