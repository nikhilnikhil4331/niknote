import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { NikoBuddy } from './NikoBuddy';

const { mascotMock } = vi.hoisted(() => ({ mascotMock: vi.fn() }));
vi.mock('wobnimo', () => ({
  Mascot: class MockMascot {
    canvas: HTMLCanvasElement;
    constructor(canvas: HTMLCanvasElement, character: unknown, options: unknown) {
      this.canvas = canvas;
      mascotMock(character, options);
    }
    on() { return () => {}; }
    setState() {}
    dispose() {}
  },
}));

const clearWebGLGlobal = () => {
  delete (window as unknown as Record<string, unknown>).WebGL2RenderingContext;
};

beforeEach(() => {
  mascotMock.mockClear();
  clearWebGLGlobal();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  clearWebGLGlobal();
});

describe('NikoBuddy', () => {
  it('keeps an accessible status and notebook fallback when WebGL2 is unavailable', () => {
    const { container } = render(<NikoBuddy state="working" label="Niko is saving" compact showLabel={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Niko is saving');
    expect(container.querySelector('.nd-niko-fallback')).toBeInTheDocument();
    expect(mascotMock).not.toHaveBeenCalled();
  });

  it('mounts only the custom character with reduced-motion and mobile performance limits', async () => {
    Object.defineProperty(window, 'WebGL2RenderingContext', { configurable: true, value: function WebGL2RenderingContext() {} });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as WebGL2RenderingContext);

    render(<NikoBuddy state="working" label="Niko is saving" size={30} compact showLabel={false} />);

    await waitFor(() => expect(mascotMock).toHaveBeenCalled());
    expect(mascotMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'niknote-buddy' }), expect.objectContaining({
      state: 'working',
      respectReducedMotion: true,
      interactive: false,
      effects: false,
      maxPixelRatio: 1.25,
    }));
  });
});
