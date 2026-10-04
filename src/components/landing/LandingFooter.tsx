import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Twitter, Github, Mail, Heart, Shield, Star } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  const handleWhatsAppShare = () => {
    const msg = encodeURIComponent(
      '🎓 NikNote — Free AI Study App! AI Teacher + Handwriting Notes + Quiz Generator\nTry free: https://www.niknote.online'
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <footer className="border-t border-border/50 bg-gradient-to-b from-background to-secondary/10">
      {/* Trust & Founder Section */}
      <div className="border-b border-border/30">
        <div className="container mx-auto px-4 lg:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            {/* Founder Card */}
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3">
                <span className="text-xs font-bold text-primary">👨‍💻 Founder & Developer</span>
              </div>
              <h3 className="text-xl font-bold text-foreground">Nikhil Jatav</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Indian developer building tools for Indian students.
                <br />"Padhai ko asaan banana hai — AI se, Hindi mein!"
              </p>
              <div className="flex items-center gap-3 mt-3 justify-center md:justify-start">
                <a href="https://github.com/nikhilnikhil4331" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Github className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="text-center">
              <h4 className="font-semibold text-foreground mb-3 text-sm">Trusted & Secure 🔒</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Shield, label: 'Data Encrypted' },
                  { icon: Star, label: '4.9 Rating' },
                  { icon: Heart, label: 'Made in India' },
                  { icon: Mail, label: '24/7 Support' },
                ].map((badge) => (
                  <div key={badge.label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                    <badge.icon className="w-3 h-3 text-primary" />
                    {badge.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="text-center md:text-right">
              <h4 className="font-semibold text-foreground mb-3 text-sm">NikNote by Numbers 📊</h4>
              <div className="space-y-1.5">
                {[
                  { value: '16+', label: 'Handwriting Styles' },
                  { value: '28+', label: 'AI Subjects' },
                  { value: '9', label: 'AI Agents' },
                  { value: '₹0', label: 'To Get Started' },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-center md:justify-end gap-2 text-sm">
                    <span className="font-bold text-foreground">{stat.value}</span>
                    <span className="text-muted-foreground">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container mx-auto px-4 lg:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img
                src="/niknote-logo.png"
                alt="NikNote"
                className="h-8 w-auto object-contain"
              />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              AI-Powered Study App for Indian Students. Handwriting notes, AI Teacher, Quiz Generator — sab ek jagah!
            </p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-[10px] font-bold text-orange-600 border border-orange-200">
              🇮🇳 Made in India
            </span>
          </div>

          {/* Features */}
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">Features</h4>
            <ul className="space-y-2">
              <li><Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">✍️ Handwriting Notes</Link></li>
              <li><Link to="/ai" className="text-sm text-muted-foreground hover:text-foreground transition-colors">🧠 AI Teacher</Link></li>
              <li><Link to="/ai-solver" className="text-sm text-muted-foreground hover:text-foreground transition-colors">📝 AI Solver</Link></li>
              <li><Link to="/documents" className="text-sm text-muted-foreground hover:text-foreground transition-colors">📄 Document AI</Link></li>
              <li><Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">📚 Blog</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">Resources</h4>
            <ul className="space-y-2">
              <li><Link to="/upgrade" className="text-sm text-muted-foreground hover:text-foreground transition-colors">💎 Premium Plans</Link></li>
              <li><Link to="/landing#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">❓ FAQ</Link></li>
              <li><a href="mailto:support@niknote.online" className="text-sm text-muted-foreground hover:text-foreground transition-colors">📧 Contact Us</a></li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">Connect</h4>
            <div className="space-y-2">
              <button
                onClick={handleWhatsAppShare}
                className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Share on WhatsApp
              </button>
              <a
                href="https://twitter.com/NikNote"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Twitter className="w-4 h-4" />
                Follow on Twitter
              </a>
              <a
                href="https://github.com/nikhilnikhil4331/ink-scribe"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="w-4 h-4" />
                Star on GitHub
              </a>
              <a
                href="mailto:support@niknote.online"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="w-4 h-4" />
                Email Support
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} NikNote. All rights reserved. Founded by Nikhil Jatav.
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
            <Link to="/refunds" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Refund Policy</Link>
            <button type="button" onClick={() => window.dispatchEvent(new Event('niknote:cookie-settings'))} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cookie settings</button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-red-500 fill-red-500" /> in India 🇮🇳 by Nikhil Jatav
          </p>
        </div>
      </div>
    </footer>
  );
};
