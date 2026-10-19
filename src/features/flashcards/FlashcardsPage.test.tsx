import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { db } from '../../db/db';
import { categories, flashcardReviews, vocabularyItems } from '../../db/repositories';
import { FlashcardsPage } from './FlashcardsPage';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('FlashcardsPage', () => {
  it('reveals a card and stores a scheduled rating', async () => {
    const cat = await categories.save({ name: 'Eten' });
    const card = await vocabularyItems.save({ categoryIds: [cat.id], dutchWord: 'brood', englishTranslation: 'bread' });

    render(
      <MantineProvider>
        <FlashcardsPage />
      </MantineProvider>,
    );

    expect(await screen.findByText('brood')).toBeInTheDocument();
    expect(screen.queryByText('bread')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(screen.getByText('bread')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hard' }));
    const review = await db.flashcardReviews.where('vocabularyItemId').equals(card.id).first();
    expect(review).toMatchObject({ vocabularyItemId: card.id, rating: 'hard' });
    expect(review!.nextDueAt - review!.reviewedAt).toBe(24 * 60 * 60_000);
  });

  it('filters due and difficult cards from their latest review records', async () => {
    const user = userEvent.setup();
    const difficult = await vocabularyItems.save({ categoryIds: [], dutchWord: 'moeilijk', englishTranslation: 'difficult' });
    const due = await vocabularyItems.save({ categoryIds: [], dutchWord: 'nieuw', englishTranslation: 'new' });
    await flashcardReviews.record(difficult.id, 'again');
    render(<MantineProvider><FlashcardsPage /></MantineProvider>);

    await user.click(await screen.findByRole('radio', { name: 'Difficult' }));
    expect(await screen.findByText('moeilijk')).toBeInTheDocument();
    expect(screen.queryByText('nieuw')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Due' }));
    expect(await screen.findByText('nieuw')).toBeInTheDocument();
    expect(screen.queryByText('moeilijk')).not.toBeInTheDocument();
    expect(await db.flashcardReviews.where('vocabularyItemId').equals(due.id).count()).toBe(0);
  });
});
