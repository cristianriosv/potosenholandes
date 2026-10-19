import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

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

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    fireEvent(window, new Event('offline'));
    expect(screen.getByRole('status')).toHaveTextContent('Offline');

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));
    expect(screen.getByRole('status')).toHaveTextContent('Online');
  });
});
