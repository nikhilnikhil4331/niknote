import { describe, expect, it, vi } from 'vitest';
import {
  buildPaymentConfirmationEmail,
  paymentReceiptCustomerName,
  paymentTransactionReference,
  resolvePaymentReceiptRecipient,
  sendPaymentConfirmationEmail,
} from '../../supabase/functions/_shared/payment-confirmation-email';

const receipt = {
  customerName: 'Asha Notes',
  planCode: 'monthly' as const,
  amountPaise: 9900,
  paymentId: 'pay_Test123',
  transactionTimestamp: 1_790_000_000,
};

describe('NikNote payment confirmation email', () => {
  it('renders a responsive, table-based receipt with brand art and all verified transaction fields', () => {
    const rendered = buildPaymentConfirmationEmail(receipt);

    expect(rendered.subject).toContain('NikNote payment is confirmed');
    expect(rendered.html).toContain('background-color:#FFFDF5');
    expect(rendered.html).toContain('background-color:#3285F4');
    expect(rendered.html).toContain('background-color:#FFE17A');
    expect(rendered.html).toContain('background-color:#9ACB70');
    expect(rendered.html).toContain('niknote-payment-confirmation-hero.jpg');
    expect(rendered.html).toContain('OPEN MY NIKNOTE');
    expect(rendered.html).toContain('Premium · 30 days');
    expect(rendered.html).toContain('₹99');
    expect(rendered.html).toContain('pay_Test123');
    expect(rendered.html).toContain('NN-pay_Test123');
    expect(rendered.html).toContain('Transaction date');
    expect(rendered.html).toContain('@media only screen and (max-width: 620px)');
    expect(rendered.html).toContain('role="presentation"');
    expect(rendered.text).toContain('Plan: Premium · 30 days');
    expect(rendered.text).toContain('Payment ID: pay_Test123');
    expect(rendered.text).toContain('Transaction reference: NN-pay_Test123');
    expect(rendered.text).toContain('Amount paid: ₹99');
    expect(rendered.text).toContain('https://niknote.online/');
    expect(rendered.html).not.toMatch(/card number|cvv|upi pin|bank account/i);
  });

  it('HTML-escapes names and refuses non-canonical plans, amounts, and payment IDs', () => {
    const malicious = buildPaymentConfirmationEmail({ ...receipt, customerName: '<img src=x onerror=alert(1)>' });
    expect(malicious.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(malicious.html).not.toContain('<img src=x onerror=alert(1)>');
    expect(() => buildPaymentConfirmationEmail({ ...receipt, amountPaise: 1 })).toThrow(/amount/i);
    expect(() => buildPaymentConfirmationEmail({ ...receipt, paymentId: 'not-a-payment-id' })).toThrow(/reference/i);
    expect(() => buildPaymentConfirmationEmail({ ...receipt, planCode: 'other' as never })).toThrow(/plan/i);
  });

  it('uses a stable unique transaction reference and never chooses a generated guest inbox', () => {
    expect(paymentTransactionReference('pay_Test123')).toBe('NN-pay_Test123');
    expect(resolvePaymentReceiptRecipient(
      { email: 'guest_1@guest.niknote.online' },
      { email: 'asha@example.test' },
    )).toBe('asha@example.test');
    expect(resolvePaymentReceiptRecipient(
      { email: 'guest_1@guest.niknote.online' },
      { email: '' },
    )).toBeNull();
    expect(paymentReceiptCustomerName({ user_metadata: { full_name: 'Asha Verma' } }, 'asha@example.test')).toBe('Asha Verma');
  });

  it('sends only a verified server-built receipt through the existing transactional provider with idempotency', async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ success: true, message_id: 'mail_test_1' }));
    const result = await sendPaymentConfirmationEmail('asha@example.test', receipt, {
      apiKey: 'server-only-test-key',
      sendUrl: 'https://mailer.example/send',
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(result).toEqual({ transactionReference: 'NN-pay_Test123', messageId: 'mail_test_1' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://mailer.example/send');
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer server-only-test-key');
    expect(headers.get('Idempotency-Key')).toBe('niknote-payment-pay_Test123');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      to: 'asha@example.test',
      from: 'NikNote <noreply@notify.niknote.online>',
      sender_domain: 'notify.niknote.online',
      purpose: 'transactional',
      label: 'payment-confirmation',
      idempotency_key: 'niknote-payment-pay_Test123',
    });
    expect(body.html).toContain('OPEN MY NIKNOTE');
    expect(body.text).toContain('Transaction reference: NN-pay_Test123');
    expect(body.html).not.toContain('server-only-test-key');
  });

  it('fails closed on missing credentials, invalid recipients, and provider delivery errors', async () => {
    const fetcher = vi.fn();
    await expect(sendPaymentConfirmationEmail('asha@example.test', receipt, { apiKey: '', fetcher: fetcher as unknown as typeof fetch }))
      .rejects.toThrow(/not configured/i);
    await expect(sendPaymentConfirmationEmail('not-an-email', receipt, { apiKey: 'key', fetcher: fetcher as unknown as typeof fetch }))
      .rejects.toThrow(/recipient/i);
    expect(fetcher).not.toHaveBeenCalled();

    const unavailable = vi.fn(async () => new Response('no delivery', { status: 503 }));
    await expect(sendPaymentConfirmationEmail('asha@example.test', receipt, {
      apiKey: 'key',
      fetcher: unavailable as unknown as typeof fetch,
    })).rejects.toThrow(/503/);
  });
});
