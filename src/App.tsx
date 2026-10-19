import { AppShell, Container, Group, Tabs, Text, Title } from '@mantine/core';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { FlashcardsPage } from './features/flashcards/FlashcardsPage';
import { ReadingPage } from './features/reading/ReadingPage';
import { ContentManagerPage } from './features/content/ContentManagerPage';
import { SentenceExercisesPage } from './features/exercises/SentenceExercisesPage';
import { BackupPage } from './features/settings/BackupPage';

const sections = [
  { path: '/flashcards', label: 'Flashcards' },
  { path: '/exercises', label: 'Exercises' },
  { path: '/reading', label: 'Reading' },
  { path: '/manage', label: 'Content' },
  { path: '/progress', label: 'Progress' },
  { path: '/settings', label: 'Settings' },
];

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
  const active = sections.find((s) => pathname.startsWith(s.path))?.path ?? null;

  return (
    <AppShell header={{ height: 100 }} padding="md">
      <AppShell.Header>
        <Group h={48} px="md">
          <Title order={3}>Potos en Holandes</Title>
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
            <Route path="/flashcards" element={<FlashcardsPage />} />
            <Route path="/reading" element={<ReadingPage />} />
            <Route path="/manage" element={<ContentManagerPage />} />
            <Route path="/exercises" element={<SentenceExercisesPage />} />
            <Route path="/settings" element={<BackupPage />} />
            {sections
              .filter((s) => !['/flashcards', '/reading', '/manage', '/exercises', '/settings'].includes(s.path))
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
