import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPage } from '@/components/landing/LandingPage';
import { useDarkMode } from '@/hooks/useDarkMode';
import { trackClickCTA, trackStartNoteCreation } from '@/lib/tracking';

const Welcome = () => {
  const navigate = useNavigate();
  const { isDark, toggle: toggleDark } = useDarkMode();

  return (
    <LandingPage
      isDark={isDark}
      onToggleDark={toggleDark}
      onStartWriting={() => {
        trackClickCTA({
          buttonLocation: 'welcome_start_writing',
          conversionSource: 'welcome_page',
          pageType: 'landing',
          featureName: 'handwriting_editor',
        });
        trackStartNoteCreation({
          conversionSource: 'welcome_page',
          featureName: 'handwriting_editor',
          pageType: 'landing',
        });
        navigate('/');
      }}
    />
  );
};

export default Welcome;
