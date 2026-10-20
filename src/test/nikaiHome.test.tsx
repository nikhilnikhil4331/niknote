import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NikAIWorkspace } from '@/components/nikai/NikAIWorkspace';
import { NikAIBrand, NikAILogoMark } from '@/components/nikai/NikAIBrand';

/**
 * Guards the NikAI home screen ("What can I help you create?") and the
 * official NikAI logo artwork used across the studio.
 */
const wrap = (ui: React.ReactNode) =>
  render(<MemoryRouter initialEntries={['/ai']}>{ui}</MemoryRouter>);

describe('NikAI home screen & brand assets', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders the hero, the four action cards and the five-item chat rail', () => {
    wrap(<NikAIWorkspace />);

    const text = document.body.textContent || '';
    expect(text).toContain('What can I help you');
    expect(text).toContain('Your AI companion for learning, notes, quizzes, writing and coding.');

    // 4 hero cards (Smart Notes also appears in the rail, so allow duplicates)
    for (const label of ['Smart Notes', 'Learn a concept', 'Practice quiz', 'Write code']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
    expect(
      text.includes('Turn any topic into beautiful, structured handwritten-ready notes.'),
    ).toBe(true);

    // Left rail: 5 destinations + New Chat + Recent Chats + upgrade card
    for (const label of ['Chat', 'Quiz', 'Writing Studio', 'Code']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
    expect(screen.getByText('New Chat')).toBeTruthy();
    expect(screen.getByText('Recent Chats')).toBeTruthy();
    expect(screen.getByText('Upgrade to NikAI Pro')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search chats...')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ask NikAI anything...')).toBeTruthy();
  });

  it('uses the official NikAI logo artwork instead of a stand-in mark', () => {
    wrap(
      <div>
        <NikAIBrand size="lg" />
        <NikAILogoMark size={48} />
      </div>,
    );

    const wordmark = document.querySelector('img[alt="NikAI"]') as HTMLImageElement | null;
    expect(wordmark?.getAttribute('src')).toBe('/nikai/nikai-wordmark.png');
    expect(screen.getByText('Astra')).toBeTruthy();

    const starSources = Array.from(document.querySelectorAll('img')).map((img) =>
      img.getAttribute('src'),
    );
    expect(starSources).toContain('/nikai/nikai-star.png');
  });

  it('hides the chat rail when the workspace is embedded in the editor slide-over', () => {
    wrap(<NikAIWorkspace embedded />);
    expect(screen.queryByText('Recent Chats')).toBeNull();
    expect(screen.queryByText('Upgrade to NikAI Pro')).toBeNull();
  });
});
