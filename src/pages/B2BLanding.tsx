// ============================================================
// NikNote 4.0 — B2B / Institution Landing Page
// For Schools, Coaching Centers, Colleges
// ============================================================
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { supabase } from '@/integrations/supabase/client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, GraduationCap, BookOpen, Brain, Shield,
  CheckCircle2, Clock, Zap, ArrowRight, School, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { trackGenerateLead } from '@/lib/tracking';

const institutionPlans = [
  {
    name: "Free editor",
    price: "Free",
    period: "",
    seats: "For individual teachers and students",
    icon: School,
    color: "from-blue-500 to-indigo-600",
    action: "editor",
    features: [
      "Create handwritten worksheets and notes",
      "Choose handwriting styles and export PDFs",
      "Use a guest workspace without a card",
    ],
  },
  {
    name: "Individual Premium",
    price: "₹49",
    period: "/ 7 days",
    seats: "For one account; ₹99 for 30 days is also available",
    icon: GraduationCap,
    highlighted: true,
    color: "from-purple-500 to-pink-600",
    action: "premium",
    features: [
      "AI writing assistant and voice dictation",
      "AI style matcher and handwriting import",
      "One-time payment; no automatic renewal",
    ],
  },
  {
    name: "Schools & coaching",
    price: "Enquire",
    period: "",
    seats: "Discuss your institution's needs",
    icon: Building2,
    color: "from-orange-500 to-red-600",
    action: "contact",
    features: [
      "Tell us about your teachers and students",
      "Individual accounts and the free editor are available today",
      "Bulk administration and student analytics are not available yet",
    ],
  },
];

const notYetAvailable = [
  "Teacher / admin dashboard",
  "Bulk student import",
  "Single sign-on (SSO)",
  "White-label branding",
  "LMS integration",
  "Per-student analytics",
];

const honestNotes = [
  {
    title: "No invented case studies",
    text: "NikNote is early. We will not put up logos, ratings or quotes from schools we have never worked with. What you see here is what exists today.",
  },
  {
    title: "Try the free editor",
    text: "Teachers can start with handwriting styles and PDF export without a payment. Contact us to discuss institution requirements.",
  },
  {
    title: "You talk to the person who built it",
    text: "Institution conversations go directly to Nikhil Jatav, the developer. No sales layer, no account manager you cannot reach.",
  },
];

const faqs = [
  {
    q: "How does NikNote actually work for a teacher?",
    a: "A teacher types or pastes questions and answers, picks a handwriting style, and exports print-ready handwritten pages as a PDF. It is used for worksheets, assignments, test papers and answer keys. There is no teacher dashboard or student analytics yet — we are being upfront about that."
  },
  {
    q: "Can students use NikNote on mobile?",
    a: "NikNote supports modern mobile and desktop browsers. Some cached editing features may work offline after loading; AI and cloud features require an internet connection."
  },
  {
    q: "Is student data safe?",
    a: "Please review the NikNote privacy policy before submitting personal or student data. Features that use AI or cloud sync require internet services."
  },
  {
    q: "Can we try before buying?",
    a: "Yes. You can use the free editor without a card. Individual Premium passes are optional and do not renew automatically."
  },
  {
    q: "What about regional language support?",
    a: "NikNote supports Hindi, English, and Hinglish. We're adding more Indian languages based on demand."
  },
  {
    q: "Do you offer discounts for government schools?",
    a: "Please contact us about your institution's needs. No institutional discount is advertised here."
  },
];

