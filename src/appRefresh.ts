import { seedIfNeeded } from './db/seed';

function waitForState(worker: ServiceWorker, state: ServiceWorkerState): Promise<ServiceWorker | undefined> {
  if (worker.state === state) return Promise.resolve(worker);
  if (worker.state === 'redundant') return Promise.resolve(undefined);

  return new Promise((resolve) => {
    const checkState = () => {
      if (worker.state === state || worker.state === 'redundant') {
        worker.removeEventListener('statechange', checkState);
        resolve(worker.state === state ? worker : undefined);
      }
    };
    worker.addEventListener('statechange', checkState);
    checkState();
  });
}

export async function refreshAppData(): Promise<void> {
  if (!navigator.onLine) {
    throw new Error('Connect to the internet before refreshing data.');
  }

  if (!('serviceWorker' in navigator)) {
    await seedIfNeeded();
    window.location.reload();
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    await seedIfNeeded();
    window.location.reload();
    return;
  }

  let updateWorker: Promise<ServiceWorker | undefined> | undefined;
  const handleUpdateFound = () => {
    if (registration.installing) {
      updateWorker = waitForState(registration.installing, 'installed');
    }
  };
  registration.addEventListener('updatefound', handleUpdateFound, { once: true });
  try {
    await registration.update();
  } finally {
    registration.removeEventListener('updatefound', handleUpdateFound);
  }

  const worker = registration.waiting
    ?? (registration.installing
      ? await waitForState(registration.installing, 'installed')
      : await updateWorker);

  if (worker?.state === 'installed') {
    const activated = waitForState(worker, 'activated');
    worker.postMessage({ type: 'SKIP_WAITING' });
    if (await activated) {
      window.location.reload();
      return;
    }
  }

  await seedIfNeeded();
}
