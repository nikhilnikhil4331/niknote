// ============================================================
// NikNote 4.0 — Activity Feed
// Notion-style activity timeline with filters and AI summaries
// ============================================================

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, FileText, Edit3, MessageSquare, Star, Share2,
  Trash2, Plus, Sparkles, ChevronDown, Filter, User,
  ArrowRight, AtSign, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ActivityItem {
  id: string;
  type: 'edit' | 'comment' | 'create' | 'delete' | 'share' | 'favorite' | 'mention' | 'resolve' | 'ai';
  userId: string;
  userName: string;
  pageId: string;
  pageTitle: string;
  description: string;
  timestamp: number;
  metadata?: Record<string, string>;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  onNavigate: (pageId: string) => void;
}

const ACTIVITY_ICONS: Record<ActivityItem['type'], { icon: React.ReactNode; color: string }> = {
  edit: { icon: <Edit3 className="w-3 h-3" />, color: 'bg-blue-100 text-blue-600' },
  comment: { icon: <MessageSquare className="w-3 h-3" />, color: 'bg-green-100 text-green-600' },
  create: { icon: <Plus className="w-3 h-3" />, color: 'bg-[#eaf2ff] text-[#245dcc]' },
  delete: { icon: <Trash2 className="w-3 h-3" />, color: 'bg-red-100 text-red-600' },
  share: { icon: <Share2 className="w-3 h-3" />, color: 'bg-purple-100 text-purple-600' },
  favorite: { icon: <Star className="w-3 h-3" />, color: 'bg-amber-100 text-amber-600' },
  mention: { icon: <AtSign className="w-3 h-3" />, color: 'bg-cyan-100 text-cyan-600' },
  resolve: { icon: <Check className="w-3 h-3" />, color: 'bg-emerald-100 text-emerald-600' },
  ai: { icon: <Sparkles className="w-3 h-3" />, color: 'bg-violet-100 text-violet-600' },
};

const formatTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const groupByDate = (items: ActivityItem[]): { label: string; items: ActivityItem[] }[] => {
  const groups: Record<string, ActivityItem[]> = {};
  const now = new Date();
  
  for (const item of items) {
    const date = new Date(item.timestamp);
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    let label: string;
    if (diffDays === 0) label = 'Today';
    else if (diffDays === 1) label = 'Yesterday';
    else if (diffDays < 7) label = 'This Week';
    else label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
    
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, onNavigate }) => {
  const [filterType, setFilterType] = useState<ActivityItem['type'] | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    if (filterType === 'all') return activities;
    return activities.filter(a => a.type === filterType);
  }, [activities, filterType]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2869d5]" />
            <h3 className="text-sm font-bold text-gray-900">Activity</h3>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              showFilters ? "bg-[#f4f8ff] text-[#245dcc]" : "hover:bg-gray-100 text-gray-400"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Filter chips */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-1 pt-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={cn(
                    "text-[9px] font-medium px-2 py-1 rounded-full transition-colors",
                    filterType === 'all' ? "bg-[#eaf2ff] text-[#245dcc]" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  )}
                >All</button>
                {Object.entries(ACTIVITY_ICONS).map(([type, { icon, color }]) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type as ActivityItem['type'])}
                    className={cn(
                      "text-[9px] font-medium px-2 py-1 rounded-full flex items-center gap-1 transition-colors capitalize",
                      filterType === type ? "bg-[#eaf2ff] text-[#245dcc]" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    )}
                  >
                    {icon} {type}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No activity yet</p>
          </div>
        ) : (
          grouped.map(({ label, items }) => (
            <div key={label}>
              <div className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider sticky top-0 bg-white/80 backdrop-blur-sm">
                {label}
              </div>
              {items.map((item, i) => {
                const iconData = ACTIVITY_ICONS[item.type];
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => onNavigate(item.pageId)}
                    className="w-full flex items-start gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left group"
                  >
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center pt-0.5">
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", iconData.color)}>
                        {iconData.icon}
                      </div>
                      <div className="w-px flex-1 bg-gray-100 mt-1 min-h-[16px]" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-gray-800">{item.userName}</span>
                        <span className="text-[10px] text-gray-400">{item.description}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <FileText className="w-3 h-3 text-gray-300" />
                        <span className="text-[10px] text-gray-500 truncate">{item.pageTitle}</span>
                        <ArrowRight className="w-2.5 h-2.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-[9px] text-gray-300 mt-0.5 block">{formatTime(item.timestamp)}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* AI Summary */}
      <div className="p-3 border-t border-gray-100">
        <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-[#245dcc] bg-[#eaf2ff] hover:bg-[#dceaff] transition-colors">
          <Sparkles className="w-3.5 h-3.5" />
          Summarize recent activity with AI
        </button>
      </div>
    </div>
  );
};
