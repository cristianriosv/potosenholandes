import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Progress,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { exercises, practiceAttempts } from '../../db/repositories';
import type { Category, Exercise } from '../../db/schema';
import { createWordTokens, getClozeChoices, isAcceptedWordOrder } from './exerciseUtils';

const ALL = 'all';
const sentenceTypes = ['missing-word', 'word-order', 'matching'] as const;
type SentenceType = (typeof sentenceTypes)[number];
type Feedback = { isCorrect: boolean; explanation: string };
type LibraryResult = { exercises: Exercise[]; categories: Category[] };
type MatchingPair = Extract<Exercise, { type: 'matching' }>['pairs'][number];
type WordToken = { id: string; text: string };

const typeLabel: Record<SentenceType, string> = {
  'missing-word': 'Missing word',
  'word-order': 'Word ordering',
  matching: 'Matching',
};

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Your answer could not be saved.';
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

function sentenceWithAnswer(prompt: string, answer: string): string {
  return prompt.replace('___', answer || '___');
}

export function SentenceExercisesPage() {
  const library = useLiveQuery(async (): Promise<LibraryResult> => {
    const [allExercises, categories] = await Promise.all([exercises.list(), db.categories.orderBy('sortOrder').toArray()]);
    return { exercises: allExercises, categories };
  }, []);
  const [typeFilter, setTypeFilter] = useState<SentenceType | typeof ALL>(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [orderedTokenIds, setOrderedTokenIds] = useState<string[]>([]);
  const [selectedDutchId, setSelectedDutchId] = useState<string | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [matchingHadError, setMatchingHadError] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [matchingFeedback, setMatchingFeedback] = useState<Feedback | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tokens, setTokens] = useState<WordToken[]>([]);
  const [dutchPairs, setDutchPairs] = useState<MatchingPair[]>([]);
  const [englishPairs, setEnglishPairs] = useState<MatchingPair[]>([]);
  const submissionLock = useRef(false);

  const sentenceExercises = useMemo(() => (library?.exercises ?? []).filter(
    (exercise): exercise is Extract<Exercise, { type: SentenceType }> => {
      if (exercise.type === 'matching') return exercise.pairs.length >= 2;
      return sentenceTypes.includes(exercise.type as SentenceType);
    },
  ), [library]);
  const filtered = sentenceExercises.filter((exercise) =>
    (typeFilter === ALL || exercise.type === typeFilter)
    && (categoryFilter === ALL || exercise.categoryIds.includes(categoryFilter)),
  );
  const current = sentenceExercises.find((exercise) => exercise.id === exerciseId);
  const clozeChoices = current?.type === 'missing-word' ? getClozeChoices(current, sentenceExercises) : [];
  const placedTokens = orderedTokenIds.flatMap((id) => {
    const token = tokens.find((candidate) => candidate.id === id);
    return token ? [token] : [];
  });
  const bankTokens = tokens.filter((token) => !orderedTokenIds.includes(token.id));
  const pairs = current?.type === 'matching' ? current.pairs : [];

  const resetRound = (id: string | null = exerciseId) => {
    submissionLock.current = false;
    setExerciseId(id);
    setSessionId(crypto.randomUUID());
    setSelectedAnswer(null);
    const target = sentenceExercises.find((exercise) => exercise.id === id);
    setTokens(target?.type === 'word-order' ? shuffle(createWordTokens(target.acceptedSentences, target.wordTiles)) : []);
    setDutchPairs(target?.type === 'matching' ? shuffle(target.pairs) : []);
    setEnglishPairs(target?.type === 'matching' ? shuffle(target.pairs) : []);
    setOrderedTokenIds([]);
    setSelectedDutchId(null);
    setMatchedPairIds([]);
    setMatchingHadError(false);
    setFeedback(null);
    setMatchingFeedback(null);
    setSaveError(null);
  };

  const persistAttempt = async (
    exercise: Exercise,
    response: string | string[] | Record<string, string>,
    isCorrect: boolean,
  ): Promise<boolean> => {
    if (submissionLock.current) return false;
    submissionLock.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const attempt = await practiceAttempts.record({ exerciseId: exercise.id, sessionId, response, isCorrect });
      setFeedback({ isCorrect: attempt.isCorrect, explanation: exerciseExplanation(exercise, attempt.isCorrect) });
      return true;
    } catch (error) {
      submissionLock.current = false;
      setSaveError(messageFor(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const checkCloze = async (exercise: Extract<Exercise, { type: 'missing-word' }>) => {
    if (!selectedAnswer || feedback) return;
    const isCorrect = exercise.acceptedAnswers.some((answer) => answer.trim().toLocaleLowerCase() === selectedAnswer.trim().toLocaleLowerCase());
    await persistAttempt(exercise, selectedAnswer, isCorrect);
  };

  const checkWordOrder = async (exercise: Extract<Exercise, { type: 'word-order' }>) => {
    if (feedback || orderedTokenIds.length !== tokens.length) return;
    const response = placedTokens.map((token) => token.text).join(' ');
    await persistAttempt(exercise, response, isAcceptedWordOrder(response, exercise.acceptedSentences));
  };

  const chooseDutchPair = (pairId: string) => {
    if (matchedPairIds.includes(pairId) || feedback) return;
    setSelectedDutchId(pairId);
    setMatchingFeedback(null);
  };

  const chooseEnglishPair = async (englishPair: MatchingPair, exercise: Extract<Exercise, { type: 'matching' }>) => {
    if (!selectedDutchId || matchedPairIds.includes(selectedDutchId) || feedback) return;
    const chosenDutch = pairs.find((pair) => pair.id === selectedDutchId);
    if (!chosenDutch) return;
    if (chosenDutch.id !== englishPair.id) {
      setMatchingHadError(true);
      setMatchingFeedback({
        isCorrect: false,
        explanation: chosenDutch.explanationEn || englishPair.explanationEn || 'These two items do not match. Try another pair.',
      });
      setSelectedDutchId(null);
      return;
    }

    const nextMatched = [...matchedPairIds, chosenDutch.id];
    setMatchedPairIds(nextMatched);
    setSelectedDutchId(null);
    setMatchingFeedback({ isCorrect: true, explanation: chosenDutch.explanationEn || 'Correct match.' });
    if (nextMatched.length === pairs.length) {
      const response = Object.fromEntries(pairs.map((pair) => [pair.id, pair.english]));
      await persistAttempt(exercise, response, !matchingHadError);
    }
  };

  if (!library) {
    return <Group role="status" justify="center" py="xl"><Loader size="sm" /><Text>Loading exercises...</Text></Group>;
  }

  if (!current) {
    return (
      <Stack>
        <Title order={2}>Sentence exercises</Title>
        <Group grow align="end">
          <Select
            label="Exercise type"
            allowDeselect={false}
            value={typeFilter}
            onChange={(value) => setTypeFilter((value ?? ALL) as SentenceType | typeof ALL)}
            data={[{ value: ALL, label: 'All types' }, ...sentenceTypes.map((type) => ({ value: type, label: typeLabel[type] }))]}
          />
          <Select
            label="Category"
            allowDeselect={false}
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value ?? ALL)}
            data={[{ value: ALL, label: 'All categories' }, ...library.categories.map((category) => ({ value: category.id, label: category.name }))]}
          />
        </Group>
        {filtered.length === 0 ? (
          <Text c="dimmed" role="status">No sentence exercises match these filters.</Text>
        ) : (
          <Stack gap="sm">
            {filtered.map((exercise) => (
              <Paper key={exercise.id} withBorder p="md">
                <Group justify="space-between" align="start">
                  <div>
                    <Text fw={600}>{exercise.prompt}</Text>
                    <Group gap="xs" mt={4}>
                      <Badge>{typeLabel[exercise.type]}</Badge>
                      <Badge variant="light">{exercise.difficulty}</Badge>
                    </Group>
                  </div>
                  <Button onClick={() => resetRound(exercise.id)}>Practice</Button>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    );
  }

  const canSubmit = current.type === 'missing-word'
    ? Boolean(selectedAnswer)
    : current.type === 'word-order'
      ? orderedTokenIds.length === tokens.length && tokens.length > 0
      : false;
  const unsupportedChoices = current.type === 'missing-word' && clozeChoices.length < 2;

  return (
    <Stack>
      <Button variant="subtle" w="fit-content" onClick={() => resetRound(null)}>Back to exercises</Button>
      <Group justify="space-between">
        <Title order={2}>{typeLabel[current.type]}</Title>
        <Badge>{current.difficulty}</Badge>
      </Group>
      <Text>{current.prompt}</Text>

      {current.type === 'missing-word' && (
        <>
          {unsupportedChoices ? (
            <Alert color="yellow" title="More choices needed">Add at least two selectable choices in Content manager before practicing this item.</Alert>
          ) : (
            <>
              <Paper withBorder p="md"><Text>{sentenceWithAnswer(current.prompt, selectedAnswer ?? '')}</Text></Paper>
              <Radio.Group value={selectedAnswer ?? ''} onChange={setSelectedAnswer} aria-label="Choose the missing word">
                <Stack gap="xs">
                  {clozeChoices.map((choice) => <Radio key={choice} value={choice} label={choice} disabled={Boolean(feedback) || isSaving} />)}
                </Stack>
              </Radio.Group>
            </>
          )}
        </>
      )}

      {current.type === 'word-order' && (
        <>
          <Text size="sm" c="dimmed">Select words in sentence order. Select a chosen word to remove it.</Text>
          <Paper withBorder p="md" aria-label="Current sentence">
            {placedTokens.length ? placedTokens.map((token) => (
              <Button key={token.id} size="xs" variant="light" mr={4} mb={4} disabled={Boolean(feedback) || isSaving} onClick={() => setOrderedTokenIds((ids) => ids.filter((id) => id !== token.id))}>
                {token.text}
              </Button>
            )) : <Text c="dimmed">Your sentence will appear here.</Text>}
          </Paper>
          <Group gap="xs">
            {bankTokens.map((token) => (
              <Button key={token.id} variant="default" disabled={Boolean(feedback) || isSaving} onClick={() => setOrderedTokenIds((ids) => [...ids, token.id])}>
                {token.text}
              </Button>
            ))}
          </Group>
        </>
      )}

      {current.type === 'matching' && (
        <>
          <Text size="sm" c="dimmed">Choose a Dutch word, then choose its English meaning.</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Stack>
              <Text fw={600}>Dutch</Text>
              {dutchPairs.map((pair) => (
                <Button key={pair.id} variant={selectedDutchId === pair.id ? 'filled' : 'default'} disabled={matchedPairIds.includes(pair.id) || Boolean(feedback) || isSaving} onClick={() => chooseDutchPair(pair.id)}>
                  {pair.dutch}{matchedPairIds.includes(pair.id) ? ' ✓' : ''}
                </Button>
              ))}
            </Stack>
            <Stack>
              <Text fw={600}>English</Text>
              {englishPairs.map((pair) => (
                <Button key={pair.id} variant="default" disabled={matchedPairIds.includes(pair.id) || Boolean(feedback) || isSaving} onClick={() => void chooseEnglishPair(pair, current)}>
                  {pair.english}
                </Button>
              ))}
            </Stack>
          </SimpleGrid>
          {matchingFeedback && <Alert color={matchingFeedback.isCorrect ? 'green' : 'red'} role="status">{matchingFeedback.explanation}</Alert>}
          {feedback && <Progress value={100} aria-label="Matching complete" />}
        </>
      )}

      {current.type !== 'matching' && (
        <Button disabled={!canSubmit || Boolean(feedback) || isSaving || unsupportedChoices} loading={isSaving} onClick={() => {
          if (current.type === 'missing-word') void checkCloze(current);
          if (current.type === 'word-order') void checkWordOrder(current);
        }}>Check answer</Button>
      )}

      {saveError && <Alert color="red" title="Attempt not saved" role="alert">{saveError}</Alert>}
      {feedback && (
        <Alert color={feedback.isCorrect ? 'green' : 'red'} title={feedback.isCorrect ? 'Correct' : 'Try again'} role="alert">
          <Stack gap="xs">
            <Text>{feedback.explanation}</Text>
            {!feedback.isCorrect && <Button variant="light" onClick={() => resetRound()}>Try again</Button>}
            {feedback.isCorrect && <Button variant="light" onClick={() => resetRound(null)}>Choose another exercise</Button>}
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}

function exerciseExplanation(exercise: Exercise, isCorrect: boolean): string {
  if (exercise.type === 'missing-word' || exercise.type === 'word-order') {
    return exercise.explanationEn ?? (isCorrect ? 'That answer is correct.' : 'Review the sentence and try again.');
  }
  if (exercise.type === 'matching') {
    return isCorrect ? 'All pairs are matched.' : 'At least one pair was incorrect. Try again to improve your result.';
  }
  return '';
}