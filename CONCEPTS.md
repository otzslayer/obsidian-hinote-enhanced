# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Comment Storage Domain

### Highlight
A contiguous span of text in a Markdown note that has been marked up with a highlight format (`==text==`, `<mark>`, `<span>`, or a user-defined regex). Highlights are the primary annotation anchor — Comments attach to them.

### Comment
A user-authored annotation attached either to a specific Highlight or to an entire Note (file-level). Each Comment has a text body and a last-modified timestamp. A Highlight may accumulate multiple Comments; their order is their ordinal position in the note text.

### Inline Comment Block
The on-disk storage unit for a single Comment: a CriticMarkup `{>>text ^YYYY-MM-DD HH:mm^<<}` span placed immediately after the Highlight marker in the note body. The end-anchored timestamp token (`^YYYY-MM-DD HH:mm^`) is the only metadata stored; all other identifiers are position-derived at parse time.
*Avoid:* sidecar comment, comment block

### File-level Comment
A Comment attached to a Note as a whole rather than to a specific Highlight. Stored in the note's YAML frontmatter under the `comments` key as a `{text, ts}` object. Parsed and written separately from Inline Comment Blocks.

### Orphan Comment
An Inline Comment Block whose immediately preceding Highlight marker has been deleted or moved. Orphan Comments are tagged `isOrphan: true` in the in-memory model and surfaced in the sidebar as a distinct group. The plugin never auto-deletes Orphan Comments — removal is always an explicit user action.

### Anchor Safety
The write-path invariant that prevents note corruption: before patching a note, the writer re-parses the current file content and verifies that the target block matches the expected `(highlight text, ordinal, current comment text)` triplet. On mismatch the write is aborted and the user is notified; the note is left unchanged. This guards against concurrent edits, remote Sync delivery, or stale in-memory state between the read and write operations.
