import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LectureMode from '@/pages/LectureMode';
import StudyPlanner from '@/pages/StudyPlanner';

const LECTURE_TRANSCRIPT =
  "Um, Today's topic is photosynthesis. So photosynthesis converts light energy into chemical energy. " +
  'The main steps are, first, light absorption by chlorophyll. Second, water splitting in photosystem two. ' +
  'And carbon fixation happens in the Calvin cycle. For example, plants in low light grow slower.';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Lecture mode screen', () => {
  it('turns a spoken transcript into structured note lines', async () => {
    render(
      <MemoryRouter>
        <LectureMode />
      </MemoryRouter>,
    );

    const box = screen.getByLabelText(/transcript/i);
    fireEvent.change(box, { target: { value: LECTURE_TRANSCRIPT } });
    fireEvent.click(screen.getByTestId('lecture-build-btn'));

    // The composer reports what it produced, so the user can trust the shape.
    expect((await screen.findAllByText(/headings/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/points/).length).toBeGreaterThan(0);
    // Filler words from speech are stripped from the generated note itself.
    const generated = Array.from(document.querySelectorAll('section li'))
      .map(li => li.textContent || '')
      .join(' ');
    expect(generated).not.toMatch(/\bUm,/);
    expect(generated.length).toBeGreaterThan(20);
    expect(generated).toMatch(/photosynthesis converts light energy/i);
  });

  it('saves the generated note into the local notebooks list', async () => {
    render(
      <MemoryRouter>
        <LectureMode />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/transcript/i), { target: { value: LECTURE_TRANSCRIPT } });
    fireEvent.click(screen.getByTestId('lecture-build-btn'));
    fireEvent.click(await screen.findByTestId('lecture-save-btn'));

    const stored = JSON.parse(localStorage.getItem('niknote.notes.v1') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].tags).toContain('Lecture');
    expect(stored[0].content).toContain('photosynthesis');
    // Headings are stored as markdown so notebooks render them as headings.
    expect(stored[0].content).toMatch(/^#{2,3} /m);
  });

  it('says so when there is nothing to convert instead of inventing a note', () => {
    render(
      <MemoryRouter>
        <LectureMode />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('lecture-build-btn'));
    expect(screen.queryByTestId('lecture-save-btn')).toBeNull();
    expect(localStorage.getItem('niknote.notes.v1')).toBeNull();
  });
});

describe('Study planner screen', () => {
  it('adds a task and schedules it inside the daily budget', async () => {
    render(
      <MemoryRouter>
        <StudyPlanner />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/subject/i), { target: { value: 'Physics' } });
    fireEvent.change(screen.getByPlaceholderText(/topic/i), { target: { value: 'Thermodynamics' } });
    fireEvent.click(screen.getByTestId('planner-add-task'));

    expect((await screen.findAllByText(/Physics: Thermodynamics/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Suggested sessions \(1\)/)).toBeTruthy();

    const stored = JSON.parse(localStorage.getItem('niknote.study.tasks.v1') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].topic).toBe('Thermodynamics');
    expect(stored[0].done).toBe(false);
  });

  it('exports a valid calendar file and never claims events were created', async () => {
    const createObjectURL = vi.fn(() => 'blob:niknote');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    // jsdom cannot follow a blob download; record the click instead.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <StudyPlanner />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/topic/i), { target: { value: 'Optics' } });
    fireEvent.click(screen.getByTestId('planner-add-task'));
    fireEvent.click(screen.getByTestId('planner-export-ics'));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    expect(clickSpy).toHaveBeenCalled();
    const blob = (createObjectURL.mock.calls as unknown as [Blob][])[0][0];
    expect(blob.type).toContain('text/calendar');
    expect(screen.getByText(/does not create events/i)).toBeTruthy();
  });
});
