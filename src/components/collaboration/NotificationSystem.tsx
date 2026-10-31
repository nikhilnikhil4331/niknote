// ============================================================
// NikNote 4.0 — Notification System
// Real-time notification center with types, actions, AI
// ============================================================

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, X, Check, CheckCheck, MessageSquare, AtSign,
  Star, Share2, Sparkles, AlertCircle, Info, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Notification {
  id: string;
  type: 'comment' | 'mention' | 'share' | 'favorite' | 'ai' | 'system' | 'reminder';
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  fromUser?: { name: string; avatar?: string };
  icon?: string;
}

interface NotificationSystemProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onAction: (notification: Notification) => void;
}

const NOTIFICATION_STYLES: Record<Notification['type'], { icon: React.ReactNode; color: string; bg: string }> = {
  comment: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-success', bg: 'bg-[color:hsl(var(--success)/0.14)]' },
  mention: { icon: <AtSign className="w-3.5 h-3.5" />, color: 'text-accent-cool', bg: 'bg-[color:hsl(var(--accent-cool-hsl)/0.14)]' },
  share: { icon: <Share2 className="w-3.5 h-3.5" />, color: 'text-accent-cool', bg: 'bg-[color:hsl(var(--primary)/0.12)]' },
  favorite: { icon: <Star className="w-3.5 h-3.5" />, color: 'text-accent-warm', bg: 'bg-[color:hsl(var(--accent-warm-hsl)/0.16)]' },
  ai: { icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-accent-cool', bg: 'bg-[color:hsl(var(--primary)/0.12)]' },
  system: { icon: <Info className="w-3.5 h-3.5" />, color: 'text-fg-secondary', bg: 'bg-muted' },
  reminder: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'text-accent-warm', bg: 'bg-[color:hsl(var(--accent-warm-hsl)/0.16)]' },
};

const formatTime = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications, onMarkRead, onMarkAllRead, onDismiss, onAction
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !n.read);
    return notifications;
  }, [notifications, filter]);

  return (
    <div className="flex flex-col h-full max-h-[500px]">
      {/* Header */}
      <div className="p-3 border-b border-subtle">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-accent-cool" />
            <h3 className="text-sm font-bold text-fg-primary">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-error text-white">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-[10px] text-accent-cool hover:text-accent-cool font-medium flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" /> Mark all read
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              "flex-1 text-[10px] font-medium py-1 rounded-md transition-colors",
              filter === 'all' ? "bg-surface text-fg-primary shadow-sm" : "text-fg-muted"
            )}
          >All ({notifications.length})</button>
          <button
            onClick={() => setFilter('unread')}
            className={cn(
              "flex-1 text-[10px] font-medium py-1 rounded-md transition-colors",
              filter === 'unread' ? "bg-surface text-fg-primary shadow-sm" : "text-fg-muted"
            )}
          >Unread ({unreadCount})</button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-8 h-8 text-fg-muted/70 mx-auto mb-2" />
            <p className="text-sm text-fg-muted/70">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-subtle">
            {filtered.map((notification, i) => {
              const style = NOTIFICATION_STYLES[notification.type];
              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={cn(
                    "relative px-3 py-3 hover:bg-muted transition-colors group",
                    !notification.read && "bg-[color:hsl(var(--primary)/0.3)]"
                  )}
                >
                  {/* Unread dot */}
                  {!notification.read && (
                    <div className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}

                  <div className="flex items-start gap-2.5 ml-2">
                    {/* Icon */}
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", style.bg, style.color)}>
                      {style.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-fg-primary">{notification.title}</span>
                        <span className="text-[9px] text-fg-muted/70 flex-shrink-0 ml-2">{formatTime(notification.timestamp)}</span>
                      </div>
                      <p className="text-[10px] text-fg-muted mt-0.5 leading-relaxed">{notification.description}</p>

                      {/* Action button */}
                      {notification.actionLabel && (
                        <button
                          onClick={() => onAction(notification)}
                          className="mt-1.5 text-[10px] font-medium text-accent-cool hover:text-accent-cool flex items-center gap-0.5"
                        >
                          {notification.actionLabel} →
                        </button>
                      )}
                    </div>

                    {/* Dismiss */}
                    <button
                      onClick={() => onDismiss(notification.id)}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-hover text-fg-muted/70 hover:text-fg-muted transition-all flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
