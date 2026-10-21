import { db } from './db';
import {
  BACKUP_SCHEMA_VERSION,
  BackupSchema,
  type Backup,
  type Category,
  type Exercise,
  type ExerciseTag,
  type FlashcardReview,
  type LegacyProgress,
  type PracticeAttempt,
  type ReadingPassage,
  type VocabularyItem,
} from './schema';

type BackupRecord = { id: string; source?: string; updatedAt?: number };
type CollectionKey =
  | 'categories'
  | 'vocabularyItems'
  | 'readingPassages'
  | 'exercises'
  | 'practiceAttempts'
  | 'flashcardReviews'
  | 'exerciseTags'
  | 'legacyProgress';
export interface ChangeCounts {
  additions: number;
  updates: number;
  duplicates: number;
  conflicts: number;
}

export interface ImportPreview {
  backup: Backup;
  collections: Record<CollectionKey, ChangeCounts>;
  totals: ChangeCounts;
}

const collectionKeys: CollectionKey[] = [
  'categories',
  'vocabularyItems',
  'readingPassages',
  'exercises',
  'practiceAttempts',
  'flashcardReviews',
  'exerciseTags',
  'legacyProgress',
];

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
}

function sameContent(left: BackupRecord, right: BackupRecord): boolean {
  const clean = (record: BackupRecord) => {
    const content = { ...record };
    delete content.source;
    delete content.updatedAt;
    return content;
  };
  return JSON.stringify(normalize(clean(left))) === JSON.stringify(normalize(clean(right)));
}