const B2BPage = () => {
  useDocumentTitle({ title: 'NikNote for Teachers, Tuition Centres & Schools | Handwritten Worksheet Maker', description: 'Create handwritten worksheets and PDFs with the free editor. Ask about NikNote for your school or coaching centre.' });
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', institution: '', students: '', message: '' });
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionFailed, setSubmissionFailed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    setSubmissionFailed(false);
    try {
      const { data, error } = await supabase.functions.invoke('b2b-lead', {
        body: { ...formData, plan: 'institution_inquiry' },
      });
      if (error || data?.success !== true) throw new Error('Inquiry was not saved');
      trackGenerateLead({
        planName: 'institution_inquiry',
        conversionSource: 'schools_form',
        pageType: 'b2b',
      });
      toast.success('Inquiry received. Thank you for contacting us.');
    } catch (err) {
      console.error('Could not save institution inquiry:', err);
      setSubmissionFailed(true);
      toast.error('Could not save your inquiry. Please email us instead.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/90">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-base">NikNote</span>
          </button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-xs">Home</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/upgrade')} className="text-xs">Pricing</Button>
            <Button size="sm" className="rounded-xl text-xs" onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-16 sm:py-24 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-sm font-medium mb-6"
          >
            <Building2 className="h-4 w-4 text-primary" />
            NikNote for Education
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4"
          >
            Handwritten worksheets,
            <span className="block bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              without the hand-copying
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            Create worksheets and notes with handwriting styles, then export them to PDF.
            Start with the free editor and contact us about your institution's needs.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button
              size="lg"
              className="rounded-xl text-base px-8 h-12"
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Contact us
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="rounded-xl text-base px-8 h-12"
              onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}
            >
              View Plans
            </Button>
          </motion.div>
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-12 grid grid-cols-3 gap-6 max-w-md mx-auto"
          >
            {[
              { value: "Free", label: "Editor and PDF export" },
              { value: "7 days", label: "Student Pro pass" },
              { value: "30 days", label: "Premium pass" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-primary">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Tools for educators</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: BookOpen, title: "Handwritten worksheets", desc: "Type notes, choose a handwriting style and export pages to PDF." },
              { icon: Brain, title: "AI study help", desc: "Explore explanations, quizzes and flashcards. AI features need an internet connection." },
              { icon: Shield, title: "Browser PDF tools", desc: "Merge, split and edit PDFs in your browser; review the privacy policy for cloud features." },
              { icon: Clock, title: "Work across sessions", desc: "Use the editor on a compatible browser; cloud sync requires internet." },
              { icon: Zap, title: "Mobile and desktop", desc: "Use NikNote on a modern phone, tablet or computer." },
              { icon: CheckCircle2, title: "Honest scope", desc: "We sell only what ships today. No dashboard we have not built, and no feature you would have to wait for." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-5 rounded-2xl bg-card border border-border/30 hover:border-primary/30 hover:shadow-lg transition-all"
              >
                <item.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold text-base mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="py-16 px-4 bg-secondary/20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3">Plans for teachers and institutions</h2>
          <p className="text-center text-muted-foreground mb-10">Start with the free editor or choose an individual, one-time Premium pass.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {institutionPlans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative bg-card rounded-2xl border-2 overflow-hidden ${
                  plan.highlighted ? 'border-primary shadow-xl shadow-primary/10' : 'border-border/30'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-purple-600" />
                )}
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center`}>
                      <plan.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold">{plan.name}</h3>
                      <div className="text-xs text-muted-foreground">{plan.seats}</div>
                    </div>
                    {plan.highlighted && (
                      <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                        Optional
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full rounded-xl ${plan.highlighted ? 'bg-gradient-to-r from-primary to-primary/80' : ''}`}
                    variant={plan.highlighted ? 'default' : 'outline'}
                    onClick={() => plan.action === 'editor' ? navigate('/studio') : plan.action === 'premium' ? navigate('/payment?plan=weekly') : document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    {plan.action === 'editor' ? 'Open free editor' : plan.action === 'premium' ? 'Choose Premium' : 'Contact us'}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Straight talk */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3">Straight talk before you buy</h2>
          <p className="text-center text-sm text-muted-foreground mb-10">
            We would rather lose a sale than sell you something that does not exist yet.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {honestNotes.map((n, i) => (
              <motion.div
                key={n.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-5 rounded-2xl bg-card border border-border/30"
              >
                <div className="text-sm font-semibold mb-2">{n.title}</div>
                <p className="text-sm text-muted-foreground">{n.text}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5">
            <div className="text-sm font-semibold text-amber-700 mb-2">
              Not included in any plan today
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              These are on the roadmap. They are <strong>not</strong> part of what you are buying right now,
              and we will not bill you for them.
            </p>
            <div className="flex flex-wrap gap-2">
              {notYetAvailable.map((item) => (
                <span
                  key={item}
                  className="text-xs px-2.5 py-1 rounded-full bg-background border border-border/50 text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border/30 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="text-sm font-medium pr-4">{faq.q}</span>
                  {expandedFaq === i ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === i && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contact" className="py-16 px-4 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3">Get Started Today</h2>
          <p className="text-center text-muted-foreground mb-8">Tell us what your teachers or students need. The free editor is available now.</p>
          <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border/30 p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="inquiry-name" className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                <input id="inquiry-name"
                  required
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="inquiry-email" className="text-xs font-medium text-muted-foreground mb-1 block">Email *</label>
                <input id="inquiry-email"
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                  placeholder="you@school.edu"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="inquiry-phone" className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
                <input id="inquiry-phone"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label htmlFor="inquiry-students" className="text-xs font-medium text-muted-foreground mb-1 block">Number of Students</label>
                <input id="inquiry-students"
                  type="number"
                  min="1"
                  max="999999"
                  value={formData.students}
                  onChange={e => setFormData(prev => ({ ...prev, students: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div>
              <label htmlFor="inquiry-institution" className="text-xs font-medium text-muted-foreground mb-1 block">Institution Name *</label>
              <input id="inquiry-institution"
                required
                value={formData.institution}
                onChange={e => setFormData(prev => ({ ...prev, institution: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                placeholder="School/Coaching/College name"
              />
            </div>
            <div>
              <label htmlFor="inquiry-message" className="text-xs font-medium text-muted-foreground mb-1 block">Message</label>
              <textarea id="inquiry-message"
                value={formData.message}
                onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                className="w-full h-24 px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none"
                placeholder="Tell us about your needs..."
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-primary to-primary/80"
            >
              {submitting ? "Submitting..." : "Contact us"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            {submissionFailed && (
              <p role="alert" className="text-xs text-center text-destructive">
                Your inquiry was not saved. Please <a className="underline" href={`mailto:support@niknote.online?subject=${encodeURIComponent('NikNote institution inquiry')}&body=${encodeURIComponent(`Name: ${formData.name}\nInstitution: ${formData.institution}\nMessage: ${formData.message}`)}`}>email support</a> instead.
              </p>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Your details are used to respond to this inquiry.
            </p>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/30 text-center">
        <div className="text-sm text-muted-foreground">
          © 2026 NikNote by Nikhil Jatav. Made with ❤️ for Indian students.
        </div>
      </footer>
    </div>
  );
};

export default B2BPage;
