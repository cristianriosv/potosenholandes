import { z } from 'zod';

export const BACKUP_SCHEMA_VERSION = 1;

const id = z.string().min(1);
const text = z.string().trim().min(1);

const base = {
  id,
  source: z.enum(['seed', 'user']).default('user'),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
};

export const CategorySchema = z.object({ ...base, name: text });

export const FlashcardSchema = z.object({
  ...base,
  categoryId: id,
  dutch: text,
  english: text,
  exampleNl: z.string().optional(),
  exampleEn: z.string().optional(),
});

const ClozeExerciseSchema = z.object({
  ...base,
  kind: z.literal('cloze'),
  // Blank is marked with "___".
  prompt: z.string().refine((s) => s.includes('___'), 'Prompt must contain ___'),
  acceptedAnswers: z.array(text).min(1),
  english: z.string().optional(),
});

const OrderExerciseSchema = z.object({
  ...base,
  kind: z.literal('order'),
  // Each entry is a full valid word order (allows alternative correct sentences).
  acceptedSentences: z.array(text).min(1),
  english: z.string().optional(),
});

export const SentenceExerciseSchema = z.discriminatedUnion('kind', [
  ClozeExerciseSchema,
  OrderExerciseSchema,
]);

export const OptionSchema = z.object({
  id,
  text,
  explanationEn: text,
});

export const QuestionSchema = z
  .object({
    id,
    prompt: text,
    options: z.array(OptionSchema).min(2),
    correctOptionId: id,
  })
  .refine((q) => q.options.some((o) => o.id === q.correctOptionId), {
    message: 'correctOptionId must match an option',
    path: ['correctOptionId'],
  })
  .refine((q) => new Set(q.options.map((o) => o.id)).size === q.options.length, {
    message: 'Option ids must be unique',
    path: ['options'],
  });

export const PassageSchema = z.object({
  ...base,
  title: text,
  body: text,
  questions: z.array(QuestionSchema).min(1),
});

export const ProgressSchema = z.object({
  id, // `${itemType}:${itemId}`
  itemType: z.enum(['flashcard', 'exercise', 'question']),
  itemId: id,
  attempts: z.number().int().min(0),
  correct: z.number().int().min(0),
  lastSeenAt: z.number().int(),
});

export const BackupSchema = z.object({
  app: z.literal('potosenholandes'),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.number().int(),
  categories: z.array(CategorySchema),
  flashcards: z.array(FlashcardSchema),
  exercises: z.array(SentenceExerciseSchema),
  passages: z.array(PassageSchema),
  progress: z.array(ProgressSchema),
});

export type Category = z.infer<typeof CategorySchema>;
export type Flashcard = z.infer<typeof FlashcardSchema>;
export type SentenceExercise = z.infer<typeof SentenceExerciseSchema>;
export type Passage = z.infer<typeof PassageSchema>;
export type Progress = z.infer<typeof ProgressSchema>;
export type Backup = z.infer<typeof BackupSchema>;
