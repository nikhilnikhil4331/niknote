import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { ComponentType } from 'react';
import { PenLine, Wallet, CalendarCheck, Sprout, Layers, Sparkles, BookOpen, FileText, Trophy, User, Crown, History, Bot, MessageSquare, GraduationCap, Combine } from 'lucide-react';
import { AppDock } from '@/components/AppDock';
import { haptic } from '@/hooks/useHaptics';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountName } from '@/hooks/useAccountName';

type HubItem = {
  to: string;
  label: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
  hue: number;
  logo?: boolean;
};

const GROUPS: { title: string; items: HubItem[] }[] = [
  { title: 'Write', items: [
    { to: '/', label: 'Handwriting Notes', desc: 'Type → your handwriting', icon: PenLine, hue: 330 },
    { to: '/notebooks', label: 'My Notebooks', desc: 'All your pages', icon: BookOpen, hue: 270 },
    { to: '/documents', label: 'Documents', desc: 'Upload PDF & images', icon: FileText, hue: 210 },
    { to: '/pdf-editor', label: 'PDF Studio', desc: 'Edit, sign & annotate PDFs', icon: PenLine, hue: 350 },
    { to: '/pdf-tools', label: 'PDF Tools', desc: 'Word, Excel, OCR, protect, merge', icon: Combine, hue: 0 },
    { to: '/history', label: 'History', desc: 'Recent work', icon: History, hue: 190 },
  ]},
  { title: 'NikAI & Study', items: [
    { to: '/ai', label: 'NikAI', desc: 'Astra Core · Memory · Smart Notes', icon: Sparkles, hue: 280, logo: true },
    { to: '/flashcards', label: 'Flashcards', desc: 'Smart revision decks', icon: Layers, hue: 20 },
    { to: '/handbook', label: 'Study Handbook', desc: 'Exam prep guides', icon: GraduationCap, hue: 160 },
  ]},
  { title: 'Life', items: [
    { to: '/board', label: 'Boards', desc: 'Draw, images, voice', icon: PenLine, hue: 265 },
    { to: '/habit', label: 'Niknote Habit', desc: 'Your daily habit app', icon: Sprout, hue: 290 },
    { to: '/money', label: 'Money Tracker', desc: 'Budget & savings', icon: Wallet, hue: 145 },
    { to: '/routine', label: 'Daily Routine', desc: 'Habits & focus', icon: CalendarCheck, hue: 35 },
    { to: '/achievements', label: 'Achievements', desc: 'Streaks & badges', icon: Trophy, hue: 45 },
  ]},
  { title: 'Account', items: [
    { to: '/account', label: 'Account', desc: 'Profile & settings', icon: User, hue: 220 },
    { to: '/upgrade', label: 'Go Premium', desc: 'Unlock everything', icon: Crown, hue: 40 },
    { to: '/feedback', label: 'Feedback', desc: 'Tell us anything', icon: MessageSquare, hue: 200 },
  ]},
];

export default function Hub() {
  const { user } = useAuth();
  const { firstName: name } = useAccountName();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background pb-28">
      <header className="px-5 pt-[max(env(safe-area-inset-top),20px)] pb-4 max-w-3xl mx-auto">
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">{greet}{name ? `, ${name}` : ''} 👋</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mt-2"><img src="/niknote-logo.png" alt="Niknote" className="h-14 w-44 object-contain object-left" /></motion.h1>
      </header>
      <main className="px-5 max-w-3xl mx-auto space-y-7">
        {GROUPS.map((g, gi) => (
          <section key={g.title}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">{g.title}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {g.items.map((it, i) => (
                <motion.div key={it.to} initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: gi * 0.06 + i * 0.03, type: 'spring', stiffness: 260, damping: 22 }} whileTap={{ scale: 0.94 }}>
                  <Link to={it.to} onClick={() => haptic('light')}
                    className="block h-full rounded-3xl border border-border bg-card/80 backdrop-blur p-4 shadow-sm active:shadow-none">
                    {it.logo ? (
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3 bg-white border border-purple-200/70 shadow-sm">
                        <img src="/nikai-mark.png" alt="" aria-hidden="true" className="h-7 w-auto object-contain select-none" />
                      </div>
                    ) : (
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
                      style={{ background: `linear-gradient(135deg, hsl(${it.hue} 85% 62%), hsl(${it.hue + 30} 85% 55%))` }}>
                      <it.icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    )}
                    <p className="font-semibold text-sm text-foreground leading-tight">{it.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{it.desc}</p>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </main>
      <AppDock />
    </div>
  );
}
