# HiNote Next

HiNote Next is a clean rewrite of HiNote. The first version focuses on one stable core:

> Turn Markdown highlights into durable knowledge items that can keep comments even when nearby text moves.

This project is intentionally built next to the existing plugin instead of replacing it.

## V1 scope

- Extract highlights from Markdown:
  - `==highlight==`
  - `<mark>highlight</mark>`
  - `<span>highlight</span>`
- Resolve live highlights against stored comment data.
- Add, edit, and delete comments.
- Add comments from editor widgets shown after highlights.
- Show current-file highlights.
- Show all vault highlights.
- Search highlight text, file paths, and comments.
- Export current-file highlights to Markdown.

## Deferred features

These should be reintroduced only after the core highlight identity model is proven stable:

- AI comments
- HiCard / FSRS
- Canvas highlights
- Image export
- Batch operations
- Advanced export templates
- Licensing
- Custom regex settings UI

## Architecture

```txt
main.ts
src/
  core/
    HighlightEngine.ts       # single read model for UI/features
    HighlightExtractor.ts    # Markdown -> HighlightSource
    HighlightResolver.ts     # HighlightSource + stored items -> ResolvedHighlight
    Hash.ts
  storage/
    HiNoteRepository.ts      # vault adapter reads/writes only
  features/
    comments/
      CommentService.ts
    export/
      MarkdownExportService.ts
  ui/
    HiNoteNextView.ts
  types.ts
```

## Design rules

1. `HighlightSource` is a live extraction from Markdown.
2. `HiNoteItem` is stored data with comments.
3. `ResolvedHighlight` is the only object consumed by UI and feature services.
4. Matching rules live in `HighlightResolver` only.
5. Storage does not decide identity or matching.

## Highlight matching order

1. Block ID
2. Text hash + context hash
3. Same text near the previous position
4. Unique same text in the file
5. Near position fallback
6. Orphaned stored item

This is the main simplification compared with the existing project: export, comments, search, and future flashcards should all use `HighlightEngine.resolveFile()` or `HighlightEngine.resolveVault()`.

## Build

```bash
npm install
npm run build
```

The release files are:

- `main.js`
- `manifest.json`
- `styles.css`

## Development note

This rewrite stores data in `.hinote-next/` so it does not touch existing HiNote data in `.hinote/`.
