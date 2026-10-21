import type { EntityTable, Table } from 'dexie';
import type { z } from 'zod';
import { db } from './db';
import {
  CategorySchema,
  ExerciseSchema,
  ExerciseTagSchema,
  FlashcardReviewSchema,
  LegacyProgressSchema,
  PracticeAttemptSchema,
  ReadingPassageSchema,
  VocabularyItemSchema,
  type Category,
  type Exercise,
  type ExerciseTag,
  type FlashcardReview,
  type LegacyProgress,
  type PracticeAttempt,
  type ReadingPassage,
  type VocabularyItem,
} from './schema';

type Managed = {
  id: string;
  createdAt: number;
  updatedAt: number;
  source: 'seed' | 'user' | 'imported';
  reviewStatus: 'draft' | 'reviewed' | 'published';
};
export type Draft<T extends Managed> = T extends unknown ? Partial<T> : never;
type ReferenceCheck<T> = (item: T) => Promise<void>;

function createRepo<T extends Managed>(
  entityTable: EntityTable<T, 'id'>,
  schema: z.ZodType<T>,
  referenceTables: Table[] = [],
  checkReferences?: ReferenceCheck<T>,
) {
  const table = entityTable as unknown as Table<T, string>;

  const save = async (draft: Draft<T>, expectedUpdatedAt?: number): Promise<T> => {
    const now = Date.now();
    return db.transaction('rw', [entityTable, ...referenceTables], async () => {
      const existing = draft.id ? await table.get(draft.id) : undefined;
      if (expectedUpdatedAt !== undefined && existing?.updatedAt !== expectedUpdatedAt) {
        throw new Error('This item changed after you opened it. Close and reopen it to avoid overwriting newer content.');
      }
      const item = schema.parse({
        reviewStatus: 'draft',
        ...existing,
        ...draft,
        source: existing ? 'user' : draft.source ?? 'user',
        id: draft.id ?? crypto.randomUUID(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: Math.max(now, (existing?.updatedAt ?? 0) + 1),
      });
      await checkReferences?.(item);
      await table.put(item);
      return item;
    });
  };

  return {
    list: () => table.toArray(),
    get: (id: string) => table.get(id),
    save,
    async duplicate(id: string): Promise<T | undefined> {
      const original = await table.get(id);
      if (!original) return undefined;
      const draft = { ...original, source: 'user' } as unknown as Draft<T>;
      delete draft.id;
      delete draft.createdAt;
      delete draft.updatedAt;
      return save(draft);
    },
    async remove(id: string): Promise<void> {
      await table.delete(id);
    },
  };
}

async function requireCategories(ids: string[]): Promise<void> {
  for (const categoryId of ids) {
    if (!(await db.categories.get(categoryId))) {
      throw new Error(`Category "${categoryId}" does not exist.`);
    }
  }
}

export const categoryBase = createRepo<Category>(db.categories, CategorySchema);
export const categories = {
  ...categoryBase,
  async remove(id: string): Promise<void> {
    await db.transaction(
      'rw',
      [db.categories, db.vocabularyItems, db.readingPassages, db.exercises],
      async () => {
        const [vocabularyCount, passageCount, exerciseCount] = await Promise.all([
          db.vocabularyItems.where('categoryIds').equals(id).count(),
          db.readingPassages.where('categoryIds').equals(id).count(),
          db.exercises.where('categoryIds').equals(id).count(),
        ]);
        if (vocabularyCount + passageCount + exerciseCount > 0) {
          throw new Error(`Category "${id}" is still referenced by learning content.`);
        }
        await db.categories.delete(id);
      },
    );
  },
};

export const vocabularyItems = {
  ...createRepo<VocabularyItem>(db.vocabularyItems, VocabularyItemSchema, [db.categories], (item) =>
    requireCategories(item.categoryIds),
  ),
  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.vocabularyItems, db.flashcardReviews, async () => {
      await db.vocabularyItems.delete(id);
      await db.flashcardReviews.where('vocabularyItemId').equals(id).delete();
    });
  },
};

const readingPassageRepo = createRepo<ReadingPassage>(
    db.readingPassages,
    ReadingPassageSchema,
    [db.categories],
    (item) => requireCategories(item.categoryIds),
  );

export const readingPassages = {
  ...readingPassageRepo,
  async duplicate(id: string): Promise<ReadingPassage | undefined> {
    return db.transaction('rw', [db.readingPassages, db.exercises], async () => {
      const original = await db.readingPassages.get(id);
      if (!original) return undefined;
      const now = Date.now();
      const copy = ReadingPassageSchema.parse({
        ...original,
        id: crypto.randomUUID(),
        source: 'user',
        reviewStatus: 'draft',
        createdAt: now,
        updatedAt: now,
      });
      const questions = await exercises.listForPassage(id);
      await db.readingPassages.add(copy);
      for (const question of questions) {
        const duplicated = {
          ...question,
          id: crypto.randomUUID(),
          passageId: copy.id,
          source: 'user',
          reviewStatus: 'draft',
          createdAt: now,
          updatedAt: now,
          ...(question.type === 'multiple-choice'
            ? { options: question.options.map((option) => ({ ...option, id: crypto.randomUUID() })) }
            : {}),
        };
        await db.exercises.add(ExerciseSchema.parse(duplicated));
      }
      return copy;
    });
  },
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.readingPassages, db.exercises], async () => {
      if (await db.exercises.where('passageId').equals(id).count()) {
        throw new Error(`Passage "${id}" is still referenced by exercises. Remove or reassign those exercises first.`);
      }
      await db.readingPassages.delete(id);
    });
  },
};

