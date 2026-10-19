import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { categories, exercises, readingPassages, vocabularyItems } from '../../db/repositories';
import {
  CategorySchema,
  ExerciseSchema,
  ReadingPassageSchema,
  VocabularyItemSchema,
  type Category,
  type Exercise,
  type ReadingPassage,
  type VocabularyItem,
} from '../../db/schema';

type ContentKind = 'category' | 'vocabulary' | 'passage' | 'exercise';
type ContentItem = Category | VocabularyItem | ReadingPassage | Exercise;
type FormValues = Record<string, unknown>;
type EditorState = { kind: ContentKind; id?: string; initialUpdatedAt?: number };
type ExerciseOption = { id: string; text: string; explanationEn: string; isCorrect: boolean };
type MatchingPair = { id: string; dutch: string; english: string; explanationEn: string };

type LibraryData = {
  categories: Category[];
  vocabulary: VocabularyItem[];
  passages: ReadingPassage[];
  exercises: Exercise[];
};

const ALL = 'all';
const kindLabels: Record<ContentKind, string> = {
  category: 'Category',
  vocabulary: 'Vocabulary',
  passage: 'Reading passage',
  exercise: 'Exercise',
};

function kindOf(item: ContentItem): ContentKind {
  if ('dutchWord' in item) return 'vocabulary';
  if ('dutchText' in item) return 'passage';
  if ('type' in item) return 'exercise';
  return 'category';
}

function titleOf(item: ContentItem): string {
  if ('name' in item) return item.name;
  if ('dutchWord' in item) return `${item.article ? `${item.article} ` : ''}${item.dutchWord}`;
  if ('dutchText' in item) return item.title;
  return item.prompt;
}

function itemCategoryIds(item: ContentItem): string[] {
  return 'categoryIds' in item ? item.categoryIds : [];
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'The change could not be saved.';
}

function initialForm(kind: ContentKind, item?: ContentItem, preset?: FormValues): FormValues {
  if (item) return { ...item };
  const common = { reviewStatus: 'draft' };
  if (kind === 'category') return { ...common, name: '', description: '', sortOrder: 0 };
  if (kind === 'vocabulary') {
    return {
      ...common,
      categoryIds: [],
      dutchWord: '',
      article: '',
      englishTranslation: '',
      exampleDutch: '',
      exampleEnglish: '',
      plural: '',
      localImageRef: '',
      verbForms: { presentSingular: '', pastSingular: '', pastParticiple: '' },
    };
  }
  if (kind === 'passage') {
    return { ...common, categoryIds: [], title: '', dutchText: '', cefrLevel: 'A2', context: 'everyday life', reviewNotes: [] };
  }
  return {
    ...common,
    ...preset,
    type: preset?.type ?? 'missing-word',
    categoryIds: preset?.categoryIds ?? [],
    difficulty: preset?.difficulty ?? 'easy',
    prompt: preset?.prompt ?? '',
    acceptedAnswers: preset?.acceptedAnswers ?? [],
    answerOptions: preset?.answerOptions ?? [],
    wordTiles: preset?.wordTiles ?? [],
  };
}

function stringValue(form: FormValues, key: string, fallback = ''): string {
  const value = form[key];
  return typeof value === 'string' ? value : fallback;
}

