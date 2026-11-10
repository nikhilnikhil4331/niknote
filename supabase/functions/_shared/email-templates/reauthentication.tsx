/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { NikNoteEmailShell } from './niknote-email-shell.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <NikNoteEmailShell
    kind="reauthentication"
    preview="Your NikNote verification code is inside."
    title="Prove it’s you."
    footer="This code expires shortly and works once. If you didn’t ask for it, ignore this email and secure your account."
  >
    <Text style={{ margin: '0 0 12px' }}>Enter this one-time verification code in NikNote:</Text>
    <Text style={{ margin: 0, padding: '18px 15px', border: '2px solid #090707', borderRadius: 14, backgroundColor: '#FFFDF5', boxShadow: '3px 3px 0 #090707', color: '#090707', fontFamily: "'Courier New', Courier, monospace", fontSize: 30, fontWeight: 800, letterSpacing: '5px', lineHeight: 1.3, textAlign: 'center' }}>
      {token}
    </Text>
  </NikNoteEmailShell>
)

export default ReauthenticationEmail
