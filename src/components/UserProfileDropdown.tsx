import React, { useState, forwardRef, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Crown, History, ChevronDown, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePremium } from '@/hooks/usePremium';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

export const UserProfileDropdown = forwardRef<HTMLDivElement>((_, ref) => {
  const { user, signOut } = useAuth();
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();

  // Check admin status
  useEffect(() => {
    if (user) {
      supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
        .then(({ data }) => setIsAdmin(!!data));
    }
  }, [user]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    toast.success('Signed out successfully');
    navigate('/');
  };

  const displayName = user?.user_metadata?.full_name || 
    user?.email?.split('@')[0] || 
    'User';

  const menuItems = [
    { label: 'NikAI', icon: <img src="/nikai-mark.png" alt="" aria-hidden="true" className="h-6 w-auto object-contain" />, onClick: () => navigate('/ai') },
    { label: 'My History', icon: History, onClick: () => navigate('/history') },
    ...(isAdmin ? [{ label: 'Admin Panel', icon: Shield, onClick: () => navigate('/admin-panel-nikhil') }] : []),
    ...(isPremium ? [] : [{ label: 'Upgrade to Premium', icon: Crown, onClick: () => navigate('/payment'), highlight: true }]),
  ];

  // Desktop dropdown content
  const desktopDropdown = (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: 'spring' as const, stiffness: 500, damping: 30, mass: 0.8 }}
      style={{
        position: 'fixed',
        top: 60,
        right: 16,
        zIndex: 99999,
      }}
      className="w-72 rounded-3xl border border-border/50 bg-card/98 backdrop-blur-2xl shadow-2xl shadow-black/20 overflow-hidden"
    >
      {/* User Info Header */}
      <div className="p-5 border-b border-border/50 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
        <div className="flex items-center gap-4">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25"
          >
            <User className="w-7 h-7 text-primary-foreground" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            {isPremium && (
              <span className="inline-flex items-center gap-1 text-xs text-accent mt-1 font-medium">
                <Crown className="w-3 h-3" />
                Premium Member
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-2">
        {menuItems.map((item, index) => (
          <motion.button
            key={index}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setIsOpen(false); item.onClick(); }}
            className={`
              w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all
              ${item.highlight 
                ? 'bg-gradient-to-r from-accent/10 to-accent/5 text-accent hover:from-accent/20 hover:to-accent/10' 
                : 'hover:bg-muted/60 text-foreground'
              }
            `}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.highlight ? 'bg-accent/10' : 'bg-muted'}`}>
              {typeof item.icon === 'function' ? <item.icon className="w-4 h-4" /> : item.icon}
            </div>
            {item.label}
          </motion.button>
        ))}
      </div>

      {/* Sign Out */}
      <div className="p-2 border-t border-border/50">
        <motion.button
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
        >
          <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center">
            <LogOut className="w-4 h-4" />
          </div>
          Sign Out
        </motion.button>
      </div>
    </motion.div>
  );

  // Mobile sheet content (slides up from bottom) - Enhanced for visibility
  const mobileSheet = (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
      }}
      className="rounded-t-3xl border-t border-border/50 bg-card backdrop-blur-2xl shadow-2xl overflow-hidden"
    >
      {/* Handle bar */}
      <div className="flex justify-center py-4">
        <div className="w-12 h-1.5 rounded-full bg-muted-foreground/40" />
      </div>

      {/* User Info Header - Larger for mobile */}
      <div className="px-6 pb-6 border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="flex items-center gap-5">
          <motion.div 
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-xl shadow-primary/30"
          >
            <User className="w-10 h-10 text-primary-foreground" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xl text-foreground truncate">{displayName}</p>
            <p className="text-base text-muted-foreground truncate mt-1">{user?.email}</p>
            {isPremium && (
              <span className="inline-flex items-center gap-1.5 text-sm text-accent-foreground mt-2 font-semibold bg-accent/20 px-3 py-1 rounded-full">
                <Crown className="w-4 h-4" />
                Premium Member
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Menu Items - Large touch targets */}
      <div className="p-4 space-y-2">
        {menuItems.map((item, index) => (
          <motion.button
            key={index}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setIsOpen(false); item.onClick(); }}
            className={`
              w-full flex items-center gap-5 px-5 py-5 rounded-2xl text-lg font-semibold transition-all
              ${item.highlight 
                ? 'bg-gradient-to-r from-accent/15 to-accent/5 text-accent border-2 border-accent/20' 
                : 'bg-muted/50 text-foreground active:bg-muted'
              }
            `}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${item.highlight ? 'bg-accent/20' : 'bg-background'}`}>
              {typeof item.icon === 'function' ? <item.icon className="w-7 h-7" /> : item.icon}
            </div>
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDown className="w-5 h-5 -rotate-90 text-muted-foreground" />
          </motion.button>
        ))}
      </div>

      {/* Sign Out - Prominent destructive button */}
      <div className="p-4 border-t border-border/50 pb-10 safe-area-inset-bottom">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-4 px-5 py-5 rounded-2xl text-lg font-bold text-destructive-foreground bg-destructive hover:bg-destructive/90 active:bg-destructive/80 transition-all shadow-lg shadow-destructive/25"
        >
          <LogOut className="w-6 h-6" />
          Sign Out
        </motion.button>
      </div>
    </motion.div>
  );

  return (
    <div className="relative" ref={ref}>
      <motion.button
        ref={buttonRef}
        whileTap={{ scale: 0.96 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-9 px-3 rounded-2xl bg-secondary/80 hover:bg-secondary border border-border/50 transition-all duration-200"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-sm">
          <User className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
        <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate">
          {displayName}
        </span>
        {isPremium && <Crown className="w-3.5 h-3.5 text-accent" />}
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      {/* Portal-rendered overlay and menu */}
      <AnimatePresence>
        {isOpen && createPortal(
          <>
            {/* Backdrop with blur - covers everything */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99998,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            />
            
            {/* Menu content - mobile sheet or desktop dropdown */}
            {isMobile ? mobileSheet : desktopDropdown}
          </>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
});

UserProfileDropdown.displayName = 'UserProfileDropdown';
