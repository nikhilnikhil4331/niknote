import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const DisclaimerBanner: React.FC = () => {
  return (
    <section className="py-6 bg-muted/50 border-y border-border/50">
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex items-start sm:items-center gap-3 max-w-3xl mx-auto text-center sm:text-left">
          <ShieldCheck className="w-5 h-5 text-accent-rose flex-shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Use responsibly.</strong> NikNote is designed for personal notes, creative projects, and teaching materials. 
            Do not use this tool to violate academic integrity policies or laws. 
            Report misuse at{' '}
            <a href="mailto:abuse@niknote.online" className="text-accent-rose hover:underline">
              abuse@niknote.online
            </a>.
          </p>
        </div>
      </div>
    </section>
  );
};
