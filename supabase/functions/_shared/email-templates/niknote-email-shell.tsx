/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

export type NikNoteEmailKind =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'emailChange'
  | 'reauthentication'
  | 'shareInvite'
  | 'referralInvite'

const SITE_URL = 'https://niknote.online'
const WORDMARK_URL = `${SITE_URL}/images/brand/niknote-primary-wordmark.png`
const FONT_STYLESHEET_URL =
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap'

// Hosted fonts are a progressive enhancement; these system stacks stay readable
// when an email client blocks remote stylesheets or does not have the web fonts.
const BODY_FONT = "'Inter', 'Aptos', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
const DISPLAY_FONT = "'Fredoka', 'Inter', 'Aptos', 'Segoe UI', Arial, sans-serif"

const EMAIL_THEMES: Record<NikNoteEmailKind, { accent: string; label: string }> = {
  signup: { accent: '#3285F4', label: 'WELCOME TO YOUR NEXT CHAPTER' },
  invite: { accent: '#F47F82', label: 'A NOTE FROM A FRIEND' },
  magiclink: { accent: '#3285F4', label: 'SECURE SIGN-IN' },
  recovery: { accent: '#FFE17A', label: 'ACCOUNT SECURITY' },
  emailChange: { accent: '#F47F82', label: 'ACCOUNT UPDATE' },
  reauthentication: { accent: '#9ACB70', label: 'IDENTITY CHECK' },
  shareInvite: { accent: '#FFE17A', label: 'A NOTE IS WAITING FOR YOU' },
  referralInvite: { accent: '#9ACB70', label: 'A LITTLE SOMETHING FROM A FRIEND' },
}

const responsiveCss = `
  @media only screen and (max-width: 620px) {
    .nn-email-shell { width: 100% !important; }
    .nn-email-gutter { padding: 20px 12px !important; }
    .nn-email-card { padding: 24px 19px !important; }
    .nn-email-title { font-size: 30px !important; line-height: 1.12 !important; }
    .nn-email-copy { font-size: 15px !important; }
    .nn-email-cta { display: block !important; width: 100% !important; box-sizing: border-box !important; }
  }
`

export interface NikNoteEmailShellProps {
  kind: NikNoteEmailKind
  preview: string
  title: string
  children: React.ReactNode
  confirmationUrl?: string
  ctaLabel?: string
  footer: React.ReactNode
}

export function NikNoteEmailShell({
  kind,
  preview,
  title,
  children,
  confirmationUrl,
  ctaLabel,
  footer,
}: NikNoteEmailShellProps) {
  const theme = EMAIL_THEMES[kind]
  const buttonBackground = theme.accent === '#FFE17A' ? '#3285F4' : theme.accent
  const buttonColor = buttonBackground === '#3285F4' ? '#FFFFFF' : '#090707'

  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
        <link href={FONT_STYLESHEET_URL} rel="stylesheet" />
        <style>{responsiveCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: '28px 12px 34px', backgroundColor: '#F4F6FB', color: '#141B2B', fontFamily: BODY_FONT, WebkitTextSizeAdjust: '100%' }}>
        <Container className="nn-email-shell nn-email-gutter" style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: 0 }}>
          <Section style={{ textAlign: 'center', padding: '0 0 18px' }}>
            <Link href={`${SITE_URL}/`} style={{ color: '#141B2B', textDecoration: 'none' }}>
              <Img src={WORDMARK_URL} width="124" alt="NikNote" style={{ display: 'block', width: 124, height: 'auto', margin: '0 auto', border: 0 }} />
            </Link>
            <Text style={{ margin: '8px 0 0', color: '#64748B', fontFamily: BODY_FONT, fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', lineHeight: 1.4, textTransform: 'uppercase' }}>
              A little space for every idea
            </Text>
          </Section>
          <Section className="nn-email-card" style={{ padding: '32px 36px 28px', border: '1px solid #DCE4F0', borderTop: `5px solid ${theme.accent}`, borderRadius: 22, backgroundColor: '#FFFFFF', boxShadow: '0 14px 38px rgba(20, 32, 55, .08)' }}>
            <Text style={{ display: 'inline-block', margin: '0 0 15px', padding: '7px 11px', border: '1px solid #DCE4F0', borderRadius: 999, backgroundColor: theme.accent, color: '#141B2B', fontFamily: BODY_FONT, fontSize: 10, fontWeight: 800, letterSpacing: '1px', lineHeight: '1.4', textTransform: 'uppercase' }}>
              {theme.label}
            </Text>
            <Heading className="nn-email-title" style={{ margin: '0 0 14px', color: '#111827', fontFamily: DISPLAY_FONT, fontSize: 36, fontWeight: 700, lineHeight: 1.12, letterSpacing: '-.7px' }}>
              {title}
            </Heading>
            <Section className="nn-email-copy" style={{ color: '#334155', fontFamily: BODY_FONT, fontSize: 15, lineHeight: 1.7 }}>
              {children}
            </Section>
            {confirmationUrl && ctaLabel && (
              <Section style={{ padding: '12px 0 2px', textAlign: 'center' }}>
                <Button className="nn-email-cta" href={confirmationUrl} style={{ display: 'inline-block', padding: '15px 26px', border: '2px solid #141B2B', borderRadius: 12, backgroundColor: buttonBackground, boxShadow: '0 4px 0 #141B2B', color: buttonColor, fontFamily: DISPLAY_FONT, fontSize: 14, fontWeight: 700, letterSpacing: '.4px', lineHeight: 1.3, textAlign: 'center', textDecoration: 'none' }}>
                  {ctaLabel}
                </Button>
                <Text style={{ margin: '14px 0 0', color: '#64748B', fontFamily: BODY_FONT, fontSize: 11, lineHeight: 1.6, wordBreak: 'break-word' }}>
                  If the button doesn’t open, copy this link: <Link href={confirmationUrl} style={{ color: '#2869D5', fontWeight: 700, textDecoration: 'underline' }}>open NikNote</Link>
                </Text>
              </Section>
            )}
            <Section style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid #E7ECF3' }}>
              <Text style={{ margin: 0, color: '#526076', fontFamily: BODY_FONT, fontSize: 12, lineHeight: 1.6 }}>
                {footer}
              </Text>
            </Section>
          </Section>
          <Text style={{ margin: '18px 8px 0', color: '#64748B', fontFamily: BODY_FONT, fontSize: 11, lineHeight: 1.7, textAlign: 'center' }}>
            Need a hand? <Link href="mailto:support@niknote.online" style={{ color: '#2869D5', fontWeight: 700, textDecoration: 'underline' }}>support@niknote.online</Link><br />
            NikNote · <Link href={`${SITE_URL}/`} style={{ color: '#526076', textDecoration: 'underline' }}>niknote.online</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
