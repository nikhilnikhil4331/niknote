import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PenTool, Mail, Lock, User, ArrowRight, Sparkles, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useNavigate, Link } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const { signUp, signInWithGoogle, signInWithGitHub, user, loading: authLoading } = useAuth();
  const { playClick, playSuccess } = useSoundEffects();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleGoogleSignIn = useCallback(async () => {
    playClick();
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast.error(error.message);
      }
    } catch (err) {
      console.error('Google sign in error:', err);
      toast.error('Google sign-in fail. Email ya GitHub try karo!');
    } finally {
      setGoogleLoading(false);
    }
  }, [playClick, signInWithGoogle]);

  const handleGitHubSignIn = useCallback(async () => {
    playClick();
    setGithubLoading(true);
    try {
      const { error } = await signInWithGitHub();
      if (error) {
        toast.error(error.message);
      }
    } catch (err) {
      console.error('GitHub sign in error:', err);
      toast.error('GitHub sign-in fail. Email try karo!');
    } finally {
      setGithubLoading(false);
    }
  }, [playClick, signInWithGitHub]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (website) return;
    if (fullName.trim().length < 2 || password.length < 8) {
      toast.error('Enter your name and a password of at least 8 characters.');
      return;
    }
    playClick();
    setLoading(true);

    try {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        // Handle specific error cases
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please sign in instead.');
        } else {
          toast.error(error.message);
        }
      } else {
        playSuccess();
        toast.success('Account created! Welcome aboard.');
        navigate('/account');
      }
    } catch (err) {
      console.error('Signup error:', err);
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Sparkles className="w-8 h-8 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <motion.div 
          className="text-center mb-8"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden">
            <img src="/niknote-logo.png" alt="NikNote" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Create Account</h1>
          <p className="text-muted-foreground">Join NikNote and transform your handwriting</p>
        </motion.div>

        {/* Signup Card */}
        <motion.div
          className="bg-card rounded-3xl border border-border shadow-2xl shadow-primary/5 p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="absolute -left-[10000px]" aria-hidden="true"><label htmlFor="signup-website">Website</label><input id="signup-website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></div>
            {/* Google Sign Up Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full h-12 rounded-xl bg-background hover:bg-muted text-foreground border-border font-medium transition-all duration-300 flex items-center justify-center gap-3"
            >
              {googleLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-5 h-5" />
                </motion.div>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleGitHubSignIn}
              disabled={githubLoading || loading}
              className="w-full h-12 rounded-xl bg-gray-900 hover:bg-gray-800 text-white border-gray-700 font-medium transition-all duration-300 flex items-center justify-center gap-3"
            >
              {githubLoading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles className="w-5 h-5" />
                </motion.div>
              ) : (
                <>
                  <Github className="w-5 h-5" />
                  Continue with GitHub
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or sign up with email</span>
              </div>
            </div>

            <div>
              <Label htmlFor="name" className="text-sm font-medium text-foreground mb-2 block">
                Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  className="pl-12 h-12 rounded-xl bg-muted/50 border-0 focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-foreground mb-2 block">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="pl-12 h-12 rounded-xl bg-muted/50 border-0 focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium text-foreground mb-2 block">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pl-12 h-12 rounded-xl bg-muted/50 border-0 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/25"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-5 h-5" />
                </motion.div>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">By creating an account, you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="text-primary font-medium hover:underline"
                onClick={playClick}
              >
                Sign In
              </Link>
            </p>
          </div>

          {/* Features preview */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-center text-sm text-muted-foreground mb-4">What you'll get:</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                'AI Handwriting Analysis',
                'Unlimited Notebooks',
                'PDF Export',
                'Cloud Sync',
              ].map((feature, i) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {feature}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="mt-6 text-center">
          <Link 
            to="/" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={playClick}
          >
            ← Back to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
