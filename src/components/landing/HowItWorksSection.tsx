import React from 'react';
import { motion } from 'framer-motion';
import { Type, Palette, Download, Brain, MessageCircle } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Type,
    title: 'Text Likhho ya Paste Karo',
    description: 'Apna content type karo ya kahin se paste karo. Hindi, English, Hinglish — sab kaam karta hai! Multi-page documents bhi support hain.',
  },
  {
    number: '02',
    icon: Palette,
    title: 'Style & Paper Choose Karo',
    description: '16+ handwriting fonts, 12 ink colors, 14 paper styles (ruled, graph, dotted, plain). Apna school/college notebook jaisa!',
  },
  {
    number: '03',
    icon: Brain,
    title: 'AI Se Smart Banao',
    description: 'AI Teacher se samjho, Quiz practice karo, Flashcards banao. Hindi mein explanation bhi milta hai! Offline bhi kaam karta hai.',
  },
  {
    number: '04',
    icon: Download,
    title: 'PDF Export + Share Karo',
    description: '300 DPI print-ready PDF download karo. WhatsApp pe directly share karo classmates ke saath — viral ho jao! 📱',
  },
];

export const HowItWorksSection: React.FC = () => {
  return (
    <section id="how-it-works" className="py-24 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold text-accent-rose uppercase tracking-wider">How It Works</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4 text-foreground">
            4 Simple Steps — Smart Notes Ready! 🚀
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Koi drawing skill nahi chahiye. Type karo, style karo, AI se smart banao, aur share karo!
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.12 }}
              className="relative text-center"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary/40 to-transparent" />
              )}

              {/* Step number + icon */}
              <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-nk-rose/10 border border-primary/20 mb-6">
                <step.icon className="w-8 h-8 text-accent-rose" />
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-lg">
                  {step.number}
                </span>
              </div>

              <h3 className="text-base font-semibold mb-2 text-foreground">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm max-w-xs mx-auto">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Quick demo strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-muted-foreground mb-3">
            Try karo — 30 seconds mein notes ready! ⚡
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {['📝 Type/Paste', '🎨 16+ Styles', '🧠 AI Help', '📥 PDF Export', '📱 WhatsApp Share'].map((tag) => (
              <span key={tag} className="px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs font-medium text-accent-rose">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
