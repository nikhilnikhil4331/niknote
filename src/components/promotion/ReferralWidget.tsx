import React, { useState } from 'react';
import { Check, Copy, MessageCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';

// Sharing is optional and does not promise a reward: the old local-only
// counter could not actually grant premium access.
export const ReferralWidget: React.FC<{ variant?: 'banner' | 'card' | 'compact' }> = ({ variant = 'card' }) => {
  const [copied, setCopied] = useState(false);
  const url = 'https://www.niknote.online/welcome';
  const text = 'Try NikNote for handwriting-style notes and study tools: ' + url;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };
  return (
    <section className={`rounded-2xl border border-border/60 bg-card p-4 ${variant === 'compact' ? 'text-xs' : ''}`} aria-label="Share NikNote">
      <div className="flex items-start gap-3">
        <Share2 className="h-5 w-5 text-accent-rose shrink-0" />
        <div className="flex-1 space-y-2">
          <h3 className="font-semibold text-sm">Share NikNote</h3>
          <p className="text-xs text-muted-foreground">Know someone who would like the free editor? Send them a link.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? 'Copied' : 'Copy link'}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium">
              <MessageCircle className="h-3 w-3" />WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
