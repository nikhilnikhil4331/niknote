import React, { useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import niknoteLogoImg from '@/assets/niknote-logo.png';
import { trackClickCTA, trackStartNoteCreation } from '@/lib/tracking';

/* ───────────────── helpers ───────────────── */
const SectionWrapper: React.FC<{ children: React.ReactNode; className?: string; id?: string }> = ({ children, className = '', id }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 60 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`relative px-6 md:px-12 lg:px-20 ${className}`}
    >
      {children}
    </motion.section>
  );
};

const GlowOrb: React.FC<{ className: string }> = ({ className }) => (
  <div className={`absolute rounded-full blur-[120px] pointer-events-none ${className}`} />
);

/* ───────────────── PAGE ───────────────── */
const PremiumLanding: React.FC = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const goApp = () => {
    trackClickCTA({
      buttonLocation: 'premium_landing_cta',
      conversionSource: 'landing_page',
      pageType: 'landing',
      featureName: 'handwriting_editor',
    });
    trackStartNoteCreation({
      conversionSource: 'landing_page',
      featureName: 'handwriting_editor',
      pageType: 'landing',
    });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-nk-midnight text-white overflow-x-hidden selection:bg-primary/30">
      {/* ──── NAV ──── */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-nk-midnight/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={niknoteLogoImg} alt="NikNote" className="h-10" />
            <span className="text-xl font-extrabold bg-gradient-to-r from-nk-warm-700 via-nk-rose to-nk-amber bg-clip-text text-transparent">NikNote</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/50 font-medium">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#solver" className="hover:text-white transition-colors">AI Solver</a>
            <a href="#power" className="hover:text-white transition-colors">AI Power</a>
          </div>
          <button
            onClick={goApp}
            className="relative group px-5 py-2 rounded-full text-sm font-semibold text-white"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-nk-warm-700 via-nk-rose to-nk-purple opacity-80 group-hover:opacity-100 transition-opacity" />
            <span className="absolute inset-[1.5px] rounded-full bg-nk-midnight" />
            <span className="relative">Try Free</span>
          </button>
        </div>
      </nav>

      {/* ──── HERO ──── */}
      <header ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Halo orbs */}
        <GlowOrb className="w-[700px] h-[700px] bg-nk-warm-600/20 -top-40 left-1/2 -translate-x-1/2" />
        <GlowOrb className="w-[500px] h-[500px] bg-primary/15 top-1/3 -left-40" />
        <GlowOrb className="w-[500px] h-[500px] bg-primary/15 top-1/4 -right-40" />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 text-center max-w-4xl mx-auto px-6">
          {/* Logo Big */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
            className="flex items-center justify-center gap-4 mb-8"
          >
            <img src={niknoteLogoImg} alt="NikNote" className="h-20 sm:h-24 drop-shadow-2xl" style={{ filter: 'drop-shadow(0 0 30px rgba(168,85,247,0.4))' }} />
          </motion.div>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-[color:var(--nk-glass-border)] bg-white/[0.04] text-sm text-white/60"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
            AI-Powered Handwriting Generator
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.8 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.05]"
          >
            <span className="block">NikNote:</span>
            <span className="block mt-2 bg-gradient-to-r from-nk-warm-700 via-nk-rose to-nk-amber bg-clip-text text-transparent">
              Your Notes, Supercharged&nbsp;by&nbsp;AI.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed"
          >
            The ultimate study companion that writes like you and solves like a genius.
          </motion.p>

          {/* CTA */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="mt-10">
            <button
              onClick={goApp}
              className="relative group inline-flex items-center gap-3 px-10 py-4 rounded-full text-lg font-bold text-white"
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-nk-warm-700 via-nk-rose to-nk-purple animate-pulse" />
              <span className="absolute inset-[2px] rounded-full bg-gradient-to-r from-nk-warm-700/90 via-nk-rose/90 to-nk-rose/90 group-hover:from-nk-warm-700 group-hover:via-nk-rose group-hover:to-nk-rose transition-all" />
              <span className="relative flex items-center gap-2">
                ✨ Try NikNote Free
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </span>
            </button>
          </motion.div>

          {/* Social proof */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-12 flex items-center justify-center gap-6 text-sm text-white/30">
            <span className="flex items-center gap-1">
              <strong className="text-white/70">16+</strong>
              <span className="text-white/50">handwriting styles</span>
            </span>
            <span className="w-px h-4 bg-white/10" />
            <span><strong className="text-white/70">300</strong> <span className="text-white/50">DPI export</span></span>
          </motion.div>
        </motion.div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black to-transparent" />
      </header>

      {/* ──── VIDEO SHOWCASE ──── */}
      <SectionWrapper className="py-20 md:py-28">
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-sm font-semibold tracking-widest uppercase text-accent-warm/80">Watch the magic</span>
            <h2 className="mt-3 text-3xl md:text-5xl font-extrabold text-white">
              See NikNote in{' '}
              <span className="bg-gradient-to-r from-nk-warm-700 via-nk-rose to-nk-amber bg-clip-text text-transparent">Action</span>
            </h2>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
          >
            {/* Glow behind video */}
            <div className="absolute -inset-4 bg-gradient-to-r from-nk-warm-700/10 via-nk-rose/10 to-nk-rose/10 blur-2xl rounded-3xl" />
            <video
              autoPlay
              loop
              muted
              playsInline
              className="relative w-full rounded-2xl"
              poster=""
            >
              <source src="/NikNote-Promo.mp4" type="video/mp4" />
            </video>
          </motion.div>
        </div>
      </SectionWrapper>

      {/* ──── FEATURE 1 — HANDWRITING ──── */}
      <SectionWrapper id="features" className="py-32 md:py-40">
        <GlowOrb className="w-[600px] h-[600px] bg-primary/10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold tracking-widest uppercase text-accent-rose/80">Feature 01</span>
            <h2 className="mt-4 text-4xl md:text-6xl font-extrabold">
              It Writes Exactly{' '}
              <span className="bg-gradient-to-r from-nk-warm-700 to-nk-rose bg-clip-text text-transparent">Like You.</span>
            </h2>
            <p className="mt-4 text-white/40 text-lg max-w-xl mx-auto">
              Match your own handwriting with AI, so digital notes feel personal. Upload a sample and NikNote maps its slant, size and spacing.
            </p>
          </div>

          {/* Split-screen demo */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Typed */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-8"
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-error/80" />
                <div className="w-3 h-3 rounded-full bg-nk-warm-600/80" />
                <div className="w-3 h-3 rounded-full bg-success/80" />
                <span className="ml-3 text-xs text-white/30 font-mono">editor.txt</span>
              </div>
              <div className="font-mono text-white/70 text-lg leading-relaxed">
                <TypewriterText text="The quick brown fox jumps over the lazy dog. This is my typed assignment text that I need to convert." />
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-white/20">
                <span className="px-2 py-1 rounded bg-white/10">Typed Input</span>
              </div>
            </motion.div>

            {/* Handwritten */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-nk-warm-700/[0.97] to-nk-rose/[0.95] p-8 relative overflow-hidden"
            >
              {/* Ruled lines */}
              <div className="absolute inset-x-8 top-20 space-y-[28px]">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-px bg-[color:hsl(var(--accent-cool-hsl)/0.3)]" />
                ))}
              </div>
              {/* Margin line */}
              <div className="absolute left-16 top-0 bottom-0 w-px bg-error/30" />

              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-error/80" />
                <div className="w-3 h-3 rounded-full bg-nk-warm-600/80" />
                <div className="w-3 h-3 rounded-full bg-success/80" />
                <span className="ml-3 text-xs text-black/30 font-mono">handwritten.pdf</span>
              </div>
              <div
                className="relative text-xl leading-[28px] text-accent-cool/80"
                style={{ fontFamily: "'Caveat', cursive", transform: 'rotate(-0.5deg)' }}
              >
                The quick brown fox jumps over the lazy dog. This is my typed assignment text that I need to convert.
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-black/20 relative">
                <span className="px-2 py-1 rounded bg-white/10">✨ AI Handwritten Output</span>
              </div>
            </motion.div>
          </div>

          {/* Arrow between cards */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-16 h-16 rounded-full bg-gradient-to-r from-nk-warm-700 to-nk-rose items-center justify-center shadow-2xl shadow-[0_18px_50px_-18px_rgba(163,64,84,0.65)]"
          >
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </motion.div>
        </div>
      </SectionWrapper>

      {/* ──── FEATURE 2 — AI SOLVER ──── */}
      <SectionWrapper id="solver" className="py-32 md:py-40">
        <GlowOrb className="w-[500px] h-[500px] bg-primary/10 top-0 right-0" />
        <GlowOrb className="w-[400px] h-[400px] bg-nk-warm-600/10 bottom-0 left-20" />

        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold tracking-widest uppercase text-accent-cool/80">Feature 02</span>
            <h2 className="mt-4 text-4xl md:text-6xl font-extrabold">
              Stuck? Just Ask{' '}
              <span className="bg-gradient-to-r from-nk-purple to-nk-rose bg-clip-text text-transparent">NikNote.</span>
            </h2>
            <p className="mt-4 text-white/40 text-lg max-w-xl mx-auto">
              From calculus to history, our AI Solver breaks down complex problems in seconds.
            </p>
          </div>

          {/* Solver demo card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl mx-auto rounded-3xl border border-white/10 bg-white/[0.04] overflow-hidden"
          >
            {/* Top bar */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-error/80" />
                <div className="w-3 h-3 rounded-full bg-nk-warm-600/80" />
                <div className="w-3 h-3 rounded-full bg-success/80" />
              </div>
              <span className="text-xs text-white/30 font-mono ml-2">AI Solver — Math Mode</span>
            </div>

            <div className="p-8 space-y-8">
              {/* Question */}
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-6">
                <span className="text-xs text-white/30 uppercase tracking-wider font-semibold">Question</span>
                <p className="mt-3 text-xl text-white/80 font-mono">∫ (3x² + 2x − 5) dx = ?</p>
              </div>

              {/* AI solving animation */}
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                whileInView={{ opacity: 1, height: 'auto' }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-sm text-accent-cool">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                  />
                  AI Solving...
                </div>

                {[
                  { step: 'Step 1', text: 'Apply power rule: ∫xⁿ dx = xⁿ⁺¹/(n+1)', delay: 0.7 },
                  { step: 'Step 2', text: '= 3·(x³/3) + 2·(x²/2) − 5x + C', delay: 0.9 },
                  { step: 'Answer', text: '= x³ + x² − 5x + C', delay: 1.1 },
                ].map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: s.delay }}
                    className={`rounded-lg p-4 ${i === 2 ? 'bg-gradient-to-r from-nk-purple/10 to-nk-rose/10 border border-primary/20' : 'bg-white/[0.04] border border-white/10'}`}
                  >
                    <span className={`text-xs font-semibold uppercase tracking-wider ${i === 2 ? 'text-success' : 'text-white/30'}`}>{s.step}</span>
                    <p className={`mt-1 font-mono ${i === 2 ? 'text-lg text-white font-bold' : 'text-white/60'}`}>{s.text}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </SectionWrapper>

      {/* ──── FEATURE 3 — AI POWER ──── */}
      <SectionWrapper id="power" className="py-32 md:py-40">
        <GlowOrb className="w-[800px] h-[800px] bg-nk-warm-600/[0.07] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <span className="text-sm font-semibold tracking-widest uppercase text-accent-warm/80">Feature 03</span>
          <h2 className="mt-4 text-4xl md:text-6xl font-extrabold">
            Study tools that{' '}
            <span className="bg-gradient-to-r from-nk-warm-700 via-nk-rose to-nk-amber bg-clip-text text-transparent">do the boring part.</span>
          </h2>
          <p className="mt-4 text-white/40 text-lg max-w-xl mx-auto">
            Summarize lectures, organize messy notes, and generate quizzes automatically.
          </p>

          {/* Neural network grid */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '📝', title: 'Smart Summarizer', desc: 'Paste a lecture or chapter and get a shorter, exam-ready version.' },
              { icon: '🧠', title: 'Auto Quiz Generator', desc: 'Create practice questions from any topic. Test yourself instantly.' },
              { icon: '🎤', title: 'Voice Dictation', desc: 'Speak your notes and they appear as text you can style as handwriting.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-left hover:border-white/20 hover:bg-white/[0.07] transition-all duration-500"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-white/40 leading-relaxed">{item.desc}</p>
                {/* Bottom glow on hover */}
                <div className="mt-6 h-px bg-gradient-to-r from-transparent via-nk-rose/0 to-transparent group-hover:via-nk-rose/40 transition-all duration-700" />
              </motion.div>
            ))}
          </div>

          {/* Floating connected orbs — abstract neural network visual */}
          <div className="relative mt-20 h-48 md:h-64">
            {[
              { x: '15%', y: '30%', size: 80, color: 'from-nk-warm-600/30 to-nk-rose/30', delay: 0 },
              { x: '45%', y: '20%', size: 100, color: 'from-nk-rose/30 to-nk-rose/30', delay: 0.3 },
              { x: '75%', y: '40%', size: 70, color: 'from-nk-purple/30 to-nk-rose/30', delay: 0.6 },
              { x: '30%', y: '70%', size: 60, color: 'from-nk-warm-600/20 to-nk-rose/20', delay: 0.9 },
              { x: '60%', y: '65%', size: 90, color: 'from-nk-rose/20 to-nk-rose/20', delay: 1.2 },
            ].map((orb, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: orb.delay, type: 'spring', stiffness: 100 }}
                animate={{ y: [0, -10, 0, 10, 0] }}
                className={`absolute rounded-full bg-gradient-to-br ${orb.color} blur-sm`}
                style={{ left: orb.x, top: orb.y, width: orb.size, height: orb.size }}
              />
            ))}
            {/* Connection lines (SVG) */}
            <svg className="absolute inset-0 w-full h-full" style={{ filter: 'blur(1px)' }}>
              <line x1="15%" y1="30%" x2="45%" y2="20%" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <line x1="45%" y1="20%" x2="75%" y2="40%" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <line x1="30%" y1="70%" x2="60%" y2="65%" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <line x1="45%" y1="20%" x2="30%" y2="70%" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <line x1="75%" y1="40%" x2="60%" y2="65%" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            </svg>
          </div>
        </div>
      </SectionWrapper>

      {/* ──── CTA ──── */}
      <SectionWrapper className="py-32 md:py-40">
        <GlowOrb className="w-[900px] h-[600px] bg-gradient-to-r from-nk-warm-700/15 via-nk-rose/15 to-nk-rose/15 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-extrabold leading-tight">
            Ready to Write{' '}
            <span className="bg-gradient-to-r from-nk-warm-700 via-nk-rose to-nk-amber bg-clip-text text-transparent">Beautifully?</span>
          </h2>
          <p className="mt-6 text-white/40 text-lg">
            NikNote is early and built by one developer in India. Try it free, and tell him what breaks.
          </p>
          <button
            onClick={goApp}
            className="relative group mt-10 inline-flex items-center gap-3 px-12 py-5 rounded-full text-xl font-bold text-white"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-nk-warm-700 via-nk-rose to-nk-purple" />
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-nk-warm-700 via-nk-rose to-nk-purple blur-xl opacity-50 group-hover:opacity-80 transition-opacity" />
            <span className="relative flex items-center gap-2">
              Get Started — It's Free
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </span>
          </button>
        </div>
      </SectionWrapper>

      {/* ──── FOOTER ──── */}
      <footer className="relative border-t border-white/10 py-16 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <img src={niknoteLogoImg} alt="NikNote" className="h-9" />
            <span className="text-sm font-bold text-white/60">NikNote</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/30">
            <a href="#features" className="hover:text-white/60 transition-colors">Features</a>
            <a href="#solver" className="hover:text-white/60 transition-colors">AI Solver</a>
            <a href="#power" className="hover:text-white/60 transition-colors">AI Power</a>
            <button onClick={goApp} className="hover:text-white/60 transition-colors">Open App</button>
            <a href="/privacy" className="hover:text-white/60 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-white/60 transition-colors">Terms</a>
          </div>
          <p className="text-xs text-white/20">© {new Date().getFullYear()} NikNote by Nikhil Jatav. Made with ❤️ in India</p>
        </div>
      </footer>
    </div>
  );
};

/* ── Typewriter sub-component ── */
const TypewriterText: React.FC<{ text: string }> = ({ text }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [displayed, setDisplayed] = React.useState('');

  React.useEffect(() => {
    if (!inView) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [inView, text]);

  return (
    <span ref={ref}>
      {displayed}
      <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="text-accent-warm">|</motion.span>
    </span>
  );
};

export default PremiumLanding;
