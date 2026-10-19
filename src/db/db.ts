import Dexie, { type EntityTable } from 'dexie';
import type { Category, Flashcard, Passage, Progress, SentenceExercise } from './schema';

export interface MetaRecord {
  key: string;
  value: unknown;
}

export class AppDatabase extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  flashcards!: EntityTable<Flashcard, 'id'>;
  exercises!: EntityTable<SentenceExercise, 'id'>;
  passages!: EntityTable<Passage, 'id'>;
  progress!: EntityTable<Progress, 'id'>;
  meta!: EntityTable<MetaRecord, 'key'>;

  constructor(name = 'potosenholandes') {
    super(name);
    // Never edit a released version; add version(n+1) with .upgrade() instead.
    this.version(1).stores({
      categories: 'id, name',
      flashcards: 'id, categoryId, updatedAt',
      exercises: 'id, kind, updatedAt',
      passages: 'id, updatedAt',
      progress: 'id, itemType, itemId',
      meta: 'key',
    });
  }
}

export const db = new AppDatabase();
