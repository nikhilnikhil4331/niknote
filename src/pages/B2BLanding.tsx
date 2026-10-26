// ============================================================
// NikNote 4.0 — B2B / Institution Landing Page
// For Schools, Coaching Centers, Colleges
// This is the ₹5 Crore revenue engine
// ============================================================
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { supabase } from '@/integrations/supabase/client';

import React, { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Building2, Users, GraduationCap, BookOpen, Brain, Shield,
  CheckCircle2, Phone, Mail, Globe, BarChart3, Clock, Star,
  Crown, Zap, ArrowRight, MessageSquare, Award, TrendingUp,
  School, Calculator, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { trackClickCTA, trackGenerateLead } from '@/lib/tracking';

const institutionPlans = [
  {
    name: "School Starter",
    price: "₹25,000",
    period: "/year",
    seats: "Up to 100 students",
    icon: School,
    color: "from-blue-500 to-indigo-600",
    features: [
      "100 student seats",
      "All premium features",
      "Basic analytics dashboard",
      "Email support",
      "PDF export",
      "Standard handwriting fonts",
    ]
  },
  {
    name: "School Pro",
    price: "₹75,000",
    period: "/year",
    seats: "Up to 500 students",
    icon: GraduationCap,
    popular: true,
    color: "from-purple-500 to-pink-600",
    features: [
      "500 student seats",
      "All premium features + AI",
      "Advanced analytics & reports",
      "Priority support",
      "Custom branding (school logo)",
      "All exam packs included",
      "Teacher dashboard",
      "Bulk student import",
    ]
  },
  {
    name: "Coaching Center",
    price: "₹2,00,000",
    period: "/year",
    seats: "Up to 2,000 students",
    icon: Building2,
    color: "from-orange-500 to-red-600",
    features: [
      "2,000 student seats",
      "All premium + AI features",
      "Full analytics suite",
      "Dedicated account manager",
      "White-label option",
      "All exam packs (JEE/NEET/UPSC)",
      "Custom content creation",
      "API access",
      "SSO integration",
    ]
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    seats: "Unlimited students",
    icon: Crown,
    color: "from-amber-500 to-yellow-600",
    features: [
      "Unlimited students",
      "Everything in Coaching Center",
      "On-premise deployment option",
      "Custom SLA (99.9% uptime)",
      "Dedicated support team",
      "Custom AI model training",
      "Multi-campus support",
      "LMS integration",
      "Data export & compliance",
      "Quarterly business reviews",
    ]
  },
];

const testimonials = [
  {
    name: "Dr. Rajesh Sharma",
    role: "Principal, Delhi Public School",
    text: "NikNote has transformed how our students take notes. The AI-powered features help them learn faster and retain more.",
    rating: 5,
  },
  {
    name: "Priya Verma",
    role: "Director, Kota Coaching Center",
    text: "Our students love the handwriting feature — it makes their notes feel personal. The JEE/NEET packs are a game-changer.",
    rating: 5,
  },
  {
    name: "Ankit Gupta",
    role: "HOD Mathematics, IIT Delhi",
    text: "The AI solver is incredibly accurate. Students can verify their work and learn from step-by-step solutions.",
    rating: 5,
  },
];

const faqs = [
  {
    q: "How does NikNote work for schools?",
    a: "We provide a branded platform for your school. Students get premium access, teachers get a dashboard to track progress, and administrators get analytics. Setup takes less than 48 hours."
  },
  {
    q: "Can students use NikNote on mobile?",
    a: "Yes! NikNote works on any device — mobile, tablet, or desktop. It's a Progressive Web App that works offline too."
  },
  {
    q: "Is student data safe?",
    a: "Absolutely. We comply with Indian data protection laws. All data is encrypted and stored on secure servers. We never sell or share student data."
  },
  {
    q: "Can we try before buying?",
    a: "Yes! We offer a 14-day free trial for institutions. No credit card required. Set up your trial in minutes."
  },
  {
    q: "What about regional language support?",
    a: "NikNote supports Hindi, English, and Hinglish. We're adding more Indian languages based on demand."
  },
  {
    q: "Do you offer discounts for government schools?",
    a: "Yes, we offer 50% discount for government schools and NGOs. Contact us for details."
  },
];

const B2BPage = () => {
  useDocumentTitle({ title: 'NikNote for Schools & Coaching | AI Learning Platform — Starting ₹25,000/year', description: 'NikNote for schools and coaching centers — AI-powered learning platform. 92% cheaper than printed notes. Teacher dashboard, student analytics. Starting ₹25,000/year.' });
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', institution: '', students: '', message: '' });
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Save lead to Supabase via edge function
      const { error } = await supabase.functions.invoke('b2b-lead', {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          institution: formData.institution,
          students: formData.students,
          message: formData.message,
          plan: 'school_pro',
        },
      });

      if (error) {
        console.error('B2B lead error:', error);
      }

      // Also open mailto as backup notification
      const subject = encodeURIComponent(`NikNote B2B Inquiry - ${formData.institution}`);
      const body = encodeURIComponent(
        `Name: ${formData.name}\nEmail: ${formData.email}\nPhone: ${formData.phone}\nInstitution: ${formData.institution}\nStudents: ${formData.students}\nMessage: ${formData.message}`
      );
      window.open(`mailto:nikhilnikhil4331@gmail.com?subject=${subject}&body=${body}`, '_blank');

      trackGenerateLead({
        planName: 'school_pro',
        conversionSource: 'schools_form',
        pageType: 'b2b',
      });
      toast.success("Thank you! We'll contact you within 24 hours 🎉");
    } catch (err) {
      console.error('Submit error:', err);
      // Fallback: just mailto
      const subject = encodeURIComponent(`NikNote B2B Inquiry - ${formData.institution}`);
      const body = encodeURIComponent(`Name: ${formData.name}\nEmail: ${formData.email}\nPhone: ${formData.phone}\nInstitution: ${formData.institution}\nStudents: ${formData.students}\nMessage: ${formData.message}`);
      window.open(`mailto:nikhilnikhil4331@gmail.com?subject=${subject}&body=${body}`, '_blank');
      toast.success("Thank you! We'll contact you soon 🎉");
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
            AI-Powered Learning for
            <span className="block bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Every Indian Classroom
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            From handwriting to AI — give your students the smartest note-taking platform. 
            Trusted by 2,500+ students. Built for Indian education.
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
              Start Free Trial
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
              { value: "2,500+", label: "Students" },
              { value: "99.9%", label: "Uptime" },
              { value: "4.8★", label: "Rating" },
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
          <h2 className="text-2xl font-bold text-center mb-10">Why Institutions Choose NikNote</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: "AI-Powered Learning", desc: "AI generates notes, solves problems, creates flashcards — students learn 3x faster" },
              { icon: BookOpen, title: "Handwriting DNA", desc: "Students write in their own handwriting style — personal, natural, effective" },
              { icon: BarChart3, title: "Teacher Dashboard", desc: "Track student progress, see engagement metrics, identify struggling students" },
              { icon: Shield, title: "Data Privacy", desc: "Student data stays in India. Compliant with Indian data protection laws" },
              { icon: Clock, title: "Zero Setup Time", desc: "Cloud-based, works on any device. Students start in minutes, not days" },
              { icon: Calculator, title: "Exam Packs", desc: "JEE, NEET, UPSC, CBSE content pre-loaded. Students get exam-ready instantly" },
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
          <h2 className="text-2xl font-bold text-center mb-3">Institution Plans</h2>
          <p className="text-center text-muted-foreground mb-10">Starting at just ₹25,000/year for 100 students</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {institutionPlans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative bg-card rounded-2xl border-2 overflow-hidden ${
                  plan.popular ? 'border-primary shadow-xl shadow-primary/10' : 'border-border/30'
                }`}
              >
                {plan.popular && (
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
                    {plan.popular && (
                      <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                        Popular
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
                    className={`w-full rounded-xl ${plan.popular ? 'bg-gradient-to-r from-primary to-primary/80' : ''}`}
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
          {/* Govt school discount */}
          <div className="mt-6 text-center p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="text-sm font-semibold text-green-700 flex items-center justify-center gap-2">
              <Award className="h-4 w-4" />
              50% Discount for Government Schools & NGOs
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">What Educators Say</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-5 rounded-2xl bg-card border border-border/30"
              >
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-3">"{t.text}"</p>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="py-16 px-4 bg-secondary/20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">ROI Calculator</h2>
          <p className="text-muted-foreground mb-6">See how much your institution saves with NikNote</p>
          <div className="bg-card rounded-2xl border border-border/30 p-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Traditional printed notes cost/student/year</span>
              <span className="font-bold">₹2,000</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>NikNote cost/student/year (Pro Plan)</span>
              <span className="font-bold text-primary">₹150</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between text-sm">
              <span>Savings per student per year</span>
              <span className="font-bold text-green-600">₹1,850 (92.5%)</span>
            </div>
            <div className="flex items-center justify-between text-sm bg-green-500/10 p-3 rounded-xl">
              <span>For 500 students — Annual Savings</span>
              <span className="font-bold text-green-700 text-lg">₹9,25,000</span>
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
          <p className="text-center text-muted-foreground mb-8">14-day free trial. No credit card required.</p>
          <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border/30 p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Email *</label>
                <input
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
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
                <input
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Number of Students</label>
                <select
                  value={formData.students}
                  onChange={e => setFormData(prev => ({ ...prev, students: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="">Select</option>
                  <option value="1-100">1-100</option>
                  <option value="100-500">100-500</option>
                  <option value="500-2000">500-2000</option>
                  <option value="2000+">2000+</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Institution Name *</label>
              <input
                required
                value={formData.institution}
                onChange={e => setFormData(prev => ({ ...prev, institution: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                placeholder="School/Coaching/College name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Message</label>
              <textarea
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
              {submitting ? "Submitting..." : "Start Free Trial"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              We'll respond within 24 hours. No spam, ever.
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
