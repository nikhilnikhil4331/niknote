import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Calendar, Clock, Smartphone, Monitor, Globe,
  FileText, Download, Crown, Ban, Trash2, Activity,
  ChevronRight, CheckCircle, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UserActivity {
  id: string;
  action: string;
  category: string;
  device_type: string | null;
  created_at: string;
  details: Record<string, unknown>;
}

interface UserDetails {
  id: string;
  display_name: string | null;
  created_at: string;
  is_premium: boolean;
  email?: string;
  last_login?: string;
  pages_created?: number;
  exports?: number;
  device?: string;
}

interface AdminUserDrawerProps {
  user: UserDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onTogglePremium: (userId: string, currentStatus: boolean) => void;
  onBanUser: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
}

export const AdminUserDrawer: React.FC<AdminUserDrawerProps> = ({
  user,
  isOpen,
  onClose,
  onTogglePremium,
  onBanUser,
  onDeleteUser,
}) => {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    pagesCreated: 0,
    exports: 0,
    notebooks: 0,
    lastLogin: '',
  });

  useEffect(() => {
    if (user && isOpen) {
      loadUserDetails(user.id);
    }
  }, [user, isOpen]);

  const loadUserDetails = async (userId: string) => {
    setLoading(true);
    try {
      // Load user activities
      const { data: activityData } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      setActivities((activityData || []).map(a => ({
        ...a,
        details: a.details as Record<string, unknown>
      })));

      // Load user stats
      const [
        { count: pagesCount },
        { count: notebooksCount },
      ] = await Promise.all([
        supabase.from('pages').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('notebooks').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      ]);

      const exportsCount = activityData?.filter(a => a.action?.includes('export')).length || 0;
      const lastLoginActivity = activityData?.find(a => a.action === 'login');

      setStats({
        pagesCreated: pagesCount || 0,
        exports: exportsCount,
        notebooks: notebooksCount || 0,
        lastLogin: lastLoginActivity?.created_at || '',
      });
    } catch (error) {
      console.error('Error loading user details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[400px] lg:w-[480px] bg-background border-l border-border shadow-xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-accent-rose">
                    {(user.display_name || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold text-lg">
                    {user.display_name || 'Unknown User'}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.is_premium ? 'default' : 'secondary'}>
                      {user.is_premium ? 'Premium' : 'Free'}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-secondary/30 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs">Pages Created</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.pagesCreated}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Download className="w-4 h-4" />
                      <span className="text-xs">Total Exports</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.exports}</p>
                  </div>
                </div>

                {/* User Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <User className="w-4 h-4" />
                    User Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Joined
                      </span>
                      <span>{formatDate(user.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Last Login
                      </span>
                      <span>{stats.lastLogin ? formatTimeAgo(stats.lastLogin) : 'Unknown'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Notebooks
                      </span>
                      <span>{stats.notebooks}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Actions
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={user.is_premium ? 'destructive' : 'default'}
                      size="sm"
                      className="flex-col h-auto py-3 gap-1"
                      onClick={() => onTogglePremium(user.id, user.is_premium)}
                    >
                      <Crown className="w-4 h-4" />
                      <span className="text-xs">{user.is_premium ? 'Revoke' : 'Grant'}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-col h-auto py-3 gap-1"
                      onClick={() => onBanUser(user.id)}
                    >
                      <Ban className="w-4 h-4" />
                      <span className="text-xs">Ban</span>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-col h-auto py-3 gap-1"
                      onClick={() => onDeleteUser(user.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-xs">Delete</span>
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Activity Timeline */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Activity Timeline
                  </h3>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No activity found</div>
                  ) : (
                    <div className="space-y-2">
                      {activities.slice(0, 20).map((activity, index) => (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors"
                        >
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">
                                {activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatTimeAgo(activity.created_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs">
                                {activity.category}
                              </Badge>
                              {activity.device_type && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  {activity.device_type === 'mobile' ? (
                                    <Smartphone className="w-3 h-3" />
                                  ) : (
                                    <Monitor className="w-3 h-3" />
                                  )}
                                  {activity.device_type}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
