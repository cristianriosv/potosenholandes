import type { ExerciseTag, PracticeAttempt } from '../../db/schema';

export type ResultFilter = 'all' | 'correct' | 'incorrect' | 'unanswered';
export type DifficultyFilter = 'all' | 'easy' | 'difficult';

export function latestAttemptsByExercise(attempts: PracticeAttempt[]): Map<string, PracticeAttempt> {
  const latest = new Map<string, PracticeAttempt>();
  for (const attempt of attempts) {
    const previous = latest.get(attempt.exerciseId);
    if (!previous || attempt.attemptedAt > previous.attemptedAt) {
      latest.set(attempt.exerciseId, attempt);
    }
  }
  return latest;
}

export function matchesResultFilter(
  latestAttempt: PracticeAttempt | undefined,
  filter: ResultFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'unanswered') return !latestAttempt;
  return latestAttempt?.isCorrect === (filter === 'correct');
}

export function matchesDifficultyFilter(
  difficulty: ExerciseTag['difficulty'] | undefined,
  filter: DifficultyFilter,
): boolean {
  return filter === 'all' || difficulty === filter;
}
