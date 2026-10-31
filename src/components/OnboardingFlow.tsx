// ============================================================
// OnboardingFlow — 3-step welcome wizard for new users
// Shows only once, stores completion in localStorage
// ============================================================

import { useState, useEffect } from 'react';
import { Pen, Sparkles, BookOpen, ArrowRight, SkipForward, Check } from 'lucide-react';

const ONBOARDING_KEY = 'niknote-onboarding-complete';

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [selectedFont, setSelectedFont] = useState<string | null>(null);

  const steps = [
    {
      icon: <Pen className="w-12 h-12 text-accent-rose" />,
      title: 'Welcome to NikNote! ✍️',
      description: 'Turn your typed text into beautiful handwritten notes. Perfect for assignments, notes, and more!',
      bg: 'from-nk-purple to-nk-rose dark:from-nk-purple/30 dark:to-nk-rose/30',
    },
    {
      icon: <BookOpen className="w-12 h-12 text-accent-rose" />,
      title: 'Choose Your Style',
      description: 'Pick a handwriting style that feels like yours. You can always change it later!',
      bg: 'from-nk-purple to-nk-rose dark:from-nk-purple/30 dark:to-nk-rose/30',
      isFontPicker: true,
    },
    {
      icon: <Sparkles className="w-12 h-12 text-accent-rose" />,
      title: "You're All Set! 🎉",
      description: 'Start typing and watch your words come alive as handwriting. Try the AI assistant for smart help!',
      bg: 'from-nk-purple to-nk-rose dark:from-nk-purple/30 dark:to-nk-rose/30',
    },
  ];

  const fonts = [
    { name: 'Caveat', class: 'font-handwriting-1', preview: 'Hello World!' },
    { name: 'Kalam', class: 'font-handwriting-2', preview: 'Hello World!' },
    { name: 'Patrick Hand', class: 'font-handwriting-3', preview: 'Hello World!' },
    { name: 'Dancing Script', class: 'font-handwriting-6', preview: 'Hello World!' },
    { name: 'Architects Daughter', class: 'font-handwriting-7', preview: 'Hello World!' },
    { name: 'Indie Flower', class: 'font-handwriting-5', preview: 'Hello World!' },
  ];

  const currentStep = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    if (selectedFont) {
      localStorage.setItem('niknote-preferred-font', selectedFont);
    }
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-3xl bg-gradient-to-br ${currentStep.bg} p-8 text-center animate-spring-in`}>
        {/* Skip button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip <SkipForward className="w-3 h-3" />
          </button>
        </div>

        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-surface/60 dark:bg-surface/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 shadow-soft">
          {currentStep.icon}
        </div>

        {/* Content */}
        <h2 className="text-2xl font-bold text-foreground mb-3">{currentStep.title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">{currentStep.description}</p>

        {/* Font picker for step 2 */}
        {currentStep.isFontPicker && (
          <div className="grid grid-cols-2 gap-2 mb-6">
            {fonts.map((font) => (
              <button
                key={font.name}
                onClick={() => setSelectedFont(font.class)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  selectedFont === font.class
                    ? 'border-primary bg-primary/5 shadow-primary-soft'
                    : 'border-transparent bg-surface/50 dark:bg-surface/5 hover:bg-surface/70'
                }`}
              >
                <span className={`${font.class} text-xl block`}>{font.preview}</span>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {selectedFont === font.class && <Check className="w-3 h-3 inline mr-1 text-accent-rose" />}
                  {font.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-primary' : i < step ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Action button */}
        <button
          onClick={handleNext}
          className="btn-press btn-pill gradient-bg text-white hover:opacity-90 shadow-primary-soft w-full flex items-center justify-center gap-2"
        >
          {step === steps.length - 1 ? (
            <>
              <Sparkles className="w-4 h-4" />
              Start Writing!
            </>
          ) : (
            <>
              Next
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Hook: Check if onboarding is needed
// ============================================================
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // Show onboarding after a small delay for better UX
      setTimeout(() => setShowOnboarding(true), 800);
    }
  }, []);

  const completeOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  };

  return { showOnboarding, completeOnboarding };
}
