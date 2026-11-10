/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import { NikNoteEmailShell } from './niknote-email-shell.tsx'

export type SharePermission = 'view' | 'comment' | 'edit'

interface ShareInviteEmailProps {
  siteName: string
  inviterName: string
  noteTitle: string
  permission: SharePermission
  shareUrl: string
}

const permissionCopy: Record<SharePermission, string> = {
  view: 'view',
  comment: 'view and leave comments on',
  edit: 'edit',
}

export const ShareInviteEmail = ({ siteName, inviterName, noteTitle, permission, shareUrl }: ShareInviteEmailProps) => (
  <NikNoteEmailShell
    kind="shareInvite"
    preview={`${inviterName} shared a NikNote with you.`}
    title="There’s a note with your name on it."
    confirmationUrl={shareUrl}
    ctaLabel="OPEN THE SHARED NOTE"
    footer="Only open this link if you recognize the person who shared it. If you weren’t expecting this invite, you can ignore the email."
  >
    <Text style={{ margin: '0 0 12px' }}>
      <strong>{inviterName}</strong> invited you to {permissionCopy[permission]} a note in {siteName}.
    </Text>
    <Text style={{ margin: 0, padding: '13px 15px', border: '1.5px solid #090707', borderRadius: 12, backgroundColor: '#FFFDF5', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, fontWeight: 700, lineHeight: 1.4, wordBreak: 'break-word' }}>
      {noteTitle}
    </Text>
  </NikNoteEmailShell>
)

export default ShareInviteEmail
