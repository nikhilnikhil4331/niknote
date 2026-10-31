import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, School, GraduationCap, Briefcase, Camera, Wand2, ArrowRight, Check, X, BookOpen, Trophy, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const steps = ["welcome", "usecase", "exam", "handwriting", "ai-demo", "tour"] as const;
type Step = (typeof steps)[number];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("welcome");
  const [useCase, setUseCase] = useState<string | null>(null);
  const [examBoard, setExamBoard] = useState<string | null>(null);
  const [aiTopic, setAiTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
  const stepIdx = steps.indexOf(step);
  const progress = ((stepIdx + 1) / steps.length) * 100;

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  const next = () => {
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  };

  // Skip ends onboarding entirely so the welcome flow never returns.
  const skip = () => {
    localStorage.setItem('niknote_onboarding_done', 'true');
    if (user && !String(user.id).startsWith('local-guest-')) {
      void supabase.from("profiles").update({ onboarding_completed: true } as any).eq("user_id", user.id);
    }
    navigate("/");
  };

  const handleUseCaseSelect = async (uc: string) => {
    setUseCase(uc);
    // save to profile
    if (user && !String(user.id).startsWith('local-guest-')) {
      await supabase
        .from("profiles")
        .update({ use_case: uc } as any)
        .eq("user_id", user.id);
    }
    next();
  };

  const handleExamSelect = async (exam: string) => {
    setExamBoard(exam);
    if (user && !String(user.id).startsWith('local-guest-')) {
      await supabase
        .from("profiles")
        .update({ exam_board: exam } as any)
        .eq("user_id", user.id);
    }
    next();
  };

  const handleHandwritingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/sample_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("handwriting-samples").upload(path, file);
      if (error) throw error;
      toast.success("Handwriting sample uploaded! We'll analyze it shortly.");
      setTimeout(() => next(), 1500);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed, try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleAIDemo = async () => {
    if (!aiTopic.trim()) {
      toast.error("Enter a topic first!");
      return;
    }
    setLoading(true);
    // Simulate AI generation delay, then go to workspace
    setTimeout(() => {
      setLoading(false);
      next();
    }, 2000);
  };

  const finishOnboarding = async () => {
    if (user && !String(user.id).startsWith('local-guest-')) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true } as any)
        .eq("user_id", user.id);
    }
    localStorage.setItem('niknote_onboarding_done', 'true');
    navigate("/");
  };

  const slideVariants = {
    enter: { x: 80, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -80, opacity: 0 },
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-primary-active/70"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Skip button */}
      <div className="flex justify-end p-4">
        {step !== "tour" && (
          <Button variant="ghost" size="sm" onClick={skip} className="text-muted-foreground">
            Skip <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="w-full max-w-md"
          >
            {/* STEP 1: Welcome */}
            {step === "welcome" && (
              <div className="text-center space-y-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary to-primary-active/60 flex items-center justify-center shadow-xl shadow-primary/20"
                >
                  <Sparkles className="w-10 h-10 text-primary-foreground" />
                </motion.div>
                <div>
                  <h1 className="text-2xl font-bold">Welcome to NikNote, {userName}! ✨</h1>
                  <p className="text-muted-foreground mt-2">
                    Let's set up your perfect note-taking experience in 60 seconds.
                  </p>
                </div>
                <Button
                  onClick={next}
                  className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-primary to-primary-active/80 shadow-lg shadow-primary/20"
                >
                  Let's Get Started <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}

            {/* STEP 2: Use Case */}
            {step === "usecase" && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-bold">How do you plan to use NikNote?</h2>
                  <p className="text-sm text-muted-foreground mt-1">This helps us personalize your experience</p>
                </div>
                <div className="space-y-3">
                  {[
                    { id: "school", icon: School, label: "🏫 School Student", desc: "9th – 12th class notes & homework" },
                    { id: "college", icon: GraduationCap, label: "🎓 College Student", desc: "Engineering, Arts, Medical, etc." },
                    { id: "professional", icon: Briefcase, label: "💼 Professional / Teacher", desc: "Work notes, lesson plans, research" },
                  ].map((uc) => (
                    <button
                      key={uc.id}
                      onClick={() => handleUseCaseSelect(uc.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                        useCase === uc.id
                          ? "border-primary bg-primary/5"
                          : "border-border/50 bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <uc.icon className="w-6 h-6 text-accent-rose" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{uc.label}</div>
                        <div className="text-xs text-muted-foreground">{uc.desc}</div>
                      </div>
                      {useCase === uc.id && <Check className="w-5 h-5 text-accent-rose ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: Exam Board */}
            {step === "exam" && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-bold">Which exam are you preparing for?</h2>
                  <p className="text-sm text-muted-foreground mt-1">We'll customize content for your exam</p>
                </div>
                <div className="space-y-3">
                  {[
                    { id: "cbse", icon: BookOpen, label: "📚 CBSE Board", desc: "Class 9-12, NCERT pattern", color: "bg-[color:hsl(var(--accent-cool-hsl)/0.1)] text-accent-cool" },
                    { id: "icse", icon: BookOpen, label: "📖 ICSE/ISC Board", desc: "CISCE curriculum", color: "bg-primary/10 text-accent-cool" },
                    { id: "jee", icon: Trophy, label: "🎯 JEE (Main + Advanced)", desc: "IIT engineering entrance", color: "bg-error/10 text-error" },
                    { id: "neet", icon: Star, label: "🏥 NEET", desc: "Medical entrance exam", color: "bg-success/10 text-success" },
                    { id: "upsc", icon: Briefcase, label: "🏛️ UPSC Civil Services", desc: "IAS, IPS, IFS preparation", color: "bg-nk-warm-600/10 text-accent-warm" },
                    { id: "state", icon: School, label: "🏫 State Board", desc: "UP, Bihar, MP, Rajasthan, etc.", color: "bg-success/10 text-success" },
                    { id: "other", icon: Zap, label: "📋 Other / College", desc: "B.Tech, B.Sc, MBA, etc.", color: "bg-muted/10 text-fg-secondary" },
                  ].map((exam) => (
                    <button
                      key={exam.id}
                      onClick={() => handleExamSelect(exam.id)}
                      className={`w-full flex items-center gap-4 p-3.5 rounded-2xl border-2 transition-all text-left ${
                        examBoard === exam.id
                          ? "border-primary bg-primary/5"
                          : "border-border/50 bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${exam.color}`}>
                        <exam.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{exam.label}</div>
                        <div className="text-xs text-muted-foreground">{exam.desc}</div>
                      </div>
                      {examBoard === exam.id && <Check className="w-5 h-5 text-accent-rose ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: Handwriting */}
            {step === "handwriting" && (
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-nk-warm-700 to-nk-rose flex items-center justify-center shadow-lg">
                  <Camera className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Let's create your digital handwriting!</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    Write the sentence below on a paper and upload a clear photo.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50 font-mono text-sm italic">
                  "The quick brown fox jumps over the lazy dog."
                </div>
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleHandwritingUpload}
                    disabled={uploading}
                  />
                  <div className="w-full h-14 rounded-2xl bg-gradient-to-r from-nk-warm-700 to-nk-rose text-white font-semibold flex items-center justify-center gap-2 cursor-pointer hover:opacity-90 transition-opacity shadow-lg">
                    {uploading ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                          <Sparkles className="w-5 h-5" />
                        </motion.div>
                        Analyzing your handwriting...
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5" />
                        📸 Upload Handwriting Sample
                      </>
                    )}
                  </div>
                </label>
                <Button variant="ghost" onClick={skip} className="text-muted-foreground text-sm">
                  I'll do this later
                </Button>
              </div>
            )}

            {/* STEP 5: AI Demo */}
            {step === "ai-demo" && (
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-nk-purple to-nk-rose flex items-center justify-center shadow-lg">
                  <Wand2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Experience the power of AI</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    What's one topic you want to learn about right now?
                  </p>
                </div>
                <Input
                  placeholder="e.g., Photosynthesis, The French Revolution"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="h-14 rounded-xl text-base"
                />
                <Button
                  onClick={handleAIDemo}
                  disabled={loading || !aiTopic.trim()}
                  className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-nk-purple to-nk-rose text-white shadow-lg"
                >
                  {loading ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                        <Sparkles className="w-5 h-5 mr-2" />
                      </motion.div>
                      Generating Notes...
                    </>
                  ) : (
                    <>Generate Notes for Me ✨</>
                  )}
                </Button>
                <Button variant="ghost" onClick={skip} className="text-muted-foreground text-sm">
                  Skip for now
                </Button>
              </div>
            )}

            {/* STEP 6: Quick Tour */}
            {step === "tour" && (
              <div className="space-y-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="text-6xl"
                >
                  🎉
                </motion.div>
                <div>
                  <h2 className="text-2xl font-bold">You're all set!</h2>
                  <p className="text-muted-foreground mt-2">Here are some quick tips:</p>
                </div>
                <div className="space-y-3 text-left">
                  {[
                    { emoji: "✏️", title: "Block Editor", desc: "Type '/' to see magic commands!" },
                    { emoji: "🧠", title: "AI Solver", desc: "Stuck on a problem? Your AI assistant helps!" },
                    { emoji: "📱", title: "Mobile Navigation", desc: "Switch between writing, styling, preview from the bottom bar." },
                  ].map((tip, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.15 }}
                      className="flex items-start gap-3 p-3 rounded-xl bg-muted/40"
                    >
                      <span className="text-xl">{tip.emoji}</span>
                      <div>
                        <div className="text-sm font-semibold">{tip.title}</div>
                        <div className="text-xs text-muted-foreground">{tip.desc}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <Button
                  onClick={finishOnboarding}
                  className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-primary to-primary-active/80 shadow-lg shadow-primary/20"
                >
                  Got It! Let me explore 🚀
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