const exerciseRepo = createRepo<Exercise>(
    db.exercises,
    ExerciseSchema,
    [db.categories, db.readingPassages],
    async (item) => {
      await requireCategories(item.categoryIds);
      if (item.passageId && !(await db.readingPassages.get(item.passageId))) {
        throw new Error(`Passage "${item.passageId}" does not exist.`);
      }
    },
  );

export const exercises = {
  ...exerciseRepo,
  async duplicate(id: string): Promise<Exercise | undefined> {
    const original = await db.exercises.get(id);
    if (!original) return undefined;
    const draft = { ...original, source: 'user' } as unknown as Record<string, unknown>;
    delete draft.id;
    delete draft.createdAt;
    delete draft.updatedAt;
    if (original.passageId) {
      const siblings = await db.exercises.where('passageId').equals(original.passageId).toArray();
      draft.sortOrder = Math.max(...siblings.map((exercise) => exercise.sortOrder ?? -1)) + 1;
    }
    if (original.type === 'multiple-choice') {
      draft.options = original.options.map((option) => ({ ...option, id: crypto.randomUUID() }));
    }
    if (original.type === 'matching') {
      draft.pairs = original.pairs.map((pair) => ({ ...pair, id: crypto.randomUUID() }));
    }
    return exerciseRepo.save(draft as Draft<Exercise>);
  },
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.exercises, db.practiceAttempts, db.exerciseTags], async () => {
      await db.exercises.delete(id);
      await db.practiceAttempts.where('exerciseId').equals(id).delete();
      await db.exerciseTags.delete(id);
    });
  },
  listForPassage(passageId: string): Promise<Exercise[]> {
    return db.exercises.where('passageId').equals(passageId).sortBy('sortOrder');
  },
};

export const exerciseTags = {
  async setDifficulty(id: string, difficulty: ExerciseTag['difficulty'] | null): Promise<void> {
    await db.transaction('rw', [db.exercises, db.exerciseTags], async () => {
      if (!(await db.exercises.get(id))) {
        throw new Error(`Exercise "${id}" does not exist.`);
      }
      if (!difficulty) {
        await db.exerciseTags.delete(id);
        return;
      }
      const previous = await db.exerciseTags.get(id);
      await db.exerciseTags.put(ExerciseTagSchema.parse({
        id,
        difficulty,
        updatedAt: Math.max(Date.now(), (previous?.updatedAt ?? 0) + 1),
      }));
    });
  },
  get: (id: string) => db.exerciseTags.get(id),
  list: () => db.exerciseTags.toArray(),
};

export const practiceAttempts = {
  async record(input: Omit<PracticeAttempt, 'id' | 'attemptedAt'>): Promise<PracticeAttempt> {
    return db.transaction('rw', [db.exercises, db.practiceAttempts], async () => {
      if (!(await db.exercises.get(input.exerciseId))) {
        throw new Error(`Exercise "${input.exerciseId}" does not exist.`);
      }
      const id = `attempt:${input.sessionId}:${input.exerciseId}`;
      const existing = await db.practiceAttempts.get(id);
      if (existing) return existing;
      const previousAttempts = await db.practiceAttempts.where('exerciseId').equals(input.exerciseId).toArray();
      const latestAttemptAt = previousAttempts.reduce(
        (latest, previous) => Math.max(latest, previous.attemptedAt),
        0,
      );
      const attempt = PracticeAttemptSchema.parse({
        ...input,
        id,
        attemptedAt: Math.max(Date.now(), latestAttemptAt + 1),
      });
      await db.practiceAttempts.add(attempt);
      return attempt;
    });
  },
  list: () => db.practiceAttempts.toArray(),
  forExercise: (exerciseId: string) => db.practiceAttempts.where('exerciseId').equals(exerciseId).toArray(),
};

export const flashcardReviews = {
  async record(vocabularyItemId: string, rating: FlashcardReview['rating']): Promise<FlashcardReview> {
    if (!(await db.vocabularyItems.get(vocabularyItemId))) {
      throw new Error(`Vocabulary item "${vocabularyItemId}" does not exist.`);
    }
    const reviewedAt = Date.now();
    const intervalMs = { again: 10 * 60_000, hard: 24 * 60 * 60_000, easy: 4 * 24 * 60 * 60_000 }[rating];
    const review = FlashcardReviewSchema.parse({
      id: crypto.randomUUID(),
      vocabularyItemId,
      rating,
      reviewedAt,
      nextDueAt: reviewedAt + intervalMs,
    });
    await db.flashcardReviews.add(review);
    return review;
  },
  list: () => db.flashcardReviews.toArray(),
  forVocabularyItem: (id: string) => db.flashcardReviews.where('vocabularyItemId').equals(id).toArray(),
};

export const legacyProgress = {
  async record(itemType: LegacyProgress['itemType'], itemId: string, wasCorrect: boolean): Promise<void> {
    const id = `${itemType}:${itemId}`;
    await db.transaction('rw', db.progress, async () => {
      const previous = await db.progress.get(id);
      await db.progress.put(
        LegacyProgressSchema.parse({
          id,
          itemType,
          itemId,
          attempts: (previous?.attempts ?? 0) + 1,
          correct: (previous?.correct ?? 0) + (wasCorrect ? 1 : 0),
          lastSeenAt: Date.now(),
        }),
      );
    });
  },
  get: (itemType: LegacyProgress['itemType'], itemId: string) => db.progress.get(`${itemType}:${itemId}`),
  list: () => db.progress.toArray(),
};

export const progress = legacyProgress;