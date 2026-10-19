import { render, screen } from '@testing-library/react';
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
});
