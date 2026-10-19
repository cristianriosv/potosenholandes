import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { applyBackup, createBackup, parseBackup, previewBackup } from './backup';
import { categories, exercises, flashcardReviews, legacyProgress, practiceAttempts, readingPassages, vocabularyItems } from './repositories';

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

async function populateData() {
  const category = await categories.save({ id: 'cat-health', name: 'Gezondheid', source: 'seed' });
  const vocabulary = await vocabularyItems.save({
    id: 'word-fiets',
    categoryIds: [category.id],
    dutchWord: 'fiets',
    article: 'de',
    englishTranslation: 'bicycle',
  });
  const passage = await readingPassages.save({
    id: 'passage-doctor',
    title: 'Bij de dokter',
    dutchText: 'De dokter werkt vandaag.',
    categoryIds: [category.id],
    cefrLevel: 'A2',
    context: 'appointment',
  });
  const exercise = await exercises.save({
    id: 'question-doctor',
    type: 'multiple-choice',
    categoryIds: [category.id],
    difficulty: 'easy',
    prompt: 'Wie werkt vandaag?',
    passageId: passage.id,
    sortOrder: 0,
    options: [
      { id: 'doctor', text: 'De dokter', isCorrect: true, explanationEn: 'The passage says the doctor works today.' },
      { id: 'teacher', text: 'De leraar', isCorrect: false, explanationEn: 'The passage does not mention a teacher.' },
    ],
  });
  const attempt = await practiceAttempts.record({
    exerciseId: exercise.id,
    sessionId: 'session-export',
    response: 'doctor',
    isCorrect: true,
  });
  const review = await flashcardReviews.record(vocabulary.id, 'hard');
  await legacyProgress.record('question', exercise.id, true);
  await db.meta.put({ key: 'seededIds', value: ['seed-tombstone'] });
  return { category, vocabulary, passage, exercise, attempt, review };
}

describe('backup service', () => {
  it('round-trips learning content, attempts, reviews, legacy progress, and seed tombstones', async () => {
    const original = await populateData();
    const fileText = JSON.stringify(await createBackup());
    await Promise.all(db.tables.map((table) => table.clear()));

    await applyBackup(fileText, 'restore');
    expect(await db.categories.get(original.category.id)).toEqual(original.category);
    expect(await db.vocabularyItems.get(original.vocabulary.id)).toEqual(original.vocabulary);
    expect(await db.readingPassages.get(original.passage.id)).toEqual(original.passage);
    expect(await db.exercises.get(original.exercise.id)).toEqual(original.exercise);
    expect(await db.practiceAttempts.get(original.attempt.id)).toEqual(original.attempt);
    expect(await db.flashcardReviews.get(original.review.id)).toEqual(original.review);
    expect(await db.progress.get(`question:${original.exercise.id}`)).toMatchObject({ attempts: 1, correct: 1 });
    expect((await db.meta.get('seededIds'))?.value).toEqual(['seed-tombstone']);
  });

  it('previews additions, updates, exact duplicates, and user-content conflicts', async () => {
    await categories.save({ id: 'seed-category', name: 'Old seed', source: 'seed' });
    await categories.save({ id: 'user-category', name: 'Keep my edit', source: 'user' });
    await categories.save({ id: 'duplicate-category', name: 'Already here', source: 'user' });
    const backup = await createBackup();
    backup.categories = backup.categories.map((category) => {
      if (category.id === 'seed-category') return { ...category, name: 'Updated seed', updatedAt: 2 };
      if (category.id === 'user-category') return { ...category, name: 'Incoming change', source: 'imported', updatedAt: 2 };
      return category;
    });
    backup.categories.push(
      { id: 'new-category', name: 'New', description: '', sortOrder: 0, source: 'imported', reviewStatus: 'draft', createdAt: 1, updatedAt: 2 },
    );

    const preview = await previewBackup(backup);
    expect(preview.collections.categories).toMatchObject({ additions: 1, updates: 1, duplicates: 1, conflicts: 1 });
    await applyBackup(backup, 'merge');
    expect((await categories.get('seed-category'))?.name).toBe('Updated seed');
    expect((await categories.get('user-category'))?.name).toBe('Keep my edit');
    expect((await categories.get('new-category'))?.name).toBe('New');
  });

  it('rejects invalid JSON, duplicate IDs, unsupported versions, and broken references', async () => {
    expect(() => parseBackup('{')).toThrow('not valid JSON');
    const backup = await createBackup();
    const duplicateCategory = {
      id: 'duplicate-category', name: 'Duplicate', description: '', sortOrder: 0,
      source: 'user' as const, reviewStatus: 'draft' as const, createdAt: 0, updatedAt: 0,
    };
    backup.categories.push({ ...duplicateCategory }, { ...duplicateCategory });
    expect(() => parseBackup(backup)).toThrow('duplicate IDs');

    const unsupported = { ...await createBackup(), schemaVersion: 99 };
    expect(() => parseBackup(unsupported)).toThrow('not supported');

    const broken = await createBackup();
    broken.exercises.push({
      id: 'orphan-question', type: 'multiple-choice', categoryIds: [], difficulty: 'easy', prompt: 'Question?',
      passageId: 'missing-passage', sortOrder: 0,
      options: [
        { id: 'yes', text: 'Yes', isCorrect: true, explanationEn: 'Correct.' },
        { id: 'no', text: 'No', isCorrect: false, explanationEn: 'Incorrect.' },
      ],
      source: 'user', reviewStatus: 'draft', createdAt: 0, updatedAt: 0,
    });
    expect(() => parseBackup(broken)).toThrow('references missing passage');
  });

  it('does not partially restore when an IndexedDB write is interrupted', async () => {
    await categories.save({ id: 'keep-existing', name: 'Keep this' });
    const source = await createBackup();
    source.categories.push({ id: 'replace-me', name: 'Replacement', description: '', sortOrder: 0, source: 'seed', reviewStatus: 'draft', createdAt: 0, updatedAt: 0 });
    source.vocabularyItems.push({
      id: 'trigger-interruption', categoryIds: ['keep-existing'], dutchWord: 'fiets', englishTranslation: 'bicycle',
      exampleDutch: '', exampleEnglish: '', source: 'user', reviewStatus: 'draft', createdAt: 0, updatedAt: 0,
    });
    const interrupt = () => {
      throw new Error('simulated write interruption');
    };
    db.vocabularyItems.hook('creating').subscribe(interrupt);
    try {
      await expect(applyBackup(source, 'restore')).rejects.toThrow('simulated write interruption');
    } finally {
      db.vocabularyItems.hook('creating').unsubscribe(interrupt);
    }
    expect(await db.categories.get('keep-existing')).toMatchObject({ name: 'Keep this' });
    expect(await db.categories.get('replace-me')).toBeUndefined();
  });
});