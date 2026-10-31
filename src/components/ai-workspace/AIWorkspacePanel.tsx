// Unified Slide-Over Panel inside NikNote Editor — STRICTLY closed until explicitly opened!
import React from 'react';
import { NikAIWorkspace } from '@/components/nikai/NikAIWorkspace';

interface AIWorkspacePanelProps {
  isOpen?: boolean;
  onClose: () => void;
  noteTitle?: string;
  noteContent?: string;
  onInsertContent: (markdown: string) => void;
}

export const AIWorkspacePanel: React.FC<AIWorkspacePanelProps> = ({
  isOpen = false,
  onClose,
  noteTitle = '',
  noteContent = '',
  onInsertContent,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[74] bg-[color:var(--nk-scrim)] backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-[75] flex flex-col h-full w-full sm:w-[460px] overflow-hidden border-l border-[color:hsl(var(--primary)/0.7)] shadow-2xl bg-[color:hsl(var(--primary)/0.06)]">
        <NikAIWorkspace
          embedded
          onClose={onClose}
          noteTitle={noteTitle}
          noteContent={noteContent}
          onInsertContent={onInsertContent}
        />
      </div>
    </>
  );
};

export default AIWorkspacePanel;
