import type { Exercise } from '../../db/schema';

export interface WordToken {
  id: string;
  text: string;
}

export function normalizeSentence(value: string): string {
  return value
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAcceptedWordOrder(response: string, acceptedSentences: string[]): boolean {
  const normalized = normalizeSentence(response);
  return acceptedSentences.some((sentence) => normalizeSentence(sentence) === normalized);
}

export function createWordTokens(acceptedSentences: string[]): WordToken[] {
  const maximumCounts = new Map<string, { count: number; text: string }>();
  for (const sentence of acceptedSentences) {
    const counts = new Map<string, { count: number; text: string }>();
    for (const text of sentence.trim().split(/\s+/).filter(Boolean)) {
      const key = normalizeSentence(text);
      const existing = counts.get(key);
      counts.set(key, { count: (existing?.count ?? 0) + 1, text: existing?.text ?? text });
    }
    for (const [key, value] of counts) {
      const previous = maximumCounts.get(key);
      if (!previous || value.count > previous.count) maximumCounts.set(key, value);
    }
  }

  const orderedTokens: WordToken[] = [];
  for (const sentence of acceptedSentences) {
    for (const text of sentence.trim().split(/\s+/).filter(Boolean)) {
      const key = normalizeSentence(text);
      const remaining = maximumCounts.get(key);
      if (!remaining || remaining.count <= 0) continue;
      orderedTokens.push({ id: `token-${orderedTokens.length}`, text: remaining.text });
      remaining.count -= 1;
    }
  }
  return orderedTokens;
}

export function getClozeChoices(
  current: Extract<Exercise, { type: 'missing-word' }>,
  exercises: Exercise[],
): string[] {
  if (current.answerOptions?.length) return current.answerOptions;
  const choices = new Set<string>(current.acceptedAnswers);
  for (const exercise of exercises) {
    if (exercise.type === 'missing-word') {
      exercise.acceptedAnswers.forEach((answer) => choices.add(answer));
    }
  }
  return [...choices];
}