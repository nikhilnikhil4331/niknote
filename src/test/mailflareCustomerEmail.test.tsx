import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke } },
}));

import {
  CUSTOMER_EMAIL_TEMPLATES,
  NIKNOTE_EMAIL_LOGO_URL,
  RETRO_EMAIL_ART_URL,
  SENDER_PRESETS,
  buildNikNoteEmailHtml,
  buildNikNotePlainText,
  interpolateEmailTemplate,
  invokeCustomerEmail,
  parseRecipientInput,
  sanitizeBrandSenderName,
} from '@/lib/mailflareClient';
import { AdminMailflareStudio } from '@/components/admin/AdminMailflareStudio';

type EdgeHandler = (req: Request) => Promise<Response>;

const jsonResponse = (body: unknown, status = 200) => Response.json(body, { status });

function setupCustomerEmailFunction(options: {
  tokenValid?: boolean;
  roleValid?: boolean;
  savedConfig?: Record<string, unknown> | null;
  mailflareSendOk?: boolean;
} = {}) {
  const sentMailflareBodies: any[] = [];
  const loggedRows: any[] = [];
  const webmailMessages: any[] = [];
  const customMailboxes: any[] = [
    {
      id: 'mbx_support',
      domain_id: 'dom_niknote_online',
      local_part: 'support',
      hostname: 'niknote.online',
      address: 'support@niknote.online',
      display_name: 'NikNote Support',
      mailbox_type: 'shared',
      color: '#7c3aed',
      signature: 'NikNote Support',
      forward_to: '',
      auto_reply_enabled: false,
      auto_reply_subject: '',
      auto_reply_body: '',
      is_default: true,
      disabled: false,
      mailflare_mailbox_id: '',
      created_at: new Date().toISOString(),
    },
  ];
  const customDomains: any[] = [
    {
      id: 'dom_niknote_online',
      hostname: 'niknote.online',
      mailflare_domain_id: '',
      sending_provider: 'mailflare',
      receiving_provider: 'mailflare',
      dns_status: 'verified',
      mx_verified: true,
      spf_verified: true,
      dmarc_verified: true,
      is_primary: true,
      created_at: new Date().toISOString(),
    },
  ];

  let storedConfig: Record<string, unknown> = options.savedConfig ?? {
    id: 1,
    provider: 'mailflare',
    mailflare_url: 'https://mail.niknote.online',
    mailflare_api_key: 'mf_secret_live_9876',
    mailflare_admin_key: 'mf_admin_live_1234',
    mailbox_id: 'mbx_support_01',
    from_name: 'NikNote Support',
    from_email: 'support@niknote.online',
    reply_to: '',
    resend_api_key: '',
    webhook_secret: 'whsec_test_secret_123456',
  };

  const fetcher = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = (init.method || 'GET').toUpperCase();

    if (url.pathname === '/rest/v1/admin_sessions') {
      return jsonResponse(options.tokenValid ? [{ id: 'sess-1' }] : []);
    }
    if (url.pathname === '/auth/v1/user') {
      return jsonResponse({ id: 'd6f42a27-971c-4b67-9035-e213db82e73e' });
    }
    if (url.pathname === '/rest/v1/user_roles') {
      return jsonResponse(options.roleValid ? [{ id: 'role-1' }] : []);
    }
    if (url.pathname === '/rest/v1/mailflare_config') {
      if (method === 'POST') {
        const parsed = JSON.parse(String(init.body || '{}'));
        storedConfig = { ...storedConfig, ...parsed };
        return jsonResponse([storedConfig]);
      }
      return jsonResponse(storedConfig ? [storedConfig] : []);
    }
    if (url.pathname === '/rest/v1/customer_email_logs') {
      if (method === 'POST') {
        loggedRows.push(JSON.parse(String(init.body || '{}')));
        return jsonResponse({}, 201);
      }
      return jsonResponse(loggedRows);
    }
    if (url.pathname === '/rest/v1/admin_email_domains') {
      if (method === 'POST') {
        const parsed = JSON.parse(String(init.body || '{}'));
        customDomains.push(parsed);
        return jsonResponse([parsed], 201);
      }
      return jsonResponse(customDomains);
    }
    if (url.pathname === '/rest/v1/admin_mailboxes') {
      if (method === 'POST') {
        const parsed = JSON.parse(String(init.body || '{}'));
        customMailboxes.push(parsed);
        return jsonResponse([parsed], 201);
      }
      return jsonResponse(customMailboxes);
    }
    if (url.pathname === '/rest/v1/admin_email_messages') {
      if (method === 'POST') {
        const parsed = {
          id: '11111111-2222-3333-4444-555555555555',
          created_at: new Date().toISOString(),
          ...JSON.parse(String(init.body || '{}')),
        };
        webmailMessages.push(parsed);
        return jsonResponse([parsed], 201);
      }
      return jsonResponse(webmailMessages);
    }
    if (url.origin === 'https://mail.niknote.online' && url.pathname === '/api/v1/send') {
      const parsed = JSON.parse(String(init.body || '{}'));
      sentMailflareBodies.push(parsed);
      if (options.mailflareSendOk === false) {
        return jsonResponse({ error: 'Sender address does not match the selected mailbox' }, 403);
      }
      return jsonResponse({ messageId: 'msg_mf_001' }, 200);
    }
    if (url.origin === 'https://mail.niknote.online' && url.pathname === '/api/v1/mailboxes') {
      return jsonResponse({
        mailboxes: [
          {
            id: 'mbx_support_01',
            localPart: 'support',
            hostname: 'niknote.online',
            displayName: 'NikNote Support',
            type: 'personal',
          },
        ],
      });
    }
    throw new Error(`Unexpected fetch URL in test: ${url.toString()}`);
  });

  const source = readFileSync('supabase/functions/customer-email/index.ts', 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;

  let handler: EdgeHandler | undefined;
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://project.example',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  };

  new Function('Deno', 'fetch', 'crypto', 'Response', 'URL', 'URLSearchParams', transpiled)(
    {
      env: { get: (k: string) => env[k] },
      serve: (h: EdgeHandler) => {
        handler = h;
      },
    },
    fetcher,
    webcrypto,
    Response,
    URL,
    URLSearchParams,
  );

  return { handler: handler!, fetcher, sentMailflareBodies, loggedRows, webmailMessages, customMailboxes };
}

