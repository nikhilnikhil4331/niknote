import React from 'react';
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Wallet, TrendingUp, Target, ReceiptText, PiggyBank, Camera, FileDown } from 'lucide-react';
import { SemiCircularDial, type DialItem } from '@/components/dial/SemiCircularDial';

// The dial used to fan symmetrically around the centre button, which pushed
// its right-hand actions off screen when the button hugged the right edge.
// These tests pin the actual measured behaviour of the component.

const ITEMS: DialItem[] = [
  { id: 'expense', label: 'Add expense', icon: TrendingUp, onSelect: vi.fn() },
  { id: 'income', label: 'Add income', icon: Wallet, onSelect: vi.fn() },
  { id: 'receipt', label: 'Scan receipt', icon: Camera, onSelect: vi.fn() },
  { id: 'budget', label: 'Budget', icon: PiggyBank, onSelect: vi.fn() },
  { id: 'goals', label: 'Goals', icon: Target, onSelect: vi.fn() },
  { id: 'bills', label: 'Bills', icon: ReceiptText, onSelect: vi.fn() },
  { id: 'report', label: 'PDF report', icon: FileDown, onSelect: vi.fn() },
];

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
}

function placeFabRight(width: number, height: number) {
  const fab = screen.getByLabelText('Open money actions');
  const size = 56;
  const right = 12;
  const bottom = 100;
  const rect = {
    left: width - right - size,
    top: height - bottom - size,
    right: width - right,
    bottom: height - bottom,
    width: size,
    height: size,
    x: width - right - size,
    y: height - bottom - size,
    toJSON: () => ({}),
  } as DOMRect;
  fab.getBoundingClientRect = () => rect;
  return { cx: rect.left + size / 2, cy: rect.top + size / 2 };
}

function readFan() {
  const fan = screen.getByRole('menu');
  const points = JSON.parse(fan.getAttribute('data-dial-points') || '[]') as Array<{ x: number; y: number }>;
  const offset = JSON.parse(fan.getAttribute('data-dial-offset') || '{"x":0,"y":0}');
  return { fan, points, offset, radius: Number(fan.getAttribute('data-dial-radius')) };
}

beforeAll(() => {
  setViewport(390, 844);
});

afterAll(() => {
  setViewport(1024, 768);
});

describe('SemiCircularDial placement', () => {
  it('keeps every action inside the viewport on a phone when anchored right', async () => {
    setViewport(390, 844);
    render(<SemiCircularDial items={ITEMS} menuLabel="Money quick actions" centerLabel="Open money actions" align="right" />);
    const { cx, cy } = placeFabRight(390, 844);
    await act(async () => { fireEvent.click(screen.getByLabelText('Open money actions')); });

    expect(screen.getAllByRole('menuitem')).toHaveLength(7);
    const { points, offset, radius } = readFan();
    expect(radius).toBeGreaterThan(60);

    for (const point of points) {
      const bubbleCx = cx + point.x + offset.x;
      const bubbleCy = cy + point.y + offset.y;
      expect(bubbleCx - 24).toBeGreaterThanOrEqual(0);
      expect(bubbleCx + 24).toBeLessThanOrEqual(390);
      expect(bubbleCy - 24).toBeGreaterThanOrEqual(0);
      expect(bubbleCy + 24).toBeLessThanOrEqual(844);
    }
  });

  it('does not place the fan off the right edge (the original bug)', async () => {
    setViewport(390, 844);
    render(<SemiCircularDial items={ITEMS} menuLabel="Money quick actions" centerLabel="Open money actions" align="right" />);
    const { cx } = placeFabRight(390, 844);
    await act(async () => { fireEvent.click(screen.getByLabelText('Open money actions')); });
    const { points, offset } = readFan();
    const rightMost = Math.max(...points.map(p => p.x)) + offset.x;
    // A right-anchored fan must lean left, never past the button by more than a bubble.
    expect(cx + rightMost + 24).toBeLessThanOrEqual(390);
  });

  it('mirrors the fan for a left-anchored button', async () => {
    setViewport(390, 844);
    render(<SemiCircularDial items={ITEMS} menuLabel="Home quick actions" centerLabel="Open home actions" align="left" />);
    const fab = screen.getByLabelText('Open home actions');
    fab.getBoundingClientRect = (() => ({
      left: 16, top: 844 - 140 - 56, right: 72, bottom: 844 - 140,
      width: 56, height: 56, x: 16, y: 844 - 196, toJSON: () => ({}),
    } as DOMRect));
    await act(async () => { fireEvent.click(screen.getByLabelText('Open home actions')); });
    const { points, offset } = readFan();
    const cx = 44;
    const leftMost = Math.min(...points.map(p => p.x)) + offset.x;
    expect(cx + leftMost - 24).toBeGreaterThanOrEqual(0);
  });

  it('falls back to an accessible compact list on a very short viewport', async () => {
    setViewport(320, 250);
    render(<SemiCircularDial items={ITEMS} menuLabel="Money quick actions" centerLabel="Open money actions" align="right" />);
    placeFabRight(320, 250);
    await act(async () => { fireEvent.click(screen.getByLabelText('Open money actions')); });
    const dial = screen.getByTestId('semicircular-dial');
    if (dial.getAttribute('data-compact')) {
      // every action is still reachable, with its label visible
      expect(screen.getAllByRole('menuitem')).toHaveLength(7);
      expect(screen.getByText('PDF report')).toBeTruthy();
    } else {
      const { points, offset, radius } = readFan();
      expect(radius).toBeGreaterThan(0);
      for (const p of points) {
        const x = 320 - 12 - 28 + p.x + offset.x;
        const y = 250 - 100 - 28 + p.y + offset.y;
        expect(x - 24).toBeGreaterThanOrEqual(0);
        expect(x + 24).toBeLessThanOrEqual(320);
        expect(y - 24).toBeGreaterThanOrEqual(0);
        expect(y + 24).toBeLessThanOrEqual(250);
      }
    }
    setViewport(390, 844);
  });
});
