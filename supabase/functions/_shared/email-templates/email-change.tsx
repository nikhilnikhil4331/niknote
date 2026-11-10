/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { NikNoteEmailShell } from './niknote-email-shell.tsx'

interface EmailChangeEmailProps {
  siteName: string
  // Supabase sends this template to the new address and the old address;
  // keep the original address explicit so the confirmation reads correctly.
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, oldEmail, email, newEmail, confirmationUrl }: EmailChangeEmailProps) => {
  const targetEmail = newEmail || email
  return (
    <NikNoteEmailShell
      kind="emailChange"
      preview="Confirm the email address change requested for your NikNote account."
      title="A quick check before we switch."
      confirmationUrl={confirmationUrl}
      ctaLabel="CONFIRM EMAIL CHANGE"
      footer="If you didn’t request this change, do not click the button. Sign in using your current address and contact support if anything looks unfamiliar."
    >
      <Text style={{ margin: '0 0 12px' }}>
        A request was made to change the email on your {siteName} account:
      </Text>
      <Text style={{ margin: 0, padding: '13px 15px', border: '1.5px solid #090707', borderRadius: 12, backgroundColor: '#FFFDF5', fontFamily: 'Verdana, Arial, sans-serif', fontSize: 13, lineHeight: 1.8, wordBreak: 'break-word' }}>
        From: <Link href={`mailto:${oldEmail}`} style={{ color: '#090707', fontWeight: 700 }}>{oldEmail}</Link><br />
        To: <Link href={`mailto:${targetEmail}`} style={{ color: '#090707', fontWeight: 700 }}>{targetEmail}</Link>
      </Text>
    </NikNoteEmailShell>
  )
}

export default EmailChangeEmail