function makeEdgePost(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://edge.example/customer-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('mailflareClient pure helpers', () => {
  it('parses valid recipients, deduplicates addresses, and flags invalid entries', () => {
    const res = parseRecipientInput(
      'student@example.com, "Aarav" <STUDENT@example.com>, bad-email, teacher@school.edu.in',
    );
    expect(res.valid).toEqual(['student@example.com', 'teacher@school.edu.in']);
    expect(res.invalid).toEqual(['bad-email']);
  });

  it('escapes HTML when interpolating untrusted customer names into HTML templates', () => {
    const out = interpolateEmailTemplate(
      '<p>Hello {{name}}</p>',
      { name: '<script>alert(1)</script>' },
      true,
    );
    expect(out).toBe('<p>Hello &lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });

  it('builds aesthetic handwritten HTML (with NikNote logo & notebook styling) and clean HTML without script injection', () => {
    const handwrittenHtml = buildNikNoteEmailHtml({
      heading: 'Welcome <Student>',
      bodyText: 'Hi **Aarav**,\n\n- Notebook ready\n- PDF Studio ready',
      ctaLabel: 'Open NikNote',
      ctaUrl: 'https://www.niknote.online',
      fromName: 'Team of NikNote',
      fromEmail: 'invite@niknote.online',
    });
    expect(handwrittenHtml).toContain('Welcome &lt;Student&gt;');
    expect(handwrittenHtml).toContain('<strong>Aarav</strong>');
    expect(handwrittenHtml).toContain(NIKNOTE_EMAIL_LOGO_URL);
    expect(handwrittenHtml).toContain('Caveat');
    expect(handwrittenHtml).toContain('Kalam');
    expect(handwrittenHtml).toContain('#f4afc0');
    expect(handwrittenHtml).toContain('&#10022;');
    expect(handwrittenHtml).toContain('href="https://www.niknote.online"');
    expect(handwrittenHtml).toContain('Team of NikNote');

    const cleanHtml = buildNikNoteEmailHtml({
      heading: 'Welcome <Student>',
      bodyText: '- Clean item',
      style: 'clean',
      fromName: 'NikNote',
      fromEmail: 'support@niknote.online',
    });
    expect(cleanHtml).toContain('<li style=');
    expect(cleanHtml).toContain(NIKNOTE_EMAIL_LOGO_URL);

    const text = buildNikNotePlainText({
      heading: 'Welcome',
      bodyText: 'Study notes ready.',
      ctaLabel: 'Open NikNote',
      ctaUrl: 'https://www.niknote.online',
    });
    expect(text).toContain('Open NikNote: https://www.niknote.online');
    expect(text).toContain('Team of NikNote');
  });

  it('renders a safe retro illustrated email with campaign placeholders and valid CTA', () => {
    const html = buildNikNoteEmailHtml({
      style: 'retro', heading: 'Hello {{name}} <friend>',
      bodyText: 'Hi {{name}}!\n\n- Your <ideas> matter',
      ctaLabel: 'Open NikNote', ctaUrl: 'https://www.niknote.online',
      fromName: 'Team of NikNote', fromEmail: 'hello@niknote.online',
    });
    expect(html).toContain(RETRO_EMAIL_ART_URL);
    expect(html).toContain('Hello {{name}} &lt;friend&gt;');
    expect(html).toContain('Your &lt;ideas&gt; matter');
    expect(html).toContain('#FFE17A');
    expect(html).toContain('#3285F4');
    expect(html).toContain('href="https://www.niknote.online"');
    expect(html).not.toContain('linear-gradient');
    expect(buildNikNoteEmailHtml({ style: 'retro', bodyText: 'Hello', ctaLabel: 'Open', ctaUrl: 'javascript:alert(1)' })).not.toContain('javascript:');
  });

  it('never mentions founder or personal names in templates, presets, or sanitized sender names', () => {
    expect(CUSTOMER_EMAIL_TEMPLATES[0].id).toBe('invite');
    for (const tpl of CUSTOMER_EMAIL_TEMPLATES) {
      const combined = `${tpl.label} ${tpl.description} ${tpl.subject} ${tpl.heading} ${tpl.body}`;
      expect(combined).not.toMatch(/founder|nikhil/i);
    }
    for (const preset of SENDER_PRESETS) {
      expect(`${preset.label} ${preset.fromName}`).not.toMatch(/founder|nikhil/i);
    }
    expect(sanitizeBrandSenderName('Nikhil — Founder')).toBe('Team of NikNote');
    expect(sanitizeBrandSenderName('NikNote')).toBe('NikNote');
    expect(sanitizeBrandSenderName('Team of NikNote')).toBe('Team of NikNote');
  });
});

describe('customer-email Edge Function (Mailflare integration & security)', () => {
  it('blocks unauthenticated requests before reading config or calling Mailflare', async () => {
    const ctx = setupCustomerEmailFunction({ tokenValid: false, roleValid: false });
    const res = await ctx.handler(makeEdgePost({ action: 'get_config' }));
    expect(res.status).toBe(403);
    expect(ctx.sentMailflareBodies).toHaveLength(0);
  });

  it('masks saved API keys and never returns raw secrets to the browser', async () => {
    const ctx = setupCustomerEmailFunction({ tokenValid: true });
    const res = await ctx.handler(
      makeEdgePost({ action: 'get_config' }, { 'x-admin-token': 'valid-admin-token' }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.config.configured).toBe(true);
    expect(json.config.hasMailflareKey).toBe(true);
    expect(json.config.maskedMailflareKey).toBe('••••••9876');
    expect(JSON.stringify(json)).not.toContain('mf_secret_live_9876');
  });

  it('rejects private/internal SSRF URLs when saving Mailflare server settings', async () => {
    const ctx = setupCustomerEmailFunction({ tokenValid: true });
    const res = await ctx.handler(
      makeEdgePost(
        {
          action: 'save_config',
          payload: {
            provider: 'mailflare',
            mailflareUrl: 'https://169.254.169.254',
            mailboxId: 'mbx_1',
            fromEmail: 'support@niknote.online',
          },
        },
        { 'x-admin-token': 'valid-admin-token' },
      ),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/private or internal/i);
  });

  it('dispatches custom email through Mailflare POST /api/v1/send and records audit log', async () => {
    const ctx = setupCustomerEmailFunction({ tokenValid: true });
    const res = await ctx.handler(
      makeEdgePost(
        {
          action: 'send_email',
          payload: {
            to: 'customer@example.com',
            recipientName: 'Priya Verma',
            subject: 'Welcome to NikNote, Priya',
            html: '<p>Hello Priya!</p>',
            text: 'Hello Priya!',
            fromName: 'NikNote Support',
            fromEmail: 'support@niknote.online',
            templateId: 'welcome',
            inReplyTo: '<root@mail.example.com>',
          },
        },
        { 'x-admin-token': 'valid-admin-token' },
      ),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      success: true,
      messageId: 'msg_mf_001',
      provider: 'mailflare',
    });

    expect(ctx.sentMailflareBodies).toHaveLength(1);
    expect(ctx.sentMailflareBodies[0]).toMatchObject({
      mailboxId: 'mbx_support_01',
      from: '"NikNote Support" <support@niknote.online>',
      to: ['customer@example.com'],
      subject: 'Welcome to NikNote, Priya',
      inReplyTo: '<root@mail.example.com>',
    });

    expect(ctx.loggedRows).toHaveLength(1);
    expect(ctx.loggedRows[0]).toMatchObject({
      recipient_email: 'customer@example.com',
      status: 'sent',
      provider: 'mailflare',
      provider_message_id: 'msg_mf_001',
    });
  });

  it('sends 1-to-1 personalized campaign emails with HTML-escaped customer variables', async () => {
    const ctx = setupCustomerEmailFunction({ tokenValid: true });
    const res = await ctx.handler(
      makeEdgePost(
        {
          action: 'send_campaign',
          payload: {
            audience: 'custom',
            recipients: [
              { email: 'one@example.com', name: 'Riya <Admin>', plan: 'premium' },
              { email: 'two@example.com', name: 'Kabir', plan: 'free' },
            ],
            subject: 'Hi {{name}} ({{plan}})',
            html: '<p>Hello {{name}}</p>',
            text: 'Hello {{name}}',
          },
        },
        { 'x-admin-token': 'valid-admin-token' },
      ),
    );

    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.sentCount).toBe(2);
    expect(ctx.sentMailflareBodies).toHaveLength(2);
    // Recipients are strictly isolated 1-to-1
    expect(ctx.sentMailflareBodies[0].to).toEqual(['one@example.com']);
    expect(ctx.sentMailflareBodies[0].html).toBe('<p>Hello Riya &lt;Admin&gt;</p>');
    expect(ctx.sentMailflareBodies[1].to).toEqual(['two@example.com']);
    expect(ctx.sentMailflareBodies[1].subject).toBe('Hi Kabir (free)');
  });

  it('auto-discovers Mailflare mailboxes via GET /api/v1/mailboxes', async () => {
    const ctx = setupCustomerEmailFunction({ tokenValid: true });
    const res = await ctx.handler(
      makeEdgePost({ action: 'discover_mailboxes' }, { 'x-admin-token': 'valid-admin-token' }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mailboxes).toEqual([
      expect.objectContaining({
        id: 'mbx_support_01',
        address: 'support@niknote.online',
      }),
    ]);
  });

  it('creates custom @niknote.online mailboxes and saves drafts in Webmail Manager', async () => {
    const ctx = setupCustomerEmailFunction({ tokenValid: true });
    const mbxRes = await ctx.handler(
      makeEdgePost(
        {
          action: 'create_mailbox',
          payload: {
            localPart: 'invite',
            domainId: 'dom_niknote_online',
            displayName: 'Team of NikNote',
            mailboxType: 'shared',
          },
        },
        { 'x-admin-token': 'valid-admin-token' },
      ),
    );
    expect(mbxRes.status).toBe(200);
    const mbxJson = await mbxRes.json();
    expect(mbxJson.mailbox.address).toBe('invite@niknote.online');

    const draftRes = await ctx.handler(
      makeEdgePost(
        {
          action: 'save_draft',
          payload: {
            fromEmail: 'invite@niknote.online',
            fromName: 'Team of NikNote',
            to: 'student@example.com',
            subject: 'Draft Invite',
            text: 'We saved a spot for you on NikNote!',
          },
        },
        { 'x-admin-token': 'valid-admin-token' },
      ),
    );
    expect(draftRes.status).toBe(200);
    expect(ctx.webmailMessages[0]).toMatchObject({
      folder: 'drafts',
      mailbox_address: 'invite@niknote.online',
      subject: 'Draft Invite',
    });
  });

  it('validates webhook secret on inbound_webhook and delivers incoming customer mail to Inbox', async () => {
    const ctx = setupCustomerEmailFunction({ tokenValid: false });

    const unauthorized = await ctx.handler(
      makeEdgePost({
        action: 'inbound_webhook',
        from: 'student@college.edu',
        to: 'support@niknote.online',
        subject: 'Help with PDF OCR',
        text: 'Can you help me scan notes?',
      }),
    );
    expect(unauthorized.status).toBe(401);

    const authorized = await ctx.handler(
      makeEdgePost(
        {
          action: 'inbound_webhook',
          from: '"Ananya" <student@college.edu>',
          to: 'support@niknote.online',
          subject: 'Help with PDF OCR',
          text: 'Can you help me scan notes?',
        },
        { 'x-webhook-secret': 'whsec_test_secret_123456' },
      ),
    );
    expect(authorized.status).toBe(200);
    expect(ctx.webmailMessages).toHaveLength(1);
    expect(ctx.webmailMessages[0]).toMatchObject({
      folder: 'inbox',
      direction: 'inbound',
      from_email: 'student@college.edu',
      mailbox_address: 'support@niknote.online',
      is_read: false,
    });
  });
});

describe('AdminMailflareStudio component', () => {
  beforeEach(() => {
    invoke.mockReset();
    sessionStorage.clear();
    sessionStorage.setItem('admin_token', 'test-admin-session');
  });

  afterEach(cleanup);

  it('shows the Edge Function error body rather than the generic non-2xx message', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: Response.json({ error: 'Mailflare URL is required' }, { status: 400 }) } });
    await expect(invokeCustomerEmail('sync_mailflare_inbox')).rejects.toThrow('Mailflare URL is required');
  });

  it('refreshes webhook messages without trying to sync an unconfigured Mailflare server', async () => {
    invoke.mockImplementation(async (_fn: string, opts: any) => {
      if (opts.body.action === 'get_workspace') return { data: { config: { provider: 'resend', fromName: 'NikNote', fromEmail: 'support@niknote.online', configured: true, mailflareUrl: '', hasMailflareKey: false }, domains: [{ id: 'domain-1', hostname: 'niknote.online', receiving_provider: 'webhook' }], mailboxes: [] }, error: null };
      if (opts.body.action === 'list_messages') return { data: { messages: [] }, error: null };
      return { data: {}, error: null };
    });
    render(<AdminMailflareStudio />);
    expect(await screen.findByText(/Refresh shows saved messages only/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sync Mailflare/i })).not.toBeInTheDocument();
    invoke.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh saved messages' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('customer-email', expect.objectContaining({ body: expect.objectContaining({ action: 'list_messages' }) })));
    expect(invoke.mock.calls.some((call: any[]) => call[1].body.action === 'sync_mailflare_inbox')).toBe(false);
  });

  it('retains Mailflare sync when a server and key are configured', async () => {
    invoke.mockImplementation(async (_fn: string, opts: any) => {
      if (opts.body.action === 'get_workspace') return { data: { config: { provider: 'mailflare', fromName: 'NikNote', fromEmail: 'support@niknote.online', configured: true, mailflareUrl: 'https://mail.example.com', hasMailflareKey: true }, domains: [], mailboxes: [] }, error: null };
      return { data: {}, error: null };
    });
    render(<AdminMailflareStudio />);
    expect(await screen.findByRole('button', { name: 'Sync Mailflare' })).toBeInTheDocument();
  });

  it('selects the retro template, previews it, and sends the same design', async () => {
    invoke.mockImplementation(async (_fn: string, opts: any) => {
      if (opts?.body?.action === 'get_config') return { data: { config: { provider: 'resend', fromName: 'NikNote', fromEmail: 'hello@niknote.online', configured: true, source: 'database' } }, error: null };
      if (opts?.body?.action === 'send_email') return { data: { success: true, provider: 'resend' }, error: null };
      return { data: {}, error: null };
    });
    render(<AdminMailflareStudio />);
    fireEvent.click(screen.getByRole('button', { name: /Compose Email/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Retro Cartoon Hello/i }));
    expect(screen.getByRole('button', { name: /Retro Cartoon Illustrated envelope/i })).toHaveAttribute('aria-pressed', 'true');
    const preview = screen.getByTitle('Customer Email Preview') as HTMLIFrameElement;
    expect(preview.srcdoc).toContain(RETRO_EMAIL_ART_URL);
    fireEvent.change(screen.getByLabelText('Recipient email address'), { target: { value: 'reader@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Custom Email/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('customer-email', expect.objectContaining({ body: expect.objectContaining({ action: 'send_email', payload: expect.objectContaining({ html: expect.stringContaining(RETRO_EMAIL_ART_URL), templateId: 'retro_hello' }) }) })));
  });

  it('loads Mailflare status, applies prefill, and dispatches custom customer email', async () => {
    invoke.mockImplementation(async (_fn: string, opts: any) => {
      const action = opts?.body?.action;
      if (action === 'get_config') {
        return {
          data: {
            config: {
              provider: 'mailflare',
              mailflareUrl: 'https://mail.niknote.online',
              mailboxId: 'mbx_support_01',
              fromName: 'NikNote Support',
              fromEmail: 'support@niknote.online',
              replyTo: '',
              hasMailflareKey: true,
              maskedMailflareKey: '••••••9876',
              hasMailflareAdminKey: false,
              maskedMailflareAdminKey: '',
              hasResendKey: false,
              maskedResendKey: '',
              configured: true,
              source: 'database',
            },
          },
          error: null,
        };
      }
      if (action === 'list_logs') {
        return {
          data: { logs: [], summary: { totalSent: 3, totalFailed: 0, last24hSent: 2 } },
          error: null,
        };
      }
      if (action === 'send_email') {
        return {
          data: {
            success: true,
            messageId: 'msg_live_42',
            provider: 'mailflare',
            from: '"NikNote Institutions" <schools@niknote.online>',
          },
          error: null,
        };
      }
      return { data: {}, error: null };
    });

    render(
      <AdminMailflareStudio
        prefill={{
          to: 'principal@dps.edu.in',
          recipientName: 'Dr. Mehta',
          institution: 'DPS Dehradun',
          templateId: 'institution_followup',
        }}
      />,
    );

    expect(await screen.findByText(/Connected \(Mailflare/i)).toBeInTheDocument();
    const toField = screen.getByLabelText('Recipient email address') as HTMLInputElement;
    expect(toField.value).toBe('principal@dps.edu.in');

    const sendBtn = screen.getByRole('button', { name: /Send Custom Email/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'customer-email',
        expect.objectContaining({
          body: expect.objectContaining({
            action: 'send_email',
            payload: expect.objectContaining({
              to: ['principal@dps.edu.in'],
              subject: 'NikNote for DPS Dehradun — handwritten worksheets & study workspace',
              fromName: 'Team of NikNote',
              fromEmail: 'schools@niknote.online',
            }),
          }),
        }),
      );
    });
  });
});
