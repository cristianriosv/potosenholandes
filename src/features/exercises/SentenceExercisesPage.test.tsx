import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { db } from '../../db/db';
import { exercises } from '../../db/repositories';
import { SentenceExercisesPage } from './SentenceExercisesPage';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

function renderPage() {
  return render(<MantineProvider><SentenceExercisesPage /></MantineProvider>);
}

describe('SentenceExercisesPage', () => {
  it('does not offer an empty matching placeholder for practice', async () => {
    await exercises.save({
      id: 'matching-placeholder',
      type: 'matching',
      categoryIds: [],
      difficulty: 'easy',
      prompt: 'Match the pronouns.',
      pairs: [],
      reviewStatus: 'draft',
    });
    renderPage();
    expect(await screen.findByText('No sentence exercises match these filters.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Practice' })).not.toBeInTheDocument();
  });

  it('checks selectable missing-word answers and persists feedback', async () => {
    const user = userEvent.setup();
    const exercise = await exercises.save({
      id: 'cloze-test',
      type: 'missing-word',
      categoryIds: [],
      difficulty: 'easy',
      prompt: 'Ik ___ naar huis.',
      acceptedAnswers: ['ga'],
      answerOptions: ['ga', 'gaan', 'ben'],
      explanationEn: 'With ik, gaan becomes ga.',
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Practice' }));
    await user.click(screen.getByRole('radio', { name: 'ga' }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(await screen.findByText('With ik, gaan becomes ga.')).toBeInTheDocument();
    expect(await db.practiceAttempts.where('exerciseId').equals(exercise.id).count()).toBe(1);
  });

  it('accepts alternative word orders with punctuation and casing differences', async () => {
    const user = userEvent.setup();
    const exercise = await exercises.save({
      id: 'order-test',
      type: 'word-order',
      categoryIds: [],
      difficulty: 'easy',
      prompt: 'Put the words in order.',
      acceptedSentences: ['Ik woon in Amsterdam.', 'In Amsterdam woon ik!'],
      explanationEn: 'Both word orders are correct.',
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Practice' }));
    for (const token of ['in', 'Amsterdam.', 'woon', 'Ik']) {
      await user.click(screen.getByRole('button', { name: token }));
    }
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Both word orders are correct.');
    expect(await db.practiceAttempts.where('exerciseId').equals(exercise.id).first()).toMatchObject({
      isCorrect: true,
      response: 'in Amsterdam. woon Ik',
    });
  });

  it('matches pairs by stable IDs and stores the completed attempt', async () => {
    const user = userEvent.setup();
    const exercise = await exercises.save({
      id: 'matching-test',
      type: 'matching',
      categoryIds: [],
      difficulty: 'easy',
      prompt: 'Match the words.',
      pairs: [
        { id: 'house', dutch: 'huis', english: 'house', explanationEn: 'Huis means house.' },
        { id: 'apple', dutch: 'appel', english: 'apple', explanationEn: 'Appel means apple.' },
      ],
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Practice' }));
    await user.click(screen.getByRole('button', { name: 'huis' }));
    await user.click(screen.getByRole('button', { name: 'house' }));
    await user.click(screen.getByRole('button', { name: 'appel' }));
    await user.click(screen.getByRole('button', { name: 'apple' }));
    const result = await screen.findByRole('alert');
    expect(within(result).getByText('All pairs are matched.')).toBeInTheDocument();
    expect(await db.practiceAttempts.where('exerciseId').equals(exercise.id).first()).toMatchObject({ isCorrect: true });
  });
});
