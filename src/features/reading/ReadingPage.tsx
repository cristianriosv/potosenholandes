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
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { exercises, practiceAttempts, readingPassages } from '../../db/repositories';
import type { Category, Exercise, ReadingPassage } from '../../db/schema';

const ALL = 'all';

type BrowseResult =
  | { kind: 'ready'; categories: Category[]; passages: ReadingPassage[] }
  | { kind: 'error'; message: string };

type PassageResult =
  | { kind: 'ready'; passage: ReadingPassage; questions: Exercise[] }
  | { kind: 'error'; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Reading content could not be loaded.';
}

export function ReadingPage() {
  const browse = useLiveQuery(async (): Promise<BrowseResult> => {
    try {
      const [categories, passages] = await Promise.all([
        db.categories.orderBy('sortOrder').toArray(),
        db.readingPassages.toArray(),
      ]);
      return { kind: 'ready', categories, passages };
    } catch (error) {
      return { kind: 'error', message: errorMessage(error) };
    }
  }, []);

  const [categoryId, setCategoryId] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [passageId, setPassageId] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; selectedOptionId: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLock = useRef(false);

  const passageResult = useLiveQuery(async (): Promise<PassageResult | null> => {
    if (!passageId) return null;
    try {
      const passage = await readingPassages.get(passageId);
      if (!passage) return { kind: 'error', message: 'This passage is no longer available.' };
      const linked = await exercises.listForPassage(passage.id);
      const questions = linked.filter((exercise) => exercise.type === 'multiple-choice');
      if (questions.length !== linked.length) {
        return { kind: 'error', message: 'This passage contains an invalid question type.' };
      }
      return { kind: 'ready', passage, questions };
    } catch (error) {
      return { kind: 'error', message: errorMessage(error) };
    }
  }, [passageId]);

  const visiblePassages = useMemo(() => {
    if (browse?.kind !== 'ready') return [];
    return browse.passages
      .filter((passage) => categoryId === ALL || passage.categoryIds.includes(categoryId))
      .filter((passage) => level === ALL || passage.cefrLevel === level)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [browse, categoryId, level]);

  const startPassage = (id: string) => {
    submissionLock.current = false;
    setPassageId(id);
    setQuestionIndex(0);
    setSelectedOptionId(null);
    setFeedback(null);
    setSaveError(null);
    setScore(0);
    setSessionId(crypto.randomUUID());
  };

  const leavePassage = () => {
    submissionLock.current = false;
    setPassageId(null);
    setSelectedOptionId(null);
    setFeedback(null);
    setSaveError(null);
    setSessionId(crypto.randomUUID());
  };

  const retry = () => {
    submissionLock.current = false;
    setQuestionIndex(0);
    setSelectedOptionId(null);
    setFeedback(null);
    setSaveError(null);
    setScore(0);
    setSessionId(crypto.randomUUID());
  };

  const submitAnswer = async (question: Extract<Exercise, { type: 'multiple-choice' }>) => {
    if (!selectedOptionId || feedback || submissionLock.current) return;
    submissionLock.current = true;
    setIsSubmitting(true);
    setSaveError(null);
    let saved = false;
    try {
      const selectedOption = question.options.find((option) => option.id === selectedOptionId);
      if (!selectedOption) throw new Error('Choose an answer before continuing.');
      const attempt = await practiceAttempts.record({
        exerciseId: question.id,
        sessionId,
        response: selectedOption.id,
        isCorrect: selectedOption.isCorrect,
      });
      const storedOptionId = typeof attempt.response === 'string' ? attempt.response : selectedOption.id;
      setFeedback({ isCorrect: attempt.isCorrect, selectedOptionId: storedOptionId });
      if (attempt.isCorrect) setScore((current) => current + 1);
      saved = true;
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setIsSubmitting(false);
      if (!saved) submissionLock.current = false;
    }
  };

  if (!browse) {
    return (
      <Group role="status" justify="center" py="xl">
        <Loader size="sm" />
        <Text>Loading reading practice...</Text>
      </Group>
    );
  }
  if (browse.kind === 'error') {
    return <Alert color="red" title="Reading unavailable" role="alert">{browse.message}</Alert>;
  }

  if (!passageId) {
    return (
      <Stack>
        <Title order={2}>Reading</Title>
        <Text c="dimmed">Choose a short Dutch text to practice comprehension.</Text>
        <Group grow align="end">
          <Select
            label="Category"
            allowDeselect={false}
            value={categoryId}
            onChange={(value) => setCategoryId(value ?? ALL)}
            data={[{ value: ALL, label: 'All categories' }, ...browse.categories.map((category) => ({ value: category.id, label: category.name }))]}
          />
          <Select
            label="Level"
            allowDeselect={false}
            value={level}
            onChange={(value) => setLevel(value ?? ALL)}
            data={[{ value: ALL, label: 'All levels' }, ...['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((value) => ({ value, label: value }))]}
          />
        </Group>
        {visiblePassages.length === 0 ? (
          <Text c="dimmed" role="status">No reading passages match these filters.</Text>
        ) : (
          <Stack gap="sm">
            {visiblePassages.map((passage) => (
              <Paper key={passage.id} withBorder p="md">
                <Group justify="space-between" align="start">
                  <div>
                    <Text fw={600}>{passage.title}</Text>
                    <Text size="sm" c="dimmed" lineClamp={2}>{passage.dutchText}</Text>
                  </div>
                  <Badge>{passage.cefrLevel}</Badge>
                </Group>
                <Button mt="sm" variant="light" onClick={() => startPassage(passage.id)}>
                  Read passage
                </Button>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    );
  }

  if (!passageResult) {
    return (
      <Group role="status" justify="center" py="xl">
        <Loader size="sm" />
        <Text>Loading passage...</Text>
      </Group>
    );
  }
  if (passageResult.kind === 'error') {
    return (
      <Stack>
        <Button variant="subtle" onClick={leavePassage}>Back to reading</Button>
        <Alert color="red" title="Passage unavailable" role="alert">{passageResult.message}</Alert>
      </Stack>
    );
  }

  const { passage, questions } = passageResult;
  if (questions.length === 0) {
    return (
      <Stack>
        <Button variant="subtle" onClick={leavePassage}>Back to reading</Button>
        <Alert color="yellow" title="No questions yet">This passage does not have any questions yet.</Alert>
      </Stack>
    );
  }

  if (questionIndex >= questions.length) {
    return (
      <Stack>
        <Button variant="subtle" onClick={leavePassage}>Back to reading</Button>
        <Title order={2}>{passage.title}</Title>
        <Title order={3}>Practice complete</Title>
        <Text role="status">Your score: {score} of {questions.length}</Text>
        <Button onClick={retry}>Try again</Button>
      </Stack>
    );
  }

  const question = questions[questionIndex];
  if (question?.type !== 'multiple-choice') {
    return <Alert color="red" title="Question unavailable" role="alert">This question is not a multiple-choice question.</Alert>;
  }
  const selectedOption = question.options.find((option) => option.id === (feedback?.selectedOptionId ?? selectedOptionId));
  const correctOption = question.options.find((option) => option.isCorrect);

  return (
    <Stack>
      <Button variant="subtle" w="fit-content" onClick={leavePassage}>Back to reading</Button>
      <Group justify="space-between">
        <Title order={2}>{passage.title}</Title>
        <Badge>{passage.cefrLevel}</Badge>
      </Group>
      <Paper withBorder p="md">
        <Text style={{ whiteSpace: 'pre-wrap' }}>{passage.dutchText}</Text>
      </Paper>
      <Progress value={(questionIndex / questions.length) * 100} aria-label="Reading question progress" />
      <Text size="sm" c="dimmed">Question {questionIndex + 1} of {questions.length} · Score {score}</Text>
      <Title order={3}>{question.prompt}</Title>
      <Radio.Group
        value={selectedOptionId ?? ''}
        onChange={setSelectedOptionId}
        aria-label={question.prompt}
      >
        <Stack gap="xs">
          {question.options.map((option) => (
            <Radio
              key={option.id}
              value={option.id}
              label={option.text}
              disabled={Boolean(feedback) || isSubmitting}
            />
          ))}
        </Stack>
      </Radio.Group>
      {saveError && <Alert color="red" title="Answer not saved" role="alert">{saveError}</Alert>}
      {feedback && selectedOption && (
        <Alert color={feedback.isCorrect ? 'green' : 'red'} title={feedback.isCorrect ? 'Correct' : 'Not quite'} role="alert">
          <Stack gap="xs">
            <Text>{selectedOption.explanationEn}</Text>
            {!feedback.isCorrect && correctOption && <Text>Correct answer: {correctOption.text}</Text>}
          </Stack>
        </Alert>
      )}
      {feedback ? (
        <Button onClick={() => {
          submissionLock.current = false;
          setQuestionIndex((current) => current + 1);
          setSelectedOptionId(null);
          setFeedback(null);
        }}>
          {questionIndex + 1 === questions.length ? 'See score' : 'Next question'}
        </Button>
      ) : (
        <Button disabled={!selectedOptionId || isSubmitting} loading={isSubmitting} onClick={() => void submitAnswer(question)}>
          Check answer
        </Button>
      )}
    </Stack>
  );
}