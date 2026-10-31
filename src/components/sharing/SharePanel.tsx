// ============================================================
// NikNote 4.0 — Share Panel & Public Pages
// Notion-style sharing with permissions, public links, QR
// ============================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2, Link2, Copy, Globe, Lock, Users, Eye, Edit3,
  Mail, MessageSquare, X, Check, Sparkles, QrCode, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Permission = 'view' | 'comment' | 'edit';

interface ShareUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  permission: Permission;
}

interface SharePanelProps {
  isOpen: boolean;
  onClose: () => void;
  pageTitle: string;
  isPublic: boolean;
  publicUrl?: string;
  shareUsers: ShareUser[];
  onTogglePublic: () => void;
  onInviteUser: (email: string, permission: Permission) => void;
  onRemoveUser: (userId: string) => void;
  onChangePermission: (userId: string, permission: Permission) => void;
  onCopyLink: () => void;
}

const PERMISSION_LABELS: Record<Permission, { label: string; icon: React.ReactNode; desc: string }> = {
  view: { label: 'Can view', icon: <Eye className="w-3 h-3" />, desc: 'Read only' },
  comment: { label: 'Can comment', icon: <MessageSquare className="w-3 h-3" />, desc: 'View + comment' },
  edit: { label: 'Can edit', icon: <Edit3 className="w-3 h-3" />, desc: 'Full access' },
};

export const SharePanel: React.FC<SharePanelProps> = ({
  isOpen, onClose, pageTitle, isPublic, publicUrl,
  shareUsers, onTogglePublic, onInviteUser, onRemoveUser,
  onChangePermission, onCopyLink
}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<Permission>('view');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const handleCopyLink = useCallback(() => {
    onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopyLink]);

  const handleInvite = useCallback(() => {
    if (!inviteEmail.trim()) return;
    onInviteUser(inviteEmail.trim(), invitePermission);
    setInviteEmail('');
  }, [inviteEmail, invitePermission, onInviteUser]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="fixed right-0 top-0 bottom-0 w-[340px] bg-surface border-l border-subtle shadow-2xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-accent-cool" />
              <h3 className="text-sm font-bold text-fg-primary">Share</h3>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-fg-muted/70">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-fg-muted/70 mt-1 truncate">{pageTitle}</p>
        </div>

        {/* Public sharing toggle */}
        <div className="p-4 border-b border-subtle">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isPublic ? <Globe className="w-4 h-4 text-success" /> : <Lock className="w-4 h-4 text-fg-muted/70" />}
              <div>
                <div className="text-[12px] font-semibold text-fg-primary">
                  {isPublic ? 'Public' : 'Private'}
                </div>
                <div className="text-[10px] text-fg-muted/70">
                  {isPublic ? 'Anyone with the link can view' : 'Only invited people can access'}
                </div>
              </div>
            </div>
            <button
              onClick={onTogglePublic}
              className={cn(
                "w-10 h-5 rounded-full transition-colors relative",
                isPublic ? "bg-success" : "bg-surface-hover"
              )}
            >
              <motion.div
                animate={{ x: isPublic ? 20 : 2 }}
                className="w-4 h-4 rounded-full bg-surface shadow-sm absolute top-0.5"
              />
            </button>
          </div>

          {/* Public link */}
          {isPublic && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2"
            >
              <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-subtle">
                <Link2 className="w-3 h-3 text-fg-muted/70 flex-shrink-0" />
                <span className="text-[10px] text-fg-muted truncate flex-1">
                  {publicUrl || 'niknote.online/p/...'}
                </span>
              </div>
              <button
                onClick={handleCopyLink}
                className={cn(
                  "p-1.5 rounded-lg border transition-colors",
                  copied ? "bg-[color:hsl(var(--success)/0.14)] border-[color:hsl(var(--success)/0.4)] text-success" : "bg-surface border-subtle text-fg-muted hover:bg-muted"
                )}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setShowQR(!showQR)}
                className="p-1.5 rounded-lg border border-subtle text-fg-muted hover:bg-muted"
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {/* Quick share */}
          <div className="flex items-center gap-2 mt-3">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[color:hsl(var(--success)/0.14)] text-success text-[10px] font-medium hover:bg-[color:hsl(var(--success)/0.14)] transition-colors">
              <MessageSquare className="w-3 h-3" /> WhatsApp
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[color:hsl(var(--accent-cool-hsl)/0.14)] text-accent-cool text-[10px] font-medium hover:bg-[color:hsl(var(--accent-cool-hsl)/0.14)] transition-colors">
              <Mail className="w-3 h-3" /> Email
            </button>
          </div>
        </div>

        {/* Invite section */}
        <div className="p-4 border-b border-subtle">
          <h4 className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider mb-2">Invite</h4>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address..."
              className="flex-1 text-[11px] bg-muted rounded-lg px-3 py-2 border border-subtle focus:border-[color:hsl(var(--primary)/0.3)] focus:ring-1 focus:ring-primary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]"
            />
            <select
              value={invitePermission}
              onChange={(e) => setInvitePermission(e.target.value as Permission)}
              className="text-[10px] bg-muted rounded-lg px-2 py-2 border border-subtle outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]"
            >
              <option value="view">View</option>
              <option value="comment">Comment</option>
              <option value="edit">Edit</option>
            </select>
          </div>
          <button
            onClick={handleInvite}
            disabled={!inviteEmail.trim()}
            className="w-full mt-2 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white bg-primary hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send Invite
          </button>
        </div>

        {/* Shared users */}
        <div className="flex-1 overflow-y-auto p-4">
          <h4 className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider mb-2">
            People with access ({shareUsers.length})
          </h4>
          <div className="space-y-2">
            {shareUsers.map(user => (
              <div key={user.id} className="flex items-center gap-2.5 group">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-nk-purple to-nk-rose flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] text-white font-bold">{user.name[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-fg-primary truncate">{user.name}</div>
                  <div className="text-[9px] text-fg-muted/70 truncate">{user.email}</div>
                </div>
                <select
                  value={user.permission}
                  onChange={(e) => onChangePermission(user.id, e.target.value as Permission)}
                  className="text-[9px] bg-muted rounded-md px-1.5 py-1 border border-subtle outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))]"
                >
                  <option value="view">View</option>
                  <option value="comment">Comment</option>
                  <option value="edit">Edit</option>
                </select>
                <button
                  onClick={() => onRemoveUser(user.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[color:hsl(var(--error)/0.14)] text-fg-muted/70 hover:text-error transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* AI suggest */}
        <div className="p-3 border-t border-subtle">
          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-accent-cool bg-[color:hsl(var(--primary)/0.12)] hover:bg-[color:hsl(var(--primary)/0.12)] transition-colors">
            <Sparkles className="w-3.5 h-3.5" />
            AI suggest collaborators
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
