import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const policies = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'NikNote par aapki padhai aur personal information ki privacy important hai.',
    sections: [
      ['What we collect', 'When you create an account, we process your name, email and sign-in details. Notes, uploaded handwriting samples, feedback and AI prompts are processed when you use those features. Basic usage and security information may also be recorded.'],
      ['How we use it', 'We use this information to provide your account, save and sync notes, generate handwriting and AI responses, process purchases, respond to support requests and protect the service. Content sent to an AI feature may be processed by the AI service providing that feature.'],
      ['Payments and sharing', 'Payment providers handle checkout and payment credentials; NikNote should not ask you to enter card details into a note. If you choose to share a note or a link, its recipients can see what you share.'],
      ['Storage and your choices', 'Sign-in storage is required to keep your session working. Optional usage analytics are saved only if you allow them. You can change that choice using Cookie settings on this page. To request access, correction or deletion of your account data, contact us.'],
      ['Security and contact', 'We use access controls and encrypted connections to protect information, but no online service can guarantee absolute security. For privacy requests, email support@niknote.online.'],
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    intro: 'NikNote use karne se pehle ye terms padhein.',
    sections: [
      ['Using NikNote', 'Use the service lawfully and only with content you have the right to upload. Keep your account secure and do not try to access another user’s notes or disrupt the service.'],
      ['AI and study content', 'AI answers and handwriting conversions can contain mistakes. Check important facts with your teacher or trusted sources. NikNote is a study aid, not a guarantee of academic results.'],
      ['Your work', 'You retain rights to your original notes and uploads. You give NikNote permission to process them only to provide the features you request, such as syncing, AI assistance and export.'],
      ['Plans and payments', 'Free and paid features may have different limits. The price, billing period and final payable amount are shown before checkout. Contact support about billing problems or refunds.'],
      ['Availability and contact', 'We may update features and these terms as the service changes. For questions, contact support@niknote.online.'],
    ],
  },
  refunds: {
    title: 'Refund Policy',
    intro: 'Payment mein problem hui? Humse seedha sampark karein.',
    sections: [
      ['Before purchasing', 'Please review the selected plan, billing period and total shown at checkout. Digital features may become available as soon as payment is confirmed.'],
      ['Request a review', 'For duplicate charges, a failed activation or any refund request, email support@niknote.online with your account email, payment date, transaction reference and a description of the issue. Do not send your card number or password.'],
      ['Resolution', 'We review each request against the applicable payment-provider rules and consumer law, and reply with the outcome and any next steps. We do not promise automatic refunds or a fixed timeframe before reviewing your case.'],
    ],
  },
} as const;

export default function LegalPage({ policy }: { policy: keyof typeof policies }) {
  const content = policies[policy];
  useDocumentTitle({ title: `${content?.title ?? 'Policies'} — NikNote`, description: content?.intro ?? 'NikNote policies and contact details.' });

  if (!content) return <main className="min-h-screen bg-background p-8"><Link to="/">Back to NikNote</Link></main>;

  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border"><div className="mx-auto max-w-3xl px-5 py-4"><Button variant="ghost" asChild><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> NikNote</Link></Button></div></header>
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
      <h1 className="text-3xl sm:text-4xl font-bold">{content.title}</h1>
      <p className="mt-4 text-muted-foreground">{content.intro}</p>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 4 October 2026</p>
      <div className="mt-10 space-y-9">{content.sections.map(([heading, text]) => <section key={heading}><h2 className="text-xl font-semibold">{heading}</h2><p className="mt-2 leading-7 text-muted-foreground">{text}</p></section>)}</div>
      <div className="mt-12 border-t border-border pt-6 flex flex-wrap gap-5 text-sm text-primary"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/refunds">Refunds</Link><a href="mailto:support@niknote.online">Contact support</a></div>
    </main>
  </div>;
}