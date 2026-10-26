// ============================================================
// NikNote Desktop — Trash (restore / delete forever)
// Cloud notes are parked with folder = '__trash__'; local
// device notes carry trashedAt. Desktop only.
// ============================================================

import React, { useMemo } from 'react';
import { RotateCcw, Trash2, FileText } from 'lucide-react';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { EmptyState } from '@/components/desktop/widgets';
import { useDesktopNotes } from '@/components/desktop/notes';
import { useNoteMeta, timeAgo } from '@/components/desktop/store';

const DesktopTrash: React.FC = () => {
  const { active, trashed, restoreNote, deleteForever } = useDesktopNotes();
  const { meta } = useNoteMeta();

  const folders = useMemo(
    () => Array.from(new Set(active.map((n) => n.folder).filter(Boolean) as string[])),
    [active],
  );

  return (
    <DesktopShell counts={{ notes: active.length, trash: trashed.length }} folders={folders}>
      <div className="mx-auto w-full max-w-[900px] px-8 py-7">
        <div className="nd-anim">
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em]" style={{ color: 'var(--nd-text)' }}>Trash</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--nd-text-3)' }}>
            {trashed.length} note(s) in trash. Restore them back to My Notes or delete forever.
          </p>
        </div>

        <div className="mt-6 pb-10 nd-anim nd-anim-1">
          {trashed.length === 0 ? (
            <EmptyState
              emoji="🗑️"
              title="Trash is empty"
              sub="Notes you delete from My Notes land here first, so nothing is ever lost by accident."
            />
          ) : (
            <div className="nd-card">
              {trashed.map((n, i) => (
                <div
                  key={n.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--nd-border-soft)' }}
                >
                  <span
                    className="flex-none flex items-center justify-center"
                    style={{ width: 32, height: 32, borderRadius: 9, background: `${n.cover}1F`, color: n.cover }}
                  >
                    <FileText size={15} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold truncate" style={{ color: 'var(--nd-text)' }}>{n.title}</span>
                    <span className="block text-[11.5px]" style={{ color: 'var(--nd-text-3)' }}>
                      {meta[n.id]?.prevFolder ? `Was in ${meta[n.id]?.prevFolder} · ` : ''}Last edited {timeAgo(n.updatedAt)}
                    </span>
                  </span>
                  <button
                    className="nd-btn-ghost"
                    onClick={() => void restoreNote(n, meta[n.id]?.prevFolder ?? null)}
                  >
                    <RotateCcw size={13} /> Restore
                  </button>
                  <button
                    className="nd-btn-ghost !text-[#DC2626] hover:!bg-[#FEF2F2] hover:!border-[#FECACA]"
                    onClick={() => {
                      if (window.confirm(`Delete "${n.title}" forever? This cannot be undone.`)) {
                        void deleteForever(n);
                      }
                    }}
                  >
                    <Trash2 size={13} /> Delete forever
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DesktopShell>
  );
};

export default DesktopTrash;
