/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { NikNoteEmailShell } from './niknote-email-shell.tsx'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <NikNoteEmailShell
    kind="recovery"
    preview={`Password reset instructions for ${siteName}.`}
    title="Let’s get you back in."
    confirmationUrl={confirmationUrl}
    ctaLabel="RESET MY PASSWORD"
    footer="If you didn’t request a reset, ignore this email—your current password stays unchanged. If you’re concerned, contact support."
  >
    <Text style={{ margin: 0 }}>
      We received a request to reset your {siteName} password. Use the secure button below to choose a new one.
    </Text>
  </NikNoteEmailShell>
)

export default RecoveryEmail
