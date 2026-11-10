/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { NikNoteEmailShell } from './niknote-email-shell.tsx'

interface ReferralInviteEmailProps {
  siteName: string
  inviterName: string
  referralCode: string
  referralUrl: string
}

export const ReferralInviteEmail = ({ siteName, inviterName, referralCode, referralUrl }: ReferralInviteEmailProps) => (
  <NikNoteEmailShell
    kind="referralInvite"
    preview={`${inviterName} invited you to try ${siteName}.`}
    title="A little more room for your ideas."
    confirmationUrl={referralUrl}
    ctaLabel="TRY NIKNOTE"
    footer="This is a personal invite from someone you know, not a payment request. If you weren’t expecting it, you can ignore this email."
  >
    <Text style={{ margin: '0 0 12px' }}>
      <strong>{inviterName}</strong> thinks you’ll like {siteName}—a cozy place to write, organize, and grow your notes.
    </Text>
    <Text style={{ margin: '0 0 12px' }}>
      Enter referral code <strong style={{ fontFamily: "'Courier New', Courier, monospace", letterSpacing: '1px' }}>{referralCode}</strong> when you sign up.
    </Text>
    <Text style={{ margin: 0, fontSize: 12 }}>
      Prefer to type the address? Visit <Link href={referralUrl} style={{ color: '#090707', fontWeight: 700 }}>niknote.online</Link> and enter the code above.
    </Text>
  </NikNoteEmailShell>
)

export default ReferralInviteEmail
