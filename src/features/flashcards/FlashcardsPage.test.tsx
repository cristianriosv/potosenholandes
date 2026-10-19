import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { db } from '../../db/db';
import { categories, vocabularyItems } from '../../db/repositories';
import { FlashcardsPage } from './FlashcardsPage';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('FlashcardsPage', () => {
  it('reveals a card and records progress', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(await db.flashcardReviews.where('vocabularyItemId').equals(card.id).count()).toBe(1);
  });
});
