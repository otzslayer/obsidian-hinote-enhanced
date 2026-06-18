/**
 * Pure inline comment serializer — no Obsidian runtime dependency.
 *
 * Produces patched note text for insert / update / delete operations.
 * Anchor safety (KTD3): update/delete re-parse the note at write time and
 * verify (highlightText + ordinal + currentText) before modifying anything.
 */

import { parseInlineComments, type HighlightMatch } from './InlineCommentParser';

// ── Types ────────────────────────────────────────────────────

export interface SerializeTarget {
    highlightText: string;
    ordinal: number;      // 0-based index among the highlight's comment blocks
    currentText: string;  // expected text of the block at `ordinal` (anchor check)
}

// ── Public helpers ───────────────────────────────────────────

/** Produce the raw {>>...<<} block string. */
export function serializeBlock(text: string, timestamp: string): string {
    return `{>>${sanitizeText(text)} ^${timestamp}^<<}`;
}

// ── Insert ───────────────────────────────────────────────────

/**
 * Append a new comment block immediately after all existing comment blocks
 * on `match` (or directly after the highlight end if none exist).
 */
export function insertComment(
    noteText: string,
    match: HighlightMatch,
    text: string,
    timestamp: string
): string {
    const insertPos = findInsertPosition(noteText, match);
    const block = serializeBlock(text, timestamp);
    return noteText.slice(0, insertPos) + block + noteText.slice(insertPos);
}

// ── Update ───────────────────────────────────────────────────

/**
 * Replace the comment block at `target.ordinal` on `match` with new text/timestamp.
 * Returns the original noteText unchanged (without throwing) when the anchor
 * check fails — the caller decides how to surface the mismatch.
 */
export function updateComment(
    noteText: string,
    match: HighlightMatch,
    target: SerializeTarget,
    newText: string,
    newTimestamp: string
): string {
    const block = findBlock(noteText, match, target);
    if (!block) return noteText; // anchor mismatch — abort

    const newBlock = serializeBlock(newText, newTimestamp);
    return noteText.slice(0, block.startOffset) + newBlock + noteText.slice(block.endOffset);
}

// ── Delete ───────────────────────────────────────────────────

/**
 * Remove the comment block at `target.ordinal` on `match`.
 * Returns original noteText on anchor mismatch.
 */
export function deleteComment(
    noteText: string,
    match: HighlightMatch,
    target: SerializeTarget
): string {
    const block = findBlock(noteText, match, target);
    if (!block) return noteText;

    return noteText.slice(0, block.startOffset) + noteText.slice(block.endOffset);
}

// ── Internals ────────────────────────────────────────────────

/**
 * Sanitize text so it cannot prematurely close a {>>...<<} block (KTD1).
 * Inserts a zero-width non-joiner between `<<` and `}`.
 */
function sanitizeText(text: string): string {
    // Break any <<} sequences by inserting zero-width non-joiner (U+200C)
    return text.replace(/<<}/g, '<‌<}');
}

/**
 * Position in `noteText` where the next block for `match` should be inserted.
 * That is: after the last existing comment block attached to `match`, or
 * immediately after `match.end` if none exist.
 *
 * Exported so editor-side callers can compute the insert offset against the live
 * editor snapshot (not disk), keeping the offset and the text in the same
 * coordinate system.
 */
export function findInsertPosition(noteText: string, match: HighlightMatch): number {
    // A highlight's own comments are the {>>...<<} blocks contiguous with its end
    // (the serializer writes them zero-gap; whitespace between is also tolerated).
    // Scan forward ONLY over that contiguous chain. Parsing with a single match
    // would mis-attribute a LATER highlight's comment blocks to this highlight and
    // insert after them — landing the comment on the wrong highlight.
    const CONTIGUOUS_BLOCK_RE = /^\s*\{>>[\s\S]*?<<\}/;
    let pos = match.end;
    let block = CONTIGUOUS_BLOCK_RE.exec(noteText.slice(pos));
    while (block) {
        pos += block[0].length;
        block = CONTIGUOUS_BLOCK_RE.exec(noteText.slice(pos));
    }
    return pos;
}

/**
 * Locate the specific comment block identified by (match + ordinal + currentText).
 * Returns null on anchor mismatch (ordinal out of range OR text differs).
 */
function findBlock(
    noteText: string,
    match: HighlightMatch,
    target: SerializeTarget
): { startOffset: number; endOffset: number } | null {
    const { pairedComments } = parseInlineComments(noteText, [match]);
    const entry = pairedComments.find(p => p.highlightStart === match.start);
    if (!entry) return null;

    const block = entry.comments[target.ordinal];
    if (!block) return null;

    // Anchor check: the block's text must match what the caller expects (KTD3).
    if (block.text !== target.currentText) return null;

    return { startOffset: block.startOffset, endOffset: block.endOffset };
}
