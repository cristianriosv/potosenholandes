# Implementation Status

Status date: 2026-10-19

| Milestone | Status | Evidence and remaining work |
| --- | --- | --- |
| 1. Offline foundation | Partial | Vite PWA, manifest, generated service worker, Dexie v1, sample data, and basic navigation exist. The shell is missing Home and Settings navigation, an offline indicator, and explicit loading/error states. Offline startup and installation have not been manually verified. |
| 2. Domain model and repositories | Complete | Canonical Zod model, Dexie v1-to-v2 migration, validated repositories, category/passage referential checks, four exercise variants, event-based attempts/reviews, canonical seed data, and a v1 upgrade regression test are implemented. |
| 3. Reading experience | Partial | Browse by category and CEFR level, three A2 passages with linked stored questions, immediate per-option explanations, correct-answer reveal, score, retry, and per-question attempt history are implemented. Reading flow tests cover correct/incorrect feedback, duplicate submission, scoring, retry, empty content, and IndexedDB reopen. Manual offline/device behavior remains unverified. |
| 4. Content manager | Partial | Searchable/filterable library, validated editors for all four entity types, passage-linked questions, per-option explanations, exercise preview, draft/reviewed/published states, optimistic stale-edit detection, dirty-draft confirmations, referenced-record deletion protection, and duplication are implemented. Tests cover create/edit/duplicate/delete, invalid content, linked-question practice, preview, and draft preservation. |
| 5. Flashcards and sentence exercises | Partial | Flashcards reveal translations and write Again/Easy review events with next-due timestamps. Hard rating in the UI, due-card scheduling, difficult-card review, and interactive sentence modes are missing. |
| 4. Content manager | Partial | Searchable/filterable library, typed editors for categories, vocabulary, passages, and all exercise types, passage-linked questions, per-option explanations, exercise preview, review states, atomic stale-write detection, dirty-draft confirmations, reference-protected deletion, and content duplication are implemented. Vocabulary editing includes local images and verb forms. Tests cover CRUD, validation, preview, linked-question practice, and preserving cancelled drafts. |
| 5. Flashcards and sentence exercises | Partial | Flashcards support Again/Hard/Easy ratings, stored review history and due times, due/difficult filters, and local images. Missing-word selection, word-order tokens with alternatives/repeated words, and matching are interactive and save attempts locally. Broader scheduling and manual offline verification remain. |
| 6. Backup and offline readiness | Not started | A backup schema is declared, but there is no import/export flow or preview. Offline behavior has not been manually tested. |
| Final engineering review | Not started | No final review has been performed. |

## Canonical Data Model

Use standalone Exercise records, with `passageId` linking reading questions to their ReadingPassage and no passage link for sentence exercises. This keeps passage content independent from its questions, lets the same exercise repository and editor handle reading and sentence practice, and makes category membership and referential-integrity checks explicit. Order linked reading questions by `sortOrder`, not by treating an array position as identity. Keep attempts and flashcard review events as separate history records. This is now implemented as the v2 model; the migration retains old aggregate progress in the legacy progress table because individual answer events cannot be reconstructed from totals.

## Verification

`npm run typecheck`, `npm run lint`, `npm test -- --run`, and `npm run build` pass; 16 tests pass. The production build emits a JavaScript chunk-size warning because the bundle exceeds 500 kB. Automated checks do not establish offline behavior.
`npm run typecheck`, `npm run lint`, `npm test -- --run`, and `npm run build` pass; 24 tests pass. The production build emits a JavaScript chunk-size warning because the bundle exceeds 500 kB. Automated checks do not establish offline behavior.

## Recommended Next Steps

1. Manually verify the production app and all practice flows offline on a supported device.
2. Complete the remaining shell states, then implement backup/import/export and run the final engineering review.

The overall milestone order is sound. The important correction is to finish the data model before implementing Reading. The initial "Your first task" section in `General_implementation.md` is historical; the approved plan and initial scaffold work are complete.

## Outstanding Manual Checks

- Install the PWA on a supported phone and open it on a laptop.
- Load the production app online once, then disable Wi-Fi and mobile data and reopen it.
- Confirm navigation and each practice mode work offline after their implementation.
- Confirm edited content survives closing and reopening the app.
- Test backup transfer between two devices after import/export is implemented.
