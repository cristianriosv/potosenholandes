import { beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { db } from './db';
import { categories, flashcards, passages, progress } from './repositories';
import { SEED_ITEMS, seedIfNeeded } from './seed';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('repositories', () => {
  it('validates before writing', async () => {
    await expect(flashcards.save({ categoryId: 'c', dutch: '', english: 'x' })).rejects.toBeInstanceOf(ZodError);
    expect(await db.flashcards.count()).toBe(0);
  });

  it('creates, edits and duplicates', async () => {
    const cat = await categories.save({ name: 'Eten' });
    const card = await flashcards.save({ categoryId: cat.id, dutch: 'brood', english: 'bread' });
    const edited = await flashcards.save({ ...card, english: 'loaf' });
    expect(edited.createdAt).toBe(card.createdAt);
    expect((await flashcards.get(card.id))?.english).toBe('loaf');

    const copy = await flashcards.duplicate(card.id);
    expect(copy?.id).not.toBe(card.id);
    expect(copy?.source).toBe('user');
    expect(await db.flashcards.count()).toBe(2);
  });

  it('removes a category with its cards and progress', async () => {
    const cat = await categories.save({ name: 'Eten' });
    const card = await flashcards.save({ categoryId: cat.id, dutch: 'brood', english: 'bread' });
    await progress.record('flashcard', card.id, true);
    await categories.remove(cat.id);
    expect(await db.flashcards.count()).toBe(0);
    expect(await db.progress.count()).toBe(0);
  });

  it('rejects a question whose correct option is missing', async () => {
    const p = SEED_ITEMS.passages[0]!;
    const bad = { ...p, id: undefined, questions: [{ ...p.questions[0]!, correctOptionId: 'zzz' }] };
    await expect(passages.save(bad)).rejects.toBeInstanceOf(ZodError);
  });

  it('tracks progress', async () => {
    await progress.record('question', 'q', true);
    await progress.record('question', 'q', false);
    expect(await progress.get('question', 'q')).toMatchObject({ attempts: 2, correct: 1 });
  });
});

describe('seedIfNeeded', () => {
  it('is idempotent and does not resurrect deleted seed items', async () => {
    await seedIfNeeded();
    const count = await db.flashcards.count();
    expect(count).toBe(SEED_ITEMS.flashcards.length);

    await flashcards.remove('seed-fc-hallo');
    await seedIfNeeded();
    expect(await db.flashcards.count()).toBe(count - 1);
  });
});
