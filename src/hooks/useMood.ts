import { useState, useEffect, useCallback } from 'react';
import { MoodType } from '@/components/MoodSelector';

interface MoodStyles {
  background: string;
  paper: string;
  paperTexture: string;
  textClass: string;
}

const moodStylesMap: Record<MoodType, MoodStyles> = {
  calm: {
    background: 'niknote-bg-calm',
    paper: 'bg-surface/60 dark:bg-[color:hsl(var(--background-secondary-hsl))]',
    paperTexture: '',
    textClass: 'text-fg-primary dark:text-fg-muted/70',
  },
  focus: {
    background: 'niknote-bg-focus',
    paper: 'bg-muted/60 dark:bg-[color:hsl(var(--background-secondary-hsl))]',
    paperTexture: '',
    textClass: 'text-fg-primary dark:text-fg-muted/70',
  },
  dark: {
    background: 'niknote-bg-dark',
    paper: 'bg-[color:hsl(var(--background-secondary-hsl))]',
    paperTexture: '',
    textClass: 'text-fg-muted/70',
  },
  vintage: {
    background: 'niknote-bg-vintage',
    paper: 'bg-[color:hsl(var(--accent-warm-hsl)/0.6)] dark:bg-nk-warm-600/30',
    paperTexture: '',
    textClass: 'text-accent-warm dark:text-accent-warm',
  },
  study: {
    background: 'niknote-bg-study',
    paper: 'bg-[color:hsl(var(--success)/0.6)] dark:bg-success/20',
    paperTexture: '',
    textClass: 'text-success dark:text-success',
  },
};

export function useMood() {
  const [mood, setMood] = useState<MoodType>(() => {
    const saved = localStorage.getItem('nikhil-notes-mood');
    return (saved as MoodType) || 'calm';
  });

  useEffect(() => {
    localStorage.setItem('nikhil-notes-mood', mood);
    
    if (mood === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [mood]);

  const changeMood = useCallback((newMood: MoodType) => {
    setMood(newMood);
  }, []);

  const styles = moodStylesMap[mood];

  return {
    mood,
    changeMood,
    styles,
  };
}
