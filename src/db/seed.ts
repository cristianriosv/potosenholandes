import type { EntityTable } from 'dexie';
import { db } from './db';
import type { Category, Flashcard, Passage, SentenceExercise } from './schema';

const T = 0; // Fixed timestamp keeps seed records deterministic.
const stamp = { source: 'seed' as const, createdAt: T, updatedAt: T };

const categories: Category[] = [
  { ...stamp, id: 'seed-cat-greetings', name: 'Begroetingen' },
  { ...stamp, id: 'seed-cat-daily', name: 'Dagelijks leven' },
];

const flashcards: Flashcard[] = [
  { ...stamp, id: 'seed-fc-hallo', categoryId: 'seed-cat-greetings', dutch: 'Goedemorgen', english: 'Good morning' },
  { ...stamp, id: 'seed-fc-dank', categoryId: 'seed-cat-greetings', dutch: 'Dank u wel', english: 'Thank you (formal)' },
  {
    ...stamp,
    id: 'seed-fc-huisarts',
    categoryId: 'seed-cat-daily',
    dutch: 'de huisarts',
    english: 'the general practitioner',
    exampleNl: 'Ik heb een afspraak bij de huisarts.',
    exampleEn: 'I have an appointment with the GP.',
  },
];

const exercises: SentenceExercise[] = [
  {
    ...stamp,
    id: 'seed-ex-cloze-1',
    kind: 'cloze',
    prompt: 'Ik ___ naar school.',
    acceptedAnswers: ['ga'],
    english: 'I go to school.',
  },
  {
    ...stamp,
    id: 'seed-ex-order-1',
    kind: 'order',
    acceptedSentences: ['Ik woon in Amsterdam'],
    english: 'I live in Amsterdam.',
  },
];

const passages: Passage[] = [
  {
    ...stamp,
    id: 'seed-passage-1',
    title: 'Afspraak bij de huisarts',
    body: 'Anna heeft last van haar rug. Ze belt de huisarts en maakt een afspraak voor dinsdag om negen uur.',
    questions: [
      {
        id: 'q1',
        prompt: 'Wanneer is de afspraak?',
        correctOptionId: 'a',
        options: [
          { id: 'a', text: 'Dinsdag om negen uur', explanationEn: 'Correct: the text says "dinsdag om negen uur".' },
          { id: 'b', text: 'Maandag om negen uur', explanationEn: 'Incorrect: the appointment is on Tuesday (dinsdag), not Monday.' },
          { id: 'c', text: 'Dinsdag om tien uur', explanationEn: 'Incorrect: the time is nine (negen), not ten.' },
        ],
      },
    ],
  },
];

export const SEED_ITEMS = { categories, flashcards, exercises, passages };

// Adds only seed items never applied before, so user deletions and edits are kept.
export async function seedIfNeeded(): Promise<void> {
  await db.transaction('rw', [db.categories, db.flashcards, db.exercises, db.passages, db.meta], async () => {
    const applied = new Set<string>(((await db.meta.get('seededIds'))?.value as string[] | undefined) ?? []);
    const add = async <T extends { id: string }>(table: EntityTable<T, 'id'>, items: T[]) => {
      const fresh = items.filter((i) => !applied.has(i.id));
      await table.bulkAdd(fresh);
      fresh.forEach((i) => applied.add(i.id));
    };
    await add(db.categories, categories);
    await add(db.flashcards, flashcards);
    await add(db.exercises, exercises);
    await add(db.passages, passages);
    await db.meta.put({ key: 'seededIds', value: [...applied] });
  });
}
