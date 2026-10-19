import { db } from './db';
import type { Category, Exercise, ReadingPassage, VocabularyItem } from './schema';
import vocabularySeed from './vocabularySeed.json';
import readingSeed from './readingSeed.json';
import messageReadingSeed from './messageReadingSeed.json';

const stamp = {
  source: 'seed' as const,
  reviewStatus: 'published' as const,
  createdAt: 0,
  updatedAt: 0,
};

const baseCategories: Category[] = [
  { ...stamp, id: 'seed-cat-greetings', name: 'Begroetingen', description: 'Polite greetings', sortOrder: 0 },
  { ...stamp, id: 'seed-cat-daily', name: 'Dagelijks leven', description: 'Everyday words', sortOrder: 1 },
];

const baseVocabularyItems: VocabularyItem[] = [
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

const categories = [
  ...baseCategories,
  ...(vocabularySeed.categories as Category[]),
  ...(readingSeed.categories as Category[]),
  ...(messageReadingSeed.categories as Category[]),
];
const vocabularyItems = [...baseVocabularyItems, ...(vocabularySeed.vocabularyItems as VocabularyItem[])];

const baseReadingPassages: ReadingPassage[] = [
  {
    ...stamp,
    id: 'seed-passage-v2-1',
    title: 'Afspraak bij de gemeente',
    dutchText: 'Sara heeft dinsdag een afspraak bij de gemeente. Ze moet haar paspoort meenemen. De afspraak is om tien uur.',
    categoryIds: ['seed-cat-daily'],
    cefrLevel: 'A2',
    context: 'appointment',
  },
  {
    ...stamp,
    id: 'seed-passage-shop',
    title: 'Aanbieding bij de supermarkt',
    dutchText: 'Deze week kosten appels één euro per kilo. De supermarkt is open van maandag tot en met zaterdag, van negen tot zes.',
    categoryIds: ['seed-cat-daily'],
    cefrLevel: 'A2',
    context: 'advertisement',
  },
  {
    ...stamp,
    id: 'seed-passage-reminder',
    title: 'Herinnering van de tandarts',
    dutchText: 'Uw afspraak bij de tandarts is donderdag om half drie. Kom tien minuten eerder. Neem uw verzekeringspas mee.',
    categoryIds: ['seed-cat-daily'],
    cefrLevel: 'A2',
    context: 'appointment-reminder',
  },
];

const baseExercises: Exercise[] = [
  {
    ...stamp,
    id: 'seed-ex-cloze-1',
    type: 'missing-word',
    categoryIds: ['seed-cat-daily'],
    difficulty: 'easy',
    prompt: 'Ik ___ naar school.',
    acceptedAnswers: ['ga'],
    answerOptions: ['ga', 'gaan', 'ben'],
    explanationEn: 'The verb gaan becomes ga with ik.',
  },
  {
    ...stamp,
    id: 'seed-ex-cloze-2',
    type: 'missing-word',
    categoryIds: ['seed-cat-daily'],
    difficulty: 'easy',
    prompt: 'Zij ___ een afspraak bij de dokter.',
    acceptedAnswers: ['heeft'],
    answerOptions: ['heeft', 'heb', 'hebt'],
    explanationEn: 'With zij, the verb hebben becomes heeft.',
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
  {
    ...stamp,
    id: 'seed-ex-mc-2',
    type: 'multiple-choice',
    categoryIds: ['seed-cat-daily'],
    difficulty: 'easy',
    prompt: 'Hoe laat is Sara haar afspraak?',
    passageId: 'seed-passage-v2-1',
    sortOrder: 1,
    options: [
      { id: 'seed-option-ten', text: 'Om tien uur', isCorrect: true, explanationEn: 'Correct: the last sentence says the appointment is at ten.' },
      { id: 'seed-option-nine', text: 'Om negen uur', isCorrect: false, explanationEn: 'The text says ten o’clock, not nine.' },
      { id: 'seed-option-eleven', text: 'Om elf uur', isCorrect: false, explanationEn: 'The text says ten o’clock, not eleven.' },
    ],
  },
  {
    ...stamp,
    id: 'seed-ex-shop-1',
    type: 'multiple-choice',
    categoryIds: ['seed-cat-daily'],
    difficulty: 'easy',
    prompt: 'Hoeveel kosten de appels per kilo?',
    passageId: 'seed-passage-shop',
    sortOrder: 0,
    options: [
      { id: 'seed-option-one-euro', text: 'Eén euro', isCorrect: true, explanationEn: 'Correct: the advert says one euro per kilo.' },
      { id: 'seed-option-two-euro', text: 'Twee euro', isCorrect: false, explanationEn: 'The advert says one euro, not two.' },
      { id: 'seed-option-free', text: 'Gratis', isCorrect: false, explanationEn: 'The apples cost one euro per kilo; they are not free.' },
    ],
  },
  {
    ...stamp,
    id: 'seed-ex-shop-2',
    type: 'multiple-choice',
    categoryIds: ['seed-cat-daily'],
    difficulty: 'easy',
    prompt: 'Op welke dagen is de supermarkt open?',
    passageId: 'seed-passage-shop',
    sortOrder: 1,
    options: [
      { id: 'seed-option-mon-sat', text: 'Van maandag tot en met zaterdag', isCorrect: true, explanationEn: 'Correct: the advert gives Monday through Saturday as opening days.' },
      { id: 'seed-option-weekend', text: 'Alleen in het weekend', isCorrect: false, explanationEn: 'The shop is open Monday through Saturday, not only at the weekend.' },
      { id: 'seed-option-sunday', text: 'Elke zondag', isCorrect: false, explanationEn: 'Sunday is not included in the stated opening days.' },
    ],
  },
  {
    ...stamp,
    id: 'seed-ex-reminder-1',
    type: 'multiple-choice',
    categoryIds: ['seed-cat-daily'],
    difficulty: 'easy',
    prompt: 'Wanneer is de afspraak bij de tandarts?',
    passageId: 'seed-passage-reminder',
    sortOrder: 0,
    options: [
      { id: 'seed-option-thursday', text: 'Donderdag om half drie', isCorrect: true, explanationEn: 'Correct: the reminder says Thursday at half past two.' },
      { id: 'seed-option-friday', text: 'Vrijdag om half drie', isCorrect: false, explanationEn: 'The reminder says Thursday, not Friday.' },
      { id: 'seed-option-thursday-three', text: 'Donderdag om drie uur', isCorrect: false, explanationEn: 'Half drie is 2:30, not 3:00.' },
    ],
  },
  {
    ...stamp,
    id: 'seed-ex-reminder-2',
    type: 'multiple-choice',
    categoryIds: ['seed-cat-daily'],
    difficulty: 'easy',
    prompt: 'Wat moet u meenemen?',
    passageId: 'seed-passage-reminder',
    sortOrder: 1,
    options: [
      { id: 'seed-option-insurance', text: 'Uw verzekeringspas', isCorrect: true, explanationEn: 'Correct: the reminder asks you to bring your insurance card.' },
      { id: 'seed-option-passport', text: 'Uw paspoort', isCorrect: false, explanationEn: 'The reminder asks for an insurance card, not a passport.' },
      { id: 'seed-option-book', text: 'Een boek', isCorrect: false, explanationEn: 'The reminder does not ask you to bring a book.' },
    ],
  },
];

const readingPassages = [
  ...baseReadingPassages,
  ...(readingSeed.passages as ReadingPassage[]),
  ...(messageReadingSeed.passages as ReadingPassage[]),
];
const exercises = [
  ...baseExercises,
  ...(readingSeed.exercises as Exercise[]),
  ...(messageReadingSeed.exercises as Exercise[]),
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
      const existingVocabulary = await db.vocabularyItems.toArray();
      const promotedIds = new Set(vocabularyItems.map((item) => item.id));
      for (const item of existingVocabulary) {
        if (promotedIds.has(item.id) && item.source === 'imported' && item.reviewStatus === 'draft') {
          await db.vocabularyItems.update(item.id, { reviewStatus: 'reviewed' });
        }
      }
      await db.meta.put({ key: 'seededIds', value: [...applied] });
    },
  );
}