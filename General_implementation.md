You are helping me build an offline-first Dutch inburgering reading practice app.

## Product goals

The app must work on phones and laptops, including when the device has no internet connection. It is for two people studying Dutch, primarily at A2 level.

The app will eventually include:
1. Flashcards organized by category.
2. Interactive sentence exercises, including missing words and word ordering.
3. Reading-comprehension exercises with Dutch passages, multiple-choice questions, immediate feedback, and English explanations for both correct and incorrect answers.
4. A built-in content manager to create, edit, duplicate, and delete learning material.
5. Local progress tracking and content backup/import/export.

## Preferred stack

- React
- TypeScript with strict mode
- Vite
- vite-plugin-pwa / Workbox for offline support
- IndexedDB using Dexie
- Zod for data validation
- Vitest and React Testing Library

Use the existing project and dependencies where appropriate. Do not introduce a backend, authentication, cloud synchronization, or paid services in the initial version.

## Your first task

1. Inspect the repository structure, existing dependencies, scripts, and tests.
2. Identify what is already implemented and what is missing.
3. Propose a small, incremental implementation plan.
4. Identify any architectural risks, particularly offline caching, IndexedDB persistence, database migrations, and editing content safely.
5. Do not implement the entire application in this first step.

Wait for approval before making substantial changes. When proposing the plan, include the files you expect to create or modify and the commands needed to verify the initial setup.


Implement Milestone 1: the offline foundation for the Dutch learning app.

First, use the approved plan and inspect the current repository. Then implement only this milestone.

Requirements:

1. Configure the Vite PWA plugin and service worker.
2. Provide a web app manifest with an app name, theme colors, icons, and standalone display mode.
3. Cache the application shell and required static assets so the app opens after it has been loaded and installed.
4. Do not depend on remote APIs, fonts, scripts, or images to render the core interface.
5. Add Dexie and create a versioned IndexedDB database.
6. Create a responsive application shell with navigation for:
   - Home
   - Reading
   - Flashcards
   - Sentence exercises
   - Content manager
   - Settings
7. Add an offline status indicator and a basic loading/error state.
8. Add a small set of clearly labeled sample records.
9. Configure tests and ensure existing tests still pass.

Architecture requirements:
- Use TypeScript strict mode.
- Keep database access outside React presentation components.
- Use separate modules for database setup, domain types, and application UI.
- Do not add all learning features yet.
- Avoid unnecessary abstractions and dependencies.

Acceptance criteria:
- The production build succeeds.
- Tests pass.
- The application can be installed as a PWA on a supported browser.
- After loading the application online once, it can be reopened with Wi-Fi and mobile data disabled.
- The navigation renders without a network connection.
- No required application assets are fetched from the network during offline startup.

After implementation, summarize changed files, commands executed, test results, and any manual offline tests that I need to perform. Do not claim that offline behavior was verified unless you actually tested it.


Implement Milestone 2: the domain model and IndexedDB repository layer.

Create a versioned, validated data model for the following entities.

1. Category:
   - id
   - name
   - description
   - sortOrder

2. VocabularyItem:
   - id
   - categoryIds
   - dutchWord
   - article, optional
   - englishTranslation
   - exampleDutch
   - exampleEnglish
   - optional plural, verb forms, and local image reference
   - source and review status

3. ReadingPassage:
   - id
   - title
   - dutchText
   - categoryIds
   - CEFR level
   - context or passage type
   - source and review status
   - Contains passage text only; questions are separate Exercise records.

4. Exercise:
   - id
   - type
   - categoryIds
   - difficulty
   - prompt
   - optional passageId; use it for reading questions and leave it empty for standalone sentence exercises
   - sortOrder, required when passageId is set
   - answer options
   - correct answer or accepted answers
   - explanation for each answer option, in English
   - source, review status, and optional hints

Support these initial exercise types:
- Multiple choice
- Missing word
- Word ordering
- Matching

