// ============================================================
// ShareButtons — WhatsApp, Copy Link, Native Share
// India-first sharing: WhatsApp is #1 priority
// ============================================================

import { useState } from 'react';
import { Share2, Link2, Check, Download } from 'lucide-react';
import { toast } from './Toast';

interface ShareButtonsProps {
  title?: string;
  text?: string;
  url?: string;
  imageBlob?: Blob | null;
  variant?: 'default' | 'compact' | 'icon-only';
  className?: string;
}

export function ShareButtons({
  title = 'My NikNote',
  text = 'Check out my handwritten notes made with NikNote! ✍️',
  url = window.location.href,
  imageBlob,
  variant = 'default',
  className = '',
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  // ============================================================
  // WhatsApp Share — Most used in India!
  // ============================================================
  const shareWhatsApp = async () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`;
    window.open(whatsappUrl, '_blank');
    toast.success('Opening WhatsApp... 📱');
  };

  // ============================================================
  // Copy Link
  // ============================================================
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.copied();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  // ============================================================
  // Native Share API (works on mobile)
  // ============================================================
  const nativeShare = async () => {
    if (!navigator.share) {
      copyLink();
      return;
    }

    try {
      const shareData: ShareData = { title, text, url };
      
      // Add image if available (Web Share API Level 2)
      if (imageBlob && navigator.canShare) {
        const file = new File([imageBlob], 'niknote.png', { type: 'image/png' });
        const dataWithFile = { ...shareData, files: [file] };
        if (navigator.canShare(dataWithFile)) {
          await navigator.share(dataWithFile);
          return;
        }
      }

      await navigator.share(shareData);
    } catch (err) {
      // User cancelled share — not an error
      if ((err as Error).name !== 'AbortError') {
        toast.error('Share failed');
      }
    }
  };

  // ============================================================
  // Compact Variant — For mobile toolbar
  // ============================================================
  if (variant === 'icon-only') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <button
          onClick={shareWhatsApp}
          className="btn-press p-2 rounded-lg hover:bg-[color:hsl(var(--success)/0.14)] dark:hover:bg-success/20 text-success transition-colors"
          title="Share on WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </button>
        <button
          onClick={nativeShare}
          className="btn-press p-2 rounded-lg hover:bg-[color:hsl(var(--accent-cool-hsl)/0.14)] dark:hover:bg-[color:hsl(var(--accent-cool-hsl)/0.2)] text-accent-cool transition-colors"
          title="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={copyLink}
          className="btn-press p-2 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
          title="Copy link"
        >
          {copied ? <Check className="w-4 h-4 text-success" /> : <Link2 className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  // ============================================================
  // Default Variant — Full buttons
  // ============================================================
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {/* WhatsApp — Green, prominent */}
      <button
        onClick={shareWhatsApp}
        className="btn-press flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success hover:bg-success text-white text-sm font-medium transition-colors shadow-sm"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        WhatsApp
      </button>

      {/* Native Share */}
      <button
        onClick={nativeShare}
        className="btn-press flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      {/* Copy Link */}
      <button
        onClick={copyLink}
        className="btn-press flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        {copied ? <Check className="w-4 h-4 text-success" /> : <Link2 className="w-4 h-4" />}
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  );
}

// ============================================================
// Compact Variant — For sidebar/toolbar
// ============================================================
export function ShareButtonsCompact(props: Omit<ShareButtonsProps, 'variant'>) {
  return <ShareButtons {...props} variant="compact" />;
}
