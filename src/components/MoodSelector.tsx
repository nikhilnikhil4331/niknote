import React from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, BookOpen, Coffee, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MoodType = 'calm' | 'focus' | 'dark' | 'vintage' | 'study';

interface MoodOption {
  id: MoodType;
  name: string;
  icon: React.ReactNode;
  colors: {
    bg: string;
    paper: string;
    accent: string;
  };
}

const moods: MoodOption[] = [
  {
    id: 'calm',
    name: 'Calm',
    icon: <Sun className="w-4 h-4" />,
    colors: {
      bg: 'from-nk-purple to-nk-rose',
      paper: 'bg-surface',
      accent: 'bg-[color:hsl(var(--accent-cool-solid-hsl))]',
    },
  },
  {
    id: 'focus',
    name: 'Focus',
    icon: <Sparkles className="w-4 h-4" />,
    colors: {
      bg: 'from-nk-purple to-nk-rose',
      paper: 'bg-muted',
      accent: 'bg-primary',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    icon: <Moon className="w-4 h-4" />,
    colors: {
      bg: 'from-surface-hover to-surface-hover',
      paper: 'bg-[color:hsl(var(--background-secondary-hsl))]',
      accent: 'bg-primary',
    },
  },
  {
    id: 'vintage',
    name: 'Vintage',
    icon: <Coffee className="w-4 h-4" />,
    colors: {
      bg: 'from-nk-warm-600 to-nk-rose',
      paper: 'bg-[color:hsl(var(--accent-warm-hsl)/0.16)]',
      accent: 'bg-nk-warm-600',
    },
  },
  {
    id: 'study',
    name: 'Study',
    icon: <BookOpen className="w-4 h-4" />,
    colors: {
      bg: 'from-success to-success/70',
      paper: 'bg-[color:hsl(var(--success)/0.5)]',
      accent: 'bg-success',
    },
  },
];

interface MoodSelectorProps {
  currentMood: MoodType;
  onMoodChange: (mood: MoodType) => void;
}

export const MoodSelector: React.FC<MoodSelectorProps> = ({ currentMood, onMoodChange }) => {
  return (
    <div className="flex items-center gap-1 p-1 bg-surface/15 backdrop-blur-sm rounded-xl">
      {moods.map((mood) => (
        <motion.button
          key={mood.id}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onMoodChange(mood.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-200",
            currentMood === mood.id
              ? "bg-surface/40 shadow-sm text-foreground backdrop-blur-sm"
              : "text-foreground/60 hover:text-foreground hover:bg-surface/20"
          )}
        >
          <span className={cn(
            "p-1 rounded-md transition-colors",
            currentMood === mood.id ? mood.colors.accent + " text-white" : "bg-transparent"
          )}>
            {mood.icon}
          </span>
          <span className="text-xs font-medium hidden sm:inline">{mood.name}</span>
        </motion.button>
      ))}
    </div>
  );
};

export const getMoodStyles = (mood: MoodType) => {
  const moodConfig = moods.find(m => m.id === mood) || moods[0];
  return moodConfig.colors;
};

export { moods };
