import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useEffect, useState } from 'react';
import {
  CONSENT_UPDATED_EVENT,
  OPEN_COOKIE_SETTINGS_EVENT,
  formatConsentSummary,
  getSavedConsent,
} from '@/lib/consent';

const policies = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'NikNote par aapki padhai aur personal information ki privacy important hai.',
    sections: [
      [
        'What we collect',
        'When you create an account, we process your name, email and sign-in details. Notes, uploaded handwriting samples, PDFs, feedback and AI prompts are processed when you use those features. Basic technical and security logs may also be recorded to keep the service reliable.',
      ],
      [
        'How we use it',
        'We use this information to provide your account or guest workspace, save and sync notes, generate handwriting previews and AI study responses, process subscription purchases, respond to support requests and protect the service against abuse. Content sent to an AI feature is processed by the AI provider fulfilling that request.',
      ],
      [
        'Cookies, analytics and advertising measurement',
        'Essential browser storage is required to keep your session, local notes and preferences working. Only if you grant Analytics consent in Cookie settings, NikNote records aggregated usage events (such as page views, feature usage and exports) using local browser storage and, when configured, Google Analytics 4 (with IP anonymization and Google Consent Mode). Only if you grant Marketing consent, NikNote may load Meta Pixel to measure standard conversion events (such as PageView, ViewContent, Lead, InitiateCheckout, CompleteRegistration and verified Purchase). We never send your note contents, handwritten documents, AI prompts, passwords or payment card details to Google Analytics or Meta.',
      ],
      [
        'Payments and sharing',
        'Razorpay handles checkout and payment credentials; NikNote never stores your card number or UPI PIN. Subscription purchases are verified server-side. If you choose to share a note or link, recipients can view what you share.',
      ],
      [
        'Your choices, security and contact',
        'Declining optional analytics or marketing cookies never prevents you from signing in or using NikNote. You can review or withdraw optional tracking consent at any time using the Cookie settings button below. We use encrypted HTTPS connections and access controls, though no online service can guarantee absolute security. To request access, correction or deletion of your account data, email support@niknote.online.',
      ],
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    intro: 'NikNote use karne se pehle ye terms padhein.',
    sections: [
      [
        'Using NikNote',
        'Use the service lawfully and only with content you have the right to upload. Keep your account secure and do not try to access another user’s notes or disrupt the service.',
      ],
      [
        'AI and study content',
        'AI answers, OCR scans and handwriting conversions can contain mistakes. Verify important facts with your teacher, textbook or trusted sources. NikNote is a study aid, not a guarantee of academic results.',
      ],
      [
        'Your work',
        'You retain rights to your original notes and uploads. You give NikNote permission to process them only to provide the features you request, such as syncing, AI assistance and export.',
      ],
      [
        'Plans and payments',
        'Free and paid features have clearly stated limits. The plan price, billing period and payable amount are displayed before checkout. Contact support about billing problems or refunds.',
      ],
      [
        'Availability and contact',
        'We may update features and these terms as the service evolves. For questions, contact support@niknote.online.',
      ],
    ],
  },
  refunds: {
    title: 'Refund Policy',
    intro: 'Payment mein problem hui? Humse seedha sampark karein.',
    sections: [
      [
        'Before purchasing',
        'Please review the selected plan, billing period and total shown at checkout. Digital features become available once payment verification completes.',
      ],
      [
        'Request a review',
        'For duplicate charges, failed activation or a refund inquiry, email support@niknote.online with your account email, payment date, Razorpay transaction reference and a description of the issue. Never send your card number, OTP or password.',
      ],
      [
        'Resolution',
        'We review each request against payment-provider records and applicable consumer law, and reply with the outcome and next steps. We do not promise automatic refunds before reviewing your transaction.',
      ],
    ],
  },
} as const;

export default function LegalPage({ policy }: { policy: keyof typeof policies }) {
  const content = policies[policy];
  const [consentSummary, setConsentSummary] = useState(() => formatConsentSummary(getSavedConsent()));
  useDocumentTitle({
    title: `${content?.title ?? 'Policies'} — NikNote`,
    description: content?.intro ?? 'NikNote policies and contact details.',
  });

  useEffect(() => {
    const sync = () => setConsentSummary(formatConsentSummary(getSavedConsent()));
    window.addEventListener(CONSENT_UPDATED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_UPDATED_EVENT, sync);
  }, []);

  if (!content) {
    return (
      <main className="min-h-screen bg-background p-8">
        <Link to="/">Back to NikNote</Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-5 py-4">
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> NikNote
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
        <h1 className="text-3xl sm:text-4xl font-bold">{content.title}</h1>
        <p className="mt-4 text-muted-foreground">{content.intro}</p>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 27 October 2026</p>
        <div className="mt-10 space-y-9">
          {content.sections.map(([heading, text]) => (
            <section key={heading}>
              <h2 className="text-xl font-semibold">{heading}</h2>
              <p className="mt-2 leading-7 text-muted-foreground">{text}</p>
            </section>
          ))}
        </div>
        {policy === 'privacy' && (
          <div className="mt-10">
            <Button
              variant="outline"
              onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
            >
              Cookie settings: {consentSummary}
            </Button>
          </div>
        )}
        <nav aria-label="Legal navigation" className="mt-12 border-t border-border pt-6 flex flex-wrap gap-5 text-sm text-primary">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms &amp; Conditions</Link>
          <Link to="/refunds">Refund Policy</Link>
          <Link to="/welcome">How NikNote Works</Link>
          <a href="mailto:support@niknote.online">Contact support</a>
        </nav>
      </main>
    </div>
  );
}
