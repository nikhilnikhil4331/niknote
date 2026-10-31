import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Bug, CheckCircle, XCircle, Info, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ErrorLog {
  id: string;
  error_type: string;
  error_message: string;
  component: string | null;
  severity: string;
  resolved: boolean;
  device_type: string | null;
  created_at: string;
}

interface AdminErrorLogsProps {
  errors: ErrorLog[];
  loading?: boolean;
  onResolve: (errorId: string) => void;
  onDismiss: (errorId: string) => void;
}

const severityConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  critical: { icon: XCircle, color: 'text-error', bg: 'bg-error/10' },
  error: { icon: AlertTriangle, color: 'text-accent-warm', bg: 'bg-nk-warm-600/10' },
  warning: { icon: AlertCircle, color: 'text-accent-warm', bg: 'bg-nk-warm-600/10' },
  info: { icon: Info, color: 'text-accent-cool', bg: 'bg-[color:hsl(var(--accent-cool-hsl)/0.1)]' },
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export const AdminErrorLogs: React.FC<AdminErrorLogsProps> = ({
  errors,
  loading,
  onResolve,
  onDismiss,
}) => {
  const unresolvedCount = errors.filter(e => !e.resolved).length;
  
  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Error Logs
          </div>
          {unresolvedCount > 0 && (
            <Badge variant="destructive">{unresolvedCount} unresolved</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] sm:h-[400px]">
          <div className="p-3 sm:p-4 space-y-2">
            {loading ? (
              <div className="text-center text-muted-foreground py-8">Loading...</div>
            ) : errors.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-2" />
                <p className="text-muted-foreground">No errors reported</p>
              </div>
            ) : (
              errors.map((error, index) => {
                const config = severityConfig[error.severity] || severityConfig.error;
                const IconComponent = config.icon;
                
                return (
                  <motion.div
                    key={error.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`p-3 rounded-lg border ${error.resolved ? 'bg-muted/30 opacity-60' : 'bg-secondary/30'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                        <IconComponent className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {error.error_type}
                          </Badge>
                          {error.component && (
                            <Badge variant="secondary" className="text-xs">
                              {error.component}
                            </Badge>
                          )}
                          {error.resolved && (
                            <Badge className="text-xs bg-success">Resolved</Badge>
                          )}
                        </div>
                        <p className="text-sm mt-1 text-muted-foreground line-clamp-2">
                          {error.error_message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(error.created_at)} • {error.device_type || 'Unknown device'}
                          </span>
                          {!error.resolved && (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => onResolve(error.id)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Resolve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-destructive"
                                onClick={() => onDismiss(error.id)}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Dismiss
                              </Button>
                            </div>
                          )}
                        </div>
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
