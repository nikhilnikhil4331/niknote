import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  User, Brain, FileText, Download, Calendar,
  ArrowLeft, Loader2, FileOutput, ChevronRight, Sparkles,
  LogOut, Crown, Settings, Monitor, Smartphone, Tablet,
  Mail, History, PenTool, Image, FileImage, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { usePremium } from '@/hooks/usePremium';
import { ReferralWidget } from '@/components/promotion/ReferralWidget';
import { StudyStreakWidget } from '@/components/gamification/StudyStreak';

interface ActivityItem {
  id: string;
  action: string;
  category: string;
  details: Record<string, unknown> | null;
  created_at: string;
  page_url: string | null;
  device_type: string | null;
}

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  ai_document_process: Brain,
  export_png: Download,
  export_pdf: FileOutput,
  page_create: FileText,
  page_view: History,
  image_upload: Image,
  handwriting_analyze: PenTool,
};

const activityLabels: Record<string, string> = {
  ai_document_process: 'AI Processing',
  export_png: 'PNG Export',
  export_pdf: 'PDF Export',
  page_create: 'Page Created',
  page_view: 'Page View',
  page_edit: 'Page Edit',
  notebook_create: 'Notebook Created',
  image_upload: 'Image Upload',
  handwriting_analyze: 'Handwriting Analysis',
};

const modeLabels: Record<string, string> = {
  solve: 'Solve',
  essay: 'Essay',
  summarize: 'Summary',
  improve: 'Improve',
  explain: 'Explain',
  rewrite: 'Rewrite',
  notes: 'Notes',
  template: 'Template',
};

const deviceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

