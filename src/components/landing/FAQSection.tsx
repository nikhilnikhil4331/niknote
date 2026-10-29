import React from 'react';
import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'What is NikNote and how can I create handwritten-style notes online?',
    answer: 'NikNote is an online handwriting notes editor and AI study workspace. Type or paste your text in the editor, pick from 16+ handwriting styles, choose ruled, graph, dotted, or plain paper with 12 ink colors, and export print-ready A4 PDFs or images.',
  },
  {
    question: 'Can I customize handwriting styles or match my own handwriting?',
    answer: 'Yes. You can adjust handwriting font family, font size, ink color, line spacing, baseline variation, and word spacing. With Handwriting Studio (Handwriting DNA), you can also upload a sample of your own writing to calibrate slant, spacing, pressure, and size.',
  },
  {
    question: 'Can I export notes as PDFs or edit existing PDF files?',
    answer: 'Yes. Notes can be exported as high-resolution A4 PDFs or PNG/JPEG images. NikNote also includes an in-browser PDF Editor (/pdf-editor) for highlighting, annotating, and in-place text editing, plus PDF Tools (/pdf-tools) for merging, splitting, compressing, OCR, and converting PDFs.',
  },
  {
    question: 'Is NikNote free to use?',
    answer: 'Yes, you can start using NikNote for free without a credit card, including instant guest workspace access. Handwriting styles, AI notes, PDF tools and exports are free for everyone. Paid plans — Student Pro (₹49 for 7 days) and Premium (₹99 for 30 days) — unlock the AI writing assistant, voice dictation, AI style matching and handwriting import.',
  },
  {
    question: 'How does the Hindi + English AI Study Assistant (NikAI) work?',
    answer: 'Ask any study question in Hindi, English, or Hinglish — such as Physics laws, Chemistry reactions, Biology concepts, or programming problems. NikAI generates structured study notes, interactive multiple-choice quizzes, and flashcards, plus includes an offline fallback topic library.',
  },
  {
    question: 'Can I scan photos of handwritten notes into editable text?',
    answer: 'Yes. Use Scan Handwriting (/scan-notes) to convert photos or screenshots of printed or handwritten notes into editable notebook pages using on-device English/Hindi OCR or NikAI vision recognition.',
  },
  {
    question: 'Which devices and browsers are supported, and does it work offline?',
    answer: 'NikNote runs in modern mobile and desktop browsers (Chrome, Edge, Safari, Firefox), can be installed as a Progressive Web App (PWA), and is available as an Android APK. Core note editing, handwriting preview, habit tracking, and client-side PDF tools work offline after first load; cloud AI and sync require an internet connection.',
  },
  {
    question: 'Which payment methods are supported?',
    answer: 'One-time payments are processed via Razorpay in INR. Each pass lasts 7 or 30 days and does not renew automatically. Available payment methods are shown at checkout; NikNote never stores your card number or UPI PIN.',
  },
];

export const FAQSection: React.FC = () => {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <section id="faq" className="py-24 bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="container mx-auto px-4 lg:px-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">FAQ</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4 text-foreground">
            Sawaal Jawab 💡
          </h2>
          <p className="text-muted-foreground">Common questions — Hinglish mein jawab!</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border border-border/50 rounded-2xl px-6 data-[state=open]:shadow-md transition-shadow"
              >
                <AccordionTrigger className="text-left text-foreground font-medium py-5 hover:no-underline text-sm sm:text-base">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5 text-sm">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};
