import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * Simple header profile button that navigates directly to /account.
 * No dropdowns, no overlays - just clean navigation.
 */
export const HeaderProfileButton: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const displayName = user?.user_metadata?.full_name || 
    user?.email?.split('@')[0] || 
    'User';

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate('/account')}
      aria-label={`Account: ${displayName}`}
      title={displayName}
      className="nn-profile-button"
    >
      <span className="nn-profile-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
      <ChevronDown aria-hidden="true" />
    </motion.button>
  );
};
