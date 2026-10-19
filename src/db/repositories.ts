import type { EntityTable, Table } from 'dexie';
import type { z } from 'zod';
import { db } from './db';
import {
  CategorySchema,
  FlashcardSchema,
  PassageSchema,
  ProgressSchema,
  SentenceExerciseSchema,
  type Category,
  type Flashcard,
  type Passage,
  type Progress,
  type SentenceExercise,
} from './schema';

type Managed = { id: string; createdAt: number; updatedAt: number; source: 'seed' | 'user' };
type AutoKeys = 'id' | 'createdAt' | 'updatedAt' | 'source';
// Distributes over unions so discriminated unions keep their shape.
export type Draft<T extends Managed> = T extends unknown
  ? Omit<T, AutoKeys> & Partial<Pick<T, AutoKeys>>
  : never;

function createRepo<T extends Managed>(entityTable: EntityTable<T, 'id'>, schema: z.ZodType<T>) {
  // EntityTable's key type can't be resolved for a generic T.
  const table = entityTable as unknown as Table<T, string>;
  return {
    list: () => table.toArray(),
    get: (id: string) => table.get(id),

    // Validates before writing; throws ZodError on invalid content.
    async save(draft: Draft<T>): Promise<T> {
      const now = Date.now();
      const existing = draft.id ? await table.get(draft.id) : undefined;
      const item = schema.parse({
        source: 'user',
        ...existing,
        ...draft,
        id: draft.id ?? crypto.randomUUID(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      await table.put(item);
      return item;
    },

    async duplicate(id: string): Promise<T | undefined> {
      const original = await table.get(id);
      if (!original) return undefined;
      const now = Date.now();
      const copy = schema.parse({
        ...original,
        id: crypto.randomUUID(),
        source: 'user',
        createdAt: now,
        updatedAt: now,
      });
      await table.add(copy);
      return copy;
    },

    // Removes the item and its progress records atomically.
    async remove(id: string): Promise<void> {
      await db.transaction('rw', table, db.progress, async () => {
        await table.delete(id);
        await db.progress.where('itemId').equals(id).delete();
      });
    },
  };
}

export const flashcards = createRepo<Flashcard>(db.flashcards, FlashcardSchema);
export const exercises = createRepo<SentenceExercise>(db.exercises, SentenceExerciseSchema);
export const passages = createRepo<Passage>(db.passages, PassageSchema);
const categoryBase = createRepo<Category>(db.categories, CategorySchema);

export const categories = {
  ...categoryBase,
  // Deleting a category deletes its flashcards and their progress.
  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.categories, db.flashcards, db.progress, async () => {
      const cardIds = await db.flashcards.where('categoryId').equals(id).primaryKeys();
      await db.progress.where('itemId').anyOf(cardIds).delete();
      await db.flashcards.bulkDelete(cardIds);
      await db.progress.where('itemId').equals(id).delete();
      await db.categories.delete(id);
    });
  },
};

export const progress = {
  async record(itemType: Progress['itemType'], itemId: string, wasCorrect: boolean) {
    const key = `${itemType}:${itemId}`;
    await db.transaction('rw', db.progress, async () => {
      const prev = await db.progress.get(key);
      await db.progress.put(
        ProgressSchema.parse({
          id: key,
          itemType,
          itemId,
          attempts: (prev?.attempts ?? 0) + 1,
          correct: (prev?.correct ?? 0) + (wasCorrect ? 1 : 0),
          lastSeenAt: Date.now(),
        }),
      );
    });
  },
  get: (itemType: Progress['itemType'], itemId: string) => db.progress.get(`${itemType}:${itemId}`),
  list: () => db.progress.toArray(),
};
