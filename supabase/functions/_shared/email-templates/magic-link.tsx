/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { NikNoteEmailShell } from './niknote-email-shell.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <NikNoteEmailShell
    kind="magiclink"
    preview={`Your secure sign-in link for ${siteName}.`}
    title="Pick up where you left off."
    confirmationUrl={confirmationUrl}
    ctaLabel="OPEN MY NIKNOTE"
    footer="You asked for a sign-in link. If you didn’t, ignore this email. The link is private, works once, and expires soon."
  >
    <Text style={{ margin: 0 }}>
      Use this one-time link to sign in to {siteName}. For your safety, don’t forward it or share it with anyone.
    </Text>
  </NikNoteEmailShell>
)

export default MagicLinkEmail
