import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AppDatabase, db } from './db';
import {
  categories,
  exercises,
  flashcardReviews,
  practiceAttempts,
  readingPassages,
  vocabularyItems,
} from './repositories';
import { SEED_ITEMS, seedIfNeeded } from './seed';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('canonical repositories', () => {
  it('creates, reads, updates, and duplicates categories', async () => {
    const category = await categories.save({ name: 'Eten' });
    expect(category).toMatchObject({ description: '', sortOrder: 0, reviewStatus: 'draft' });
    expect(await categories.get(category.id)).toEqual(category);
    expect(await categories.list()).toHaveLength(1);

    const updated = await categories.save({ id: category.id, name: 'Voeding', sortOrder: 2 });
    expect(updated.createdAt).toBe(category.createdAt);
    expect(updated.name).toBe('Voeding');

    const duplicate = await categories.duplicate(category.id);
    expect(duplicate).toMatchObject({ name: 'Voeding', source: 'user' });
    expect(duplicate?.id).not.toBe(category.id);
    await categories.remove(category.id);
    expect(await categories.get(category.id)).toBeUndefined();
  });

  it('validates vocabulary and checks category references', async () => {
    await expect(
      vocabularyItems.save({ dutchWord: 'brood', englishTranslation: 'bread', categoryIds: ['missing'] }),
    ).rejects.toThrow('Category "missing" does not exist.');
    await expect(
      vocabularyItems.save({ dutchWord: '', englishTranslation: 'bread', categoryIds: [] }),
    ).rejects.toBeInstanceOf(ZodError);

    const category = await categories.save({ name: 'Eten' });
    const item = await vocabularyItems.save({
      dutchWord: 'brood',
      article: 'het',
      englishTranslation: 'bread',
      categoryIds: [category.id],
    });
    expect(await vocabularyItems.get(item.id)).toMatchObject({ dutchWord: 'brood', categoryIds: [category.id] });
    expect(await vocabularyItems.list()).toHaveLength(1);
    const updated = await vocabularyItems.save({ id: item.id, englishTranslation: 'loaf' });
    expect(updated.createdAt).toBe(item.createdAt);
    expect(updated.englishTranslation).toBe('loaf');
    const duplicate = await vocabularyItems.duplicate(item.id);
    expect(duplicate?.id).not.toBe(item.id);
    await expect(categories.remove(category.id)).rejects.toThrow('still referenced');
    await vocabularyItems.remove(item.id);
    if (duplicate) await vocabularyItems.remove(duplicate.id);
    expect(await vocabularyItems.get(item.id)).toBeUndefined();
    await categories.remove(category.id);
  });

  it('creates, updates, duplicates, lists, and protects referenced passages', async () => {
    const passage = await readingPassages.save({
      title: 'Bij de winkel',
      dutchText: 'De winkel is open.',
      categoryIds: [],
      cefrLevel: 'A2',
      context: 'advertisement',
    });
    const updated = await readingPassages.save({ id: passage.id, title: 'De winkel', dutchText: 'De winkel is open.' });
    expect(updated.createdAt).toBe(passage.createdAt);
    expect(await readingPassages.get(passage.id)).toEqual(updated);
    expect(await readingPassages.list()).toHaveLength(1);
    expect((await readingPassages.duplicate(passage.id))?.id).not.toBe(passage.id);

    const question = await exercises.save({
      type: 'multiple-choice',
      categoryIds: [],
      difficulty: 'easy',
      prompt: 'Wanneer is de winkel open?',
      passageId: passage.id,
      sortOrder: 0,
      options: [
        { id: 'open', text: 'Vandaag', isCorrect: true, explanationEn: 'The passage says today.' },
        { id: 'closed', text: 'Morgen', isCorrect: false, explanationEn: 'The passage says today, not tomorrow.' },
      ],
    });
    expect(await exercises.listForPassage(passage.id)).toEqual([question]);
    const copiedQuestion = await exercises.duplicate(question.id);
    expect(copiedQuestion?.sortOrder).toBe(1);
    if (copiedQuestion?.type === 'multiple-choice' && question.type === 'multiple-choice') {
      expect(copiedQuestion.options.map((option) => option.id)).not.toEqual(question.options.map((option) => option.id));
    }
    await expect(readingPassages.remove(passage.id)).rejects.toThrow('still referenced');
    await exercises.remove(question.id);
    if (copiedQuestion) await exercises.remove(copiedQuestion.id);
    await readingPassages.remove(passage.id);
    expect(await readingPassages.get(passage.id)).toBeUndefined();
  });

  it('validates exercise answer rules and passage references', async () => {
    const invalidOptions = {
      type: 'multiple-choice' as const,
      categoryIds: [],
      difficulty: 'easy' as const,
      prompt: 'Question?',
      options: [
        { id: 'a', text: 'A', isCorrect: true, explanationEn: 'Because A.' },
        { id: 'b', text: 'B', isCorrect: true, explanationEn: 'Because B.' },
      ],
    };
    await expect(exercises.save(invalidOptions)).rejects.toThrow('exactly one correct option');
    await expect(
      exercises.save({
        ...invalidOptions,
        options: [
          { id: 'a', text: 'A', isCorrect: true, explanationEn: '' },
          { id: 'b', text: 'B', isCorrect: false, explanationEn: 'Not B.' },
        ],
      }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      exercises.save({
        type: 'multiple-choice',
        categoryIds: [],
        difficulty: 'easy',
        prompt: 'Question?',
        passageId: 'missing',
        sortOrder: 0,
        options: [
          { id: 'a', text: 'A', isCorrect: true, explanationEn: 'Correct.' },
          { id: 'b', text: 'B', isCorrect: false, explanationEn: 'Incorrect.' },
        ],
      }),
    ).rejects.toThrow('Passage "missing" does not exist.');
    await expect(
      exercises.save({ type: 'missing-word', categoryIds: [], difficulty: 'easy', prompt: 'No blank', acceptedAnswers: ['yes'] }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('records attempts and flashcard ratings with local schedules', async () => {
    const exercise = await exercises.save({
      type: 'word-order',
      categoryIds: [],
      difficulty: 'easy',
      prompt: 'Order these words.',
      acceptedSentences: ['Ik woon hier'],
    });
    const updated = await exercises.save({ id: exercise.id, prompt: 'Build this sentence.' });
    expect(updated.createdAt).toBe(exercise.createdAt);
    const duplicate = await exercises.duplicate(exercise.id);
    expect(duplicate?.id).not.toBe(exercise.id);
    const attempt = await practiceAttempts.record({
      exerciseId: updated.id,
      sessionId: 'session-1',
      response: 'Ik woon hier',
      isCorrect: true,
    });
    expect(await practiceAttempts.forExercise(updated.id)).toEqual([attempt]);
    await exercises.remove(updated.id);
    expect(await practiceAttempts.forExercise(updated.id)).toEqual([]);
    if (duplicate) await exercises.remove(duplicate.id);

    const item = await vocabularyItems.save({ dutchWord: 'huis', englishTranslation: 'house', categoryIds: [] });
    const review = await flashcardReviews.record(item.id, 'hard');
    expect(review.nextDueAt - review.reviewedAt).toBe(24 * 60 * 60_000);
    expect(await flashcardReviews.forVocabularyItem(item.id)).toEqual([review]);
    await vocabularyItems.remove(item.id);
    expect(await flashcardReviews.forVocabularyItem(item.id)).toEqual([]);
  });
});

describe('seedIfNeeded', () => {
  it('is idempotent and does not resurrect a deleted seed item', async () => {
    await seedIfNeeded();
    expect(await db.vocabularyItems.count()).toBe(SEED_ITEMS.vocabularyItems.length);
    await vocabularyItems.remove('seed-fc-hallo');
    await seedIfNeeded();
    expect(await db.vocabularyItems.count()).toBe(SEED_ITEMS.vocabularyItems.length - 1);
    expect(await db.exercises.count()).toBe(SEED_ITEMS.exercises.length);
  });

  it('does not overwrite a user record that shares a future seed ID', async () => {
    await categories.save({ id: 'seed-cat-greetings', name: 'My category' });
    await seedIfNeeded();
    expect(await categories.get('seed-cat-greetings')).toMatchObject({ name: 'My category', source: 'user' });
  });
});

describe('v1 database migration', () => {
  it('preserves and normalizes v1 records and converts embedded questions', async () => {
    const name = `migration-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      categories: 'id, name',
      flashcards: 'id, categoryId, updatedAt',
      exercises: 'id, kind, updatedAt',
      passages: 'id, updatedAt',
      progress: 'id, itemType, itemId',
      meta: 'key',
    });
    await legacy.open();
    await legacy.table('categories').put({ id: 'cat-old', name: 'Oud', source: 'user', createdAt: 11, updatedAt: 12 });
    await legacy.table('flashcards').put({
      id: 'card-old', categoryId: 'cat-old', dutch: 'de fiets', english: 'bicycle',
      exampleNl: 'Ik heb een fiets.', exampleEn: 'I have a bicycle.', source: 'user', createdAt: 21, updatedAt: 22,
    });
    await legacy.table('exercises').put({
      id: 'exercise-old', kind: 'cloze', prompt: 'Ik ___ hier.', acceptedAnswers: ['woon'],
      english: 'I live here.', source: 'user', createdAt: 31, updatedAt: 32,
    });
    await legacy.table('passages').put({
      id: 'passage-old', title: 'Oude tekst', body: 'Dit is een oude tekst.', source: 'seed', createdAt: 41, updatedAt: 42,
      questions: [{
        id: 'question-old', prompt: 'Wat is dit?', correctOptionId: 'option-yes', options: [
          { id: 'option-yes', text: 'Een tekst', explanationEn: 'The passage calls it a text.' },
          { id: 'option-no', text: 'Een huis', explanationEn: 'The passage does not mention a house.' },
        ],
      }],
    });
    await legacy.table('progress').put({
      id: 'flashcard:card-old', itemType: 'flashcard', itemId: 'card-old', attempts: 3, correct: 2, lastSeenAt: 51,
    });
    await legacy.table('meta').put({ key: 'seededIds', value: ['passage-old'] });
    legacy.close();

    const upgraded = new AppDatabase(name);
    await upgraded.open();
    try {
      expect(await upgraded.categories.get('cat-old')).toMatchObject({ name: 'Oud', sortOrder: 0, description: '' });
      expect(await upgraded.vocabularyItems.get('card-old')).toMatchObject({
        dutchWord: 'fiets', article: 'de', englishTranslation: 'bicycle', categoryIds: ['cat-old'], createdAt: 21,
      });
      expect(await upgraded.exercises.get('exercise-old')).toMatchObject({
        type: 'missing-word', acceptedAnswers: ['woon'], prompt: 'Ik ___ hier.',
      });
      expect(await upgraded.readingPassages.get('passage-old')).toMatchObject({
        title: 'Oude tekst', dutchText: 'Dit is een oude tekst.',
      });
      const migratedQuestion = await upgraded.exercises.get('question-old');
      expect(migratedQuestion).toMatchObject({ type: 'multiple-choice', passageId: 'passage-old', sortOrder: 0 });
      if (migratedQuestion?.type === 'multiple-choice') {
        expect(migratedQuestion.options[0]).toMatchObject({ id: 'option-yes', isCorrect: true });
      } else {
        throw new Error('Migrated passage question did not retain its multiple-choice type.');
      }
      expect(await upgraded.progress.get('flashcard:card-old')).toMatchObject({ attempts: 3, correct: 2 });
      expect((await upgraded.meta.get('seededIds'))?.value).toContain('question-old');
    } finally {
      upgraded.close();
      await Dexie.delete(name);
    }
  });
});