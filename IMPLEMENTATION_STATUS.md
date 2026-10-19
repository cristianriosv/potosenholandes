# Implementation Status

Status date: 2026-10-19

| Milestone | Status | Evidence and remaining work |
| --- | --- | --- |
| 1. Offline foundation | Partial | Vite PWA, manifest, generated service worker, Dexie, sample content, required navigation, Home links, loading/error states, and a browser online/offline indicator exist. Manual installation and offline startup have not been verified on a device. |
| 2. Domain model and repositories | Complete | Canonical Zod model, Dexie v1-to-v2 migration, validated repositories, referential checks, four exercise variants, event-based attempts/reviews, canonical seeds, and a v1 upgrade regression test are implemented. |
| 3. Reading experience | Partial | Browse/filter, three A2 passages with linked questions, immediate explanations, correct-answer reveal, score, retry, and local attempt history are implemented and tested. Manual offline/device behavior remains unverified. |
| 4. Content manager | Complete | Searchable/filterable library, typed editors, linked questions, per-option explanations, previews, review states, atomic stale-write detection, dirty-draft confirmation, protected deletion, duplication, and local image/verb-form fields are implemented and tested. |
| 5. Flashcards and sentence exercises | Partial | Again/Hard/Easy review scheduling, due/difficult filters, local images, all three sentence modes, and 111 imported draft vocabulary items across 20 categories are implemented and tested. Manual offline behavior remains unverified. |
| 6. Backup and offline readiness | Partial | Versioned export/import, validation, change preview, conflict-safe merge, explicit full restore, legacy-progress/seed-state preservation, and atomic rollback tests are implemented. Cross-device and offline checks remain. |
| Progress summary | Not started | Attempts and review history are stored locally, but the Progress navigation tab still displays a placeholder. |
| Final engineering review | Not started | No final review has been performed. |

## Canonical Data Model

Use standalone Exercise records, with `passageId` linking reading questions to their ReadingPassage and no passage link for sentence exercises. This keeps passage content independent from its questions, lets the same exercise repository and editor handle reading and sentence practice, and makes category membership and referential-integrity checks explicit. Order linked reading questions by `sortOrder`, not by treating an array position as identity. Keep attempts and flashcard review events as separate history records. This is now implemented as the v2 model; the migration retains old aggregate progress in the legacy progress table because individual answer events cannot be reconstructed from totals.

## Verification

`npm run typecheck`, `npm run lint`, `npm test -- --run`, and `npm run build` pass; 33 tests pass. The production build emits a JavaScript chunk-size warning because the bundle exceeds 500 kB. Automated checks do not establish offline behavior.

## Recommended Next Steps

1. Implement the Progress summary screen using existing local attempt/review records.
2. Manually verify PWA installation, offline startup, every practice flow, and backup transfer/restore.
3. Perform the final engineering review and address any reproduced issues.

The overall milestone order is sound. The important correction is to finish the data model before implementing Reading. The initial "Your first task" section in `General_implementation.md` is historical; the approved plan and initial scaffold work are complete.

## Outstanding Manual Checks

- Install the PWA on a supported phone and open it on a laptop.
- Load the production app online once, then disable Wi-Fi and mobile data and reopen it.
- Confirm navigation and each practice mode work offline after their implementation.
- Confirm edited content survives closing and reopening the app.
- Test backup transfer between two devices after import/export is implemented.
