import { describe, expect, it } from 'vitest';
import { getClozeChoices, createWordTokens, isAcceptedWordOrder } from './exerciseUtils';
import type { Exercise } from '../../db/schema';

const base = {
  id: 'exercise-cloze',
  type: 'missing-word' as const,
  categoryIds: [],
  difficulty: 'easy' as const,
  prompt: 'Ik ___ naar huis.',
  acceptedAnswers: ['ga'],
  source: 'user' as const,
  reviewStatus: 'draft' as const,
  createdAt: 1,
  updatedAt: 1,
};

describe('sentence exercise utilities', () => {
  it('accepts alternative word orders regardless of punctuation or case', () => {
    expect(isAcceptedWordOrder('morgen ga ik naar huis!', ['Ik ga morgen naar huis', 'Morgen ga ik naar huis.'])).toBe(true);
    expect(isAcceptedWordOrder('Morgen woon ik hier', ['Ik woon hier morgen'])).toBe(false);
  });

  it('creates a distinct token for repeated words and includes alternative vocabulary', () => {
    const tokens = createWordTokens(['Ik zie de de man.', 'Ik zie de man.']);
    expect(tokens.map((token) => token.text)).toEqual(['Ik', 'zie', 'de', 'de', 'man.']);
    expect(new Set(tokens.map((token) => token.id)).size).toBe(tokens.length);
  });

  it('preserves authored word tiles for ordering practice', () => {
    const tiles = createWordTokens(['Morgen gaan wij naar de huisarts.'], ['Morgen', 'gaan', 'wij', 'naar', 'de', 'huisarts']);
    expect(tiles.map((token) => token.text)).toEqual(['Morgen', 'gaan', 'wij', 'naar', 'de', 'huisarts']);
    expect(new Set(tiles.map((token) => token.id)).size).toBe(tiles.length);
  });

  it('uses only stored choices and derives legacy distractors from other stored cloze answers', () => {
    const current: Exercise = { ...base, answerOptions: ['ga', 'gaan', 'ben'] };
    const distractor: Exercise = { ...base, id: 'exercise-other', acceptedAnswers: ['heeft'] };
    expect(getClozeChoices(current, [current, distractor])).toEqual(['ga', 'gaan', 'ben']);
    expect(getClozeChoices(base, [base, distractor])).toEqual(['ga', 'heeft']);
  });
});
