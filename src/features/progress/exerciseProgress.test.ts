import { describe, expect, it } from 'vitest';
import { latestAttemptsByExercise, matchesDifficultyFilter, matchesResultFilter } from './exerciseProgress';

describe('exercise progress helpers', () => {
  it('uses the latest attempt for each exercise', () => {
    const attempts = [
      { id: 'old', exerciseId: 'exercise-1', sessionId: 'one', response: 'a', isCorrect: false, attemptedAt: 10 },
      { id: 'new', exerciseId: 'exercise-1', sessionId: 'two', response: 'b', isCorrect: true, attemptedAt: 20 },
      { id: 'other', exerciseId: 'exercise-2', sessionId: 'three', response: 'c', isCorrect: false, attemptedAt: 15 },
    ];
    const latest = latestAttemptsByExercise(attempts);

    expect(latest.get('exercise-1')?.id).toBe('new');
    expect(latest.get('exercise-2')?.id).toBe('other');
    expect(matchesResultFilter(latest.get('exercise-1'), 'correct')).toBe(true);
    expect(matchesResultFilter(latest.get('exercise-2'), 'incorrect')).toBe(true);
    expect(matchesResultFilter(undefined, 'unanswered')).toBe(true);
    expect(matchesResultFilter(undefined, 'correct')).toBe(false);
    expect(matchesDifficultyFilter('difficult', 'difficult')).toBe(true);
    expect(matchesDifficultyFilter(undefined, 'easy')).toBe(false);
    expect(matchesDifficultyFilter(undefined, 'all')).toBe(true);
  });
});
