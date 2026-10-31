// ============================================================
// NikNote 4.0 — Comments System
// Notion-style inline comments with threads, reactions,
// resolution, and AI-powered suggestions
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Reply, Check, X, MoreHorizontal,
  Smile, AtSign, Sparkles, ThumbsUp, Clock, User,
  ChevronDown, ChevronRight, Trash2, Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Comment {
  id: string;
  blockId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: number;
  updatedAt?: number;
  resolved: boolean;
  reactions: { emoji: string; userIds: string[] }[];
  replies: Reply[];
  aiSuggested?: boolean;
}

export interface Reply {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: number;
}

interface CommentsPanelProps {
  comments: Comment[];
  onAddComment: (blockId: string, content: string) => void;
  onAddReply: (commentId: string, content: string) => void;
  onResolveComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onReactComment: (commentId: string, emoji: string) => void;
  currentUserId?: string;
}

const EMOJI_REACTIONS = ['👍', '❤️', '😊', '🤔', '👋', '✅'];

const formatTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  comments, onAddComment, onAddReply, onResolveComment,
  onDeleteComment, onReactComment, currentUserId
}) => {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [expandedComment, setExpandedComment] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);

  const filteredComments = useMemo(() => {
    switch (filter) {
      case 'open': return comments.filter(c => !c.resolved);
      case 'resolved': return comments.filter(c => c.resolved);
      default: return comments;
    }
  }, [comments, filter]);

  const openCount = comments.filter(c => !c.resolved).length;
  const resolvedCount = comments.filter(c => c.resolved).length;

  const handleAddReply = useCallback((commentId: string) => {
    if (!replyText.trim()) return;
    onAddReply(commentId, replyText.trim());
    setReplyText('');
    setReplyingTo(null);
  }, [replyText, onAddReply]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-subtle">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent-cool" />
            <h3 className="text-sm font-bold text-fg-primary">Comments</h3>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            {openCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[color:hsl(var(--primary)/0.12)] text-accent-cool font-semibold">
                {openCount} open
              </span>
            )}
            {resolvedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[color:hsl(var(--success)/0.14)] text-success font-semibold">
                {resolvedCount} resolved
              </span>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
          {(['all', 'open', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 text-[10px] font-medium py-1 rounded-md transition-colors capitalize",
                filter === f ? "bg-surface text-fg-primary shadow-sm" : "text-fg-muted hover:text-fg-primary"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* New comment input */}
      <div className="p-3 border-b border-subtle">
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-nk-purple to-nk-rose flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] text-white font-bold">U</span>
          </div>
          <div className="flex-1 relative">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="w-full text-xs bg-muted rounded-lg px-3 py-2 border border-subtle focus:border-[color:hsl(var(--primary)/0.3)] focus:ring-1 focus:ring-primary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))] resize-none"
            />
            {newComment.trim() && (
              <button
                onClick={() => { onAddComment('current', newComment.trim()); setNewComment(''); }}
                className="absolute right-2 bottom-2 px-2.5 py-1 rounded-md text-[10px] font-medium text-white bg-primary hover:bg-primary transition-colors"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto">
        {filteredComments.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageSquare className="w-10 h-10 text-fg-muted/70 mx-auto mb-3" />
            <p className="text-sm text-fg-muted/70">No comments yet</p>
            <p className="text-[11px] text-fg-muted/70 mt-1">Select text and comment to start a discussion</p>
          </div>
        ) : (
          <div className="divide-y divide-subtle">
            {filteredComments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-3 transition-colors",
                  comment.resolved && "bg-[color:hsl(var(--success)/0.3)]",
                  comment.aiSuggested && "border-l-2 border-l-purple-300"
                )}
              >
                {/* Comment header */}
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-nk-purple to-nk-rose flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] text-white font-bold">
                      {comment.userName?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-fg-primary">{comment.userName}</span>
                      <span className="text-[10px] text-fg-muted/70">{formatTime(comment.createdAt)}</span>
                      {comment.aiSuggested && (
                        <span className="text-[9px] font-medium px-1 py-0.5 rounded-full bg-[color:hsl(var(--primary)/0.12)] text-accent-cool">AI</span>
                      )}
                      {comment.resolved && (
                        <span className="text-[9px] font-medium px-1 py-0.5 rounded-full bg-[color:hsl(var(--success)/0.14)] text-success">Resolved</span>
                      )}
                    </div>
                    <p className="text-[12px] text-fg-primary mt-0.5 leading-relaxed">{comment.content}</p>

                    {/* Reactions */}
                    {comment.reactions.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {comment.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            onClick={() => onReactComment(comment.id, reaction.emoji)}
                            className={cn(
                              "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors",
                              reaction.userIds.includes(currentUserId || '')
                                ? "bg-[color:hsl(var(--primary)/0.12)] border-[color:hsl(var(--primary)/0.3)] text-accent-cool"
                                : "bg-muted border-subtle text-fg-muted hover:bg-muted"
                            )}
                          >
                            <span>{reaction.emoji}</span>
                            <span className="font-medium">{reaction.userIds.length}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <button
                        onClick={() => setShowReactions(showReactions === comment.id ? null : comment.id)}
                        className="text-[10px] text-fg-muted/70 hover:text-fg-secondary transition-colors"
                      >
                        <Smile className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                        className="text-[10px] text-fg-muted/70 hover:text-fg-secondary transition-colors flex items-center gap-0.5"
                      >
                        <Reply className="w-3 h-3" /> Reply
                      </button>
                      {!comment.resolved && (
                        <button
                          onClick={() => onResolveComment(comment.id)}
                          className="text-[10px] text-success hover:text-success transition-colors flex items-center gap-0.5"
                        >
                          <Check className="w-3 h-3" /> Resolve
                        </button>
                      )}
                    </div>

                    {/* Reaction picker */}
                    <AnimatePresence>
                      {showReactions === comment.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex items-center gap-0.5 mt-1.5 p-1 bg-surface rounded-lg border border-subtle shadow-sm w-fit"
                        >
                          {EMOJI_REACTIONS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => { onReactComment(comment.id, emoji); setShowReactions(null); }}
                              className="w-6 h-6 rounded hover:bg-muted flex items-center justify-center text-sm transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Replies */}
                    {comment.replies.length > 0 && (
                      <div className="mt-2 ml-2 space-y-2 border-l-2 border-subtle pl-3">
                        {comment.replies.map(reply => (
                          <div key={reply.id} className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-surface-hover to-surface-hover flex items-center justify-center flex-shrink-0">
                              <span className="text-[8px] text-white font-bold">{reply.userName?.[0]?.toUpperCase()}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-fg-primary">{reply.userName}</span>
                                <span className="text-[9px] text-fg-muted/70">{formatTime(reply.createdAt)}</span>
                              </div>
                              <p className="text-[11px] text-fg-secondary leading-relaxed">{reply.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply input */}
                    <AnimatePresence>
                      {replyingTo === comment.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 ml-2"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddReply(comment.id); }}
                              placeholder="Reply..."
                              className="flex-1 text-[11px] bg-muted rounded-lg px-2.5 py-1.5 border border-subtle focus:border-[color:hsl(var(--primary)/0.3)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]"
                            />
                            <button
                              onClick={() => handleAddReply(comment.id)}
                              className="px-2 py-1 rounded-md text-[9px] font-medium text-white bg-primary hover:bg-primary"
                            >
                              Send
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* AI suggestion */}
      <div className="p-3 border-t border-subtle">
        <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-accent-cool bg-[color:hsl(var(--primary)/0.12)] hover:bg-[color:hsl(var(--primary)/0.12)] transition-colors">
          <Sparkles className="w-3.5 h-3.5" />
          AI suggest improvements
        </button>
      </div>
    </div>
  );
};
