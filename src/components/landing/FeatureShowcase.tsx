import React from 'react';
import { motion } from 'framer-motion';
import {
  Pen,
  Palette,
  FileText,
  Sparkles,
  Download,
  Mic,
  Sliders,
  BookOpen,
  Brain,
  Zap,
  MessageCircle,
  Layers,
  Target,
  Lightbulb,
  GraduationCap,
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: '🧠 AI Teacher (Hindi + English)',
    description: 'Ask study questions in Hindi or English. Cloud AI needs an internet connection.',
    badge: 'NEW',
    badgeColor: 'bg-purple-500',
  },
  {
    icon: Target,
    title: '📝 Quiz & Flashcard Generator',
    description: 'Enter any topic, get quiz questions + flashcards instantly. Exam revision ka best way! CBSE, JEE, NEET pattern.',
    badge: 'STUDY',
    badgeColor: 'bg-red-500',
  },
  {
    icon: Pen,
    title: '✍️ 16+ Handwriting Styles',
    description: 'From neat cursive to casual print — each with adjustable randomness so it never looks robotic. Real India-style handwriting!',
  },
  {
    icon: Palette,
    title: '🎨 12 Ink Colors + Custom',
    description: 'Classic blue, black, red, green, and more. Plus custom color picker. Match any notebook or assignment requirement.',
  },
  {
    icon: FileText,
    title: '📄 Paper Styles',
    description: 'Ruled, college-ruled, graph, dotted, plain, legal, and more. Exactly like your school/college notebooks!',
  },
  {
    icon: Lightbulb,
    title: '💡 Smart Editor with Suggestions',
    description: 'AI suggests improvements while you type — fix grammar, expand ideas, simplify language. Like Grammarly for notes!',
  },
  {
    icon: Download,
    title: '📥 PDF & Image Export (300 DPI)',
    description: 'Export multi-page PDFs at 300 DPI — print-ready quality. Also download individual pages as PNG images.',
  },
  {
    icon: Layers,
    title: '🧩 Mind Maps & Diagrams',
    description: 'Create visual mind maps for any topic. AI generates structure — you just review and learn!',
  },
  {
    icon: GraduationCap,
    title: '📚 28+ Built-in Subjects',
    description: 'Newton\'s Laws, Photosynthesis, Thermodynamics, Indian Constitution — instant notes without any API key!',
    badge: 'FREE',
    badgeColor: 'bg-green-500',
  },
  {
    icon: MessageCircle,
    title: '📱 WhatsApp One-Click Share',
    description: 'Share your handwritten notes directly to WhatsApp groups. Classmates ko bhejo — viral ho jao!',
  },
  {
    icon: Mic,
    title: '🎤 Voice Dictation',
    description: 'Dictate notes in supported browsers. Language availability depends on your browser and device.',
  },
  {
    icon: Sliders,
    title: '🎯 Natural Imperfections',
    description: 'Baseline jitter, stroke variation, spacing randomness — makes output look genuinely handwritten, not computer-generated.',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export const FeatureShowcase: React.FC = () => {
  return (
    <section id="features" className="py-24 bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 lg:px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">Features</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4 text-foreground">
            Notion + ChatGPT + GoodNotes ={' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              NikNote
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            AI-powered notes, realistic handwriting, exam preparation — sab ek app mein. Indian students ke liye, Indian students dwara! 🇮🇳
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              className="group relative p-6 bg-card rounded-2xl border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1"
            >
              {feature.badge && (
                <span className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${feature.badgeColor}`}>
                  {feature.badge}
                </span>
              )}
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-2 text-foreground group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-muted-foreground text-sm mb-4">
            ...aur bahut kuch! Naye features har week add hote hain 🚀
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['Hindi Support', 'Offline Mode', 'PWA Install', 'Free Forever Plan'].map((tag) => (
              <span key={tag} className="px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs font-medium text-primary">
                ✅ {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
