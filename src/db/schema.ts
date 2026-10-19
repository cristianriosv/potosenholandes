import { z } from 'zod';

export const BACKUP_SCHEMA_VERSION = 2;

const id = z.string().trim().min(1, 'ID is required');
const text = z.string().trim().min(1, 'This field is required');
const categoryIds = z.array(id).refine((ids) => new Set(ids).size === ids.length, 'Category IDs must be unique');

const base = {
  id,
  source: z.enum(['seed', 'user', 'imported']).default('user'),
  reviewStatus: z.enum(['draft', 'reviewed', 'published']).default('draft'),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
};

export const CategorySchema = z.object({
  ...base,
  name: text,
  description: z.string().default(''),
  sortOrder: z.number().int().default(0),
});

export const VocabularyItemSchema = z.object({
  ...base,
  categoryIds,
  dutchWord: text,
  article: z.enum(['de', 'het']).optional(),
  englishTranslation: text,
  exampleDutch: z.string().default(''),
  exampleEnglish: z.string().default(''),
  plural: z.string().optional(),
  verbForms: z
    .object({
      presentSingular: z.string().optional(),
      pastSingular: z.string().optional(),
      pastParticiple: z.string().optional(),
    })
    .optional(),
  localImageRef: z
    .string()
    .min(1)
    .refine((path) => !path.startsWith('//') && !/^[a-z][a-z\d+.-]*:/i.test(path), 'Images must use a local reference')
    .optional(),
});

export const CEFRLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const ReadingPassageSchema = z.object({
  ...base,
  title: text,
  dutchText: text,
  categoryIds,
  cefrLevel: CEFRLevelSchema,
  context: text,
});

const ExerciseBase = {
  ...base,
  categoryIds,
  difficulty: z.enum(['easy', 'medium', 'hard']),
  prompt: text,
  passageId: id.optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  hints: z.array(text).optional(),
};

export const MultipleChoiceOptionSchema = z.object({
  id,
  text,
  isCorrect: z.boolean(),
  explanationEn: text,
});

const MultipleChoiceExerciseSchema = z.object({
  ...ExerciseBase,
  type: z.literal('multiple-choice'),
  options: z.array(MultipleChoiceOptionSchema).min(2, 'Add at least two answer options'),
});

const MissingWordExerciseSchema = z.object({
  ...ExerciseBase,
  type: z.literal('missing-word'),
  prompt: z.string().refine((value) => value.includes('___'), 'Prompt must contain ___'),
  acceptedAnswers: z.array(text).min(1, 'Add at least one accepted answer'),
  answerOptions: z.array(text).min(2, 'Add at least two answer choices').optional(),
  explanationEn: z.string().optional(),
});

const WordOrderExerciseSchema = z.object({
  ...ExerciseBase,
  type: z.literal('word-order'),
  acceptedSentences: z.array(text).min(1, 'Add at least one accepted sentence'),
  explanationEn: z.string().optional(),
});

export const MatchingPairSchema = z.object({
  id,
  dutch: text,
  english: text,
  explanationEn: z.string().optional(),
});

const MatchingExerciseSchema = z.object({
  ...ExerciseBase,
  type: z.literal('matching'),
  pairs: z.array(MatchingPairSchema).min(2, 'Add at least two matching pairs'),
});

const ExerciseUnionSchema = z.discriminatedUnion('type', [
  MultipleChoiceExerciseSchema,
  MissingWordExerciseSchema,
  WordOrderExerciseSchema,
  MatchingExerciseSchema,
]);

export const ExerciseSchema = ExerciseUnionSchema.superRefine((exercise, context) => {
  if (exercise.type === 'missing-word' && exercise.answerOptions) {
    const choices = exercise.answerOptions.map((answer) => answer.toLocaleLowerCase());
    if (new Set(choices).size !== choices.length) {
      context.addIssue({ code: 'custom', path: ['answerOptions'], message: 'Answer choices must be unique' });
    }
    if (exercise.acceptedAnswers.some((answer) => !choices.includes(answer.toLocaleLowerCase()))) {
      context.addIssue({ code: 'custom', path: ['answerOptions'], message: 'Every accepted answer must be an answer choice' });
    }
  }
  if (exercise.type === 'multiple-choice') {
    const correctCount = exercise.options.filter((option) => option.isCorrect).length;
    if (correctCount !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'A multiple-choice exercise must have exactly one correct option',
      });
    }
    if (new Set(exercise.options.map((option) => option.id)).size !== exercise.options.length) {
      context.addIssue({ code: 'custom', path: ['options'], message: 'Option IDs must be unique' });
    }
  }
  if (exercise.type === 'matching' && new Set(exercise.pairs.map((pair) => pair.id)).size !== exercise.pairs.length) {
    context.addIssue({ code: 'custom', path: ['pairs'], message: 'Matching pair IDs must be unique' });
  }

  if (new Set(exercise.categoryIds).size !== exercise.categoryIds.length) {
    context.addIssue({ code: 'custom', path: ['categoryIds'], message: 'Category IDs must be unique' });
  }

  if (exercise.passageId && exercise.type !== 'multiple-choice') {
    context.addIssue({ code: 'custom', path: ['passageId'], message: 'Only multiple-choice exercises can reference a passage' });
  }
  if (exercise.passageId && exercise.sortOrder === undefined) {
    context.addIssue({ code: 'custom', path: ['sortOrder'], message: 'Passage questions require a sort order' });
  }
  if (!exercise.passageId && exercise.sortOrder !== undefined) {
    context.addIssue({ code: 'custom', path: ['sortOrder'], message: 'Sort order is only used for passage questions' });
  }
});

export const PracticeAttemptSchema = z.object({
  id,
  exerciseId: id,
  sessionId: id,
  response: z.union([z.string(), z.array(z.string()), z.record(z.string(), z.string())]),
  isCorrect: z.boolean(),
  attemptedAt: z.number().int().nonnegative(),
});

export const FlashcardReviewSchema = z.object({
  id,
  vocabularyItemId: id,
  rating: z.enum(['again', 'hard', 'easy']),
  reviewedAt: z.number().int().nonnegative(),
  nextDueAt: z.number().int().nonnegative(),
});

export const LegacyProgressSchema = z.object({
  id,
  itemType: z.enum(['flashcard', 'exercise', 'question']),
  itemId: id,
  attempts: z.number().int().min(0),
  correct: z.number().int().min(0),
  lastSeenAt: z.number().int().nonnegative(),
});

export const BackupSchema = z.object({
  app: z.literal('potosenholandes'),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.number().int().nonnegative(),
  categories: z.array(CategorySchema),
  vocabularyItems: z.array(VocabularyItemSchema),
  readingPassages: z.array(ReadingPassageSchema),
  exercises: z.array(ExerciseSchema),
  practiceAttempts: z.array(PracticeAttemptSchema),
  flashcardReviews: z.array(FlashcardReviewSchema),
});

export type Category = z.infer<typeof CategorySchema>;
export type VocabularyItem = z.infer<typeof VocabularyItemSchema>;
export type ReadingPassage = z.infer<typeof ReadingPassageSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type PracticeAttempt = z.infer<typeof PracticeAttemptSchema>;
export type FlashcardReview = z.infer<typeof FlashcardReviewSchema>;
export type LegacyProgress = z.infer<typeof LegacyProgressSchema>;
export type Backup = z.infer<typeof BackupSchema>;
