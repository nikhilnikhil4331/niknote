export type PaymentPlanCode = 'weekly' | 'monthly';

export interface PaymentConfirmationDetails {
  customerName: string;
  planCode: PaymentPlanCode;
  amountPaise: number;
  paymentId: string;
  /** Razorpay's Unix timestamp in seconds, as returned by its payment API. */
  transactionTimestamp?: number;
}

export interface PaymentReceiptEmailOptions {
  apiKey: string;
  sendUrl?: string;
  fetcher?: typeof fetch;
}

const SITE_URL = 'https://niknote.online';
const HERO_IMAGE_URL = `${SITE_URL}/images/email/niknote-payment-confirmation-hero.jpg`;
const WORDMARK_URL = `${SITE_URL}/images/brand/niknote-primary-wordmark.png`;
const PLAN_DETAILS: Record<PaymentPlanCode, { label: string; amountPaise: number; duration: string }> = {
  weekly: { label: 'Student Pro', amountPaise: 4900, duration: '7 days' },
  monthly: { label: 'Premium', amountPaise: 9900, duration: '30 days' },
};
const EMAIL_SEND_URL = 'https://api.lovable.dev/v1/messaging/email/send';

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character] || character));

function safeCustomerName(name: string): string {
  const safe = Array.from(name, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('').replace(/\s+/g, ' ').trim().slice(0, 100);
  return safe || 'NikNote creator';
}

function amountLabel(amountPaise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}

function transactionDate(timestamp?: number): string {
  const date = Number.isFinite(timestamp) && timestamp! > 0
    ? new Date(timestamp! * 1000)
    : new Date();
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(date) + ' IST';
}

function validateDetails(details: PaymentConfirmationDetails) {
  if (!Object.prototype.hasOwnProperty.call(PLAN_DETAILS, details.planCode)) throw new Error('Invalid payment plan');
  if (details.amountPaise !== PLAN_DETAILS[details.planCode].amountPaise) throw new Error('Payment amount does not match plan');
  if (!/^pay_[A-Za-z0-9]+$/.test(details.paymentId)) throw new Error('Invalid payment reference');
}

export function paymentTransactionReference(paymentId: string): string {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new Error('Invalid payment reference');
  // Preserve the provider's case-sensitive ID so this receipt reference stays unique.
  return `NN-${paymentId}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

export function resolvePaymentReceiptRecipient(user: unknown, payment: unknown): string | null {
  const accountEmailValue = asRecord(user).email;
  const checkoutEmailValue = asRecord(payment).email;
  const accountEmail = typeof accountEmailValue === 'string' ? accountEmailValue.trim().toLowerCase() : '';
  const checkoutEmail = typeof checkoutEmailValue === 'string' ? checkoutEmailValue.trim().toLowerCase() : '';
  const isEmail = (value: string) => value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
  const isGeneratedGuestAddress = (value: string) => value.endsWith('@guest.niknote.online');

  if (isEmail(accountEmail) && !isGeneratedGuestAddress(accountEmail)) return accountEmail;
  if (isEmail(checkoutEmail) && !isGeneratedGuestAddress(checkoutEmail)) return checkoutEmail;
  return null;
}

export function paymentReceiptCustomerName(user: unknown, recipient: string): string {
  const userRecord = asRecord(user);
  const metadata = asRecord(userRecord.user_metadata ?? userRecord.raw_user_meta_data);
  const preferred = [metadata.full_name, metadata.name, metadata.display_name]
    .find((value) => typeof value === 'string' && value.trim());
  if (typeof preferred === 'string') return safeCustomerName(preferred);

  const mailboxName = recipient.split('@')[0].replace(/[._+-]+/g, ' ').trim();
  if (!mailboxName) return 'NikNote creator';
  return safeCustomerName(mailboxName.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()));
}

export function buildPaymentConfirmationEmail(details: PaymentConfirmationDetails): {
  subject: string;
  html: string;
  text: string;
  transactionReference: string;
  formattedDate: string;
  formattedAmount: string;
} {
  validateDetails(details);
  const name = safeCustomerName(details.customerName);
  const escapedName = escapeHtml(name);
  const plan = PLAN_DETAILS[details.planCode];
  const formattedAmount = amountLabel(details.amountPaise);
  const formattedDate = transactionDate(details.transactionTimestamp);
  const paymentId = escapeHtml(details.paymentId);
  const transactionReference = paymentTransactionReference(details.paymentId);
  const escapedReference = escapeHtml(transactionReference);
  const planLabel = `${plan.label} · ${plan.duration}`;
  const escapedPlan = escapeHtml(planLabel);
  const subject = 'Your NikNote payment is confirmed — your receipt is inside';

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
  <style type="text/css">
    @media only screen and (max-width: 620px) {
      .nn-email-shell { width: 100% !important; }
      .nn-email-gutter { padding-left: 16px !important; padding-right: 16px !important; }
      .nn-email-card { padding: 23px 19px !important; }
      .nn-email-title { font-size: 34px !important; line-height: 1.08 !important; }
      .nn-email-receipt { padding: 16px !important; }
      .nn-email-art { width: 100% !important; height: auto !important; }
      .nn-email-cta { display: block !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#FFFDF5; color:#090707; font-family:Arial, Helvetica, sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; mso-hide:all;">Your ${escapeHtml(plan.label)} payment is confirmed. Your receipt and next steps are inside.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; background-color:#FFFDF5;">
    <tr>
      <td align="center" class="nn-email-gutter" style="padding:30px 20px 34px;">
        <table role="presentation" class="nn-email-shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:0 0 20px;">
              <a href="${SITE_URL}/" style="display:inline-block; color:#090707; text-decoration:none;">
                <img src="${WORDMARK_URL}" width="124" alt="NikNote" style="display:block; width:124px; max-width:100%; height:auto; border:0; color:#090707; font-family:Georgia, 'Times New Roman', serif; font-size:28px; font-weight:900;">
              </a>
            </td>
          </tr>
          <tr>
            <td class="nn-email-card" style="padding:30px 34px 28px; background-color:#FFFFFF; border:2px solid #090707; border-radius:20px; box-shadow:6px 6px 0 #090707;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                <tr>
                  <td align="center" style="padding:0 0 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                      <tr>
                        <td width="52" height="52" align="center" valign="middle" bgcolor="#9ACB70" style="width:52px; height:52px; border:2px solid #090707; border-radius:50%; background-color:#9ACB70; box-shadow:3px 3px 0 #090707; color:#090707; font-family:Arial, Helvetica, sans-serif; font-size:31px; font-weight:900; line-height:52px;">✓</td>
                        <td bgcolor="#F47F82" style="padding:8px 12px; border:1.5px solid #090707; border-radius:999px; background-color:#F47F82; color:#090707; font-size:12px; font-weight:800; letter-spacing:1.4px; text-transform:uppercase;">Payment confirmed</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 6px; color:#090707; font-family:Georgia, 'Times New Roman', serif; font-size:16px; line-height:1.45;">Hi ${escapedName},</td>
                </tr>
                <tr>
                  <td align="center" class="nn-email-title" style="padding:0 0 10px; color:#090707; font-family:Georgia, 'Times New Roman', serif; font-size:40px; font-weight:900; line-height:1.05; letter-spacing:-1px;">Your ideas have a new home.</td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 4px 17px; color:#090707; font-size:16px; line-height:1.55;">Your NikNote payment went through. Premium is ready whenever you are.</td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 17px;">
                    <img class="nn-email-art" src="${HERO_IMAGE_URL}" width="520" alt="An open notebook with a stack of colorful books, a blue pencil, and a coral pen" style="display:block; width:100%; max-width:520px; height:auto; border:1.5px solid #090707; border-radius:14px; background-color:#FFFDF5; color:#090707; font-size:14px; line-height:1.4;">
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 18px; color:#090707; font-family:Arial, Helvetica, sans-serif; font-size:14px; font-weight:800; letter-spacing:1.1px; text-transform:uppercase;">Your payment receipt</td>
                </tr>
                <tr>
                  <td class="nn-email-receipt" style="padding:20px; border:2px solid #090707; border-radius:14px; background-color:#FFFDF5;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                      <tr>
                        <td style="padding:0 0 12px; color:#090707; font-size:12px; font-weight:700; letter-spacing:.7px; text-transform:uppercase;">Plan</td>
                        <td align="right" style="padding:0 0 12px; color:#090707; font-size:14px; font-weight:800;">${escapedPlan}</td>
                      </tr>
                      <tr>
                        <td style="padding:11px 0; border-top:1px solid #090707; color:#090707; font-size:12px; font-weight:700; letter-spacing:.7px; text-transform:uppercase;">Transaction date</td>
                        <td align="right" style="padding:11px 0; border-top:1px solid #090707; color:#090707; font-size:14px; font-weight:700;">${escapeHtml(formattedDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding:11px 0; border-top:1px solid #090707; color:#090707; font-size:12px; font-weight:700; letter-spacing:.7px; text-transform:uppercase;">Payment ID</td>
                        <td align="right" style="padding:11px 0; border-top:1px solid #090707; color:#090707; font-family:Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; word-break:break-all;">${paymentId}</td>
                      </tr>
                      <tr>
                        <td style="padding:11px 0; border-top:1px solid #090707; color:#090707; font-size:12px; font-weight:700; letter-spacing:.7px; text-transform:uppercase;">Transaction reference</td>
                        <td align="right" style="padding:11px 0; border-top:1px solid #090707; color:#090707; font-family:Arial, Helvetica, sans-serif; font-size:12px; font-weight:800; word-break:break-all;">${escapedReference}</td>
                      </tr>
                      <tr>
                        <td style="padding:13px 0 0; border-top:2px solid #090707; color:#090707; font-size:13px; font-weight:900; letter-spacing:.7px; text-transform:uppercase;">Amount paid</td>
                        <td align="right" style="padding:13px 0 0; border-top:2px solid #090707; color:#3285F4; font-family:Georgia, 'Times New Roman', serif; font-size:23px; font-weight:900;">${escapeHtml(formattedAmount)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:23px 0 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                      <tr>
                        <td align="center" bgcolor="#3285F4" style="border:2px solid #090707; border-radius:12px; background-color:#3285F4; box-shadow:4px 4px 0 #090707;">
                          <a class="nn-email-cta" href="${SITE_URL}/" style="display:inline-block; padding:16px 30px; border-radius:10px; color:#FFFFFF; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:900; letter-spacing:.7px; line-height:1.2; text-align:center; text-decoration:none;">OPEN MY NIKNOTE</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:18px 6px 0; color:#090707; font-size:13px; line-height:1.5;">We only show your payment reference here—never your card, bank, or UPI details.</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 15px 0; color:#090707; font-size:12px; line-height:1.65;">
              Need a hand? <a href="mailto:support@niknote.online" style="color:#090707; font-weight:700; text-decoration:underline;">support@niknote.online</a><br>
              Made for your next bright idea.<br>
              <span style="color:#090707; font-weight:800;">NikNote</span> · <a href="${SITE_URL}/" style="color:#090707; text-decoration:underline;">niknote.online</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${name},`,
    '',
    'Your NikNote payment is confirmed. Premium is ready whenever you are.',
    '',
    'PAYMENT RECEIPT',
    `Plan: ${planLabel}`,
    `Transaction date: ${formattedDate}`,
    `Payment ID: ${details.paymentId}`,
    `Transaction reference: ${transactionReference}`,
    `Amount paid: ${formattedAmount}`,
    '',
    `Open my NikNote: ${SITE_URL}/`,
    '',
    'We only show your payment reference here—never your card, bank, or UPI details.',
    'Need help? support@niknote.online',
    'NikNote · https://niknote.online/',
  ].join('\n');

  return { subject, html, text, transactionReference, formattedDate, formattedAmount };
}

export async function sendPaymentConfirmationEmail(
  recipient: string,
  details: PaymentConfirmationDetails,
  options: PaymentReceiptEmailOptions,
): Promise<{ transactionReference: string; messageId?: string }> {
  const address = recipient.trim().toLowerCase();
  if (address.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) {
    throw new Error('Invalid receipt recipient');
  }
  if (!options.apiKey) throw new Error('Transactional email is not configured');

  const rendered = buildPaymentConfirmationEmail(details);
  const idempotencyKey = `niknote-payment-${details.paymentId}`;
  const response = await (options.fetcher || fetch)(options.sendUrl || EMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      to: address,
      from: 'NikNote <noreply@notify.niknote.online>',
      sender_domain: 'notify.niknote.online',
      reply_to: 'support@niknote.online',
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      purpose: 'transactional',
      label: 'payment-confirmation',
      idempotency_key: idempotencyKey,
    }),
  });
  if (!response.ok) throw new Error(`Transactional email send failed (${response.status})`);
  const result = await response.json().catch(() => ({}));
  if (result?.success === false) throw new Error('Transactional email provider rejected the message');

  return {
    transactionReference: rendered.transactionReference,
    ...(typeof result?.message_id === 'string' ? { messageId: result.message_id } : {}),
  };
}
