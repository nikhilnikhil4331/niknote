import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppDock } from '@/components/AppDock';

function RouteProbe() {
  const { pathname } = useLocation();
  return <output data-testid="current-route">{pathname}</output>;
}

beforeEach(() => localStorage.clear());

describe('mobile dock navigation', () => {
  it('exposes valid destinations and follows the current app route', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/home']}>
        <AppDock />
        <RouteProbe />
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav.querySelectorAll('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Create note' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notes' }));
    await waitFor(() => expect(screen.getByTestId('current-route')).toHaveTextContent('/notebooks'));
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Create note' }));
    await waitFor(() => expect(screen.getByTestId('current-route')).toHaveTextContent('/editor/new'));

    await user.click(screen.getByRole('button', { name: 'NikAI' }));
    await waitFor(() => expect(screen.getByTestId('current-route')).toHaveTextContent('/ai'));
    expect(screen.getByRole('button', { name: 'NikAI' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Profile' }));
    await waitFor(() => expect(screen.getByTestId('current-route')).toHaveTextContent('/account'));
    expect(screen.getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Home' }));
    await waitFor(() => expect(screen.getByTestId('current-route')).toHaveTextContent('/home'));
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });
});
