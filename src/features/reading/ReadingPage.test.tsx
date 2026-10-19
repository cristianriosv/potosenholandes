import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { db } from '../../db/db';
import { exercises, readingPassages } from '../../db/repositories';
import { ReadingPage } from './ReadingPage';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

async function addPracticePassage() {
  const passage = await readingPassages.save({
    id: 'passage-shop',
    title: 'Bij de winkel',
    dutchText: 'De winkel is open op maandag. Brood kost twee euro.',
    categoryIds: [],
    cefrLevel: 'A2',
    context: 'advertisement',
  });
  const first = await exercises.save({
    id: 'question-day',
    type: 'multiple-choice',
    categoryIds: [],
    difficulty: 'easy',
    prompt: 'Wanneer is de winkel open?',
    passageId: passage.id,
    sortOrder: 0,
    options: [
      { id: 'monday', text: 'Op maandag', isCorrect: true, explanationEn: 'Correct: the text says Monday.' },
      { id: 'sunday', text: 'Op zondag', isCorrect: false, explanationEn: 'The text says Monday, not Sunday.' },
    ],
  });
  const second = await exercises.save({
    id: 'question-price',
    type: 'multiple-choice',
    categoryIds: [],
    difficulty: 'easy',
    prompt: 'Hoeveel kost het brood?',
    passageId: passage.id,
    sortOrder: 1,
    options: [
      { id: 'two-euro', text: 'Twee euro', isCorrect: true, explanationEn: 'Correct: the text says two euros.' },
      { id: 'one-euro', text: 'Eén euro', isCorrect: false, explanationEn: 'The text says two euros, not one.' },
    ],
  });
  return { passage, first, second };
}

function renderReading() {
  return render(
    <MantineProvider>
      <ReadingPage />
    </MantineProvider>,
  );
}

describe('ReadingPage', () => {
  it('shows an empty state when no passages are stored', async () => {
    renderReading();
    expect(await screen.findByText('No reading passages match these filters.')).toBeInTheDocument();
  });

  it('gives stored feedback, prevents duplicate submits, calculates score, retries, and persists attempts', async () => {
    const user = userEvent.setup();
    const { passage, first, second } = await addPracticePassage();
      const view = renderReading();

    await user.click(await screen.findByRole('button', { name: 'Read passage' }));
      expect(await screen.findByText(passage.dutchText)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Op maandag' }));
    await user.dblClick(screen.getByRole('button', { name: 'Check answer' }));
    expect(await screen.findByText('Correct: the text says Monday.')).toBeInTheDocument();
    expect(await db.practiceAttempts.where('exerciseId').equals(first.id).count()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Next question' }));
    await user.click(screen.getByRole('radio', { name: 'Eén euro' }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    const feedback = await screen.findByRole('alert');
    expect(within(feedback).getByText('The text says two euros, not one.')).toBeInTheDocument();
    expect(within(feedback).getByText('Correct answer: Twee euro')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'See score' }));
    expect(screen.getByText('Your score: 1 of 2')).toBeInTheDocument();
    expect(await db.practiceAttempts.where('exerciseId').equals(second.id).count()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText(/Question 1 of 2/)).toBeInTheDocument();
    view.unmount();

    db.close();
    await db.open();
    renderReading();
    expect(await db.practiceAttempts.where('exerciseId').equals(first.id).count()).toBe(1);
    expect(await db.practiceAttempts.where('exerciseId').equals(second.id).count()).toBe(1);
  });
});
