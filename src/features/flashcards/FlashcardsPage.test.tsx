import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { db } from '../../db/db';
import { categories, flashcards } from '../../db/repositories';
import { FlashcardsPage } from './FlashcardsPage';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('FlashcardsPage', () => {
  it('reveals a card and records progress', async () => {
    const cat = await categories.save({ name: 'Eten' });
    const card = await flashcards.save({ categoryId: cat.id, dutch: 'brood', english: 'bread' });

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
    expect(await db.progress.get(`flashcard:${card.id}`)).toMatchObject({ attempts: 1, correct: 1 });
  });
});
