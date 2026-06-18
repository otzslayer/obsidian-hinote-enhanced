/**
 * Pure migration transform — no Obsidian runtime dependency.
 *
 * Converts stored .hinote comment data into inline {>>...<<} blocks
 * embedded in the note text. Conservative matching: only a unique text
 * match is migrated; ambiguous or missing matches are reported without
 * modifying the note (R13, KTD8).
 */

import { parseInlineComments, type HighlightMatch } from '../services/comment/inline/InlineCommentParser';
import { insertComment } from '../services/comment/inline/InlineCommentSerializer';
import type { FileLevelComment } from '../services/comment/inline/FrontmatterComments';

// ── Types ────────────────────────────────────────────────────

export interface StoredCommentItem {
    id: string;
    content: string;
    createdAt: number;
    updatedAt: number;
}

export interface StoredHighlightData {
    text: string;
    comments?: StoredCommentItem[];
}

export type MigrationStatus =
    | 'migrated'
    | 'ambiguous'
    | 'not_found'
    | 'already_inlined';

export interface MigrationReportEntry {
    highlightText: string;
    status: MigrationStatus;
    matchCount?: number;
}

export interface MigrationResult {
    noteText: string;
    report: MigrationReportEntry[];
    frontmatterComments: FileLevelComment[];
}

// ── Default highlight pattern (mirrors HighlightExtractor) ──

// Matches ==text==, <mark>text</mark>, <span>text</span>
const DEFAULT_HIGHLIGHT_RE =
    /==([^=\n](?:[^=\n]|=[^=\n])*?[^=\n])==|<mark[^>]*>([\s\S]*?)<\/mark>|<span[^>]*>([\s\S]*?)<\/span>/g;

// ── Public API ───────────────────────────────────────────────

/**
 * Transform `noteText` by inserting inline {>>...<<} blocks for each
 * stored highlight comment. File-level comments are returned as
 * `frontmatterComments` for the caller to write via processFrontMatter.
 */
export function migrateNoteComments(
    noteText: string,
    storedHighlights: StoredHighlightData[],
    fileLevelComments: FileLevelComment[] = []
): MigrationResult {
    const report: MigrationReportEntry[] = [];
    let currentText = noteText;

    // Process highlights that actually have comments
    const withComments = storedHighlights.filter(
        (h) => h.comments && h.comments.length > 0
    );

    for (const stored of withComments) {
        const result = processHighlight(currentText, stored);
        if (result.status === 'migrated') {
            currentText = result.noteText;
        }
        report.push({
            highlightText: stored.text,
            status: result.status,
            matchCount: result.matchCount,
        });
    }

    return {
        noteText: currentText,
        report,
        frontmatterComments: fileLevelComments,
    };
}

// ── Internals ────────────────────────────────────────────────

interface ProcessResult {
    noteText: string;
    status: MigrationStatus;
    matchCount?: number;
}

function processHighlight(noteText: string, stored: StoredHighlightData): ProcessResult {
    const comments = stored.comments ?? [];
    const matches = findAllMatches(noteText, stored.text);

    if (matches.length === 0) {
        return { noteText, status: 'not_found' };
    }

    if (matches.length > 1) {
        return { noteText, status: 'ambiguous', matchCount: matches.length };
    }

    const match = matches[0];

    // Idempotency check: all stored comment texts already appear as inline blocks
    // on this highlight → skip to avoid duplicates (R13).
    if (isAlreadyInlined(noteText, match, comments)) {
        return { noteText, status: 'already_inlined' };
    }

    // Insert each comment in order
    let patched = noteText;
    for (const comment of comments) {
        const timestamp = formatTimestamp(comment.updatedAt);
        // Recompute the match position in the progressively-patched text
        const freshMatches = findAllMatches(patched, stored.text);
        if (freshMatches.length !== 1) {
            // Safety: abort if the text changed unexpectedly
            return { noteText, status: 'ambiguous', matchCount: freshMatches.length };
        }
        patched = insertComment(patched, freshMatches[0], comment.content, timestamp);
    }

    return { noteText: patched, status: 'migrated' };
}

/**
 * Find all occurrences of `highlightText` as a highlight marker in `noteText`.
 * Returns HighlightMatch entries for each occurrence.
 */
function findAllMatches(noteText: string, highlightText: string): HighlightMatch[] {
    const results: HighlightMatch[] = [];
    DEFAULT_HIGHLIGHT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DEFAULT_HIGHLIGHT_RE.exec(noteText)) !== null) {
        // Capture group 1 = ==text==, group 2 = <mark>, group 3 = <span>
        const captured = m[1] ?? m[2] ?? m[3] ?? '';
        if (captured.trim() === highlightText.trim()) {
            results.push({ text: captured, start: m.index, end: m.index + m[0].length });
        }
    }
    return results;
}

/**
 * Check whether all stored comment texts already exist as inline blocks
 * attached to `match` in `noteText`. Used for idempotency (R13).
 */
function isAlreadyInlined(
    noteText: string,
    match: HighlightMatch,
    comments: StoredCommentItem[]
): boolean {
    const { pairedComments } = parseInlineComments(noteText, [match]);
    const entry = pairedComments.find((p) => p.highlightStart === match.start);
    if (!entry || entry.comments.length === 0) return false;

    const existingTexts = new Set(entry.comments.map((c) => c.text));
    return comments.every((c) => existingTexts.has(c.content));
}

/** Convert a ms timestamp to "YYYY-MM-DD HH:mm". */
function formatTimestamp(ms: number): string {
    const d = new Date(ms);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}
