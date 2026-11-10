import { describe, expect, it } from 'vitest';
import { createReferralInviteMailto, createShareInviteMailto } from '../lib/emailInvites';

const queryFromMailto = (mailto: string) => new URL(mailto.replace('mailto:', 'https://mail.test/'));

describe('NikNote email invite drafts', () => {
  it('creates a referral email with the correct code and link without promising a reward', () => {
    const draft = createReferralInviteMailto({
      inviterName: 'Aisha Khan',
      referralCode: 'NIK7ABC',
      referralUrl: 'https://www.niknote.online/?ref=NIK7ABC',
    });
    const url = queryFromMailto(draft);
    expect(url.searchParams.get('subject')).toContain('Aisha Khan');
    expect(url.searchParams.get('body')).toContain('NIK7ABC');
    expect(url.searchParams.get('body')).toContain('Use referral code NIK7ABC when you join');
    expect(url.searchParams.get('body')).not.toContain('Premium days');
    expect(url.searchParams.get('body')).toContain('https://www.niknote.online/?ref=NIK7ABC');
  });

  it('creates a collaboration invite draft for the chosen permission and a specific recipient', () => {
    const draft = createShareInviteMailto({
      inviterName: 'Riya',
      noteTitle: 'Biology revision',
      permission: 'comment',
      shareUrl: 'https://niknote.online/share/note-123',
    }, 'friend@example.com');
    const url = queryFromMailto(draft);
    expect(decodeURIComponent(url.pathname.slice(1))).toBe('friend@example.com');
    expect(url.searchParams.get('subject')).toContain('Biology revision');
    expect(url.searchParams.get('body')).toContain('view and comment on');
    expect(url.searchParams.get('body')).toContain('https://niknote.online/share/note-123');
  });

  it('rejects non-NikNote invite URLs and malformed recipients', () => {
    expect(() => createReferralInviteMailto({
      inviterName: 'A friend',
      referralCode: 'NIK7ABC',
      referralUrl: 'https://not-niknote.example/promo',
    })).toThrow(/NikNote website/);
    expect(() => createShareInviteMailto({
      inviterName: 'A friend',
      noteTitle: 'My note',
      permission: 'edit',
      shareUrl: 'https://niknote.online/note',
    }, 'not-an-email')).toThrow(/valid invite email/);
  });
});
