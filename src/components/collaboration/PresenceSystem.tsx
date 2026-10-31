// ============================================================
// NikNote 4.0 — Real-time Presence & Cursors
// Notion-style live collaboration with cursor tracking
// Shows who's online and where they're editing
// ============================================================

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Users, Circle, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PresenceUser {
  id: string;
  name: string;
  avatar?: string;
  color: string; // Unique cursor color
  cursor?: { x: number; y: number }; // Cursor position in editor
  selectedBlockId?: string; // Which block they're editing
  lastActive: number;
  status: 'active' | 'idle' | 'offline';
}

interface PresenceSystemProps {
  users: PresenceUser[];
  currentUserId?: string;
  onUserClick?: (userId: string) => void;
}

const STATUS_COLORS = {
  active: 'bg-success',
  idle: 'bg-nk-warm-600',
  offline: 'bg-surface-hover',
};

const PRESENCE_COLORS = [
  '#7C5F9E', '#A34054', '#157F52', '#C4762F',
  '#7C5F9E', '#7C5F9E', '#A62B36', '#157F52',
];

export const PresenceSystem: React.FC<PresenceSystemProps> = ({
  users, currentUserId, onUserClick
}) => {
  const activeUsers = useMemo(() => users.filter(u => u.status !== 'offline'), [users]);
  const otherUsers = useMemo(() => activeUsers.filter(u => u.id !== currentUserId), [activeUsers, currentUserId]);

  return (
    <>
      {/* ===== Floating cursors ===== */}
      <AnimatePresence>
        {otherUsers
          .filter(u => u.cursor && u.status === 'active')
          .map(user => (
            <motion.div
              key={`cursor-${user.id}`}
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: 1,
                x: user.cursor!.x,
                y: user.cursor!.y,
              }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="fixed z-50 pointer-events-none"
              style={{ left: user.cursor!.x, top: user.cursor!.y }}
            >
              <MousePointer2
                className="w-4 h-4"
                style={{ color: user.color, fill: user.color }}
              />
              <div
                className="text-[9px] font-medium text-white px-1.5 py-0.5 rounded-md mt-0.5 whitespace-nowrap shadow-sm"
                style={{ backgroundColor: user.color }}
              >
                {user.name}
              </div>
            </motion.div>
          ))
        }
      </AnimatePresence>

      {/* ===== Presence bar (bottom-right) ===== */}
      {otherUsers.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface/80 backdrop-blur-xl border border-subtle/60 shadow-lg">
          {/* User avatars */}
          <div className="flex -space-x-1.5">
            {otherUsers.slice(0, 5).map(user => (
              <motion.button
                key={user.id}
                whileHover={{ scale: 1.1, y: -2 }}
                onClick={() => onUserClick?.(user.id)}
                className="relative"
              >
                <div
                  className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name[0]?.toUpperCase()}
                </div>
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white",
                  STATUS_COLORS[user.status]
                )} />
              </motion.button>
            ))}
            {otherUsers.length > 5 && (
              <div className="w-7 h-7 rounded-full border-2 border-white bg-surface-hover flex items-center justify-center text-[8px] font-bold text-fg-secondary shadow-sm">
                +{otherUsers.length - 5}
              </div>
            )}
          </div>

          {/* Label */}
          <div className="flex items-center gap-1 text-[10px] text-fg-muted">
            <Eye className="w-3 h-3" />
            <span>{otherUsers.length} {otherUsers.length === 1 ? 'person' : 'people'} viewing</span>
          </div>
        </div>
      )}

      {/* ===== Block-level presence indicators ===== */}
      {otherUsers
        .filter(u => u.selectedBlockId && u.status === 'active')
        .map(user => (
          <style key={`block-highlight-${user.id}`}>
            {`
              [data-block-id="${user.selectedBlockId}"] {
                position: relative;
              }
              [data-block-id="${user.selectedBlockId}"]::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                border-left: 2px solid ${user.color};
                background: ${user.color}11;
                pointer-events: none;
                border-radius: 4px;
              }
            `}
          </style>
        ))
      }
    </>
  );
};

// Helper to generate a presence user
export function createPresenceUser(
  id: string,
  name: string,
  overrides?: Partial<PresenceUser>
): PresenceUser {
  const colorIndex = Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % PRESENCE_COLORS.length;
  return {
    id,
    name,
    color: PRESENCE_COLORS[colorIndex],
    lastActive: Date.now(),
    status: 'active',
    ...overrides,
  };
}
