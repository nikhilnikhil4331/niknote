// Unified Slide-Over Panel inside NikNote Editor — powered directly by NikAI!
import React from 'react';
import { NikAIWorkspace } from '@/components/nikai/NikAIWorkspace';

interface AIWorkspacePanelProps {
  onClose: () => void;
  noteTitle: string;
  noteContent: string;
  onInsertContent: (markdown: string) => void;
}

export const AIWorkspacePanel: React.FC<AIWorkspacePanelProps> = ({
  onClose,
  noteTitle,
  noteContent,
  onInsertContent,
}) => {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden border-l border-purple-200/70 shadow-2xl bg-[#FAF8FF]">
      <NikAIWorkspace
        embedded
        onClose={onClose}
        noteTitle={noteTitle}
        noteContent={noteContent}
        onInsertContent={onInsertContent}
      />
    </div>
  );
};

export default AIWorkspacePanel;
