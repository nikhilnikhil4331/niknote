import React from 'react';
import { motion } from 'framer-motion';
import { 
  LogIn, LogOut, UserPlus, FileText, Download, 
  CreditCard, Palette, BookOpen, Trash2, Edit,
  Eye, MousePointer, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  category: string;
  details: Record<string, unknown>;
  device_type: string | null;
  page_url: string | null;
  created_at: string;
  display_name?: string;
}

interface AdminActivityFeedProps {
  activities: ActivityLog[];
  loading?: boolean;
}

const actionIcons: Record<string, React.ElementType> = {
  login: LogIn,
  logout: LogOut,
  signup: UserPlus,
  page_view: Eye,
  page_create: FileText,
  page_delete: Trash2,
  page_edit: Edit,
  export_png: Download,
  export_pdf: Download,
  export_zip: Download,
  premium_attempt: CreditCard,
  premium_success: CreditCard,
  mood_change: Palette,
  notebook_create: BookOpen,
  notebook_delete: Trash2,
  button_click: MousePointer,
  feature_use: Zap,
};

const actionColors: Record<string, string> = {
  auth: 'bg-[color:hsl(var(--accent-cool-hsl)/0.1)] text-accent-cool',
  page: 'bg-success/10 text-success',
  export: 'bg-primary/10 text-accent-cool',
  premium: 'bg-nk-warm-600/10 text-accent-warm',
  mood: 'bg-primary/10 text-accent-rose',
  notebook: 'bg-primary/10 text-accent-cool',
  general: 'bg-muted text-muted-foreground',
};

function formatTimeAgo(dateString: string): string {
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
  return date.toLocaleDateString();
}

function formatAction(action: string): string {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const AdminActivityFeed: React.FC<AdminActivityFeedProps> = ({ activities, loading }) => {
  const Icon = (action: string) => actionIcons[action] || Zap;

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Live Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] sm:h-[500px]">
          <div className="p-3 sm:p-4 space-y-2">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">Loading...</div>
            ) : activities.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No activity yet</div>
            ) : (
              activities.map((activity, index) => {
                const IconComponent = Icon(activity.action);
                const colorClass = actionColors[activity.category] || actionColors.general;
                
                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="flex items-start gap-3 p-2 sm:p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {activity.display_name || 'Anonymous'}
                        </span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-sm">{formatAction(activity.action)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {activity.category}
                        </Badge>
                        {activity.device_type && (
                          <Badge variant="outline" className="text-xs">
                            {activity.device_type}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(activity.created_at)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
