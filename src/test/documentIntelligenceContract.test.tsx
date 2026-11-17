import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  readPdf: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));
vi.mock('@/lib/pdfText', () => ({ readPdf: mocks.readPdf }));
vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

import { DocumentIntelligence } from '@/components/document-intelligence/DocumentIntelligence';

describe('Document Intelligence client contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readPdf.mockResolvedValue({
      pages: [
        { lines: ['Force equals mass times acceleration'] },
        { lines: [], scanImage: 'data:image/jpeg;base64,c2Nhbi1wYWdl' },
      ],
      totalPages: 2,
      firstPageImage: '',
    });
    mocks.invoke.mockImplementation(async (name: string) => {
      if (name === 'extract-handwriting-text') {
        return { data: { extractedText: 'Newton\'s second law' }, error: null };
      }
      if (name === 'process-document') {
        return {
          data: {
            text: 'Page 1\nForce equals mass times acceleration\n\nPage 2\nNewton\'s second law',
            content: '## SUMMARY\nThe law relates force, mass, and acceleration.\n\n## KEY POINTS\n- Net force equals mass times acceleration.',
            processMode: 'summarize',
          },
          error: null,
        };
      }
      throw new Error(`Unexpected edge function ${name}`);
    });
  });

  it('OCRs scanned PDF pages and sends extracted text using the process-document JSON contract', async () => {
    const { container } = render(
      <MemoryRouter>
        <DocumentIntelligence />
      </MemoryRouter>
    );
    const file = new File(['test pdf'], 'physics-notes.pdf', { type: 'application/pdf' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('The law relates force, mass, and acceleration.')).toBeTruthy();
    expect(mocks.readPdf).toHaveBeenCalledWith(file, 20);
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'extract-handwriting-text', {
      body: { imageBase64: 'data:image/jpeg;base64,c2Nhbi1wYWdl' },
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'process-document', {
      body: expect.objectContaining({
        content: 'Page 1\nForce equals mass times acceleration\n\nPage 2\nNewton\'s second law',
        processMode: 'summarize',
        userMode: 'student',
        title: 'physics-notes.pdf',
      }),
    });
    expect(mocks.invoke.mock.calls[1][1].body).not.toHaveProperty('fileBase64');
  });
});
