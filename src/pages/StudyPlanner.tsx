import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CalendarPlus, Check, Clock, Download, ExternalLink, Plus, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  googleCalendarUrl, newTask, planSessions, sortTasks, tasksToIcs,
  type StudyTask, type TaskPriority,
} from '@/lib/studyPlan';

const TASKS_KEY = 'niknote.study.tasks.v1';

function loadTasks(): StudyTask[] {
  try {
    const raw = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function persist(tasks: StudyTask[]): void {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks.slice(0, 300)));
  } catch {
    toast.error('Could not save tasks on this device.');
  }
}

export default function StudyPlanner() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [dailyMinutes, setDailyMinutes] = useState(90);
  const [form, setForm] = useState({
    subject: '',
    topic: '',
    minutes: 45,
    dueDate: new Date().toISOString().slice(0, 10),
    priority: 'normal' as TaskPriority,
  });

  useEffect(() => {
    setTasks(loadTasks());
    try {
      const saved = Number(localStorage.getItem('niknote.study.dailyMinutes') || '');
      if (saved >= 30) setDailyMinutes(saved);
    } catch { /* ignore */ }
  }, []);

  const update = (next: StudyTask[]) => {
    setTasks(next);
    persist(next);
  };

  const add = () => {
    if (!form.topic.trim()) {
      toast.error('Add a topic so the task means something later.');
      return;
    }
    const task = newTask({
      subject: form.subject || 'General',
      topic: form.topic,
      minutes: Number(form.minutes) || 45,
      dueDate: form.dueDate,
      priority: form.priority,
    });
    update([task, ...tasks]);
    setForm({ ...form, topic: '' });
    toast.success('Task added');
  };

  const sessions = useMemo(() => {
    // planSessions mutates its copies, so give it clones.
    return planSessions(tasks.map(task => ({ ...task })), {
      dailyMinutes,
      startDate: new Date().toISOString().slice(0, 10),
    });
  }, [tasks, dailyMinutes]);

  const downloadCalendar = () => {
    const open = tasks.filter(task => !task.done);
    if (!open.length) {
      toast.error('Add a task first.');
      return;
    }
    const ics = tasksToIcs(open, { calendarName: 'NikNote study plan' });
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'niknote-study-plan.ics';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Calendar file ready — import it in Google/Apple Calendar.');
  };

  return (
    <div className="min-h-screen bg-[#F7F5FF] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5B4E8A] hover:text-[#3f2a63]"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <header className="rounded-2xl border border-violet-200/70 bg-white p-5 shadow-sm">
          <h1 className="flex items-center gap-2 text-xl font-bold text-[#241a3d]">
            <CalendarPlus className="h-5 w-5 text-violet-600" /> Study planner
          </h1>
          <p className="mt-1 text-xs text-[#6b6486]">
            List what has to be done and when. The plan spreads it across the days you have, and
            exports a standard <code>.ics</code> file — nothing is added to your calendar without
            you importing it.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-[#6b6486]">
              Minutes per day
              <input
                type="number"
                min={30}
                max={480}
                step={15}
                value={dailyMinutes}
                onChange={e => {
                  const value = Math.max(30, Math.min(480, Number(e.target.value) || 90));
                  setDailyMinutes(value);
                  try { localStorage.setItem('niknote.study.dailyMinutes', String(value)); } catch { /* ignore */ }
                }}
                className="ml-2 w-20 rounded-lg border border-violet-200 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={downloadCalendar}
              data-testid="planner-export-ics"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#241a3d] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#322452]"
            >
              <Download className="h-3.5 w-3.5" /> Export .ics
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-violet-200/70 bg-white p-4 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              placeholder="Subject (e.g. Physics)"
              className="rounded-xl border border-violet-200 px-3 py-2 text-sm"
            />
            <input
              value={form.topic}
              onChange={e => setForm({ ...form, topic: e.target.value })}
              placeholder="Topic (e.g. Thermodynamics)"
              className="rounded-xl border border-violet-200 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-xs text-[#6b6486]">
              Minutes
              <input
                type="number"
                min={10}
                step={5}
                value={form.minutes}
                onChange={e => setForm({ ...form, minutes: Number(e.target.value) || 45 })}
                className="w-20 rounded-lg border border-violet-200 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-[#6b6486]">
              Deadline
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className="rounded-lg border border-violet-200 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-[#6b6486]">
              Priority
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value as TaskPriority })}
                className="rounded-lg border border-violet-200 px-2 py-1 text-sm"
              >
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </label>
            <button
              type="button"
              onClick={add}
              data-testid="planner-add-task"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add task
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-200/70 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#8B7FB0]">
            Tasks ({tasks.filter(t => !t.done).length} open)
          </h2>
          {tasks.length === 0 ? (
            <p className="mt-2 text-sm text-[#6b6486]">
              Nothing planned yet. Add the chapter you have been avoiding — that is usually the
              right first task.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-violet-100">
              {sortTasks(tasks).map(task => (
                <li key={task.id} className="flex flex-wrap items-center gap-2 py-2">
                  <button
                    type="button"
                    aria-label={task.done ? `Reopen ${task.topic}` : `Complete ${task.topic}`}
                    onClick={() => update(tasks.map(t => (t.id === task.id ? { ...t, done: !t.done } : t)))}
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      task.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-violet-300'
                    }`}
                  >
                    {task.done && <Check className="h-3 w-3" />}
                  </button>
                  <span className={`text-sm ${task.done ? 'text-[#a79fc0] line-through' : 'font-medium text-[#241a3d]'}`}>
                    {task.subject}: {task.topic}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#6b6486]">
                    <Clock className="h-3 w-3" /> {task.minutes}m · due {task.dueDate}
                  </span>
                  {task.priority === 'high' && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">high</span>
                  )}
                  <a
                    href={googleCalendarUrl(task)}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Google Calendar
                  </a>
                  <button
                    type="button"
                    aria-label={`Delete ${task.topic}`}
                    onClick={() => update(tasks.filter(t => t.id !== task.id))}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-violet-200/70 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#8B7FB0]">
            Suggested sessions ({sessions.length})
          </h2>
          {sessions.length === 0 ? (
            <p className="mt-2 text-sm text-[#6b6486]">Add a task to see a schedule.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {sessions.slice(0, 12).map((session, i) => (
                <li key={`${session.taskId}-${i}`} className="flex items-center gap-2 text-sm text-[#2b2344]">
                  <span className="rounded-lg bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                    {session.date}
                  </span>
                  <span className="text-[11px] text-[#6b6486]">
                    {String(session.startHour).padStart(2, '0')}:00
                  </span>
                  <span className="font-medium">{session.title}</span>
                  <span className="ml-auto text-[11px] text-[#6b6486]">{session.minutes}m</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-[#8B7FB0]">
            Sessions are suggestions only. Exporting the calendar file does not create events in an
            external calendar — your calendar app imports the file.
          </p>
        </section>
      </div>
    </div>
  );
}
