// ============================================================
// NikNote 4.0 — Share Buttons (Touch-Friendly Mobile)
// No Framer Motion on floating button — pure CSS transitions
// ============================================================

import React, { useState } from 'react';
import { Share2, MessageCircle, Twitter, Linkedin, Copy, Check, X, ExternalLink } from 'lucide-react';
import { PROMO_MESSAGES, getShareLinks } from '@/utils/promotion';
import { toast } from 'sonner';

interface ShareButtonsProps {
  variant?: 'floating' | 'inline' | 'compact';
  className?: string;
}

export const ShareButtons: React.FC<ShareButtonsProps> = ({ variant = 'floating', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareLinks = getShareLinks(
    'NikNote — Free AI Study App for Indian Students! 🎓',
    'Check out NikNote! AI teacher, handwriting notes, quizzes & flashcards. 100% Free!'
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText('https://www.niknote.online');
    setCopied(true);
    toast.success('Link copied! Share with classmates 🎓');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    window.open(shareLinks.whatsapp, '_blank');
    toast.success('Share on WhatsApp! 📱');
  };

  const handleTelegram = () => {
    window.open(shareLinks.telegram, '_blank');
    toast.success('Share on Telegram! 📨');
  };

  const handleTwitter = () => {
    window.open(shareLinks.twitter, '_blank');
    toast.success('Share on Twitter! 🐦');
  };

  const shareButtons = [
    { icon: <MessageCircle className="w-5 h-5" />, label: 'WhatsApp', action: handleWhatsApp, color: 'bg-green-500 hover:bg-green-600', textColor: 'text-white' },
    { icon: <ExternalLink className="w-5 h-5" />, label: 'Telegram', action: handleTelegram, color: 'bg-blue-500 hover:bg-blue-600', textColor: 'text-white' },
    { icon: <Twitter className="w-5 h-5" />, label: 'Twitter', action: handleTwitter, color: 'bg-sky-500 hover:bg-sky-600', textColor: 'text-white' },
    { icon: copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />, label: 'Copy Link', action: handleCopy, color: 'bg-gray-600 hover:bg-gray-700', textColor: 'text-white' },
  ];

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {shareButtons.map(btn => (
          <button key={btn.label} onClick={btn.action} className={`p-2 rounded-lg ${btn.color} ${btn.textColor} transition-colors`} title={btn.label}
            style={{ touchAction: 'manipulation', cursor: 'pointer' }}>
            {btn.icon}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {shareButtons.map(btn => (
          <button key={btn.label} onClick={btn.action} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${btn.color} ${btn.textColor} text-xs font-medium transition-colors`}
            style={{ touchAction: 'manipulation', cursor: 'pointer' }}>
            {btn.icon}
            {btn.label}
          </button>
        ))}
      </div>
    );
  }

  // Floating variant — NO Framer Motion, pure CSS
  // Hidden on mobile (< 768px) to avoid blocking bottom nav
  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-6 z-40 w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow active:scale-90 md:flex hidden"
        title="Share NikNote"
        style={{ 
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          cursor: 'pointer',
        }}
      >
        <Share2 className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[60]"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed bottom-20 left-6 z-[61] w-72 bg-white rounded-2xl border border-gray-200 shadow-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Share NikNote 🎓</h3>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-muted/50"
                style={{ touchAction: 'manipulation', cursor: 'pointer' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Share with classmates & friends! Help Indian students study better 📚
            </p>
            <div className="space-y-2">
              {shareButtons.map(btn => (
                <button
                  key={btn.label}
                  onClick={() => { btn.action(); setIsOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${btn.color} ${btn.textColor} text-sm font-medium transition-all active:scale-[0.98]`}
                  style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                >
                  {btn.icon}
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};
