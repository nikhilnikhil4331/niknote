import { describe, expect, it } from 'vitest';
import {
  buildDraft, confirmSent, draftToPlainText, isValidEmail, mailtoLink,
} from '@/lib/growth/email';
import {
  confirmManualSend, createApproval, decide, manualSendReady, normalizeEmail, submitForReview,
} from '@/lib/growth/approvals';

const base = {
  to: 'partners@example.edu',
  subject: 'NikNote × Example College — notes workflow',
  body: 'Hi Example team,\n\nI build NikNote. Would a short demo help your students?',
  senderName: 'Nikhil Jatav',
  senderEmail: 'nikhil@niknote.online',
};

describe('outreach draft', () => {
  it('rejects an invalid recipient', () => {
    const result = buildDraft({ ...base, to: 'not-an-email' });
    expect('error' in result).toBe(true);
  });

  it('always identifies the sender and offers an opt-out', () => {
    const result = buildDraft(base);
    if ('error' in result) throw new Error(result.error);
    expect(result.draft.body).toContain('— Nikhil Jatav');
    expect(result.draft.body).toMatch(/reply "no"/i);
    expect(result.draft.body).toContain('nikhil@niknote.online');
  });

  it('does not duplicate the opt-out when it is already written', () => {
    const result = buildDraft({
      ...base,
      body: `${base.body}\n\nReply "no" and I will not email you again.`,
    });
    if ('error' in result) throw new Error(result.error);
    const matches = result.draft.body.match(/reply "no"/gi) || [];
    expect(matches).toHaveLength(1);
  });

  it('produces a mailto link and flags one that would be truncated', () => {
    const short = buildDraft(base);
    if ('error' in short) throw new Error(short.error);
    const link = mailtoLink(short.draft);
    expect(link.href.startsWith('mailto:partners%40example.edu')).toBe(true);
    expect(link.href).toContain('subject=NikNote');
    expect(link.tooLong).toBe(false);

    const long = buildDraft({ ...base, body: 'x'.repeat(3000) });
    if ('error' in long) throw new Error(long.error);
    expect(mailtoLink(long.draft).tooLong).toBe(true);
  });

  it('needs a real person to confirm a send', () => {
    expect(() => confirmSent('  ')).toThrow(/named person/i);
    expect(confirmSent('Nikhil').sentBy).toBe('Nikhil');
  });

  it('keeps the plain-text copy identical to the mail body', () => {
    const result = buildDraft(base);
    if ('error' in result) throw new Error(result.error);
    expect(draftToPlainText(result.draft)).toContain(result.draft.body);
  });
});

describe('manual send gate', () => {
  it('normalises public emails only', () => {
    expect(normalizeEmail(' Partners@Example.EDU ')).toBe('partners@example.edu');
    expect(normalizeEmail('nope')).toBeUndefined();
    expect(isValidEmail('a@b.co')).toBe(true);
  });

  it('refuses to record a send that was not approved by a human', () => {
    const item = createApproval({
      kind: 'partnership_message',
      title: 'Outreach · Example College',
      summary: 'Why this is relevant',
      body: 'Subject: hi\n\nbody',
      dedupeKey: 'example-college',
      contactEmail: 'partners@example.edu',
    });

    expect(manualSendReady(item).allowed).toBe(false);
    expect(manualSendReady(item).reasons.join(' ')).toMatch(/not approved/i);
    expect(() => confirmManualSend(item, 'Nikhil')).toThrow();

    const approved = decide(submitForReview(item), 'approved', 'Nikhil');
    expect(manualSendReady(approved).allowed).toBe(true);

    const executed = confirmManualSend(approved, 'Nikhil');
    expect(executed.status).toBe('executed');
    expect(executed.executedBy).toBe('Nikhil');
  });

  it('blocks approval without a named human', () => {
    const item = submitForReview(createApproval({
      kind: 'partnership_message',
      title: 't',
      summary: 's',
      body: 'b',
      dedupeKey: 'k',
      contactEmail: 'a@b.co',
    }));
    expect(() => decide(item, 'approved', '   ')).toThrow(/named human/i);
  });

  it('drops an invalid contact email instead of storing it', () => {
    const item = createApproval({
      kind: 'partnership_message',
      title: 't',
      summary: 's',
      body: 'b',
      dedupeKey: 'k2',
      contactEmail: 'see contact form',
    });
    expect(item.contactEmail).toBeUndefined();
    expect(manualSendReady(decide(submitForReview(item), 'approved', 'Nikhil')).allowed).toBe(false);
  });
});
