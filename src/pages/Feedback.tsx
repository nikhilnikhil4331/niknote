// ============================================================
// NikNote 4.0 — Feedback Page
// Beautiful feedback form for users
// Saves to Supabase for the support team
// ============================================================

import React, { useState } from 'react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { motion } from 'framer-motion';
import {
  ArrowLeft, MessageSquare, Star, Send, CheckCircle2,
  ThumbsUp, ThumbsDown, Lightbulb, Bug, Sparkles, Heart,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ThankYouBurst } from '@/components/motion/ThankYouBurst';

type FeedbackType = 'suggestion' | 'bug' | 'praise' | 'feature';
type FeedbackCategory = 'editor' | 'ai' | 'handwriting' | 'pdf' | 'mobile' | 'pricing' | 'other';

const feedbackTypes: { id: FeedbackType; label: string; icon: any; color: string }[] = [
  { id: 'suggestion', label: 'Suggestion', icon: Lightbulb, color: 'from-nk-warm-600 to-nk-rose' },
  { id: 'bug', label: 'Bug Report', icon: Bug, color: 'from-error to-nk-rose' },
  { id: 'praise', label: 'Love It!', icon: Heart, color: 'from-nk-rose to-error/70' },
  { id: 'feature', label: 'Feature Request', icon: Sparkles, color: 'from-nk-purple to-nk-rose' },
];

const categories: { id: FeedbackCategory; label: string }[] = [
  { id: 'editor', label: '✍️ Editor' },
  { id: 'ai', label: '🧠 AI Features' },
  { id: 'handwriting', label: '🖊️ Handwriting' },
  { id: 'pdf', label: '📄 PDF Export' },
  { id: 'mobile', label: '📱 Mobile App' },
  { id: 'pricing', label: '💰 Pricing' },
  { id: 'other', label: '📦 Other' },
];

const FeedbackPage = () => {
  useDocumentTitle({ title: 'Feedback — NikNote | Help Us Improve', description: 'Share your feedback on NikNote AI study app. Help us improve for Indian students.' });
  const navigate = useNavigate();
  const { user } = useAuth();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('suggestion');
  const [category, setCategory] = useState<FeedbackCategory>('editor');
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [website, setWebsite] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (website) return;
    setFormError('');
    if (!user) { setFormError('Sign in to submit feedback.'); return; }
    if (localStorage.getItem('niknote_feedback_sent_at') && Date.now() - Number(localStorage.getItem('niknote_feedback_sent_at')) < 60000) {
      setFormError('Please wait a minute before sending another message.'); return;
    }
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!description.trim()) {
      toast.error('Please describe your feedback');
      return;
    }
    if (title.trim().length < 3 || description.trim().length < 10) {
      setFormError('Please enter a title of at least 3 characters and a description of at least 10 characters.');
      return;
    }
    if (rating === 0) {
      toast.error('Please give a rating');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        type: feedbackType,
        rating,
        message: `[${category}] ${title.trim()}\n\n${description.trim()}${email.trim() ? `\n\nReply to: ${email.trim()}` : ''}`,
      });

      if (error) throw error;

      localStorage.setItem('niknote_feedback_sent_at', String(Date.now()));
      setSubmitted(true);
      toast.success('Thank you for your feedback! 🎉');
    } catch (err) {
      console.error('Feedback error:', err);
      toast.error('Something went wrong. Please try again.');
      setFormError('Feedback could not be sent. Please try again or email support@niknote.online.');
    } finally {
      setSubmitting(false);
    }
  };

  // Success State
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-success/70/20 to-primary/5 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="text-center space-y-6 max-w-sm"
        >
          <ThankYouBurst title="Thank you!" subtitle="Your feedback means a lot! We'll use it to make Niknote even better for you." />
          <div className="space-y-3">
              <Button onClick={() => navigate('/')} className="w-full rounded-xl">
              Back to Editor
            </Button>
            <Button
              variant="outline"
              onClick={() => { setSubmitted(false); setTitle(''); setDescription(''); setRating(0); }}
              className="w-full rounded-xl"
            >
              Submit More Feedback
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40 h-14 sm:h-16">
        <div className="max-w-lg mx-auto px-4 h-full flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold truncate">Feedback 💬</h1>
            <p className="text-xs text-muted-foreground truncate">Help us improve NikNote</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-active/60 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="absolute -left-[10000px]" aria-hidden="true"><label htmlFor="feedback-website">Website</label><input id="feedback-website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></div>
          {/* Feedback Type */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-sm font-semibold mb-3">What type of feedback?</h2>
            <div className="grid grid-cols-2 gap-2">
              {feedbackTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFeedbackType(type.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                    feedbackType === type.id
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border/50 bg-card hover:border-border'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${type.color} flex items-center justify-center flex-shrink-0`}>
                    <type.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-xs font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Category */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <h2 className="text-sm font-semibold mb-3">Which area?</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    category === cat.id
                      ? 'border-primary bg-primary/10 text-accent-rose'
                      : 'border-border/50 bg-card text-muted-foreground hover:border-border'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Rating */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h2 className="text-sm font-semibold mb-3">How do you like NikNote?</h2>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`h-9 w-9 transition-colors ${
                      star <= rating
                        ? 'text-accent-warm fill-nk-amber'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="text-sm text-muted-foreground ml-2">
                  {['', 'Poor 😞', 'Fair 😐', 'Good 🙂', 'Great 😊', 'Amazing! 🤩'][rating]}
                </span>
              )}
            </div>
          </motion.div>

          {/* Title */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <h2 className="text-sm font-semibold mb-2">Title</h2>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder={
                feedbackType === 'bug' ? 'e.g. PDF export fails on mobile' :
                feedbackType === 'feature' ? 'e.g. Add dark mode for editor' :
                feedbackType === 'praise' ? 'e.g. Love the handwriting styles!' :
                'e.g. Make AI responses faster'
              }
              className="w-full h-11 px-4 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </motion.div>

          {/* Description */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-sm font-semibold mb-2">Tell us more</h2>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder={
                feedbackType === 'bug'
                  ? 'What happened? What device/browser are you using? Steps to reproduce...'
                  : feedbackType === 'feature'
                  ? 'What feature would you like? How would it help you?'
                  : 'Share your thoughts, ideas, or experience...'
              }
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
            <div className="text-[10px] text-muted-foreground text-right mt-1">
              {description.length}/2000
            </div>
          </motion.div>

          {/* Email */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <h2 className="text-sm font-semibold mb-2">Email (optional)</h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full h-11 px-4 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              We'll only use this to follow up on your feedback
            </p>
          </motion.div>

          {/* Submit */}
          {formError && <p role="alert" className="text-sm text-destructive">{formError} {!user && <a className="underline" href="/login">Sign in</a>}</p>}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim() || rating === 0}
              className="w-full h-13 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-primary to-primary-active/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Submit Feedback
                </>
              )}
            </Button>
          </motion.div>

          {/* Encouragement */}
          <div className="text-center text-xs text-muted-foreground pb-6">
            <Heart className="h-3 w-3 inline text-error" /> Every feedback helps us improve for you
          </div>
        </form>
      </main>
    </div>
  );
};

export default FeedbackPage;
