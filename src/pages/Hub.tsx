import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PenLine, Wallet, CalendarCheck, Layers, Sparkles, BookOpen, FileText, Trophy, User, Crown, History, Bot, MessageSquare, GraduationCap } from 'lucide-react';
import { AppDock } from '@/components/AppDock';
import { haptic } from '@/hooks/useHaptics';
import { useAuth } from '@/contexts/AuthContext';
import { accountName } from '@/lib/accountName';

const GROUPS = [
  { title: 'Write', items: [
    { to: '/', label: 'Handwriting Notes', desc: 'Type → your handwriting', icon: PenLine, hue: 330 },
    { to: '/notebooks', label: 'My Notebooks', desc: 'All your pages', icon: BookOpen, hue: 270 },
    { to: '/documents', label: 'Documents', desc: 'Upload PDF & images', icon: FileText, hue: 210 },
    { to: '/history', label: 'History', desc: 'Recent work', icon: History, hue: 190 },
  ]},
  { title: 'AI', items: [
    { to: '/ai-solver', label: 'AI Solver', desc: 'Step-by-step answers', icon: Sparkles, hue: 285 },
    { to: '/ai', label: 'AI Studio', desc: 'Notes, summaries, more', icon: Bot, hue: 250 },
    { to: '/flashcards', label: 'Flashcards', desc: 'Smart revision', icon: Layers, hue: 20 },
    { to: '/handbook', label: 'Study Handbook', desc: 'Exam prep guides', icon: GraduationCap, hue: 160 },
  ]},
  { title: 'Life', items: [
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
  const { firstName: name } = accountName(user);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background pb-28">
      <header className="px-5 pt-[max(env(safe-area-inset-top),20px)] pb-4 max-w-3xl mx-auto">
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-muted-foreground">{greet}{name ? `, ${name}` : ''} 👋</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Niknote</motion.h1>
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
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
                      style={{ background: `linear-gradient(135deg, hsl(${it.hue} 85% 62%), hsl(${it.hue + 30} 85% 55%))` }}>
                      <it.icon className="w-5 h-5 text-primary-foreground" />
                    </div>
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
