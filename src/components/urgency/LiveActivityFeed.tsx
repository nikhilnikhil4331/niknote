import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Crown, Zap } from 'lucide-react';

// Simulated real-time activity for social proof
const activities = [
  { name: 'Rahul', city: 'Delhi', action: 'upgraded to Premium', icon: Crown, time: '2 min ago' },
  { name: 'Priya', city: 'Mumbai', action: 'started free trial', icon: Zap, time: '5 min ago' },
  { name: 'Amit', city: 'Patna', action: 'upgraded to Student Pro', icon: Crown, time: '8 min ago' },
  { name: 'Sneha', city: 'Jaipur', action: 'upgraded to Premium', icon: Crown, time: '12 min ago' },
  { name: 'Vikram', city: 'Lucknow', action: 'started free trial', icon: Zap, time: '15 min ago' },
  { name: 'Ananya', city: 'Hyderabad', action: 'upgraded to Premium', icon: Crown, time: '18 min ago' },
  { name: 'Arjun', city: 'Bangalore', action: 'started free trial', icon: Zap, time: '22 min ago' },
  { name: 'Kavita', city: 'Chennai', action: 'upgraded to Student Pro', icon: Crown, time: '25 min ago' },
  { name: 'Deepak', city: 'Kolkata', action: 'upgraded to Premium', icon: Crown, time: '30 min ago' },
  { name: 'Neha', city: 'Pune', action: 'started free trial', icon: Zap, time: '35 min ago' },
];

export const LiveActivityFeed: React.FC = () => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show first notification after 4 seconds
    const initialTimer = setTimeout(() => {
      setVisible(true);
    }, 4000);

    // Rotate every 8 seconds
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIdx((prev) => (prev + 1) % activities.length);
        setVisible(true);
      }, 500);
    }, 8000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  const activity = activities[currentIdx];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 60, x: -20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 20, x: -20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-20 sm:bottom-6 left-4 z-40 max-w-[280px]"
        >
          <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-3 shadow-xl shadow-black/10 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
              <activity.icon className="h-4 w-4 text-accent-rose" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                <span className="font-bold">{activity.name}</span>{' '}
                <span className="text-muted-foreground">{activity.action}</span>
              </p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" />
                {activity.city} • {activity.time}
              </div>
            </div>
            <button
              onClick={() => setVisible(false)}
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[8px] hover:bg-destructive/20 hover:text-destructive transition-colors"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
