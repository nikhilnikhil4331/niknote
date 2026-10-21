import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';

const setViewport = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
};

const pageInfo = () =>
  Array.from(document.querySelectorAll('span'))
    .map(node => (node.textContent || '').trim())
    .find(text => /^\d+\/\d+$/.test(text)) || '';

describe('adding a page', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
    Element.prototype.scrollIntoView = vi.fn();
    window.history.pushState({}, '', '/studio');
  });

  it('commits a new page on desktop through the page bar', async () => {
    render(<App />);
    await waitFor(() => expect(pageInfo()).toBe('1/1'), { timeout: 4000 });

    const addBtn = document.querySelector('button.border-dashed') as HTMLButtonElement | null;
    expect(addBtn).toBeTruthy();
    fireEvent.click(addBtn!);

    await waitFor(() => expect(pageInfo()).toBe('2/2'), { timeout: 3000 });
    // the sheet lives inside the page stage, so the unfold has something to move
    expect(document.querySelector('[data-page-sheet="true"]')).not.toBeNull();
  });

  it('offers page controls in the mobile write view, not only in preview', async () => {
    setViewport(390);
    render(<App />);

    const addBtn = await screen.findByRole('button', { name: /^add page$/i });
    expect(document.body.textContent).toMatch(/Page 1 of 1/);

    fireEvent.click(addBtn);
    await waitFor(() => expect(document.body.textContent).toMatch(/Page 2 of 2/), { timeout: 3000 });
  });
});
