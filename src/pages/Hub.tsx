import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import type { ComponentType } from 'react';
import {
  Activity, BookOpen, CalendarCheck, Combine, FileText, GraduationCap,
  History, Layers, Lightbulb, MessageSquare, PenLine, ScanText, Shapes, Sparkles,
  Sprout, Trophy, User, Wallet, Crown,
} from 'lucide-react';
import { AppDock } from '@/components/AppDock';
import { haptic } from '@/hooks/useHaptics';
import { useAccountName } from '@/hooks/useAccountName';

type HubTone = 'blue' | 'coral' | 'yellow' | 'mint' | 'ink';
type HubItem = {
  to: string;
  label: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
  tone: HubTone;
  logo?: boolean;
};

const TONES: Record<HubTone, { background: string; color: string; border: string }> = {
  blue: { background: '#eaf2ff', color: '#245dcc', border: '#c7d9f5' },
  coral: { background: '#fff0f0', color: '#b92d48', border: '#f2c1c5' },
  yellow: { background: '#fff8dc', color: '#836108', border: '#ebd37d' },
  mint: { background: '#e4f5eb', color: '#247957', border: '#bfdfcc' },
  ink: { background: '#f2f4f8', color: '#30384a', border: '#d8deea' },
};

const GROUPS: { title: string; items: HubItem[] }[] = [
  { title: 'Write & make', items: [
    { to: '/', label: 'Handwriting Notes', desc: 'Type it, make it yours', icon: PenLine, tone: 'coral' },
    { to: '/playground', label: 'Playground', desc: 'Arrange ideas on a little canvas', icon: Shapes, tone: 'blue' },
    { to: '/notebooks', label: 'My Notebooks', desc: 'All your pages in one place', icon: BookOpen, tone: 'blue' },
    { to: '/documents', label: 'Documents', desc: 'Bring in PDFs and images', icon: FileText, tone: 'ink' },
    { to: '/pdf-editor', label: 'PDF Studio', desc: 'Edit, sign and annotate PDFs', icon: PenLine, tone: 'coral' },
    { to: '/pdf-tools', label: 'PDF Tools', desc: 'Merge, convert, OCR and more', icon: Combine, tone: 'yellow' },
    { to: '/scan-notes', label: 'Scan Handwriting', desc: 'Turn a photo into editable text', icon: ScanText, tone: 'mint' },
    { to: '/history', label: 'History', desc: 'Pick up where you left off', icon: History, tone: 'ink' },
  ]},
  { title: 'NikAI & study', items: [
    { to: '/ai', label: 'NikAI', desc: 'Ask, learn and make study notes', icon: Sparkles, tone: 'blue', logo: true },
    { to: '/flashcards', label: 'Flashcards', desc: 'Practice active recall', icon: Layers, tone: 'coral' },
    { to: '/handbook', label: 'Study Handbook', desc: 'Find a steady study workflow', icon: GraduationCap, tone: 'yellow' },
  ]},
  { title: 'Plan your day', items: [
    { to: '/board', label: 'Boards', desc: 'Plan tasks and revision', icon: Lightbulb, tone: 'blue' },
    { to: '/habit', label: 'NikNote Habit', desc: 'Make room for good routines', icon: Sprout, tone: 'mint' },
    { to: '/money', label: 'Money Tracker', desc: 'Keep an eye on your budget', icon: Wallet, tone: 'yellow' },
    { to: '/routine', label: 'Daily Routine', desc: 'Shape a calmer day', icon: CalendarCheck, tone: 'coral' },
    { to: '/achievements', label: 'Achievements', desc: 'See your study milestones', icon: Trophy, tone: 'yellow' },
  ]},
  { title: 'Your account', items: [
    { to: '/account', label: 'Account', desc: 'Profile and settings', icon: User, tone: 'blue' },
    { to: '/upgrade', label: 'Go Premium', desc: 'See plans and extra features', icon: Crown, tone: 'yellow' },
    { to: '/feedback', label: 'Feedback', desc: 'Send a note to the team', icon: MessageSquare, tone: 'coral' },
    { to: '/checkup', label: 'Check-up', desc: 'Test AI, PDF and OCR tools', icon: Activity, tone: 'mint' },
  ]},
];

export default function Hub() {
  const { firstName: name } = useAccountName();
  const reducedMotion = useReducedMotion();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_90%_0%,rgba(255,228,92,.23),transparent_28rem),linear-gradient(155deg,#fffdf5,#f6f9ff_68%,#fff0f0)] pb-12">
      <header className="mx-auto max-w-6xl px-6 pb-7 pt-8 md:px-10 md:pt-10">
        <div className="mb-8 flex items-center gap-3">
          <img src="/images/brand/niknote-primary-mark.png" alt="" aria-hidden="true" className="h-10 w-10 object-contain" />
          <img src="/images/brand/niknote-primary-wordmark.png" alt="NikNote" className="h-9 w-32 object-contain object-left" />
        </div>
        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-medium text-[#68636c]"
        >
          {greet}{name ? `, ${name}` : ''} 👋
        </motion.p>
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 9 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0 } : { delay: 0.05 }}
          className="mt-2 flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <h1 className="font-[Fredoka] text-3xl font-semibold tracking-tight text-[#171313] sm:text-4xl">Your tools, in one place.</h1>
            <p className="mt-1 max-w-xl text-sm text-[#68636c]">A little space to write, study, plan and play.</p>
          </div>
          <Link to="/playground" onClick={() => haptic('light')} className="inline-flex items-center gap-2 rounded-xl border border-[#171313] bg-[#2869d5] px-4 py-2.5 text-sm font-bold text-white shadow-[0_3px_0_#171313] transition-transform hover:-translate-y-0.5">
            <Shapes className="h-4 w-4" /> Open Playground
          </Link>
        </motion.div>
      </header>
      <main className="mx-auto max-w-6xl space-y-9 px-6 pb-10 md:px-10">
        {GROUPS.map((group, groupIndex) => (
          <section key={group.title} aria-labelledby={`hub-${groupIndex}`}>
            <h2 id={`hub-${groupIndex}`} className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#68636c]">
              <span className="h-px w-5 bg-[#ff858f]" />{group.title}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.items.map((item, itemIndex) => {
                const tone = TONES[item.tone];
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.to}
                    initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reducedMotion ? { duration: 0 } : { delay: groupIndex * 0.045 + itemIndex * 0.02, type: 'spring', stiffness: 260, damping: 23 }}
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                    className="h-full"
                  >
                    <Link
                      to={item.to}
                      onClick={() => haptic('light')}
                      className="group block h-full rounded-[19px] border border-[#e0e6f0] bg-white/85 p-4 shadow-[0_3px_10px_rgba(23,19,19,.035)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[#9dbcf0] hover:shadow-[0_8px_20px_rgba(40,105,213,.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#347ff0]"
                    >
                      <div
                        className="mb-3 grid h-11 w-11 place-items-center rounded-[14px] border"
                        style={{ background: item.logo ? '#ffffff' : tone.background, color: tone.color, borderColor: item.logo ? '#c7d9f5' : tone.border }}
                      >
                        {item.logo ? <img src="/nikai-mark.png" alt="" aria-hidden="true" className="h-7 w-auto object-contain" /> : <Icon className="h-5 w-5" />}
                      </div>
                      <p className="text-sm font-bold leading-tight text-[#171313]">{item.label}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#68636c]">{item.desc}</p>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </section>
        ))}
      </main>
      <AppDock />
    </div>
  );
}
