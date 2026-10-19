import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../App';
import { db } from '../../db/db';
import { exercises, readingPassages } from '../../db/repositories';
import { ContentManagerPage } from './ContentManagerPage';

beforeEach(async () => {
  Element.prototype.scrollIntoView = vi.fn();
  await Promise.all(db.tables.map((table) => table.clear()));
});

function renderManager() {
  return render(
    <MantineProvider>
      <ContentManagerPage />
    </MantineProvider>,
  );
}

async function chooseContentType(optionIndex: number) {
  const types = ['Category', 'Vocabulary', 'Reading passage', 'Exercise'];
  fireEvent.click(await screen.findByRole('button', { name: `+ ${types[optionIndex]}` }));
}

async function createPassageWithQuestionBuilder(user: ReturnType<typeof userEvent.setup>, passageTitle: string) {
  await chooseContentType(2);
  await user.type(await screen.findByRole('textbox', { name: 'Title' }), passageTitle);
  await user.type(screen.getByRole('textbox', { name: 'Dutch passage' }), 'Mila gaat naar de markt. De markt is open op vrijdag.');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText(passageTitle)).toBeInTheDocument();
}

async function addQuestion(user: ReturnType<typeof userEvent.setup>, order: number) {
  await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]!);
  await user.click(await screen.findByRole('button', { name: 'Add question' }));
  await user.type(screen.getByRole('textbox', { name: 'Prompt' }), `Question ${order}?`);
  await user.type(screen.getByRole('textbox', { name: 'Option 1 text' }), `Right ${order}`);
  await user.type(screen.getByRole('textbox', { name: 'Option 1 English explanation' }), `Right explanation ${order}.`);
  await user.type(screen.getByRole('textbox', { name: 'Option 2 text' }), `Wrong ${order}`);
  await user.type(screen.getByRole('textbox', { name: 'Option 2 English explanation' }), `Wrong explanation ${order}.`);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText(`Question ${order}?`)).toBeInTheDocument();
}

describe('ContentManagerPage', () => {
  it('creates, edits, duplicates, and confirms deletion of categories', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderManager();

    await chooseContentType(0);
    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Gezondheid');
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect((await screen.findAllByText('Gezondheid')).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Zorg');
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect((await screen.findAllByText('Zorg')).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(await screen.findAllByText('Zorg')).toHaveLength(2);
    expect(await db.categories.count()).toBe(2);

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]!);
    expect(confirm).toHaveBeenCalledOnce();
    expect(await db.categories.count()).toBe(1);
    confirm.mockRestore();
  });

  it('does not save invalid content and shows understandable validation', async () => {
    const user = userEvent.setup();
    renderManager();
    await chooseContentType(1);
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('dutchWord: This field is required');
    expect(await db.vocabularyItems.count()).toBe(0);
  });

  it('keeps a dirty draft open when switching to another create action is cancelled', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderManager();
    await chooseContentType(0);
    const name = await screen.findByRole('textbox', { name: 'Name' });
    await user.type(name, 'Unsaved category');
    await user.click(screen.getByRole('button', { name: '+ Vocabulary' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(name).toHaveValue('Unsaved category');
    expect(screen.queryByRole('textbox', { name: 'Dutch word' })).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('saves selectable choices for missing-word exercises', async () => {
    const user = userEvent.setup();
    renderManager();
    await chooseContentType(3);
    await user.type(await screen.findByRole('textbox', { name: 'Prompt' }), 'Ik ___ naar huis.');
    await user.type(screen.getByRole('textbox', { name: 'Accepted answers (one per line)' }), 'ga');
    await user.type(screen.getByRole('textbox', { name: 'Selectable choices (one per line)' }), 'ga\ngaan\nben');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await db.exercises.toCollection().first()).toMatchObject({
      type: 'missing-word',
      acceptedAnswers: ['ga'],
      answerOptions: ['ga', 'gaan', 'ben'],
    });
  });

  it('creates three linked questions and makes them available in Reading', async () => {
    const user = userEvent.setup();
    const manager = renderManager();

    await createPassageWithQuestionBuilder(user, 'Markt op vrijdag');
    await addQuestion(user, 1);
    await addQuestion(user, 2);
    await addQuestion(user, 3);

    const passage = (await readingPassages.list())[0]!;
    const linked = await exercises.listForPassage(passage.id);
    expect(linked.map((item) => item.sortOrder)).toEqual([0, 1, 2]);
    expect(linked).toHaveLength(3);
    expect(linked.every((item) => item.type === 'multiple-choice')).toBe(true);
    expect(linked[0]).toMatchObject({
      prompt: 'Question 1?',
      options: expect.arrayContaining([expect.objectContaining({ text: 'Right 1' })]),
    });
    const questionRow = screen.getByRole('article', { name: 'Question 1?' });
    await user.click(within(questionRow).getByRole('button', { name: 'Preview' }));
    expect(await screen.findByText('Right 1')).toBeInTheDocument();

    const copy = await readingPassages.duplicate(passage.id);
    expect(copy?.id).not.toBe(passage.id);
    const copiedQuestions = await exercises.listForPassage(copy!.id);
    expect(copiedQuestions).toHaveLength(3);
    expect(copiedQuestions.map((item) => item.id)).not.toEqual(linked.map((item) => item.id));

    manager.unmount();
    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/reading']}>
          <App />
        </MemoryRouter>
      </MantineProvider>,
    );
    await user.click((await screen.findAllByRole('button', { name: 'Read passage' }))[0]!);
    expect(await screen.findByRole('heading', { name: 'Question 1?' })).toBeInTheDocument();
  }, 15_000);
});
