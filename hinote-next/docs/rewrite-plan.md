# Rewrite Plan

## Phase 1: Stable comments

- Current-file highlight list
- Vault-wide highlight list
- Comment CRUD
- Markdown export
- Stable highlight matching

Success criteria:

- Comments survive text inserted before a highlight.
- Repeated identical highlights do not steal each other's comments when context differs.
- Deleted highlights become visible orphaned items instead of silently disappearing.

## Phase 2: Editor integration

- Add editor widgets after highlights. Done in V1 as a direct add-comment prompt.
- Add preview-mode widgets.
- Open the HiNote Next panel focused on a specific highlight.

## Phase 3: Data migration

- Read old `.hinote/` data.
- Convert old highlight/comment records to `HiNoteItem`.
- Write into `.hinote-next/`.
- Keep a backup and never mutate old data directly.

## Phase 4: AI comments

- Start with OpenAI-compatible providers and Ollama.
- Keep provider presets small.
- AI should consume `ResolvedHighlight`, not raw extracted text.

## Phase 5: HiCard

- Split card storage, scheduling, grouping, and sync.
- Link cards to `HiNoteItem.id`.
- Use highlight/comment events from a dedicated domain event service.

## Phase 6: Optional power features

- Canvas extraction
- Image export
- Batch operations
- Advanced templates
- Licensing
