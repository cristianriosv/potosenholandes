import { useEffect, useState } from 'react';
import { AppShell, Badge, Button, Container, Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { FlashcardsPage } from './features/flashcards/FlashcardsPage';
import { ReadingPage } from './features/reading/ReadingPage';
import { ContentManagerPage } from './features/content/ContentManagerPage';
import { SentenceExercisesPage } from './features/exercises/SentenceExercisesPage';
import { BackupPage } from './features/settings/BackupPage';

const sections = [
  { path: '/home', label: 'Home' },
  { path: '/flashcards', label: 'Flashcards' },
  { path: '/exercises', label: 'Exercises' },
  { path: '/reading', label: 'Reading' },
  { path: '/manage', label: 'Content' },
  { path: '/progress', label: 'Progress' },
  { path: '/settings', label: 'Settings' },
];

function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return <Badge color={isOnline ? 'green' : 'orange'} role="status">{isOnline ? 'Online' : 'Offline'}</Badge>;
}

function HomePage() {
  const navigate = useNavigate();
  return (
    <Stack>
      <Title order={2}>Welkom</Title>
      <Text c="dimmed">Choose a short practice session.</Text>
      <Group grow>
        <Button onClick={() => navigate('/reading')}>Reading</Button>
        <Button onClick={() => navigate('/flashcards')}>Flashcards</Button>
        <Button onClick={() => navigate('/exercises')}>Sentence exercises</Button>
      </Group>
      <Group>
        <Button variant="light" onClick={() => navigate('/manage')}>Content manager</Button>
        <Button variant="light" onClick={() => navigate('/settings')}>Settings and backups</Button>
      </Group>
    </Stack>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <>
      <Title order={2}>{title}</Title>
      <Text c="dimmed">Coming soon.</Text>
    </>
  );
}

export function App() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = sections.find((s) => pathname.startsWith(s.path))?.path ?? '/home';

  return (
    <AppShell header={{ height: 100 }} padding="md">
      <AppShell.Header>
        <Group h={48} px="md" justify="space-between">
          <Title order={3}>Potos en Holandes</Title>
          <OfflineStatus />
        </Group>
        <Tabs value={active} onChange={(v) => v && navigate(v)}>
          <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
            {sections.map((s) => (
              <Tabs.Tab key={s.path} value={s.path}>
                {s.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="sm">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/flashcards" element={<FlashcardsPage />} />
            <Route path="/reading" element={<ReadingPage />} />
            <Route path="/manage" element={<ContentManagerPage />} />
            <Route path="/exercises" element={<SentenceExercisesPage />} />
            <Route path="/settings" element={<BackupPage />} />
            {sections
              .filter((s) => !['/home', '/flashcards', '/reading', '/manage', '/exercises', '/settings'].includes(s.path))
              .map((s) => (
                <Route key={s.path} path={s.path} element={<Placeholder title={s.label} />} />
              ))}
            <Route path="*" element={<Placeholder title="Welkom" />} />
          </Routes>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
