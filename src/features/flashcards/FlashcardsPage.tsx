import { useMemo, useState } from 'react';
import { Button, Card, Group, Image, Select, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { flashcardReviews } from '../../db/repositories';
import type { FlashcardReview } from '../../db/schema';

const ALL = 'all';
type ReviewMode = 'all' | 'due' | 'difficult';

export function FlashcardsPage() {
  const categories = useLiveQuery(() => db.categories.orderBy('name').toArray(), []);
  const cards = useLiveQuery(() => db.flashcards.toArray(), []);
  const reviews = useLiveQuery(() => db.flashcardReviews.orderBy('reviewedAt').reverse().toArray(), []);
  const [category, setCategory] = useState(ALL);
  const [reviewMode, setReviewMode] = useState<ReviewMode>('all');
  const [dueReferenceTime, setDueReferenceTime] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const latestReviews = useMemo(() => {
    const latest = new Map<string, FlashcardReview>();
    for (const review of reviews ?? []) {
      if (!latest.has(review.vocabularyItemId)) latest.set(review.vocabularyItemId, review);
    }
    return latest;
  }, [reviews]);

  const deck = useMemo(
    () => (cards ?? [])
      .filter((card) => category === ALL || card.categoryIds.includes(category))
      .filter((card) => {
        const latest = latestReviews.get(card.id);
        if (reviewMode === 'due') return !latest || latest.nextDueAt <= dueReferenceTime;
        if (reviewMode === 'difficult') return latest?.rating === 'again' || latest?.rating === 'hard';
        return true;
      }),
    [cards, category, dueReferenceTime, latestReviews, reviewMode],
  );

  if (!categories || !cards || !reviews) return <Text role="status">Loading flashcards...</Text>;

  const card = deck[index % Math.max(deck.length, 1)];

  const answer = async (rating: 'again' | 'hard' | 'easy') => {
    if (!card) return;
    await flashcardReviews.record(card.id, rating);
    setRevealed(false);
    if (reviewMode !== 'due') setIndex((i) => i + 1);
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
      <SegmentedControl
        value={reviewMode}
        onChange={(value) => {
          const mode = value as ReviewMode;
          setReviewMode(mode);
          if (mode === 'due') setDueReferenceTime(Date.now());
          setIndex(0);
          setRevealed(false);
        }}
        data={[
          { value: 'all', label: 'All cards' },
          { value: 'due', label: 'Due' },
          { value: 'difficult', label: 'Difficult' },
        ]}
        aria-label="Flashcard review filter"
      />
      {!card ? (
        <Text c="dimmed" role="status">No cards match this review filter.</Text>
      ) : (
        <>
          <Card withBorder padding="xl" onClick={() => setRevealed(true)} style={{ cursor: 'pointer' }}>
            <Stack align="center" gap="xs" mih={140} justify="center">
              {card.localImageRef && <Image src={card.localImageRef} alt={card.dutchWord} h={96} fit="contain" />}
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
              <Button color="red" variant="light" onClick={() => void answer('again')}>Again</Button>
              <Button color="yellow" variant="light" onClick={() => void answer('hard')}>Hard</Button>
              <Button color="green" onClick={() => void answer('easy')}>Easy</Button>
            </Group>
          ) : (
            <Button variant="default" onClick={() => setRevealed(true)}>
              Reveal
            </Button>
          )}
          <Text size="sm" c="dimmed" ta="center">
            Card {(index % deck.length) + 1} of {deck.length}
          </Text>
          {latestReviews.get(card.id) && (
            <Text size="sm" c="dimmed" ta="center">
              Last review: {latestReviews.get(card.id)!.rating}. Next review {new Date(latestReviews.get(card.id)!.nextDueAt).toLocaleString()}.
            </Text>
          )}
        </>
      )}
    </Stack>
  );
}
