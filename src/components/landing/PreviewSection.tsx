import React from 'react';
import { motion } from 'framer-motion';

export const PreviewSection: React.FC = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
      
      <div className="container mx-auto px-4 lg:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            See the Magic in Action
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Type on the left, see beautiful handwritten notes appear on the right. 
            It's that simple.
          </p>
        </motion.div>

        {/* Preview Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Browser Chrome */}
          <div className="bg-card rounded-2xl border border-border shadow-2xl shadow-primary/10 overflow-hidden">
            {/* Browser Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-secondary/50 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/70" />
                <div className="w-3 h-3 rounded-full bg-accent/70" />
                <div className="w-3 h-3 rounded-full bg-primary/70" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 bg-background rounded-lg text-xs text-muted-foreground">
                  niknote.online
                </div>
              </div>
            </div>
            
            {/* App Preview */}
            <div className="grid grid-cols-2 gap-0">
              {/* Editor Side */}
              <div className="p-6 border-r border-border bg-background">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="text-accent-rose text-sm">✏️</span>
                    </div>
                    <span className="text-sm font-medium">Type here...</span>
                  </div>
                  {/* Simulated typing lines */}
                  <motion.div 
                    className="h-4 bg-foreground/80 rounded w-3/4"
                    initial={{ width: 0 }}
                    whileInView={{ width: "75%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.5 }}
                  />
                  <motion.div 
                    className="h-4 bg-foreground/60 rounded w-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: "100%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.7 }}
                  />
                  <motion.div 
                    className="h-4 bg-foreground/40 rounded w-2/3"
                    initial={{ width: 0 }}
                    whileInView={{ width: "66%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.9 }}
                  />
                </div>
              </div>
              
              {/* Preview Side */}
              <div className="p-6 bg-paper min-h-[300px]">
                <div className="relative">
                  {/* Paper Lines */}
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(transparent,transparent_31px,hsl(var(--line-color))_31px,hsl(var(--line-color))_32px)]" />
                  
                  {/* Handwritten Text */}
                  <motion.div 
                    className="relative font-handwriting-1 text-xl text-ink-blue space-y-6 pt-2"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 1.2 }}
                  >
                    <p className="transform rotate-[-0.5deg]">Welcome to Nik Note!</p>
                    <p className="transform rotate-[0.3deg]">Your notes, beautifully handwritten</p>
                    <p className="transform rotate-[-0.2deg]">in seconds ✨</p>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-primary/20 to-nk-rose/20 rounded-full blur-2xl" />
          <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-nk-amber/20 to-primary/20 rounded-full blur-2xl" />
        </motion.div>
      </div>
    </section>
  );
};