Use this canonical relationship model throughout the app:
- A ReadingPassage has no embedded questions. Each reading question is an Exercise with type `multiple-choice` and a `passageId` pointing to its passage.
- Sentence exercises are Exercise records without a `passageId`. Their types are `missing-word`, `word-order`, or `matching`.
- Category membership uses `categoryIds` on vocabulary, passage, and exercise records. Do not duplicate content to place it in multiple categories.
- Give every entity and answer option a stable ID. Give reading questions an explicit `sortOrder`; array position is not identity.
- Store each multiple-choice option's text, correct/incorrect state, and non-empty English explanation together in that option. Enforce exactly one correct option.
- Persist learner history as PracticeAttempt records and flashcard ratings as FlashcardReview records, including review time and next due time. Derive summary progress from these records unless a measured performance need justifies a cached aggregate.
- Keep existing Dexie v1 data readable through a tested versioned migration; never clear the database to adopt this model.

Use Zod to validate content at the boundaries. Use stable IDs rather than array positions to reference records.

Implement:
- Dexie database schema and versioning
- Repository functions for creating, reading, updating, and deleting records
- Referential integrity checks for passage and category references
- Seed data for development
- Tests for repository operations and validation

For multiple-choice questions, require exactly one correct option and a non-empty explanation for every option. Reject invalid content with understandable error messages.

Do not implement the full content manager or practice interfaces yet.

Acceptance criteria:
- All repository operations are tested.
- Invalid records are rejected.
- Existing records remain readable after a simulated database upgrade.
- No remote database is used.
- The production build and test suite pass.

Report the changed files, database schema, migration strategy, and verification results.



Implement Milestone 3: the complete reading-comprehension experience.

Build the Reading section using the existing domain model and database repositories.

User flow:
1. Browse reading passages by category and difficulty.
2. Select a passage and read its Dutch text.
3. Load the passage's linked multiple-choice Exercise records by `passageId`, in explicit `sortOrder`, and answer them one at a time.
4. Immediately show whether the selected answer is correct.
5. Show a short English explanation associated with the selected option.
6. Make the correct answer clear even when the user chooses incorrectly.
7. Allow the user to continue to the next question.
8. Display the final score and allow retrying the exercise.

Requirements:
- Answers and explanations must come from stored content, not hardcoded conditions.
- Store each question as a separate Exercise record; do not embed or duplicate question objects in ReadingPassage.
- Do not reveal the correct answer before the user responds.
- Prevent accidental double submissions and duplicate score increments.
- Support keyboard navigation and accessible feedback.
- Work offline without remote resources.
- Provide clear empty states when no passages exist.
- Handle missing or invalid references without crashing.
- Save basic attempts and results locally.

Create at least three original, clearly labeled practice passages with questions. Use plausible everyday Dutch situations such as a gemeente appointment, a shop advertisement, and an appointment reminder. Keep the language appropriate for A2 practice, and ensure every question is answerable from its passage.

Write tests covering:
- Correct answers
- Incorrect answers
- Explanation selection
- Score calculation
- Retry behavior
- Empty content
- Persistence across reloads

Acceptance criteria:
A learner can complete an entire reading exercise offline and receive an explanation for every answer they select.

Report changed files and test results.



Implement Milestone 4: a built-in content management interface.

The goal is to let nontechnical users maintain learning material without editing source code or JSON files.

Implement:
1. A searchable content library.
2. Filters by content type, category, difficulty, and review status.
3. Create, edit, duplicate, and delete operations for categories, vocabulary items, reading passages, and exercises.
4. Forms with validation and understandable error messages.
5. A reading passage editor with linked questions stored as separate Exercise records referencing the passage by `passageId`.
6. An exercise editor with editable answer options, correct answers, and a separate English explanation for every option.
7. A preview mode that renders the exercise as the learner will see it.
8. Draft, reviewed, and published states.
9. Confirmation before destructive operations.
10. Protection against deleting categories or passages that are still referenced by other content; require reassignment or explicit resolution before deletion.

Data requirements:
- All edits must persist in IndexedDB.
- Changes must appear immediately in the learning interfaces.
- Use stable IDs.
- Do not overwrite content silently when editing.
- Avoid marking content as officially verified unless it has actually been verified against a reliable source.