export function parseBackup(input: unknown): Backup {
  let value: unknown = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      throw new Error('The backup file is not valid JSON.');
    }
  }

  const result = BackupSchema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.') || 'Backup'}: ${issue.message}`).join('\n');
    throw new Error(`The backup is invalid. ${details}`);
  }
  if (result.data.schemaVersion !== 2 && result.data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Backup version ${result.data.schemaVersion} is not supported. Expected version ${BACKUP_SCHEMA_VERSION}.`);
  }
  const backup = { ...result.data, schemaVersion: BACKUP_SCHEMA_VERSION };
  validateReferences(backup);
  return backup;
}

function validateUniqueIds(backup: Backup): void {
  for (const key of collectionKeys) {
    const records = backup[key] as BackupRecord[];
    if (new Set(records.map((record) => record.id)).size !== records.length) {
      throw new Error(`The backup contains duplicate IDs in ${key}.`);
    }
  }
  if (new Set(backup.seededIds).size !== backup.seededIds.length) {
    throw new Error('The backup contains duplicate seed IDs.');
  }
}

function validateReferences(backup: Backup): void {
  validateUniqueIds(backup);
  const categoryIds = new Set(backup.categories.map((item) => item.id));
  const passageIds = new Set(backup.readingPassages.map((item) => item.id));
  const exerciseIds = new Set(backup.exercises.map((item) => item.id));
  const vocabularyIds = new Set(backup.vocabularyItems.map((item) => item.id));

  for (const item of backup.vocabularyItems) {
    for (const categoryId of item.categoryIds) {
      if (!categoryIds.has(categoryId)) throw new Error(`Vocabulary item "${item.id}" references missing category "${categoryId}".`);
    }
  }
  for (const passage of backup.readingPassages) {
    for (const categoryId of passage.categoryIds) {
      if (!categoryIds.has(categoryId)) throw new Error(`Passage "${passage.id}" references missing category "${categoryId}".`);
    }
  }
  for (const exercise of backup.exercises) {
    for (const categoryId of exercise.categoryIds) {
      if (!categoryIds.has(categoryId)) throw new Error(`Exercise "${exercise.id}" references missing category "${categoryId}".`);
    }
    if (exercise.passageId && !passageIds.has(exercise.passageId)) {
      throw new Error(`Exercise "${exercise.id}" references missing passage "${exercise.passageId}".`);
    }
  }
  for (const attempt of backup.practiceAttempts) {
    if (!exerciseIds.has(attempt.exerciseId)) throw new Error(`Attempt "${attempt.id}" references missing exercise "${attempt.exerciseId}".`);
  }
  for (const tag of backup.exerciseTags) {
    if (!exerciseIds.has(tag.id)) throw new Error(`Exercise tag "${tag.id}" references missing exercise "${tag.id}".`);
  }
  for (const review of backup.flashcardReviews) {
    if (!vocabularyIds.has(review.vocabularyItemId)) {
      throw new Error(`Review "${review.id}" references missing vocabulary item "${review.vocabularyItemId}".`);
    }
  }
  for (const progress of backup.legacyProgress) {
    const exists = progress.itemType === 'flashcard'
      ? vocabularyIds.has(progress.itemId)
      : exerciseIds.has(progress.itemId);
    if (!exists) throw new Error(`Legacy progress "${progress.id}" references missing content "${progress.itemId}".`);
  }
}

async function listCurrent(key: CollectionKey): Promise<BackupRecord[]> {
  switch (key) {
    case 'categories': return db.categories.toArray() as unknown as BackupRecord[];
    case 'vocabularyItems': return db.vocabularyItems.toArray() as unknown as BackupRecord[];
    case 'readingPassages': return db.readingPassages.toArray() as unknown as BackupRecord[];
    case 'exercises': return db.exercises.toArray() as unknown as BackupRecord[];
    case 'practiceAttempts': return db.practiceAttempts.toArray() as unknown as BackupRecord[];
    case 'flashcardReviews': return db.flashcardReviews.toArray() as unknown as BackupRecord[];
    case 'exerciseTags': return db.exerciseTags.toArray() as unknown as BackupRecord[];
    case 'legacyProgress': return db.progress.toArray() as unknown as BackupRecord[];
  }
}

export async function createBackup(): Promise<Backup> {
  const [categories, vocabularyItems, readingPassages, exercises, practiceAttempts, flashcardReviews, exerciseTags, legacyProgress, meta] = await Promise.all([
    db.categories.toArray(),
    db.vocabularyItems.toArray(),
    db.readingPassages.toArray(),
    db.exercises.toArray(),
    db.practiceAttempts.toArray(),
    db.flashcardReviews.toArray(),
    db.exerciseTags.toArray(),
    db.progress.toArray(),
    db.meta.get('seededIds'),
  ]);
  return BackupSchema.parse({
    app: 'potosenholandes',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: Date.now(),
    categories,
    vocabularyItems,
    readingPassages,
    exercises,
    practiceAttempts,
    flashcardReviews,
    exerciseTags,
    legacyProgress,
    seededIds: Array.isArray(meta?.value) ? meta.value : [],
  });
}

async function countChanges(key: CollectionKey, incoming: BackupRecord[]): Promise<ChangeCounts> {
  const existing = new Map((await listCurrent(key)).map((record) => [record.id, record]));
  const result: ChangeCounts = { additions: 0, updates: 0, duplicates: 0, conflicts: 0 };
  for (const item of incoming as BackupRecord[]) {
    const current = existing.get(item.id);
    if (!current) result.additions += 1;
    else if (sameContent(current, item)) result.duplicates += 1;
    else if (key === 'exerciseTags' && (item.updatedAt ?? 0) > (current.updatedAt ?? 0)) result.updates += 1;
    else if (current.source === 'user' || !current.source) result.conflicts += 1;
    else result.updates += 1;
  }
  return result;
}

export async function previewBackup(input: unknown): Promise<ImportPreview> {
  const backup = parseBackup(input);
  const entries = await Promise.all(collectionKeys.map(async (key) => [key, await countChanges(key, backup[key] as unknown as BackupRecord[])] as const));
  const collections = Object.fromEntries(entries) as Record<CollectionKey, ChangeCounts>;
  const totals = collectionKeys.reduce<ChangeCounts>((sum, key) => ({
    additions: sum.additions + collections[key].additions,
    updates: sum.updates + collections[key].updates,
    duplicates: sum.duplicates + collections[key].duplicates,
    conflicts: sum.conflicts + collections[key].conflicts,
  }), { additions: 0, updates: 0, duplicates: 0, conflicts: 0 });
  return { backup, collections, totals };
}

async function writeCollection(key: CollectionKey, records: BackupRecord[]): Promise<void> {
  switch (key) {
    case 'categories': await db.categories.bulkPut(records as unknown as Category[]); break;
    case 'vocabularyItems': await db.vocabularyItems.bulkPut(records as unknown as VocabularyItem[]); break;
    case 'readingPassages': await db.readingPassages.bulkPut(records as unknown as ReadingPassage[]); break;
    case 'exercises': await db.exercises.bulkPut(records as unknown as Exercise[]); break;
    case 'practiceAttempts': await db.practiceAttempts.bulkPut(records as unknown as PracticeAttempt[]); break;
    case 'flashcardReviews': await db.flashcardReviews.bulkPut(records as unknown as FlashcardReview[]); break;
    case 'exerciseTags': await db.exerciseTags.bulkPut(records as unknown as ExerciseTag[]); break;
    case 'legacyProgress': await db.progress.bulkPut(records as unknown as LegacyProgress[]); break;
  }
}

export async function applyBackup(input: unknown, mode: 'merge' | 'restore'): Promise<ImportPreview> {
  const preview = await previewBackup(input);
  const { backup } = preview;
  const contentTables = [db.categories, db.vocabularyItems, db.readingPassages, db.exercises];

  await db.transaction(
    'rw',
    [
      ...contentTables,
      db.practiceAttempts,
      db.flashcardReviews,
      db.exerciseTags,
      db.progress,
      db.meta,
    ],
    async () => {
      if (mode === 'restore') {
        for (const key of collectionKeys) {
          const records = backup[key] as unknown as BackupRecord[];
          switch (key) {
            case 'categories': await db.categories.clear(); break;
            case 'vocabularyItems': await db.vocabularyItems.clear(); break;
            case 'readingPassages': await db.readingPassages.clear(); break;
            case 'exercises': await db.exercises.clear(); break;
            case 'practiceAttempts': await db.practiceAttempts.clear(); break;
            case 'flashcardReviews': await db.flashcardReviews.clear(); break;
            case 'exerciseTags': await db.exerciseTags.clear(); break;
            case 'legacyProgress': await db.progress.clear(); break;
          }
          await writeCollection(key, records);
        }
        await db.meta.clear();
        await db.meta.put({ key: 'seededIds', value: backup.seededIds });
        return;
      }

      for (const key of collectionKeys) {
        const incoming = backup[key] as unknown as BackupRecord[];
        const current = new Map((await listCurrent(key)).map((record) => [record.id, record as BackupRecord]));
        const accepted = incoming.filter((item) => {
          const existing = current.get(item.id);
          if (key === 'exerciseTags') {
            return !existing || (
              !sameContent(existing, item) && (item.updatedAt ?? 0) > (existing.updatedAt ?? 0)
            );
          }
          if (!existing || sameContent(existing, item)) return !existing;
          return Boolean(existing.source && existing.source !== 'user');
        });
        await writeCollection(key, accepted);
      }

      const currentSeedIds = await db.meta.get('seededIds');
      const seeded = new Set(Array.isArray(currentSeedIds?.value) ? currentSeedIds.value.map(String) : []);
      backup.seededIds.forEach((id) => seeded.add(id));
      await db.meta.put({ key: 'seededIds', value: [...seeded] });
    },
  );

  return preview;
}