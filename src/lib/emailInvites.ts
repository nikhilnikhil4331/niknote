export type ShareInvitePermission = 'view' | 'comment' | 'edit';

export interface ReferralInviteDraft {
  inviterName: string;
  referralCode: string;
  referralUrl: string;
}

export interface ShareInviteDraft {
  inviterName: string;
  noteTitle: string;
  permission: ShareInvitePermission;
  shareUrl: string;
}

function cleanText(value: string, fallback: string): string {
  const cleaned = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('').replace(/\s+/g, ' ').trim().slice(0, 180);
  return cleaned || fallback;
}

function safeNikNoteUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['niknote.online', 'www.niknote.online'].includes(url.hostname)) {
    throw new Error('Invite link must use the NikNote website');
  }
  return url.toString();
}

function mailto(subject: string, body: string, recipient = ''): string {
  const cleanRecipient = recipient.trim();
  if (cleanRecipient && (cleanRecipient.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(cleanRecipient))) {
    throw new Error('Enter a valid invite email address');
  }
  return `mailto:${encodeURIComponent(cleanRecipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function createReferralInviteMailto({
  inviterName,
  referralCode,
  referralUrl,
}: ReferralInviteDraft): string {
  const name = cleanText(inviterName, 'A NikNote friend');
  const code = referralCode.trim();
  if (!/^[A-Za-z0-9_-]{4,24}$/.test(code)) throw new Error('Invalid referral code');
  const link = safeNikNoteUrl(referralUrl);
  const subject = `${name} invited you to try NikNote`;
  const body = [
    `Hi! ${name} thought you might like NikNote, a cozy place to write, organize, and grow your notes.`,
    '',
    `Try it here: ${link}`,
    `Use referral code ${code} when you join.`,
    '',
    'See you in the notebook!',
  ].join('\n');
  return mailto(subject, body);
}

export function createShareInviteMailto({
  inviterName,
  noteTitle,
  permission,
  shareUrl,
}: ShareInviteDraft, recipient = ''): string {
  const inviter = cleanText(inviterName, 'A NikNote creator');
  const title = cleanText(noteTitle, 'Shared NikNote');
  const link = safeNikNoteUrl(shareUrl);
  const permissionText: Record<ShareInvitePermission, string> = {
    view: 'view',
    comment: 'view and comment on',
    edit: 'edit',
  };
  const subject = `${inviter} shared “${title}” with you`;
  const body = [
    `${inviter} invited you to ${permissionText[permission]} “${title}” on NikNote.`,
    '',
    `Open the shared note: ${link}`,
    '',
    'If you were not expecting this invite, you can ignore this email.',
  ].join('\n');
  return mailto(subject, body, recipient);
}
