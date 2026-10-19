import { useMemo, useState } from 'react';
import { Button, Card, Group, Select, Stack, Text, Title } from '@mantine/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { flashcardReviews } from '../../db/repositories';

const ALL = 'all';

export function FlashcardsPage() {
  const categories = useLiveQuery(() => db.categories.orderBy('name').toArray(), []);
  const cards = useLiveQuery(() => db.flashcards.toArray(), []);
  const [category, setCategory] = useState(ALL);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const deck = useMemo(
    () => (cards ?? []).filter((c) => category === ALL || c.categoryIds.includes(category)),
    [cards, category],
  );

  if (!categories || !cards) return null;

  const card = deck[index % Math.max(deck.length, 1)];

  const answer = async (known: boolean) => {
    if (!card) return;
    await flashcardReviews.record(card.id, known ? 'easy' : 'again');
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  return (
    <Stack>
      <Title order={2}>Flashcards</Title>
      <Select
        label="Category"
        allowDeselect={false}
        value={category}
        onChange={(v) => {
          setCategory(v ?? ALL);
          setIndex(0);
          setRevealed(false);
        }}
        data={[{ value: ALL, label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
      />
      {!card ? (
        <Text c="dimmed">No flashcards in this category.</Text>
      ) : (
        <>
          <Card withBorder padding="xl" onClick={() => setRevealed(true)} style={{ cursor: 'pointer' }}>
            <Stack align="center" gap="xs" mih={140} justify="center">
              <Text size="xl" fw={700}>
                {card.article ? `${card.article} ` : ''}{card.dutchWord}
              </Text>
              {revealed ? (
                <>
                  <Text>{card.englishTranslation}</Text>
                  {card.exampleDutch && <Text size="sm" fs="italic">{card.exampleDutch}</Text>}
                  {card.exampleEnglish && <Text size="sm" c="dimmed">{card.exampleEnglish}</Text>}
                </>
              ) : (
                <Text size="sm" c="dimmed">Tap to reveal</Text>
              )}
            </Stack>
          </Card>
          {revealed ? (
            <Group grow>
              <Button color="red" variant="light" onClick={() => answer(false)}>
                Again
              </Button>
              <Button color="green" onClick={() => answer(true)}>
                Got it
              </Button>
            </Group>
          ) : (
            <Button variant="default" onClick={() => setRevealed(true)}>
              Reveal
            </Button>
          )}
          <Text size="sm" c="dimmed" ta="center">
            Card {(index % deck.length) + 1} of {deck.length}
          </Text>
        </>
      )}
    </Stack>
  );
}
