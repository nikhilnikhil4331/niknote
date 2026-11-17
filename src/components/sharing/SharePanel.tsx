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
import { createShareInviteMailto } from '@/lib/emailInvites';

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
        className="fixed right-0 top-0 bottom-0 w-[340px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#347ff0]" />
              <h3 className="text-sm font-bold text-gray-900">Share</h3>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1 truncate">{pageTitle}</p>
        </div>

        {/* Public sharing toggle */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isPublic ? <Globe className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-gray-400" />}
              <div>
                <div className="text-[12px] font-semibold text-gray-800">
                  {isPublic ? 'Public' : 'Private'}
                </div>
                <div className="text-[10px] text-gray-400">
                  {isPublic ? 'Anyone with the link can view' : 'Only invited people can access'}
                </div>
              </div>
            </div>
            <button
              onClick={onTogglePublic}
              className={cn(
                "w-10 h-5 rounded-full transition-colors relative",
                isPublic ? "bg-green-500" : "bg-gray-300"
              )}
            >
              <motion.div
                animate={{ x: isPublic ? 20 : 2 }}
                className="w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5"
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
              <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                <Link2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-500 truncate flex-1">
                  {publicUrl || 'niknote.online/p/...'}
                </span>
              </div>
              <button
                onClick={handleCopyLink}
                className={cn(
                  "p-1.5 rounded-lg border transition-colors",
                  copied ? "bg-green-50 border-green-200 text-green-600" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                )}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setShowQR(!showQR)}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {/* Quick share */}
          <div className="flex items-center gap-2 mt-3">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-600 text-[10px] font-medium hover:bg-green-100 transition-colors">
              <MessageSquare className="w-3 h-3" /> WhatsApp
            </button>
            <button
              type="button"
              disabled={!isPublic || !publicUrl}
              onClick={() => {
                if (!isPublic || !publicUrl) return;
                window.location.href = createShareInviteMailto({
                  inviterName: 'A NikNote creator',
                  noteTitle: pageTitle,
                  permission: 'view',
                  shareUrl: publicUrl,
                });
              }}
              title={!isPublic || !publicUrl ? 'Make a share link public before emailing it' : 'Open an email draft with this public note link'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Mail className="w-3 h-3" /> Email invite
            </button>
          </div>
        </div>

        {/* Invite section */}
        <div className="p-4 border-b border-gray-100">
          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Invite</h4>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address..."
              className="flex-1 text-[11px] bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 focus:border-[#9dbcf0] focus:ring-1 focus:ring-[#347ff0]/20 outline-none"
            />
            <select
              value={invitePermission}
              onChange={(e) => setInvitePermission(e.target.value as Permission)}
              className="text-[10px] bg-gray-50 rounded-lg px-2 py-2 border border-gray-200 outline-none"
            >
              <option value="view">View</option>
              <option value="comment">Comment</option>
              <option value="edit">Edit</option>
            </select>
          </div>
          <button
            onClick={handleInvite}
            disabled={!inviteEmail.trim()}
            className="w-full mt-2 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white bg-[#2869d5] hover:bg-[#1f56b4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send Invite
          </button>
        </div>

        {/* Shared users */}
        <div className="flex-1 overflow-y-auto p-4">
          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            People with access ({shareUsers.length})
          </h4>
          <div className="space-y-2">
            {shareUsers.map(user => (
              <div key={user.id} className="flex items-center gap-2.5 group">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#347ff0] to-[#c83f58] flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] text-white font-bold">{user.name[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium text-gray-800 truncate">{user.name}</div>
                  <div className="text-[9px] text-gray-400 truncate">{user.email}</div>
                </div>
                <select
                  value={user.permission}
                  onChange={(e) => onChangePermission(user.id, e.target.value as Permission)}
                  className="text-[9px] bg-gray-50 rounded-md px-1.5 py-1 border border-gray-200 outline-none"
                >
                  <option value="view">View</option>
                  <option value="comment">Comment</option>
                  <option value="edit">Edit</option>
                </select>
                <button
                  onClick={() => onRemoveUser(user.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* AI suggest */}
        <div className="p-3 border-t border-gray-100">
          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-[#245dcc] bg-[#eaf2ff] hover:bg-[#dceaff] transition-colors">
            <Sparkles className="w-3.5 h-3.5" />
            AI suggest collaborators
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
