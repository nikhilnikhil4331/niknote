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

const EMAIL_THEMES: Record<NikNoteEmailKind, { accent: string; label: string; font: string }> = {
  signup: { accent: '#3285F4', label: 'WELCOME TO YOUR NEXT CHAPTER', font: "Georgia, 'Times New Roman', serif" },
  invite: { accent: '#F47F82', label: 'A NOTE FROM A FRIEND', font: "Trebuchet MS, Arial, sans-serif" },
  magiclink: { accent: '#3285F4', label: 'SECURE SIGN-IN', font: 'Arial, Helvetica, sans-serif' },
  recovery: { accent: '#FFE17A', label: 'ACCOUNT SECURITY', font: "Georgia, 'Times New Roman', serif" },
  emailChange: { accent: '#F47F82', label: 'ACCOUNT UPDATE', font: 'Verdana, Arial, sans-serif' },
  reauthentication: { accent: '#9ACB70', label: 'IDENTITY CHECK', font: "'Courier New', Courier, monospace" },
  shareInvite: { accent: '#FFE17A', label: 'A NOTE IS WAITING FOR YOU', font: "Trebuchet MS, Arial, sans-serif" },
  referralInvite: { accent: '#9ACB70', label: 'A LITTLE SOMETHING FROM A FRIEND', font: "Georgia, 'Times New Roman', serif" },
}

const responsiveCss = `
  @media only screen and (max-width: 620px) {
    .nn-email-shell { width: 100% !important; }
    .nn-email-gutter { padding: 18px 12px !important; }
    .nn-email-card { padding: 23px 19px !important; }
    .nn-email-title { font-size: 31px !important; }
    .nn-email-cta { display: block !important; }
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
        <style>{responsiveCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: '#FFFDF5', color: '#090707', fontFamily: 'Arial, Helvetica, sans-serif', WebkitTextSizeAdjust: '100%' }}>
        <Container className="nn-email-shell" style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: '25px 20px 30px' }}>
          <Section style={{ textAlign: 'center', padding: '0 0 18px' }}>
            <Link href={`${SITE_URL}/`} style={{ color: '#090707', textDecoration: 'none' }}>
              <Img src={WORDMARK_URL} width="124" alt="NikNote" style={{ display: 'block', width: 124, height: 'auto', margin: '0 auto', border: 0 }} />
            </Link>
          </Section>
          <Section className="nn-email-card" style={{ padding: '30px 34px 28px', border: '2px solid #090707', borderRadius: 20, backgroundColor: '#FFFFFF', boxShadow: '6px 6px 0 #090707' }}>
            <Text style={{ display: 'inline-block', margin: '0 0 14px', padding: '7px 11px', border: '1.5px solid #090707', borderRadius: 999, backgroundColor: theme.accent, color: '#090707', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 10, fontWeight: 800, letterSpacing: '1px', lineHeight: '1.4', textTransform: 'uppercase' }}>
              {theme.label}
            </Text>
            <Heading className="nn-email-title" style={{ margin: '0 0 13px', color: '#090707', fontFamily: theme.font, fontSize: 36, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-.5px' }}>
              {title}
            </Heading>
            <Section style={{ color: '#090707', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 15, lineHeight: 1.6 }}>
              {children}
            </Section>
            {confirmationUrl && ctaLabel && (
              <Section style={{ padding: '10px 0 2px', textAlign: 'center' }}>
                <Button className="nn-email-cta" href={confirmationUrl} style={{ display: 'inline-block', padding: '15px 26px', border: '2px solid #090707', borderRadius: 12, backgroundColor: buttonBackground, boxShadow: '4px 4px 0 #090707', color: buttonColor, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 14, fontWeight: 900, letterSpacing: '.5px', lineHeight: 1.25, textAlign: 'center', textDecoration: 'none' }}>
                  {ctaLabel}
                </Button>
                <Text style={{ margin: '13px 0 0', color: '#090707', fontSize: 11, lineHeight: 1.5, wordBreak: 'break-word' }}>
                  If the button doesn’t open, copy this link: <Link href={confirmationUrl} style={{ color: '#090707', textDecoration: 'underline' }}>open NikNote</Link>
                </Text>
              </Section>
            )}
            <Section style={{ marginTop: 20, paddingTop: 15, borderTop: '1px solid #090707' }}>
              <Text style={{ margin: 0, color: '#090707', fontSize: 12, lineHeight: 1.55 }}>
                {footer}
              </Text>
            </Section>
          </Section>
          <Text style={{ margin: '17px 8px 0', color: '#090707', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 11, lineHeight: 1.6, textAlign: 'center' }}>
            Need a hand? <Link href="mailto:support@niknote.online" style={{ color: '#090707', fontWeight: 700 }}>support@niknote.online</Link><br />
            NikNote · <Link href={`${SITE_URL}/`} style={{ color: '#090707' }}>niknote.online</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
