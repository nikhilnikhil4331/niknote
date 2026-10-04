import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, MessageCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CTASectionProps {
  onStartWriting: () => void;
}

export const CTASection: React.FC<CTASectionProps> = ({ onStartWriting }) => {
  const handleWhatsAppShare = () => {
    const msg = encodeURIComponent(
      '🎓 NikNote — Free AI Study App for Indian Students!\n\n✍️ 16+ handwriting styles\n🧠 AI Teacher (Hindi + English)\n📝 Quiz & Flashcard Generator\n📱 Works offline too!\n\nTry free: https://www.niknote.online'
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />

      {/* Animated Background Orbs */}
      <motion.div
        className="absolute top-0 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl"
        animate={{ y: [0, 20, 0], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl"
        animate={{ y: [0, -30, 0], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", delay: 0.2 }}
            className="mb-8"
          >
            <img
              src="/niknote-logo.png"
              alt="NikNote"
              className="h-16 w-auto mx-auto object-contain"
            />
          </motion.div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-foreground">
            Ab Padhai Ko Banayo
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-500 to-accent bg-clip-text text-transparent">
              Smart & Fun! 🚀
            </span>
          </h2>

          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            AI Teacher, Handwriting Notes, Quiz, Flashcards — sab free mein.
            <br />
            <span className="text-foreground font-medium">Indian students ke liye, bina signup ke! 🇮🇳</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={onStartWriting}
              className="group h-14 px-8 text-base font-semibold rounded-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 text-white shadow-lg shadow-primary/25 hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <Zap className="w-5 h-5 mr-2" />
              Start Free — Abhi Try Karo!
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={handleWhatsAppShare}
              className="group h-14 px-8 text-base font-semibold rounded-full border-2 border-green-500 text-green-600 hover:bg-green-50 transition-all duration-300 hover:scale-105"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Share on WhatsApp 📱
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {[
              '✅ No Signup Required',
              '✅ Free Forever Plan',
              '✅ Works Offline',
              '✅ Hindi Support',
              '✅ UPI Payment',
            ].map((tag) => (
              <span key={tag} className="text-xs text-muted-foreground font-medium">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