function stringArray(form: FormValues, key: string): string[] {
  const value = form[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function EditorFields({
  editor,
  form,
  setForm,
  library,
  error,
  onSave,
  onClose,
  onEditQuestion,
}: {
  editor: EditorState;
  form: FormValues;
  setForm: (update: (current: FormValues) => FormValues) => void;
  library: LibraryData;
  error: string | null;
  onSave: () => void;
  onClose: () => void;
  onEditQuestion: (exercise: Exercise) => void;
}) {
  const [preview, setPreview] = useState(false);
  const [acceptedAnswersText, setAcceptedAnswersText] = useState(
    stringArray(form, 'acceptedAnswers').join('\n'),
  );
  const [answerOptionsText, setAnswerOptionsText] = useState(
    stringArray(form, 'answerOptions').join('\n'),
  );
  const [acceptedSentencesText, setAcceptedSentencesText] = useState(
    stringArray(form, 'acceptedSentences').join('\n'),
  );
  const [wordTilesText, setWordTilesText] = useState(stringArray(form, 'wordTiles').join('\n'));

  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const options = (Array.isArray(form.options) ? form.options : []) as ExerciseOption[];
  const pairs = (Array.isArray(form.pairs) ? form.pairs : []) as MatchingPair[];
  const categoryChoices = library.categories.map((category) => ({ value: category.id, label: category.name }));
  const linkedQuestions = editor.kind === 'passage' && editor.id
    ? library.exercises.filter((exercise) => exercise.passageId === editor.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    : [];

  return (
    <Stack>
      {error && <Alert color="red" title="Could not save" role="alert">{error}</Alert>}
      {editor.kind === 'category' && (
        <>
          <TextInput label="Name" value={stringValue(form, 'name')} onChange={(event) => set('name', event.currentTarget.value)} required />
          <Textarea label="Description" value={stringValue(form, 'description')} onChange={(event) => set('description', event.currentTarget.value)} />
          <NumberInput label="Sort order" value={typeof form.sortOrder === 'number' ? form.sortOrder : 0} onChange={(value) => set('sortOrder', typeof value === 'number' ? value : 0)} />
        </>
      )}

      {editor.kind === 'vocabulary' && (
        <>
          <TextInput label="Dutch word" value={stringValue(form, 'dutchWord')} onChange={(event) => set('dutchWord', event.currentTarget.value)} required />
          <Select label="Article" clearable value={stringValue(form, 'article') || null} onChange={(value) => set('article', value ?? '')} data={['de', 'het']} />
          <TextInput label="English translation" value={stringValue(form, 'englishTranslation')} onChange={(event) => set('englishTranslation', event.currentTarget.value)} required />
          <MultiSelect label="Categories" data={categoryChoices} value={stringArray(form, 'categoryIds')} onChange={(value) => set('categoryIds', value)} searchable />
          <TextInput label="Dutch example" value={stringValue(form, 'exampleDutch')} onChange={(event) => set('exampleDutch', event.currentTarget.value)} />
          <TextInput label="English example" value={stringValue(form, 'exampleEnglish')} onChange={(event) => set('exampleEnglish', event.currentTarget.value)} />
          <TextInput label="Plural" value={stringValue(form, 'plural')} onChange={(event) => set('plural', event.currentTarget.value)} />
          <TextInput label="Local image path" placeholder="/images/word.webp" value={stringValue(form, 'localImageRef')} onChange={(event) => set('localImageRef', event.currentTarget.value)} />
          <Group grow>
            {([
              ['presentSingular', 'Present singular'],
              ['pastSingular', 'Past singular'],
              ['pastParticiple', 'Past participle'],
            ] as const).map(([key, label]) => {
              const forms = form.verbForms && typeof form.verbForms === 'object' ? form.verbForms as Record<string, string> : {};
              return <TextInput key={key} label={label} value={forms[key] ?? ''} onChange={(event) => set('verbForms', { ...forms, [key]: event.currentTarget.value })} />;
            })}
          </Group>
        </>
      )}

      {editor.kind === 'passage' && (
        <>
          <TextInput label="Title" value={stringValue(form, 'title')} onChange={(event) => set('title', event.currentTarget.value)} required />
          <Textarea label="Dutch passage" minRows={5} value={stringValue(form, 'dutchText')} onChange={(event) => set('dutchText', event.currentTarget.value)} required />
          <MultiSelect label="Categories" data={categoryChoices} value={stringArray(form, 'categoryIds')} onChange={(value) => set('categoryIds', value)} searchable />
          <Group grow>
            <Select label="CEFR level" value={stringValue(form, 'cefrLevel', 'A2')} onChange={(value) => set('cefrLevel', value ?? 'A2')} data={['A1', 'A2', 'B1', 'B2', 'C1', 'C2']} />
            <TextInput label="Context" value={stringValue(form, 'context')} onChange={(event) => set('context', event.currentTarget.value)} required />
          </Group>
            <Textarea
              label="Review notes (internal)"
              value={stringArray(form, 'reviewNotes').join('\n')}
              onChange={(event) => set('reviewNotes', event.currentTarget.value.split('\n').map((note) => note.trim()).filter(Boolean))}
            />
          {editor.id && (
            <Paper withBorder p="sm">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={600}>Linked questions</Text>
                  <Button size="xs" variant="light" onClick={() => onEditQuestion({
                    id: '',
                    type: 'multiple-choice',
                    categoryIds: stringArray(form, 'categoryIds'),
                    difficulty: 'easy',
                    prompt: '',
                    passageId: editor.id,
                    sortOrder: linkedQuestions.length,
                    options: [
                      { id: crypto.randomUUID(), text: '', isCorrect: true, explanationEn: '' },
                      { id: crypto.randomUUID(), text: '', isCorrect: false, explanationEn: '' },
                    ],
                    source: 'user',
                    reviewStatus: 'draft',
                    createdAt: 0,
                    updatedAt: 0,
                  })}>Add question</Button>
                </Group>
                {linkedQuestions.length === 0 && <Text size="sm" c="dimmed">No questions linked yet.</Text>}
                {linkedQuestions.map((question) => (
                  <Button key={question.id} variant="subtle" justify="start" onClick={() => onEditQuestion(question)}>
                    {question.sortOrder! + 1}. {question.prompt}
                  </Button>
                ))}
              </Stack>
            </Paper>
          )}
        </>
      )}

      {editor.kind === 'exercise' && (
        <>
          <Select
            label="Exercise type"
            value={stringValue(form, 'type', 'missing-word')}
            onChange={(value) => {
              set('type', value ?? 'missing-word');
              if (value === 'multiple-choice' && options.length < 2) {
                set('options', [
                  { id: crypto.randomUUID(), text: '', isCorrect: true, explanationEn: '' },
                  { id: crypto.randomUUID(), text: '', isCorrect: false, explanationEn: '' },
                ]);
              }
              if (value === 'matching' && pairs.length < 2) {
                set('pairs', [
                  { id: crypto.randomUUID(), dutch: '', english: '', explanationEn: '' },
                  { id: crypto.randomUUID(), dutch: '', english: '', explanationEn: '' },
                ]);
              }
            }}
            data={[
              { value: 'multiple-choice', label: 'Multiple choice' },
              { value: 'missing-word', label: 'Missing word' },
              { value: 'word-order', label: 'Word ordering' },
              { value: 'matching', label: 'Matching' },
            ]}
          />
          <TextInput label="Prompt" value={stringValue(form, 'prompt')} onChange={(event) => set('prompt', event.currentTarget.value)} required />
          <Group grow>
            <Select label="Difficulty" value={stringValue(form, 'difficulty', 'easy')} onChange={(value) => set('difficulty', value ?? 'easy')} data={['easy', 'medium', 'hard']} />
            <MultiSelect label="Categories" data={categoryChoices} value={stringArray(form, 'categoryIds')} onChange={(value) => set('categoryIds', value)} searchable />
          </Group>
          {stringValue(form, 'type') === 'multiple-choice' && (
            <>
              <Select
                label="Linked reading passage (optional)"
                clearable
                value={stringValue(form, 'passageId') || null}
                onChange={(value) => {
                  set('passageId', value ?? undefined);
                  if (value && typeof form.sortOrder !== 'number') set('sortOrder', 0);
                  if (!value) set('sortOrder', undefined);
                }}
                data={library.passages.map((passage) => ({ value: passage.id, label: passage.title }))}
              />
              {stringValue(form, 'passageId') && <NumberInput label="Question order" min={0} value={typeof form.sortOrder === 'number' ? form.sortOrder : 0} onChange={(value) => set('sortOrder', typeof value === 'number' ? value : 0)} />}
              <Stack gap="sm">
                <Text fw={600}>Answer options and English explanations</Text>
                {options.map((option, index) => (
                  <Paper key={option.id} withBorder p="sm">
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text size="sm" fw={500}>Option {index + 1}</Text>
                        <Radio
                          checked={option.isCorrect}
                          onChange={() => set('options', options.map((candidate) => ({ ...candidate, isCorrect: candidate.id === option.id })))}
                          label="Correct answer"
                          name="correct-option"
                        />
                      </Group>
                      <TextInput aria-label={`Option ${index + 1} text`} value={option.text} onChange={(event) => set('options', options.map((candidate) => candidate.id === option.id ? { ...candidate, text: event.currentTarget.value } : candidate))} required />
                      <Textarea aria-label={`Option ${index + 1} English explanation`} value={option.explanationEn} onChange={(event) => set('options', options.map((candidate) => candidate.id === option.id ? { ...candidate, explanationEn: event.currentTarget.value } : candidate))} required />
                      {options.length > 2 && <Button size="xs" color="red" variant="subtle" onClick={() => set('options', options.filter((candidate) => candidate.id !== option.id))}>Remove option</Button>}
                    </Stack>
                  </Paper>
                ))}
                <Button variant="default" onClick={() => set('options', [...options, { id: crypto.randomUUID(), text: '', explanationEn: '', isCorrect: false }])}>Add option</Button>
              </Stack>
            </>
          )}
          {stringValue(form, 'type') === 'missing-word' && (
            <>
              <Text>Use ___ in the prompt to mark the blank.</Text>
              <Textarea label="Accepted answers (one per line)" value={acceptedAnswersText} onChange={(event) => {
                setAcceptedAnswersText(event.currentTarget.value);
                set('acceptedAnswers', event.currentTarget.value.split('\n').map((answer) => answer.trim()).filter(Boolean));
              }} required />
              <Textarea label="Selectable choices (one per line)" value={answerOptionsText} onChange={(event) => {
                setAnswerOptionsText(event.currentTarget.value);
                set('answerOptions', event.currentTarget.value.split('\n').map((answer) => answer.trim()).filter(Boolean));
              }} required />
              <Textarea label="English explanation" value={stringValue(form, 'explanationEn')} onChange={(event) => set('explanationEn', event.currentTarget.value)} />
            </>
          )}
          {stringValue(form, 'type') === 'word-order' && (
            <>
              <Textarea label="Accepted sentences (one per line)" value={acceptedSentencesText} onChange={(event) => {
                setAcceptedSentencesText(event.currentTarget.value);
                set('acceptedSentences', event.currentTarget.value.split('\n').map((answer) => answer.trim()).filter(Boolean));
              }} required />
              <Textarea label="Word tiles (one per line)" value={wordTilesText} onChange={(event) => {
                setWordTilesText(event.currentTarget.value);
                set('wordTiles', event.currentTarget.value.split('\n').map((tile) => tile.trim()).filter(Boolean));
              }} />
              <Textarea label="English explanation" value={stringValue(form, 'explanationEn')} onChange={(event) => set('explanationEn', event.currentTarget.value)} />
            </>
          )}
          {stringValue(form, 'type') === 'matching' && (
            <Stack gap="sm">
              <Text fw={600}>Matching pairs</Text>
              {pairs.map((pair, index) => (
                <Paper key={pair.id} withBorder p="sm">
                  <Stack gap="xs">
                    <TextInput label={`Dutch ${index + 1}`} value={pair.dutch} onChange={(event) => set('pairs', pairs.map((candidate) => candidate.id === pair.id ? { ...candidate, dutch: event.currentTarget.value } : candidate))} required />
                    <TextInput label={`English ${index + 1}`} value={pair.english} onChange={(event) => set('pairs', pairs.map((candidate) => candidate.id === pair.id ? { ...candidate, english: event.currentTarget.value } : candidate))} required />
                    <TextInput label={`English explanation ${index + 1}`} value={pair.explanationEn} onChange={(event) => set('pairs', pairs.map((candidate) => candidate.id === pair.id ? { ...candidate, explanationEn: event.currentTarget.value } : candidate))} />
                    {pairs.length > 2 && <Button size="xs" color="red" variant="subtle" onClick={() => set('pairs', pairs.filter((candidate) => candidate.id !== pair.id))}>Remove pair</Button>}
                  </Stack>
                </Paper>
              ))}
              <Button variant="default" onClick={() => set('pairs', [...pairs, { id: crypto.randomUUID(), dutch: '', english: '', explanationEn: '' }])}>Add pair</Button>
            </Stack>
          )}
        </>
      )}

      <Select
        label="Review status"
        value={stringValue(form, 'reviewStatus', 'draft')}
        onChange={(value) => set('reviewStatus', value ?? 'draft')}
        data={[
          { value: 'draft', label: 'Draft' },
          { value: 'reviewed', label: 'Reviewed' },
          { value: 'published', label: 'Published' },
        ]}
      />
      {editor.kind === 'exercise' && (
        <Button variant="default" onClick={() => setPreview((current) => !current)}>
          {preview ? 'Hide preview' : 'Preview exercise'}
        </Button>
      )}
      {preview && <ExercisePreview form={form} />}
      <Group justify="end">
        <Button variant="default" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave}>Save</Button>
      </Group>
    </Stack>
  );
}

function ExercisePreview({ form }: { form: FormValues }) {
  const type = stringValue(form, 'type');
  const options = (Array.isArray(form.options) ? form.options : []) as ExerciseOption[];
  const pairs = (Array.isArray(form.pairs) ? form.pairs : []) as MatchingPair[];
  return (
    <Paper withBorder p="md" aria-label="Exercise preview">
      <Stack>
        <Badge w="fit-content">{type}</Badge>
        <Text fw={600}>{stringValue(form, 'prompt')}</Text>
        {type === 'multiple-choice' && options.map((option) => <Text key={option.id}>{option.text}</Text>)}
        {type === 'missing-word' && (
          <Stack gap="xs">
            {stringArray(form, 'answerOptions').map((option) => <Text key={option}>{option}</Text>)}
            <Text size="sm" c="dimmed">Accepted: {stringArray(form, 'acceptedAnswers').join(' / ')}</Text>
          </Stack>
        )}
        {type === 'word-order' && (
          <>
            {stringArray(form, 'wordTiles').length > 0 && <Text size="sm">Tiles: {stringArray(form, 'wordTiles').join(' · ')}</Text>}
            {stringArray(form, 'acceptedSentences').map((sentence) => <Text key={sentence}>{sentence}</Text>)}
          </>
        )}
        {type === 'matching' && pairs.map((pair) => <Text key={pair.id}>{pair.dutch} - {pair.english}</Text>)}
      </Stack>
    </Paper>
  );
}

export function ContentManagerPage() {
  const query = useLiveQuery(async () => {
    try {
      const [categoryList, vocabulary, passages, exerciseList] = await Promise.all([
        categories.list(), vocabularyItems.list(), readingPassages.list(), exercises.list(),
      ]);
      return { data: { categories: categoryList, vocabulary, passages, exercises: exerciseList } as LibraryData, error: null };
    } catch (error) {
      return { data: null, error: errorText(error) };
    }
  }, []);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [difficultyFilter, setDifficultyFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [form, setForm] = useState<FormValues>({});
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<Exercise | null>(null);

  const library = query?.data;
  const items = useMemo(() => {
    if (!library) return [];
    const all: ContentItem[] = [
      ...library.categories,
      ...library.vocabulary,
      ...library.passages,
      ...library.exercises,
    ];
    const term = search.trim().toLocaleLowerCase();
    return all.filter((item) => {
      if (kindFilter !== ALL && kindOf(item) !== kindFilter) return false;
      if (categoryFilter !== ALL && !itemCategoryIds(item).includes(categoryFilter)) return false;
      if (difficultyFilter !== ALL && (!('difficulty' in item) || item.difficulty !== difficultyFilter)) return false;
      if (statusFilter !== ALL && item.reviewStatus !== statusFilter) return false;
      if (!term) return true;
      return `${titleOf(item)} ${'description' in item ? item.description : ''} ${'englishTranslation' in item ? item.englishTranslation : ''}`
        .toLocaleLowerCase().includes(term);
    });
  }, [library, search, kindFilter, categoryFilter, difficultyFilter, statusFilter]);

  const openEditor = (kind: ContentKind, item?: ContentItem, preset?: FormValues, discardConfirmed = false) => {
    if (editor && isDirty && !discardConfirmed && !window.confirm('Discard unsaved changes?')) return;
    setEditor({ kind, id: item?.id, initialUpdatedAt: item?.updatedAt });
    setForm(initialForm(kind, item, preset));
    setIsDirty(false);
    setError(null);
  };

  const closeEditor = (afterSave = false) => {
    if (!afterSave && isDirty && !window.confirm('Discard unsaved changes?')) return;
    setEditor(null);
    setIsDirty(false);
    setError(null);
  };

  const getExisting = async (kind: ContentKind, id: string) => {
    if (kind === 'category') return categories.get(id);
    if (kind === 'vocabulary') return vocabularyItems.get(id);
    if (kind === 'passage') return readingPassages.get(id);
    return exercises.get(id);
  };

  const save = async () => {
    if (!editor) return;
    setError(null);
    try {
      const current = editor.id ? await getExisting(editor.kind, editor.id) : undefined;
      if (editor.id && (!current || current.updatedAt !== editor.initialUpdatedAt)) {
        throw new Error('This item changed after you opened it. Close and reopen it to avoid overwriting newer content.');
      }
      const now = Date.now();
      const base = {
        id: editor.id ?? crypto.randomUUID(),
        source: 'user',
        reviewStatus: stringValue(form, 'reviewStatus', 'draft'),
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      const expectedUpdatedAt = editor.id ? editor.initialUpdatedAt : undefined;

      if (editor.kind === 'category') {
        await categories.save(CategorySchema.parse({
          ...base,
          name: stringValue(form, 'name'),
          description: stringValue(form, 'description'),
          sortOrder: typeof form.sortOrder === 'number' ? form.sortOrder : 0,
        }), expectedUpdatedAt);
      } else if (editor.kind === 'vocabulary') {
        const verbForms = form.verbForms && typeof form.verbForms === 'object'
          ? form.verbForms as { presentSingular?: string; pastSingular?: string; pastParticiple?: string }
          : undefined;
        await vocabularyItems.save(VocabularyItemSchema.parse({
          ...base,
          categoryIds: stringArray(form, 'categoryIds'),
          dutchWord: stringValue(form, 'dutchWord'),
          article: stringValue(form, 'article') || undefined,
          englishTranslation: stringValue(form, 'englishTranslation'),
          exampleDutch: stringValue(form, 'exampleDutch'),
          exampleEnglish: stringValue(form, 'exampleEnglish'),
          plural: stringValue(form, 'plural') || undefined,
          localImageRef: stringValue(form, 'localImageRef') || undefined,
          verbForms: verbForms && Object.values(verbForms).some(Boolean) ? verbForms : undefined,
        }), expectedUpdatedAt);
      } else if (editor.kind === 'passage') {
        await readingPassages.save(ReadingPassageSchema.parse({
          ...base,
          title: stringValue(form, 'title'),
          dutchText: stringValue(form, 'dutchText'),
          categoryIds: stringArray(form, 'categoryIds'),
          cefrLevel: stringValue(form, 'cefrLevel', 'A2'),
          context: stringValue(form, 'context'),
          reviewNotes: stringArray(form, 'reviewNotes'),
        }), expectedUpdatedAt);
      } else {
        const common = {
          ...base,
          categoryIds: stringArray(form, 'categoryIds'),
          difficulty: stringValue(form, 'difficulty', 'easy'),
          prompt: stringValue(form, 'prompt'),
          hints: [],
        };
        const type = stringValue(form, 'type', 'missing-word');
        let raw: unknown;
        if (type === 'multiple-choice') {
          const passageId = stringValue(form, 'passageId');
          raw = {
            ...common,
            type,
            ...(passageId ? { passageId, sortOrder: typeof form.sortOrder === 'number' ? form.sortOrder : 0 } : {}),
            options: (Array.isArray(form.options) ? form.options : []) as ExerciseOption[],
          };
        } else if (type === 'missing-word') {
          raw = {
            ...common,
            type,
            acceptedAnswers: stringArray(form, 'acceptedAnswers'),
            answerOptions: stringArray(form, 'answerOptions'),
            explanationEn: stringValue(form, 'explanationEn') || undefined,
          };
        } else if (type === 'word-order') {
          raw = {
            ...common,
            type,
            acceptedSentences: stringArray(form, 'acceptedSentences'),
            wordTiles: stringArray(form, 'wordTiles'),
            explanationEn: stringValue(form, 'explanationEn') || undefined,
          };
        } else {
          raw = { ...common, type, pairs: (Array.isArray(form.pairs) ? form.pairs : []) as MatchingPair[] };
        }
        await exercises.save(ExerciseSchema.parse(raw), expectedUpdatedAt);
      }
      closeEditor(true);
    } catch (saveError) {
      setError(saveError instanceof Error && 'issues' in saveError
        ? (saveError as { issues: { path: PropertyKey[]; message: string }[] }).issues.map((issue) => `${issue.path.join('.') || 'Content'}: ${issue.message}`).join('\n')
        : errorText(saveError));
    }
  };

  const duplicate = async (item: ContentItem) => {
    try {
      const kind = kindOf(item);
      if (kind === 'category') await categories.duplicate(item.id);
      if (kind === 'vocabulary') await vocabularyItems.duplicate(item.id);
      if (kind === 'passage') await readingPassages.duplicate(item.id);
      if (kind === 'exercise') await exercises.duplicate(item.id);
    } catch (duplicateError) {
      setError(errorText(duplicateError));
    }
  };

  const remove = async (item: ContentItem) => {
    if (!window.confirm(`Delete "${titleOf(item)}"? This cannot be undone.`)) return;
    try {
      const kind = kindOf(item);
      if (kind === 'category') await categories.remove(item.id);
      if (kind === 'vocabulary') await vocabularyItems.remove(item.id);
      if (kind === 'passage') await readingPassages.remove(item.id);
      if (kind === 'exercise') await exercises.remove(item.id);
      setError(null);
    } catch (deleteError) {
      setError(errorText(deleteError));
    }
  };

  if (!query) return <Text role="status">Loading content library...</Text>;
  if (query.error) return <Alert color="red" title="Content library unavailable">{query.error}</Alert>;
  if (!library) return <Text role="status">Loading content library...</Text>;

  return (
    <Stack>
      <Group justify="space-between" align="end">
        <div>
          <Title order={2}>Content manager</Title>
          <Text c="dimmed">Create and maintain local learning material.</Text>
        </div>
        <Group gap="xs" wrap="wrap" justify="end">
          {Object.entries(kindLabels).map(([value, label]) => (
            <Button key={value} size="xs" variant="light" onClick={() => openEditor(value as ContentKind)}>
              + {label}
            </Button>
          ))}
        </Group>
      </Group>
      {error && !editor && <Alert color="red" title="Action failed" onClose={() => setError(null)} withCloseButton>{error}</Alert>}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput label="Search" placeholder="Search content" value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
        <Select label="Type" value={kindFilter} onChange={(value) => setKindFilter(value ?? ALL)} data={[{ value: ALL, label: 'All types' }, ...Object.entries(kindLabels).map(([value, label]) => ({ value, label }))]} />
        <Select label="Category" value={categoryFilter} onChange={(value) => setCategoryFilter(value ?? ALL)} data={[{ value: ALL, label: 'All categories' }, ...library.categories.map((category) => ({ value: category.id, label: category.name }))]} />
        <Group grow>
          <Select label="Difficulty" value={difficultyFilter} onChange={(value) => setDifficultyFilter(value ?? ALL)} data={[{ value: ALL, label: 'Any difficulty' }, 'easy', 'medium', 'hard'].map((entry) => typeof entry === 'string' ? { value: entry, label: entry[0]!.toUpperCase() + entry.slice(1) } : entry)} />
          <Select label="Review status" value={statusFilter} onChange={(value) => setStatusFilter(value ?? ALL)} data={[{ value: ALL, label: 'Any status' }, 'draft', 'reviewed', 'published'].map((entry) => typeof entry === 'string' ? { value: entry, label: entry[0]!.toUpperCase() + entry.slice(1) } : entry)} />
        </Group>
      </SimpleGrid>
      {items.length === 0 ? (
        <Text c="dimmed" role="status">No content matches these filters.</Text>
      ) : (
        <Stack gap="xs">
          {items.map((item) => (
            <Paper component="article" aria-label={titleOf(item)} key={`${kindOf(item)}:${item.id}`} withBorder p="sm">
              <Group justify="space-between" align="center" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Group gap="xs">
                    <Text fw={600} lineClamp={1}>{titleOf(item)}</Text>
                    <Badge variant="light">{kindLabels[kindOf(item)]}</Badge>
                    <Badge color={item.reviewStatus === 'published' ? 'green' : item.reviewStatus === 'reviewed' ? 'blue' : 'gray'}>{item.reviewStatus}</Badge>
                  </Group>
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {'englishTranslation' in item ? item.englishTranslation : 'dutchText' in item ? item.dutchText : 'type' in item ? item.type : item.description}
                  </Text>
                </div>
                <Group gap="xs" wrap="nowrap">
                  {'type' in item && <Button size="xs" variant="default" onClick={() => setPreviewItem(item)}>Preview</Button>}
                  <Button size="xs" variant="light" onClick={() => openEditor(kindOf(item), item)}>Edit</Button>
                  <Button size="xs" variant="default" onClick={() => void duplicate(item)}>Duplicate</Button>
                  <Button size="xs" color="red" variant="subtle" onClick={() => void remove(item)}>Delete</Button>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <Modal opened={Boolean(editor)} onClose={closeEditor} title={editor ? `${editor.id ? 'Edit' : 'Create'} ${kindLabels[editor.kind]}` : ''} size="lg" centered>
        {editor && <EditorFields
          key={`${editor.kind}:${editor.id ?? 'new'}`}
          editor={editor}
          form={form}
          setForm={(update) => {
            setForm(update);
            setIsDirty(true);
          }}
          library={library}
          error={error}
          onSave={() => void save()}
          onClose={closeEditor}
          onEditQuestion={(question) => {
            if (isDirty && !window.confirm('Discard unsaved passage changes before editing its question?')) return;
            openEditor('exercise', question.id ? question : undefined, question as unknown as FormValues, true);
          }}
        />}
      </Modal>

      <Modal opened={Boolean(previewItem)} onClose={() => setPreviewItem(null)} title="Exercise preview" centered>
        {previewItem && <ExercisePreview form={previewItem as unknown as FormValues} />}
      </Modal>
    </Stack>
  );
}