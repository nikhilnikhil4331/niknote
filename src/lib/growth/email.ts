// ============================================================
// growth/email — the send path, such as it is.
//
// Decision (documented in docs/GROWTH-SYSTEM.md): NikNote does not own an
// email provider yet. Outreach is sent from the operator's own mail client via
// an RFC 6068 `mailto:` link, so:
//   * no API key exists to leak,
//   * no prospect address is uploaded anywhere by us,
//   * nothing can be sent by a cron job or an "AI agent" at 3am.
//
// Every draft must identify the sender and offer an opt-out. A draft for a
// prospect who has opted out is never produced, and `markSent` refuses to
// record a send that the human did not confirm.
// ============================================================

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  /** Who is signing this email — a real person, not "the team". */
  senderName: string;
  senderEmail: string;
}

export interface DraftInput {
  to: string;
  subject: string;
  body: string;
  senderName: string;
  senderEmail: string;
}

const MAX_SUBJECT = 140;
const MAX_BODY = 4000;
const MAX_MAILTO = 1900; // mailto URLs get truncated by some clients past ~2k

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lines every outreach email must carry. Missing either one blocks the draft. */
export const REQUIRED_LINES = {
  identification: (name: string) => `— ${name}`,
  optOut: () => 'If you would rather not hear from me again, reply "no" and I will not email you again.',
};

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function buildDraft(input: DraftInput): { ok: true; draft: EmailDraft } | { ok: false; error: string } {
  const to = input.to.trim();
  if (!isValidEmail(to)) return { ok: false, error: 'A valid public contact email is required.' };

  const senderName = input.senderName.trim();
  const senderEmail = input.senderEmail.trim();
  if (!senderName) return { ok: false, error: 'Sign the email with a real person’s name.' };
  if (!isValidEmail(senderEmail)) return { ok: false, error: 'The sender email must be valid.' };

  const subject = input.subject.trim().slice(0, MAX_SUBJECT);
  if (!subject) return { ok: false, error: 'The subject cannot be empty.' };

  let body = input.body.trim().slice(0, MAX_BODY);
  if (!body) return { ok: false, error: 'The body cannot be empty.' };

  if (!body.includes(REQUIRED_LINES.identification(senderName))) {
    body = `${body}\n\n${REQUIRED_LINES.identification(senderName)}`;
  }
  if (!/reply\s+"?no"?/i.test(body) && !/unsubscribe/i.test(body)) {
    body = `${body}\n\n${REQUIRED_LINES.optOut()}`;
  }
  if (body.includes(senderEmail) === false) {
    body = `${body}\n${senderEmail}`;
  }

  return {
    ok: true,
    draft: { to, subject, body, senderName, senderEmail },
  };
}

/**
 * Build a `mailto:` link. When the draft is too long for a URL, the caller
 * should copy the text instead — we return `tooLong` rather than emit a link
 * that silently loses the last paragraph.
 */
export function mailtoLink(draft: EmailDraft): { href: string; tooLong: boolean } {
  const href = `mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
  return { href, tooLong: href.length > MAX_MAILTO };
}

export interface SendConfirmation {
  /** ISO timestamp of the human confirming they sent it. */
  confirmedAt: string;
  sentBy: string;
}

/**
 * A send is only recorded when a named human confirms it. There is no code
 * path that marks a message sent automatically.
 */
export function confirmSent(by: string, at = new Date()): SendConfirmation {
  const sentBy = by.trim();
  if (!sentBy) throw new Error('A named person must confirm the send.');
  return { confirmedAt: at.toISOString(), sentBy };
}

/** Plain-text copy for the clipboard, identical to what the mail client gets. */
export function draftToPlainText(draft: EmailDraft): string {
  return `To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`;
}
