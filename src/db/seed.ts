import { db } from './db';
import type { Category, Exercise, ReadingPassage, VocabularyItem } from './schema';

const stamp = {
  source: 'seed' as const,
  reviewStatus: 'published' as const,
  createdAt: 0,
  updatedAt: 0,
};

const categories: Category[] = [
  { ...stamp, id: 'seed-cat-greetings', name: 'Begroetingen', description: 'Polite greetings', sortOrder: 0 },
  { ...stamp, id: 'seed-cat-daily', name: 'Dagelijks leven', description: 'Everyday words', sortOrder: 1 },
];

const vocabularyItems: VocabularyItem[] = [
  {
    ...stamp,
    id: 'seed-fc-hallo',
    categoryIds: ['seed-cat-greetings'],
    dutchWord: 'Goedemorgen',
    englishTranslation: 'Good morning',
    exampleDutch: '',
    exampleEnglish: '',
  },
  {
    ...stamp,
    id: 'seed-fc-dank',
    categoryIds: ['seed-cat-greetings'],
    dutchWord: 'Dank u wel',
    englishTranslation: 'Thank you (formal)',
    exampleDutch: '',
    exampleEnglish: '',
  },
  {
    ...stamp,
    id: 'seed-fc-huisarts',
    categoryIds: ['seed-cat-daily'],
    dutchWord: 'huisarts',
    article: 'de',
    englishTranslation: 'general practitioner',
    exampleDutch: 'Ik heb een afspraak bij de huisarts.',
    exampleEnglish: 'I have an appointment with the GP.',
  },
];

const readingPassages: ReadingPassage[] = [
  {
    ...stamp,
    id: 'seed-passage-v2-1',
    title: 'Afspraak bij de gemeente',
    dutchText: 'Sara heeft dinsdag een afspraak bij de gemeente. Ze moet haar paspoort meenemen.',
    categoryIds: ['seed-cat-daily'],
    cefrLevel: 'A2',
    context: 'appointment',
  },
];

const exercises: Exercise[] = [
  {
    ...stamp,
    id: 'seed-ex-cloze-1',
    type: 'missing-word',
    categoryIds: ['seed-cat-daily'],
    difficulty: 'easy',
    prompt: 'Ik ___ naar school.',
    acceptedAnswers: ['ga'],
    explanationEn: 'The verb gaan becomes ga with ik.',
  },
  {
    ...stamp,
    id: 'seed-ex-order-1',
    type: 'word-order',
    categoryIds: ['seed-cat-daily'],
    difficulty: 'easy',
    prompt: 'Make a sentence from the words.',
    acceptedSentences: ['Ik woon in Amsterdam'],
    explanationEn: 'The verb follows the subject in this simple sentence.',
  },
  {
    ...stamp,
    id: 'seed-ex-mc-1',
    type: 'multiple-choice',
    categoryIds: ['seed-cat-daily'],
    difficulty: 'easy',
    prompt: 'Wat moet Sara meenemen?',
    passageId: 'seed-passage-v2-1',
    sortOrder: 0,
    options: [
      { id: 'seed-option-passport', text: 'Haar paspoort', isCorrect: true, explanationEn: 'Correct: the passage says she must bring her passport.' },
      { id: 'seed-option-ticket', text: 'Een treinkaartje', isCorrect: false, explanationEn: 'The passage does not mention a train ticket.' },
      { id: 'seed-option-book', text: 'Een boek', isCorrect: false, explanationEn: 'The passage does not mention a book.' },
    ],
  },
];

export const SEED_ITEMS = { categories, vocabularyItems, readingPassages, exercises };

async function addUnapplied(tableName: string, items: readonly { id: string }[], applied: Set<string>): Promise<void> {
  const table = db.table(tableName);
  const existing = new Set((await table.toCollection().primaryKeys()).map(String));
  const fresh = items.filter((item) => !applied.has(item.id) && !existing.has(item.id));
  if (fresh.length > 0) await table.bulkAdd(fresh);
  items.forEach((item) => applied.add(item.id));
}

export async function seedIfNeeded(): Promise<void> {
  await db.transaction(
    'rw',
    [db.categories, db.vocabularyItems, db.readingPassages, db.exercises, db.meta],
    async () => {
      const prior = await db.meta.get('seededIds');
      const applied = new Set(Array.isArray(prior?.value) ? prior.value.map(String) : []);
      await addUnapplied('categories', categories, applied);
      await addUnapplied('flashcards', vocabularyItems, applied);
      await addUnapplied('passages', readingPassages, applied);
      await addUnapplied('exercises', exercises, applied);
      await db.meta.put({ key: 'seededIds', value: [...applied] });
    },
  );
}