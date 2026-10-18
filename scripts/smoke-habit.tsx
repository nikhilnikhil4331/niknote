// SSR smoke test for the Niknote Habit experience.
// Bundled with esbuild and run under node (see scripts/smoke-habit.sh).
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import RoutineAppPage from '@/pages/RoutineApp';
import { RoutineProvider } from '@/components/habits/RoutineProvider';
import { HomeScreen } from '@/components/habits/screens/Home';
import { HabitsScreen } from '@/components/habits/screens/Habits';
import { AddHabitScreen } from '@/components/habits/screens/AddHabit';
import { HabitDetailScreen } from '@/components/habits/screens/HabitDetail';
import { FocusTimerScreen } from '@/components/habits/screens/FocusTimer';
import { InsightsScreen } from '@/components/habits/screens/Insights';
import { SleepScreen } from '@/components/habits/screens/Sleep';
import { ExerciseScreen } from '@/components/habits/screens/Exercise';
import { CalendarScreen } from '@/components/habits/screens/CalendarView';
import { StreaksScreen } from '@/components/habits/screens/Streaks';
import { ProfileScreen } from '@/components/habits/screens/Profile';

const noop = () => {};

function wrap(ui: React.ReactNode) {
  return (
    <MemoryRouter initialEntries={['/habit']}>
      <AuthProvider>
        <RoutineProvider>{ui}</RoutineProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

function check(name: string, ui: React.ReactNode, expect?: string) {
  let html = '';
  try {
    html = renderToString(wrap(ui));
  } catch (e) {
    console.error(`✗ ${name}`, e instanceof Error ? e.message : e);
    process.exitCode = 1;
    return;
  }
  const ok = html.length > 200 && (!expect || html.includes(expect));
  console.log(`${ok ? '✓' : '✗'} ${name} (${html.length} chars)`);
  if (!ok) process.exitCode = 1;
}

// Full page (splash)
try {
  const html = renderToString(
    <MemoryRouter initialEntries={['/habit']}>
      <AuthProvider>
        <RoutineAppPage />
      </AuthProvider>
    </MemoryRouter>,
  );
  const ok = html.length > 500 && html.includes('Better Habits');
  console.log(`${ok ? '✓' : '✗'} page+splash (${html.length} chars)`);
  if (!ok) process.exitCode = 1;
} catch (e) {
  console.error('✗ page+splash', e instanceof Error ? e.message : e);
  process.exitCode = 1;
}

check('home', <HomeScreen go={noop as any} />, 'habits done');
check('habits', <HabitsScreen go={noop as any} />, 'My Habits');
check('add', <AddHabitScreen go={noop as any} />, 'Create Habit');
check('detail-missing', <HabitDetailScreen id="does-not-exist" go={noop as any} />, 'Habit not found');
check('detail-missing-ok', <HabitDetailScreen id="x" go={noop as any} />);
check('focus', <FocusTimerScreen go={noop as any} />, 'Focus Timer');
check('insights', <InsightsScreen go={noop as any} />, 'Weekly Progress');
check('sleep', <SleepScreen go={noop as any} />, 'Sleep Summary');
check('exercise', <ExerciseScreen go={noop as any} />, 'Recent Activities');
check('calendar', <CalendarScreen go={noop as any} />, 'Habits on');
check('streaks', <StreaksScreen go={noop as any} />, 'Achievements');
check('profile', <ProfileScreen go={noop as any} />, 'Backup');

console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE OK');
