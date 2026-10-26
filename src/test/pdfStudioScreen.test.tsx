import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PdfStudio from '@/components/pdf-studio/PdfStudio';

vi.mock('@/lib/pdfStudio', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pdfStudio')>('@/lib/pdfStudio');
  return actual;
});

describe('PDF Editor 2.0 empty state', () => {
  it('opens in a clean read-first state — no canvas, no auto-activated pen', () => {
    const { container } = render(
      <MemoryRouter>
        <PdfStudio />
      </MemoryRouter>
    );
    expect(screen.getByText(/Open a PDF to begin/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /open a pdf/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /try the sample/i })).toBeTruthy();
    expect(screen.getByText(/nothing draws until you choose a tool/i)).toBeTruthy();
    expect(screen.getAllByText(/Signatures/i).length).toBeGreaterThan(0);
    // The empty state must not mount a drawing surface at all.
    expect(container.querySelector('canvas')).toBeNull();
    expect(screen.queryByLabelText(/page 1/i)).toBeNull();
  });
});
