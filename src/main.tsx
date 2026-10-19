import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { App } from './App';
import { seedIfNeeded } from './db/seed';

// Ask the browser not to evict our data under storage pressure.
void navigator.storage?.persist?.();
void seedIfNeeded();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </MantineProvider>
  </StrictMode>,
);
