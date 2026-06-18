/**
 * Pure frontmatter ↔ file-level comment conversion — no Obsidian runtime dependency.
 *
 * Shape contract (KTD4): a HiNote file-level comment is any object with exactly
 * a string `text` field and a string `ts` field. Items that don't match this
 * shape are treated as foreign and preserved verbatim.
 */

// ── Types ────────────────────────────────────────────────────

export interface FileLevelComment {
    text: string;
    ts: string; // "YYYY-MM-DD HH:mm"
}

// ── Shape guard ──────────────────────────────────────────────

function isFileLevelComment(x: unknown): x is FileLevelComment {
    return (
        typeof x === 'object' &&
        x !== null &&
        typeof (x as Record<string, unknown>).text === 'string' &&
        typeof (x as Record<string, unknown>).ts === 'string'
    );
}

// ── Public API ───────────────────────────────────────────────

/**
 * Extract HiNote file-level comments from a raw frontmatter object.
 * Only items matching `{text: string, ts: string}` are returned (KTD4).
 */
export function parseFileLevelComments(
    frontmatter: unknown
): FileLevelComment[] {
    if (!frontmatter || typeof frontmatter !== 'object') return [];
    const fm = frontmatter as Record<string, unknown>;
    if (!Array.isArray(fm.comments)) return [];
    return fm.comments.filter(isFileLevelComment);
}

/**
 * Merge a new set of HiNote comments into an existing `comments` array value.
 *
 * Strategy (KTD4):
 *   - Remove all existing HiNote-shaped items from `existing`.
 *   - Append `newComments` at the end.
 *   - Foreign-shaped items are left untouched in their original positions.
 *
 * Returns the new array suitable for writing back to `frontmatter.comments`.
 */
export function mergeFileLevelComments(
    existing: unknown,
    newComments: FileLevelComment[]
): unknown[] {
    const base = Array.isArray(existing) ? existing : [];
    const foreignItems = base.filter((x) => !isFileLevelComment(x));
    return [...foreignItems, ...newComments];
}
