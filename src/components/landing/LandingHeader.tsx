import React from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, Menu, X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface LandingHeaderProps {
  isDark: boolean;
  onToggleDark: () => void;
  onStartWriting: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({
  isDark,
  onToggleDark,
  onStartWriting,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  const handleShareWhatsApp = () => {
    const msg = encodeURIComponent(
      '🎓 NikNote — Free AI Study App for Indian Students!\n\n✍️ Convert text to 16+ handwriting styles\n🧠 AI Teacher, Quiz Generator, Flashcards\n📱 Works on phone & laptop\n\nTry free: https://www.niknote.online'
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/30"
    >
      <div className="container mx-auto px-4 lg:px-6">
        <div className="h-16 flex items-center justify-between">
          {/* Logo — Official NikNote Logo */}
          <motion.a
            href="/"
            className="flex items-center gap-2.5"
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <img
              src="/niknote-logo.png"
              alt="NikNote"
              className="h-9 w-auto object-contain"
              loading="eager"
            />
            <span className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-nk-warm-600/10 text-[10px] font-bold text-accent-warm border border-[color:hsl(var(--accent-warm-hsl)/0.34)]">
              🇮🇳 Made in India
            </span>
          </motion.a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* WhatsApp Share */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShareWhatsApp}
              className="rounded-xl hover:bg-[color:hsl(var(--success)/0.14)] text-success hidden sm:flex"
              title="Share on WhatsApp"
            >
              <MessageCircle className="w-5 h-5" />
            </Button>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleDark}
              className="rounded-xl hover:bg-secondary/80"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-foreground" />
              ) : (
                <Moon className="w-5 h-5 text-foreground" />
              )}
            </Button>

            {/* CTA */}
            <Button
              onClick={onStartWriting}
              className="hidden sm:flex h-10 px-5 rounded-full bg-gradient-to-r from-primary to-primary-active/90 hover:from-primary/90 hover:to-primary shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 font-medium text-sm"
            >
              Start Free ✨
            </Button>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden rounded-xl"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden glass border-t border-border/30"
        >
          <div className="container mx-auto px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors font-medium py-2"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2 flex gap-2">
              <Button
                onClick={() => { onStartWriting(); setMobileMenuOpen(false); }}
                className="flex-1 h-11 rounded-full bg-gradient-to-r from-primary to-primary-active/90 font-medium"
              >
                Start Free ✨
              </Button>
              <Button
                onClick={() => { handleShareWhatsApp(); setMobileMenuOpen(false); }}
                variant="outline"
                className="h-11 rounded-full border-[color:hsl(var(--success)/0.4)] text-success hover:bg-[color:hsl(var(--success)/0.14)]"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
};
