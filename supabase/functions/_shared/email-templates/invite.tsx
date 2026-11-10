/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Link, Text } from 'npm:@react-email/components@0.0.22'
import { NikNoteEmailShell } from './niknote-email-shell.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <NikNoteEmailShell
    kind="invite"
    preview={`You’ve been invited to join ${siteName}.`}
    title="A spot at the notebook table is yours."
    confirmationUrl={confirmationUrl}
    ctaLabel="ACCEPT MY INVITATION"
    footer="If you weren’t expecting this invite, you can ignore this email. The invitation link is personal—please don’t forward it."
  >
    <Text style={{ margin: '0 0 12px' }}>
      You’ve been invited to create an account at <Link href={siteUrl} style={{ color: '#090707', fontWeight: 800 }}>{siteName}</Link>.
    </Text>
    <Text style={{ margin: 0 }}>
      Accept the invitation to set up your account and open your own space for notes, ideas, and plans.
    </Text>
  </NikNoteEmailShell>
)

export default InviteEmail
