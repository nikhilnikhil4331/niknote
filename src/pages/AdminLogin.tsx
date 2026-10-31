import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, User, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if already authenticated
  useEffect(() => {
    const adminToken = sessionStorage.getItem('admin_token');
    const expiresAt = sessionStorage.getItem('admin_expires');
    
    if (adminToken && expiresAt && Date.now() < parseInt(expiresAt)) {
      navigate('/admin-panel-nikhil');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-auth', {
        body: { username, password }
      });

      if (fnError || !data?.success || !data?.token) {
        const msg = data?.error || 'Invalid credentials';
        setError(msg);
        toast.error(msg);
        return;
      }

      sessionStorage.setItem('admin_token', data.token);
      sessionStorage.setItem('admin_expires', data.expiresAt.toString());

      toast.success('Admin access granted');
      navigate('/admin-panel-nikhil');
    } catch (err) {
      console.error('Admin login error:', err);
      setError('Server error. Please try again.');
      toast.error('Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-hover via-surface-hover to-surface-hover flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
      
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-[color:hsl(var(--background-secondary-hsl))] backdrop-blur-2xl border border-active/50 rounded-3xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-error to-nk-rose flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/25"
            >
              <Shield className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-2">Admin Access</h1>
            <p className="text-fg-muted/70 text-sm">Restricted area. Authorized personnel only.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-[color:hsl(var(--error)/0.2)] text-error text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-fg-muted/70 text-sm font-medium">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-muted" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="pl-11 h-12 bg-nk-midnight/50 border-active text-white placeholder:text-fg-muted rounded-xl focus:border-[color:hsl(var(--error)/0.4)] focus:ring-error/20"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-fg-muted/70 text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-muted" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="pl-11 pr-11 h-12 bg-nk-midnight/50 border-active text-white placeholder:text-fg-muted rounded-xl focus:border-[color:hsl(var(--error)/0.4)] focus:ring-error/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-muted/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-error to-nk-rose hover:from-error hover:to-nk-rose text-white font-semibold shadow-lg shadow-red-500/25 transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 mr-2" />
                  Access Admin Panel
                </>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-active/50 text-center">
            <p className="text-fg-muted text-xs">
              This area is monitored. Unauthorized access attempts will be logged.
            </p>
          </div>
        </div>

        {/* Security badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 flex items-center justify-center gap-2 text-fg-muted text-sm"
        >
          <Shield className="w-4 h-4" />
          <span>Secured Connection</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
