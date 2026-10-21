import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { App } from './App';
import { refreshAppData } from './appRefresh';

vi.mock('./appRefresh', () => ({ refreshAppData: vi.fn() }));

describe('App', () => {
  it('renders navigation and the selected section', async () => {
    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/reading']}>
          <App />
        </MemoryRouter>
      </MantineProvider>,
    );
    expect(screen.getByRole('tab', { name: 'Reading' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { name: 'Reading' })).toBeInTheDocument();
  });

  it('opens Home by default and shows browser connectivity changes', async () => {
    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Welkom' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Online');
    expect(screen.getByRole('button', { name: 'Refresh data' })).toBeEnabled();

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    fireEvent(window, new Event('offline'));
    expect(screen.getByRole('status')).toHaveTextContent('Offline');
    expect(screen.getByRole('button', { name: 'Refresh data' })).toBeDisabled();

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));
    expect(screen.getByRole('status')).toHaveTextContent('Online');
    expect(screen.getByRole('button', { name: 'Refresh data' })).toBeEnabled();
  });

  it('toggles dark mode', () => {
    window.localStorage.clear();
    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </MantineProvider>,
    );

    const darkModeToggle = screen.getByRole('button', { name: 'Dark mode' });
    expect(darkModeToggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(darkModeToggle);

    expect(darkModeToggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
  });

  it('refreshes data and reports errors to the learner', async () => {
    vi.mocked(refreshAppData).mockResolvedValue();
    const { rerender } = render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }));
    expect(await screen.findByText('Data is up to date.')).toBeInTheDocument();
    expect(refreshAppData).toHaveBeenCalledOnce();

    vi.mocked(refreshAppData).mockRejectedValue(new Error('Could not reach the update server.'));
    rerender(
      <MantineProvider>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </MantineProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the update server.');
  });
});
