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
import { exerciseTags, exercises, practiceAttempts, readingPassages } from '../../db/repositories';
import type { Category, Exercise, ExerciseTag, PracticeAttempt, ReadingPassage } from '../../db/schema';
import {
  latestAttemptsByExercise,
  matchesDifficultyFilter,
  matchesResultFilter,
  type DifficultyFilter,
  type ResultFilter,
} from '../progress/exerciseProgress';

const ALL = 'all';

type BrowseResult =
  | { kind: 'ready'; categories: Category[]; passages: ReadingPassage[]; exercises: Exercise[]; attempts: PracticeAttempt[]; tags: ExerciseTag[] }
  | { kind: 'error'; message: string };

type PassageResult =
  | { kind: 'ready'; passage: ReadingPassage; questions: Exercise[]; attempts: PracticeAttempt[]; tags: ExerciseTag[] }
  | { kind: 'error'; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Reading content could not be loaded.';
}

export function ReadingPage() {
  const browse = useLiveQuery(async (): Promise<BrowseResult> => {
    try {
      const [categories, passages, allExercises, attempts, tags] = await Promise.all([
        db.categories.orderBy('sortOrder').toArray(),
        db.readingPassages.toArray(),
        exercises.list(),
        practiceAttempts.list(),
        exerciseTags.list(),
      ]);
      return { kind: 'ready', categories, passages, exercises: allExercises, attempts, tags };
    } catch (error) {
      return { kind: 'error', message: errorMessage(error) };
    }
  }, []);

  const [categoryId, setCategoryId] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [passageId, setPassageId] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; selectedOptionId: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
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
      const [attempts, tags] = await Promise.all([practiceAttempts.list(), exerciseTags.list()]);
      return { kind: 'ready', passage, questions, attempts, tags };
    } catch (error) {
      return { kind: 'error', message: errorMessage(error) };
    }
  }, [passageId]);

  const latestAttempts = useMemo(
    () => latestAttemptsByExercise(browse?.kind === 'ready' ? browse.attempts : []),
    [browse],
  );
  const tagsByExercise = useMemo(
    () => new Map((browse?.kind === 'ready' ? browse.tags : []).map((tag) => [tag.id, tag])),
    [browse],
  );
  const visiblePassages = useMemo(() => {
    if (browse?.kind !== 'ready') return [];
    return browse.passages
      .filter((passage) => categoryId === ALL || passage.categoryIds.includes(categoryId))
      .filter((passage) => level === ALL || passage.cefrLevel === level)
      .filter((passage) => {
        const questionIds = browse.exercises.filter((exercise) => exercise.passageId === passage.id).map((exercise) => exercise.id);
        const latestForPassage = questionIds
          .map((id) => latestAttempts.get(id))
          .filter((attempt): attempt is PracticeAttempt => Boolean(attempt))
          .sort((left, right) => right.attemptedAt - left.attemptedAt)[0];
        return matchesResultFilter(latestForPassage, resultFilter);
      })
      .filter((passage) => {
        return browse.exercises.some((exercise) =>
          exercise.passageId === passage.id
            && matchesDifficultyFilter(tagsByExercise.get(exercise.id)?.difficulty, difficultyFilter),
        );
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [browse, categoryId, level, latestAttempts, resultFilter, difficultyFilter, tagsByExercise]);

  const setDifficulty = async (id: string, difficulty: ExerciseTag['difficulty'] | null) => {
    setTagError(null);
    try {
      await exerciseTags.setDifficulty(id, difficulty);
    } catch (error) {
      setTagError(errorMessage(error));
    }
  };

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
        <Group grow align="end">
          <Select
            label="Last result"
            allowDeselect={false}
            value={resultFilter}
            onChange={(value) => setResultFilter((value ?? 'all') as ResultFilter)}
            data={[
              { value: 'all', label: 'Any result' },
              { value: 'correct', label: 'Last answer correct' },
              { value: 'incorrect', label: 'Last answer incorrect' },
              { value: 'unanswered', label: 'Not answered yet' },
            ]}
          />
          <Select
            label="Difficulty tag"
            allowDeselect={false}
            value={difficultyFilter}
            onChange={(value) => setDifficultyFilter((value ?? 'all') as DifficultyFilter)}
            data={[
              { value: 'all', label: 'Any difficulty' },
              { value: 'easy', label: 'Tagged easy' },
              { value: 'difficult', label: 'Tagged difficult' },
            ]}
          />
        </Group>
        {tagError && <Alert color="red" role="alert">{tagError}</Alert>}
        {visiblePassages.length === 0 ? (
          <Text c="dimmed" role="status">No reading passages match these filters.</Text>
        ) : (
          <Stack gap="sm">
            {visiblePassages.map((passage) => {
              const linkedQuestions = browse.exercises.filter((exercise) => exercise.passageId === passage.id);
              const lastAttempt = linkedQuestions
                .map((exercise) => latestAttempts.get(exercise.id))
                .filter((attempt): attempt is PracticeAttempt => Boolean(attempt))
                .sort((left, right) => right.attemptedAt - left.attemptedAt)[0];
              const difficulties = new Set(linkedQuestions.flatMap((exercise) => {
                const difficulty = tagsByExercise.get(exercise.id)?.difficulty;
                return difficulty ? [difficulty] : [];
              }));
              return (
                <Paper key={passage.id} withBorder p="md">
                  <Group justify="space-between" align="start">
                    <div>
                      <Text fw={600}>{passage.title}</Text>
                      <Text size="sm" c="dimmed" lineClamp={2}>{passage.dutchText}</Text>
                      <Group gap="xs" mt={4}>
                        <Badge color={!lastAttempt ? 'gray' : lastAttempt.isCorrect ? 'green' : 'red'}>
                          {!lastAttempt ? 'Not answered' : lastAttempt.isCorrect ? 'Last: correct' : 'Last: incorrect'}
                        </Badge>
                        {difficulties.has('easy') && <Badge color="blue">Easy</Badge>}
                        {difficulties.has('difficult') && <Badge color="orange">Difficult</Badge>}
                      </Group>
                    </div>
                    <Badge>{passage.cefrLevel}</Badge>
                  </Group>
                  <Button mt="sm" variant="light" onClick={() => startPassage(passage.id)}>
                    Read passage
                  </Button>
                </Paper>
              );
            })}
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
  const questionTag = passageResult.tags.find((tag) => tag.id === question.id);
  const questionLastAttempt = latestAttemptsByExercise(passageResult.attempts).get(question.id);
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
      <Group gap="xs">
        <Badge color={!questionLastAttempt ? 'gray' : questionLastAttempt.isCorrect ? 'green' : 'red'}>
          {!questionLastAttempt ? 'Not answered' : questionLastAttempt.isCorrect ? 'Last answer: correct' : 'Last answer: incorrect'}
        </Badge>
        {(['easy', 'difficult'] as const).map((difficulty) => (
          <Button
            key={difficulty}
            size="xs"
            variant={questionTag?.difficulty === difficulty ? 'filled' : 'light'}
            aria-pressed={questionTag?.difficulty === difficulty}
            onClick={() => void setDifficulty(question.id, questionTag?.difficulty === difficulty ? null : difficulty)}
          >
            {difficulty === 'easy' ? 'Easy' : 'Difficult'}
          </Button>
        ))}
      </Group>
      {tagError && <Alert color="red" role="alert">{tagError}</Alert>}
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