Test creating, editing, duplicating, deleting, and previewing records, including invalid data and referenced records.

Acceptance criteria:
I can create a reading passage, add three questions with different explanations, save it, open Reading mode, and practice the new exercise without modifying application code.

Keep the UI responsive and accessible. Report changed files and test results.



Implement Milestone 5: flashcards and interactive sentence exercises.

Use the existing content model, database, and Content Manager. Flashcards use VocabularyItem records; sentence practice uses Exercise records without `passageId`. Do not create a separate storage system.

## Flashcards
- Browse by category.
- Show the Dutch word and optional local image first.
- Reveal the English translation and example.
- Display the article (de/het) when relevant.
- Allow the learner to rate a card as Again, Hard, or Easy.
- Store each rating as a FlashcardReview record and schedule simple future reviews from its rating and review time.
- Allow users to repeat difficult words.

## Sentence exercises
Implement:
1. Missing-word exercises with selectable answers.
2. Word-order exercises using selectable or draggable word tokens.
3. Matching Dutch words with English meanings.

Requirements:
- Show immediate feedback.
- Provide English explanations or hints when configured.
- Allow retrying.
- Track results locally.
- Support keyboard and touch interaction.
- Ensure the correct answer is derived from stored data.
- Handle punctuation, repeated words, and valid alternative answers appropriately.
- Do not require a network connection or remote images.

Update the Content Manager to create and edit these exercise types.

Write tests for answer validation, word ordering, alternative accepted answers, flashcard progress, and persistence.

Acceptance criteria:
All practice modes work offline and use the same categories and content repository.

Report changed files and test results.


Implement Milestone 6: reliable local backups, import/export, and offline-readiness checks.

## Backup and restore
- Export learning content, PracticeAttempt records, and FlashcardReview records to a versioned JSON file.
- Import a backup with schema validation.
- Preview additions, updates, duplicates, and conflicts before applying changes.
- Offer a safe merge option and a full restore option with an explicit confirmation.
- Never silently overwrite user-created content.
- Preserve stable IDs and relationships.
- Handle invalid files without partially modifying the database.
- Make it possible to export and import content between two devices manually.

## Offline readiness
- Ensure the production app shell and required static assets are cached.
- Keep images required for practice local.
- Display whether the app is offline.
- Avoid unnecessary cache invalidation and stale application versions.
- Explain how users can update the app when internet access returns.
- Provide a way to create a backup before major changes.

## Testing
Add automated tests for:
- Export and re-import round trips
- Invalid backup files
- Duplicate IDs and conflicting records
- Referential integrity
- Interrupted or rejected imports
- Data preservation during schema upgrades

Provide a manual test checklist for:
1. Installing on Android or iPhone.
2. Opening on a laptop.
3. Loading the application online.
4. Enabling airplane mode.
5. Completing each exercise type offline.
6. Editing and saving content offline.
7. Closing and reopening the app.
8. Exporting content from one device and importing it into another.
9. Restoring a backup after clearing local application data.

Do not claim automatic cross-device synchronization. Import/export is the initial synchronization mechanism.

Run the production build and tests. Report actual results, known limitations, and any manual checks that remain outstanding.



Perform a final engineering review of the offline Dutch learning application.

Do not add new features. Inspect the implementation for:
- Offline startup failures
- Network dependencies
- IndexedDB data loss or migration bugs
- Incorrect answer evaluation or explanations
- Import/export corruption risks
- Accessibility issues on phones and laptops
- Security issues in the content editor
- Missing tests and misleading UI states

Run the existing tests and production build. Fix concrete bugs you can reproduce, and add regression tests.

Distinguish clearly between automated tests that passed and manual device tests that have not been performed.

Finish with:
1. A summary of implemented features.
2. Commands to run the application locally.
3. Instructions to build and serve the production version.
4. Instructions to install and test offline on a phone.
5. Known limitations and a recommended backup routine.

Do not claim the app is fully offline-ready until the relevant production and device tests have been completed.



