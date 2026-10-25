import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PdfTools from '@/components/pdf-tools/PdfTools';

function renderTools() {
  return render(
    <MemoryRouter>
      <PdfTools />
    </MemoryRouter>
  );
}

describe('PDF Tools page', () => {
  test('shows every tool tab', () => {
    renderTools();
    expect(screen.getByRole('heading', { name: 'PDF Tools' })).toBeInTheDocument();
    for (const label of ['Merge', 'Split', 'Compress', 'Watermark', 'Page numbers', 'Images → PDF']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  test('merge tab starts with an upload zone', () => {
    renderTools();
    expect(screen.getByText(/PDF add karo/i)).toBeInTheDocument();
  });

  test('links back to the editor and the hub', () => {
    renderTools();
    expect(screen.getByLabelText('Back')).toHaveAttribute('href', '/hub');
    expect(screen.getByText(/Edit & sign/i)).toHaveAttribute('href', '/pdf-editor');
  });
});
