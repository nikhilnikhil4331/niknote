import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Play, MessageCircle, BookOpen, Brain, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeroSectionProps {
  onStartWriting: () => void;
  onPreviewNotes: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onStartWriting,
  onPreviewNotes,
}) => {
  const handleWhatsAppShare = () => {
    const msg = encodeURIComponent(
      '🎓 NikNote — Free AI Study App for Indian Students!\n\n✍️ Convert text to 16+ handwriting styles\n🧠 AI Teacher, Quiz Generator, Flashcards\n📱 Works on phone & laptop\n\nTry free: https://www.niknote.online'
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />

      {/* Floating Orbs */}
      <motion.div
        className="absolute top-20 left-[10%] w-72 h-72 bg-primary/10 rounded-full blur-3xl"
        animate={{ y: [0, 30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-20 right-[10%] w-96 h-96 bg-accent/10 rounded-full blur-3xl"
        animate={{ y: [0, -40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 lg:px-6">
        <div className="max-w-5xl mx-auto text-center">

          {/* Badge Row — Made in India + AI Powered */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-2 mb-6"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-200 text-xs font-bold text-orange-600">
              🇮🇳 Made for Indian Students
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <Sparkles className="w-3 h-3" />
              AI-Powered Learning
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-200 text-xs font-bold text-green-600">
              ✅ 100% Free to Start
            </span>
          </motion.div>

          {/* H1 — SEO + Indian student focus */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
          >
            <span className="text-foreground">AI Notes + Handwriting</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-500 to-accent bg-clip-text text-transparent">
              Made for Bharat
            </span>
            <br />
            <span className="text-foreground text-3xl sm:text-4xl md:text-5xl lg:text-5xl">
              Ke Students 🎓
            </span>
          </motion.h1>

          {/* Sub — value proposition for Indian students */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed"
          >
            <span className="text-foreground font-medium">AI Teacher</span> jo Hindi mein samjhata hai,{' '}
            <span className="text-foreground font-medium">Handwriting Notes</span> jo real lagti hai,{' '}
            <span className="text-foreground font-medium">Quiz & Flashcards</span> jo exam ready karte hain.
            CBSE, ICSE, JEE, NEET — sab ke liye!
          </motion.p>

          {/* Exam Board Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-2 mb-8"
          >
            {[
              { label: 'CBSE', color: 'bg-blue-100 text-blue-700 border-blue-200' },
              { label: 'ICSE', color: 'bg-purple-100 text-purple-700 border-purple-200' },
              { label: 'JEE', color: 'bg-red-100 text-red-700 border-red-200' },
              { label: 'NEET', color: 'bg-green-100 text-green-700 border-green-200' },
              { label: 'UPSC', color: 'bg-amber-100 text-amber-700 border-amber-200' },
              { label: 'State Boards', color: 'bg-teal-100 text-teal-700 border-teal-200' },
            ].map((exam) => (
              <span
                key={exam.label}
                className={`px-3 py-1 rounded-full text-[11px] font-bold border ${exam.color}`}
              >
                {exam.label}
              </span>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button
              size="lg"
              onClick={onStartWriting}
              className="group h-14 px-8 text-base font-bold rounded-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:from-orange-400 hover:via-pink-400 hover:to-purple-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/40 transition-all duration-300 hover:scale-105"
            >
              <Zap className="w-5 h-5 mr-2" />
              Start Writing FREE ✨
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={onPreviewNotes}
              className="group h-14 px-8 text-base font-semibold rounded-full border-2 hover:bg-secondary/50 transition-all duration-300 hover:scale-105"
            >
              <Play className="w-5 h-5 mr-2 text-primary" />
              See Examples
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={handleWhatsAppShare}
              className="group h-14 px-8 text-base font-semibold rounded-full border-2 border-green-500 text-green-600 hover:bg-green-50 transition-all duration-300 hover:scale-105"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Share on WhatsApp
            </Button>
          </motion.div>

          {/* Social proof strip — realistic */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="w-4 h-4 text-primary" />
              <span>AI explanations for study topics</span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-border" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="w-4 h-4 text-purple-500" />
              <span>Some editing may work offline when cached</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2"
        >
          <motion.div className="w-1.5 h-1.5 rounded-full bg-primary" />
        </motion.div>
      </motion.div>
    </section>
  );
};