export default function AccountPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('niknote_openai_key') || '');
  const [stats, setStats] = useState({
    totalAiRequests: 0,
    totalExports: 0,
    totalUploads: 0,
    totalPages: 0,
    totalNotebooks: 0,
    lastActive: null as string | null,
    memberSince: null as string | null,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }

    if (user) {
      fetchAccountData();
    }
  }, [user, authLoading, navigate]);

  const fetchAccountData = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    try {
      // Fetch user's activity logs and notebook count in parallel
      const [activityResult, notebooksResult] = await Promise.all([
        supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('notebooks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

      if (activityResult.error) throw activityResult.error;

      const activityData = activityResult.data;
      const mappedActivities = (activityData || []).map(a => ({
        ...a,
        details: (typeof a.details === 'object' && a.details !== null) ? a.details as Record<string, unknown> : {},
      }));
      setActivities(mappedActivities);

      // Calculate stats
      const aiRequests = activityData?.filter(a => a.action === 'ai_document_process').length || 0;
      const exports = activityData?.filter(a => a.action.startsWith('export_')).length || 0;
      const uploads = activityData?.filter(a => a.action === 'image_upload' || a.action === 'handwriting_analyze').length || 0;
      const pages = activityData?.filter(a => a.action === 'page_create').length || 0;
      const lastActivity = activityData?.[0]?.created_at || null;

      setStats({
        totalAiRequests: aiRequests,
        totalExports: exports,
        totalUploads: uploads,
        totalPages: pages,
        totalNotebooks: notebooksResult.count || 0,
        lastActive: lastActivity,
        memberSince: user.created_at || null,
      });
    } catch (err) {
      console.error('Failed to fetch account data:', err);
      setError('Failed to load your activity. Please try again.');
      toast.error('Failed to load activity data');
    } finally {
      setLoading(false);
    }
  };

  // Activity skeleton loader
  const ActivitySkeleton = () => (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-start gap-4 p-4 rounded-2xl">
          <Skeleton className="w-12 h-12 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/');
  };

  const handleSaveApiKey = () => {
    if (openaiKey.trim()) {
      localStorage.setItem('niknote_openai_key', openaiKey.trim());
      toast.success('🔑 API Key saved! AI agents now powered by OpenAI.');
    } else {
      localStorage.removeItem('niknote_openai_key');
      toast.success('📴 API Key removed. Using built-in knowledge base.');
    }
  };

  const displayName = user?.user_metadata?.full_name || 
    user?.email?.split('@')[0] || 
    'User';

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">My Account</h1>
                <p className="text-xs text-muted-foreground">Manage your profile & history</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/ai-solver')} className="gap-2">
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">AI Solver</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Referral Widget */}
        {user && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <ReferralWidget variant="card" />
          </motion.div>
        )}

        {/* Study Streak Widget */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <StudyStreakWidget />
        </motion.div>

        {/* User Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-2 overflow-hidden">
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-xl shadow-primary/25"
                >
                  <User className="w-12 h-12 sm:w-14 sm:h-14 text-primary-foreground" />
                </motion.div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{displayName}</h2>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">{user?.email}</span>
                  </div>
                  {stats.memberSince && (
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Member since {format(new Date(stats.memberSince), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {isPremium ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-accent mt-3 font-semibold bg-accent/10 px-3 py-1.5 rounded-full">
                      <Crown className="w-4 h-4" />
                      Premium Member ✨
                    </span>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={() => navigate('/payment')}
                      className="mt-3 gap-2 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:from-orange-400 hover:via-pink-400 hover:to-purple-500 text-white font-bold shadow-lg shadow-purple-500/20"
                    >
                      <Crown className="w-4 h-4" />
                      Upgrade to Premium — ₹49/week
                    </Button>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="hidden sm:flex"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 hover:shadow-lg hover:shadow-primary/10 transition-shadow">
              <CardContent className="p-4 sm:p-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <p className="text-3xl font-bold">{stats.totalAiRequests}</p>
                <p className="text-xs text-muted-foreground mt-1">AI Requests</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/10 transition-shadow">
              <CardContent className="p-4 sm:p-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                  <Download className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-3xl font-bold">{stats.totalExports}</p>
                <p className="text-xs text-muted-foreground mt-1">Exports</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-500/10 hover:shadow-lg hover:shadow-blue-500/10 transition-shadow">
              <CardContent className="p-4 sm:p-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                  <FileImage className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-3xl font-bold">{stats.totalUploads}</p>
                <p className="text-xs text-muted-foreground mt-1">Uploads</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-purple-500/10 hover:shadow-lg hover:shadow-purple-500/10 transition-shadow">
              <CardContent className="p-4 sm:p-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-purple-500" />
                </div>
                <p className="text-3xl font-bold">{stats.totalNotebooks}</p>
                <p className="text-xs text-muted-foreground mt-1">Notebooks</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Activity Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-primary" />
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ActivitySkeleton />
              ) : error ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-destructive" />
                  </div>
                  <p className="text-muted-foreground font-medium">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchAccountData}
                    className="mt-4 gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </Button>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground font-medium">No activity yet</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Start using the app to see your history here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.slice(0, 20).map((activity, index) => {
                    const IconComponent = activityIcons[activity.action] || History;
                    const DeviceIcon = deviceIcons[activity.device_type || 'desktop'] || Monitor;
                    const modeLabel = activity.details?.processMode 
                      ? modeLabels[activity.details.processMode as string] || activity.details.processMode 
                      : null;

                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="flex items-start gap-4 p-4 rounded-2xl hover:bg-muted/40 transition-colors group"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                          <IconComponent className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">
                              {activityLabels[activity.action] || activity.action}
                            </p>
                            {modeLabel && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                                {String(modeLabel)}
                              </span>
                            )}
                          </div>
                          {activity.details && Object.keys(activity.details).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {activity.details.contentLength && `${String(activity.details.contentLength)} characters`}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>{format(new Date(activity.created_at), 'MMM d, yyyy • h:mm a')}</span>
                            {activity.device_type && (
                              <span className="flex items-center gap-1">
                                <DeviceIcon className="w-3 h-3" />
                                <span className="capitalize">{activity.device_type}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Settings Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="border-2 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Add your OpenAI API key to unlock full AI power. Without a key, NikNote uses a built-in knowledge base with 20+ topics for Indian students.
              </p>
              
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">OpenAI API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="flex-1 h-10 px-3 rounded-xl bg-muted/30 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveApiKey}
                    className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4"
                  >
                    Save
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  🔒 Key is stored locally in your browser only. Never sent to our servers.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                <h4 className="text-xs font-semibold text-purple-900 mb-1">🧠 Current AI Status</h4>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${openaiKey ? 'bg-green-500' : 'bg-amber-500'}`} />
                    <span className="text-[11px] text-purple-800">
                      {openaiKey ? 'Full AI Mode — Unlimited responses' : 'Local Mode — 20+ built-in topics + smart templates'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-[11px] text-purple-800">9 AI Agents active (Teacher, Notes, Quiz, etc.)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-[11px] text-purple-800">Hinglish support enabled</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                <h4 className="text-xs font-semibold mb-1">📚 Built-in Topics (No API needed)</h4>
                <div className="flex flex-wrap gap-1">
                  {['Newton\'s Laws', 'Photosynthesis', 'Pythagoras', 'Thermodynamics', 'Gravity', 'Electricity', 'Cell Biology', 'Periodic Table', 'Trigonometry', 'Quadratic', 'Probability', 'Chemical Reactions', 'Algebra', 'Digestion', 'Magnetism', 'Light & Optics', 'Indian History', 'English Grammar', 'Ecology', 'Statistics', 'Work & Energy', 'Acids & Bases', 'Sound', 'Coordinate Geometry', 'Reproduction', 'Force & Pressure', 'Programming', 'Constitution'].map(t => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-primary/5 text-primary border border-primary/10">{t}</span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sign Out Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            variant="outline"
            size="lg"
            onClick={handleSignOut}
            className="w-full h-14 rounded-2xl text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground transition-all"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
