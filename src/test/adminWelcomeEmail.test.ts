import { describe, expect, it } from 'vitest';
import { buildNikNoteWelcomeEmail, NIKNOTE_WELCOME_TEMPLATE_ID } from '../../supabase/functions/_shared/admin-welcome-email';

describe('NikNote admin welcome email template', () => {
  it('uses the refreshed Fredoka and Inter NikNote branding with a text alternative', () => {
    const rendered = buildNikNoteWelcomeEmail('Asha');
    expect(rendered.subject).toContain('Welcome to NikNote');
    expect(rendered.html).toContain("'Fredoka'");
    expect(rendered.html).toContain("'Inter'");
    expect(rendered.html).toContain('niknote-primary-wordmark.png');
    expect(rendered.html).toContain('Make room for');
    expect(rendered.html).toContain('OPEN NIKNOTE');
    expect(rendered.html).toContain('@media only screen and (max-width: 620px)');
    expect(rendered.html).toContain('You received this account welcome email because you joined NikNote.');
    expect(rendered.text).toContain('Open NikNote: https://niknote.online/');
    expect(NIKNOTE_WELCOME_TEMPLATE_ID).toBe('niknote-welcome-v1');
  });

  it('escapes recipient names and falls back safely for blank names', () => {
    const untrusted = buildNikNoteWelcomeEmail('<img src=x onerror=alert(1)>');
    expect(untrusted.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(untrusted.html).not.toContain('<img src=x onerror=alert(1)>');
    expect(buildNikNoteWelcomeEmail('   ').html).toContain('Hi creator,');
  });
});
