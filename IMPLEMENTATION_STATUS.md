# Implementation Status

Status date: 2026-10-19

| Milestone | Status | Evidence and remaining work |
| --- | --- | --- |
| 1. Offline foundation | Partial | Vite PWA, manifest, generated service worker, Dexie v1, sample data, and basic navigation exist. The shell is missing Home and Settings navigation, an offline indicator, and explicit loading/error states. Offline startup and installation have not been manually verified. |
| 2. Domain model and repositories | Complete | Canonical Zod model, Dexie v1-to-v2 migration, validated repositories, category/passage referential checks, four exercise variants, event-based attempts/reviews, canonical seed data, and a v1 upgrade regression test are implemented. |
| 3. Reading experience | Not started | Reading is a placeholder. There is no question flow, feedback UI, retry, or reading-attempt persistence. Only one sample passage exists. |
| 4. Content manager | Not started | Content is a placeholder; no editing interface exists. |
| 5. Flashcards and sentence exercises | Partial | Flashcards reveal translations and write Again/Easy review events with next-due timestamps. Hard rating in the UI, due-card scheduling, difficult-card review, and interactive sentence modes are missing. |
| 6. Backup and offline readiness | Not started | A backup schema is declared, but there is no import/export flow or preview. Offline behavior has not been manually tested. |
| Final engineering review | Not started | No final review has been performed. |

## Canonical Data Model

Use standalone Exercise records, with `passageId` linking reading questions to their ReadingPassage and no passage link for sentence exercises. This keeps passage content independent from its questions, lets the same exercise repository and editor handle reading and sentence practice, and makes category membership and referential-integrity checks explicit. Order linked reading questions by `sortOrder`, not by treating an array position as identity. Keep attempts and flashcard review events as separate history records. This is now implemented as the v2 model; the migration retains old aggregate progress in the legacy progress table because individual answer events cannot be reconstructed from totals.

## Verification

`npm run typecheck`, `npm run lint`, `npm test -- --run`, and `npm run build` pass; 10 tests pass. The production build emits a JavaScript chunk-size warning because the bundle exceeds 500 kB. Automated checks do not establish offline behavior.

## Recommended Next Steps

1. Fill the missing Milestone 1 shell states and manually test the production build offline.
2. Implement Reading using standalone linked exercises, then proceed to the Content Manager, sentence exercises and richer flashcards, backup/import/export, and final review.

The overall milestone order is sound. The important correction is to finish the data model before implementing Reading. The initial "Your first task" section in `General_implementation.md` is historical; the approved plan and initial scaffold work are complete.

## Outstanding Manual Checks

- Install the PWA on a supported phone and open it on a laptop.
- Load the production app online once, then disable Wi-Fi and mobile data and reopen it.
- Confirm navigation and each practice mode work offline after their implementation.
- Confirm edited content survives closing and reopening the app.
- Test backup transfer between two devices after import/export is implemented.
