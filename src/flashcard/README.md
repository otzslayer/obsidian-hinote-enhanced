# Flashcard module

This module owns HiCard/flashcard behavior.

## Public entry

Code outside `src/flashcard` should import from `src/flashcard`:

```ts
import { FSRSManager, FlashcardComponent } from "../flashcard";
```

Avoid importing directly from `components/`, `services/`, `settings/`, or `types/` outside this module unless there is a strong reason.

## Internal layout

- `types/`: shared flashcard and FSRS data contracts.
- `services/`: storage, scheduling, group, source-card, event-sync, and daily-stat logic.
- `components/`: flashcard UI composition and renderers.
- `settings/`: flashcard settings tab.

## Boundary rule

`FSRSManager` is the public service facade. Smaller services such as `DailyStatsService`, `SourceCardService`, and `FlashcardEventSyncService` are implementation details used to keep `FSRSManager` maintainable.
