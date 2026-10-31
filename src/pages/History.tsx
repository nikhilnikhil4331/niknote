import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  History, Brain, FileText, Download, Calendar, Clock, 
  ArrowLeft, Loader2, FileOutput, ChevronRight, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';

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
};

const activityLabels: Record<string, string> = {
  ai_document_process: 'AI Processing',
  export_png: 'PNG Export',
  export_pdf: 'PDF Export',
  page_create: 'Page Created',
  page_view: 'Page View',
  page_edit: 'Page Edit',
  notebook_create: 'Notebook Created',
};

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAiRequests: 0,
    totalExports: 0,
    totalPages: 0,
    lastActive: null as string | null,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }

    if (user) {
      fetchActivityHistory();
    }
  }, [user, authLoading, navigate]);

  const fetchActivityHistory = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch user's activity logs
      const { data: activityData, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const mappedActivities = (activityData || []).map(a => ({
        ...a,
        details: (typeof a.details === 'object' && a.details !== null) ? a.details as Record<string, unknown> : {},
      }));
      setActivities(mappedActivities);

      // Calculate stats
      const aiRequests = activityData?.filter(a => a.action === 'ai_document_process').length || 0;
      const exports = activityData?.filter(a => a.action.startsWith('export_')).length || 0;
      const pages = activityData?.filter(a => a.action === 'page_create').length || 0;
      const lastActivity = activityData?.[0]?.created_at || null;

      setStats({
        totalAiRequests: aiRequests,
        totalExports: exports,
        totalPages: pages,
        lastActive: lastActivity,
      });
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-rose" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary-active/60 flex items-center justify-center">
                <History className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold">My History</h1>
                <p className="text-xs text-muted-foreground">Your activity & usage</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-4 text-center">
                <Brain className="w-8 h-8 mx-auto text-accent-rose mb-2" />
                <p className="text-2xl font-bold">{stats.totalAiRequests}</p>
                <p className="text-xs text-muted-foreground">AI Requests</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="border-2 border-[color:hsl(var(--success)/0.2)] bg-gradient-to-br from-success/5 to-success/70/10">
              <CardContent className="p-4 text-center">
                <Download className="w-8 h-8 mx-auto text-success mb-2" />
                <p className="text-2xl font-bold">{stats.totalExports}</p>
                <p className="text-xs text-muted-foreground">Exports</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-2 border-[color:hsl(var(--accent-cool-hsl)/0.2)] bg-gradient-to-br from-nk-purple/5 to-nk-rose/10">
              <CardContent className="p-4 text-center">
                <FileText className="w-8 h-8 mx-auto text-accent-cool mb-2" />
                <p className="text-2xl font-bold">{stats.totalPages}</p>
                <p className="text-xs text-muted-foreground">Pages Created</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="border-2 border-[color:hsl(var(--accent-warm-hsl)/0.2)] bg-gradient-to-br from-nk-warm-700/5 to-nk-rose/10">
              <CardContent className="p-4 text-center">
                <Clock className="w-8 h-8 mx-auto text-accent-warm mb-2" />
                <p className="text-sm font-medium">
                  {stats.lastActive 
                    ? formatDistanceToNow(new Date(stats.lastActive), { addSuffix: true })
                    : 'Never'
                  }
                </p>
                <p className="text-xs text-muted-foreground">Last Active</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Activity Timeline */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4" />
              Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No activity yet</p>
                <p className="text-sm text-muted-foreground/60">Start using the app to see your history here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity, index) => {
                  const IconComponent = activityIcons[activity.action] || History;
                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-start gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <IconComponent className="w-5 h-5 text-accent-rose" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {activityLabels[activity.action] || activity.action}
                        </p>
                        {activity.details && Object.keys(activity.details).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {activity.details.processMode && `Mode: ${activity.details.processMode}`}
                            {activity.details.contentLength && ` • ${activity.details.contentLength} chars`}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{format(new Date(activity.created_at), 'MMM d, yyyy • h:mm a')}</span>
                          {activity.device_type && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{activity.device_type}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
