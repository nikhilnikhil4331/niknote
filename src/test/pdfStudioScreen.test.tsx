import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PdfStudio from '@/components/pdf-studio/PdfStudio';

vi.mock('@/lib/pdfStudio', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pdfStudio')>('@/lib/pdfStudio');
  return actual;
});

describe('PDF Studio screen', () => {
  it('opens the editor shell with every tool ready before a file is chosen', () => {
    render(
      <MemoryRouter>
        <PdfStudio />
      </MemoryRouter>
    );
    expect(screen.getByText(/PDF Studio — edit any PDF/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /open a pdf/i })).toBeTruthy();
    expect(screen.getAllByText(/signatures/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/flattened export/i)).toBeTruthy();
  });
});
