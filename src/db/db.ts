import Dexie, { type EntityTable } from 'dexie';
import type {
  Category,
  Exercise,
  FlashcardReview,
  LegacyProgress,
  PracticeAttempt,
  ReadingPassage,
  VocabularyItem,
} from './schema';
import {
  CategorySchema,
  ExerciseSchema,
  ReadingPassageSchema,
  VocabularyItemSchema,
} from './schema';

export interface MetaRecord {
  key: string;
  value: unknown;
}

export class AppDatabase extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  practiceAttempts!: EntityTable<PracticeAttempt, 'id'>;
  flashcardReviews!: EntityTable<FlashcardReview, 'id'>;
  progress!: EntityTable<LegacyProgress, 'id'>;
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

    this.version(2)
      .stores({
        categories: 'id, name, sortOrder, reviewStatus',
        flashcards: 'id, *categoryIds, dutchWord, updatedAt, reviewStatus',
        exercises: 'id, type, passageId, *categoryIds, updatedAt, reviewStatus',
        passages: 'id, title, *categoryIds, cefrLevel, updatedAt, reviewStatus',
        progress: 'id, itemType, itemId, lastSeenAt',
        meta: 'key',
        practiceAttempts: 'id, &[sessionId+exerciseId], exerciseId, sessionId, attemptedAt',
        flashcardReviews: 'id, vocabularyItemId, reviewedAt, nextDueAt',
      })
      .upgrade(async (transaction) => {
        const categoriesTable = transaction.table('categories');
        const vocabularyTable = transaction.table('flashcards');
        const exercisesTable = transaction.table('exercises');
        const passagesTable = transaction.table('passages');
        const metaTable = transaction.table('meta');

        const oldCategories = await categoriesTable.toArray();
        const oldCards = await vocabularyTable.toArray();
        const oldExercises = await exercisesTable.toArray();
        const oldPassages = await passagesTable.toArray();
        const categoryIds = new Set(oldCategories.map((category) => String(category.id)));
        const normalizedCategories = oldCategories.map((category, index) => CategorySchema.parse({
          ...category,
          description: typeof category.description === 'string' ? category.description : '',
          sortOrder: Number.isInteger(category.sortOrder) ? category.sortOrder : index,
          reviewStatus: category.reviewStatus ?? 'draft',
        }));
        const recoveredCategories = new Map<string, Category>();

        const ensureCategory = (categoryId: string): void => {
          if (categoryIds.has(categoryId)) return;
          categoryIds.add(categoryId);
          recoveredCategories.set(categoryId, CategorySchema.parse({
            id: categoryId,
            name: `Recovered category ${categoryId}`,
            description: 'Created during migration because existing content referenced a missing category.',
            sortOrder: normalizedCategories.length + recoveredCategories.size,
            source: 'imported',
            reviewStatus: 'draft',
            createdAt: 0,
            updatedAt: 0,
          }));
        };

        const now = Date.now();
        const migratedCards: VocabularyItem[] = oldCards.map((card) => {
          const linkedCategory = typeof card.categoryId === 'string' ? card.categoryId : '';
          const linkedCategoryIds = linkedCategory ? [linkedCategory] : [];
          linkedCategoryIds.forEach(ensureCategory);
          const dutch = String(card.dutch ?? '');
          const articleMatch = /^(de|het)\s+(.+)$/i.exec(dutch);
          return VocabularyItemSchema.parse({
            id: String(card.id),
            categoryIds: linkedCategoryIds,
            dutchWord: articleMatch?.[2] ?? dutch,
            article: articleMatch?.[1]?.toLowerCase(),
            englishTranslation: String(card.english ?? ''),
            exampleDutch: String(card.exampleNl ?? ''),
            exampleEnglish: String(card.exampleEn ?? ''),
            source: card.source ?? 'user',
            reviewStatus: 'draft',
            createdAt: Number.isInteger(card.createdAt) ? card.createdAt : now,
            updatedAt: Number.isInteger(card.updatedAt) ? card.updatedAt : now,
          });
        });

        const migratedPassages: ReadingPassage[] = [];
        const passageQuestions: Exercise[] = [];
        for (const passage of oldPassages) {
          const linkedCategoryIds: string[] = Array.isArray(passage.categoryIds)
            ? passage.categoryIds.map(String)
            : [];
          linkedCategoryIds.forEach((id) => ensureCategory(String(id)));
          migratedPassages.push(ReadingPassageSchema.parse({
            id: String(passage.id),
            title: String(passage.title ?? 'Untitled passage'),
            dutchText: String(passage.body ?? ''),
            categoryIds: linkedCategoryIds.map(String),
            cefrLevel: passage.cefrLevel ?? 'A2',
            context: passage.context ?? 'general',
            source: passage.source ?? 'user',
            reviewStatus: passage.reviewStatus ?? 'draft',
            createdAt: Number.isInteger(passage.createdAt) ? passage.createdAt : now,
            updatedAt: Number.isInteger(passage.updatedAt) ? passage.updatedAt : now,
          }));

          for (const [questionIndex, question] of (Array.isArray(passage.questions) ? passage.questions : []).entries()) {
            const correctId = String(question.correctOptionId);
            passageQuestions.push(ExerciseSchema.parse({
              id: String(question.id),
              type: 'multiple-choice',
              categoryIds: linkedCategoryIds.map(String),
              difficulty: 'medium',
              prompt: String(question.prompt),
              passageId: String(passage.id),
              sortOrder: questionIndex,
              options: (question.options ?? []).map((option: Record<string, unknown>) => ({
                id: String(option.id),
                text: String(option.text),
                isCorrect: String(option.id) === correctId,
                explanationEn: String(option.explanationEn ?? 'No explanation was provided in the previous version.'),
              })),
              source: passage.source ?? 'user',
              reviewStatus: 'draft',
              createdAt: Number.isInteger(passage.createdAt) ? passage.createdAt : now,
              updatedAt: Number.isInteger(passage.updatedAt) ? passage.updatedAt : now,
            }));
          }
        }
        migratedPassages.flatMap((passage) => passage.categoryIds).forEach((id: string) => ensureCategory(id));
        migratedCards.flatMap((card) => card.categoryIds).forEach((id: string) => ensureCategory(id));

        const migratedExercises: Exercise[] = oldExercises.map((exercise) => {
          const common = {
            id: String(exercise.id),
            categoryIds: [] as string[],
            difficulty: 'medium' as const,
            prompt: String(exercise.prompt ?? 'Complete the exercise'),
            hints: [],
            source: exercise.source ?? 'user',
            reviewStatus: 'draft' as const,
            createdAt: Number.isInteger(exercise.createdAt) ? exercise.createdAt : now,
            updatedAt: Number.isInteger(exercise.updatedAt) ? exercise.updatedAt : now,
          };
          if (exercise.kind === 'cloze') {
            return ExerciseSchema.parse({
              ...common,
              type: 'missing-word',
              prompt: String(exercise.prompt ?? ''),
              acceptedAnswers: Array.isArray(exercise.acceptedAnswers) ? exercise.acceptedAnswers.map(String) : [],
              explanationEn: typeof exercise.english === 'string' ? exercise.english : undefined,
            });
          }
          return ExerciseSchema.parse({
            ...common,
            type: 'word-order',
            acceptedSentences: Array.isArray(exercise.acceptedSentences) ? exercise.acceptedSentences.map(String) : [],
            explanationEn: typeof exercise.english === 'string' ? exercise.english : undefined,
          });
        });

        const migratedIds = new Set(migratedExercises.map((exercise) => exercise.id));
        for (const question of passageQuestions) {
          if (migratedIds.has(question.id)) {
            throw new Error(`Cannot migrate passage question ${question.id}: an exercise already uses this ID.`);
          }
          migratedIds.add(question.id);
          migratedExercises.push(question);
        }

        await categoriesTable.clear();
        await categoriesTable.bulkPut([...normalizedCategories, ...recoveredCategories.values()]);
        await vocabularyTable.clear();
        await vocabularyTable.bulkPut(migratedCards);
        await exercisesTable.clear();
        await exercisesTable.bulkPut(migratedExercises);
        await passagesTable.clear();
        await passagesTable.bulkPut(migratedPassages);

        const seeded = await metaTable.get('seededIds');
        const seededIds = new Set(Array.isArray(seeded?.value) ? seeded.value.map(String) : []);
        const seededPassageIds = new Set(
          oldPassages.filter((passage) => passage.source === 'seed').map((passage) => String(passage.id)),
        );
        passageQuestions
          .filter((question) => seededPassageIds.has(question.passageId ?? ''))
          .forEach((question) => seededIds.add(question.id));
        await metaTable.put({ key: 'seededIds', value: [...seededIds] });
      });
  }

  get flashcards(): EntityTable<VocabularyItem, 'id'> {
    return this.table('flashcards') as EntityTable<VocabularyItem, 'id'>;
  }

  get vocabularyItems(): EntityTable<VocabularyItem, 'id'> {
    return this.flashcards;
  }

  get passages(): EntityTable<ReadingPassage, 'id'> {
    return this.table('passages') as EntityTable<ReadingPassage, 'id'>;
  }

  get readingPassages(): EntityTable<ReadingPassage, 'id'> {
    return this.passages;
  }
}

export const db = new AppDatabase();
