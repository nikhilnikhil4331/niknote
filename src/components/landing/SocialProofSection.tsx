import React from 'react';
import { motion } from 'framer-motion';
import { Star, BookOpen, Brain, Zap, Shield } from 'lucide-react';

const stats = [
  { icon: BookOpen, value: '16+', label: 'Handwriting Styles', sub: 'Neat, Cursive, Casual' },
  { icon: Zap, value: '300 DPI', label: 'Export Quality', sub: 'Print-ready PDFs' },
  { icon: Shield, value: 'Offline', label: 'Works Without Internet', sub: 'Install once' },
  { icon: Star, value: 'Free', label: 'To Get Started', sub: 'No credit card needed' },
];

// NikNote has very few users today. Inventing glowing reviews would be dishonest
// and, in India, would count as misleading advertising. Until there is real,
// permission-granted feedback to quote, this section tells the truth instead.
const honestCards = [
  {
    emoji: '🧪',
    title: 'No fake reviews here',
    text: 'This product is new and we do not have a wall of testimonials yet. We would rather show you nothing than invent students who do not exist.',
  },
  {
    emoji: '🔍',
    title: 'Test it before you pay',
    text: 'Every core feature runs in your browser. Open the editor, type a paragraph, export a PDF and judge the handwriting yourself. No signup wall.',
  },
  {
    emoji: '🛠️',
    title: 'Built in the open',
    text: 'The codebase is public on GitHub. If something is broken, you can see exactly what it is and tell the developer directly.',
  },
];

export const SocialProofSection: React.FC = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-secondary/20 to-background">
      <div className="container mx-auto px-4 lg:px-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-20">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="text-center p-4 rounded-2xl bg-card/50 border border-border/30"
            >
              <stat.icon className="w-6 h-6 text-primary mx-auto mb-2" />
              <div className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</div>
              <div className="text-sm font-medium text-foreground">{stat.label}</div>
              <div className="text-[11px] text-muted-foreground">{stat.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Honest positioning instead of invented testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">Early access</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-2">
            We are early. Here is the honest pitch.
          </h2>
          <p className="text-muted-foreground mt-2">
            NikNote is built by one developer in India, not a marketing team.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {honestCards.map((c, index) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="bg-card rounded-2xl border border-border/50 p-5 hover:shadow-lg hover:border-primary/20 transition-all"
            >
              <span className="text-2xl">{c.emoji}</span>
              <p className="font-semibold text-foreground text-sm mt-3 mb-2">{c.title}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">{c.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
