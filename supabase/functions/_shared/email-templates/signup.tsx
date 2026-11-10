/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { NikNoteEmailShell } from './niknote-email-shell.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <NikNoteEmailShell
    kind="signup"
    preview={`Confirm your email and start your first NikNote.`}
    title="Your ideas need a home."
    confirmationUrl={confirmationUrl}
    ctaLabel="CONFIRM MY EMAIL"
    footer="If you didn’t create this account, you can safely ignore this message. No account changes will be made."
  >
    <Text style={{ margin: '0 0 12px' }}>
      Thanks for joining <Link href={siteUrl} style={{ color: '#090707', fontWeight: 800 }}>{siteName}</Link>.
    </Text>
    <Text style={{ margin: 0 }}>
      Confirm <Link href={`mailto:${recipient}`} style={{ color: '#090707', fontWeight: 700 }}>{recipient}</Link> to finish setting up your account and keep your notes close.
    </Text>
  </NikNoteEmailShell>
)

export default SignupEmail
