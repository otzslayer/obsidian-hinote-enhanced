/**
 * Pure inline comment parser — no Obsidian runtime dependency.
 *
 * Format: {>>text ^YYYY-MM-DD HH:mm:ss^<<}
 *   - Text may contain ^, but only a strict end-anchored ^YYYY-MM-DD HH:mm[:ss]^
 *     token immediately before <<} is treated as the timestamp (KTD1). Seconds are
 *     optional for back-compat with minute-precision timestamps written before.
 *   - AI comments are prefixed with "🤖 " (KTD, R4).
 *   - Orphans: {>>...<<} blocks with no preceding highlight match end (KTD5).
 */

// ── Types ────────────────────────────────────────────────────

export interface HighlightMatch {
    text: string;
    start: number; // start of the full match in the note text
    end: number;   // end of the full match (exclusive) — comment blocks attach here
}

export interface InlineCommentBlock {
    text: string;            // comment content, AI prefix stripped
    timestamp: string | null; // "YYYY-MM-DD HH:mm" or null
    isAI: boolean;
    isOrphan: boolean;
    ordinal: number;         // 0-based index within the same highlight
    startOffset: number;     // start of {>> in note text
    endOffset: number;       // end of <<} in note text (exclusive)
}

export interface ParsedHighlightComments {
    highlightText: string;
    highlightStart: number;
    highlightEnd: number;
    comments: InlineCommentBlock[];
}

export interface InlineParseResult {
    pairedComments: ParsedHighlightComments[];
    orphanComments: InlineCommentBlock[];
}

// ── Constants ────────────────────────────────────────────────

const AI_PREFIX = '🤖 ';

// End-anchored timestamp: ^YYYY-MM-DD HH:mm[:ss]^ immediately before <<}
// Captures the token at the very end of the block content. Seconds are optional
// so timestamps written before second-precision still parse.
const TIMESTAMP_SUFFIX_RE = /\s+\^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?)\^\s*$/;

// Non-greedy CriticMarkup block — matches the nearest <<} (KTD1)
const INLINE_COMMENT_RE = /\{>>([\s\S]*?)<<\}/g;

// ── Public API ───────────────────────────────────────────────

/**
 * Parse all {>>...<<} blocks in `noteText`, pairing each with its nearest
 * preceding highlight match end (KTD6). Blocks without a preceding match
 * are tagged as orphans (KTD5).
 */
export function parseInlineComments(
    noteText: string,
    highlightMatches: HighlightMatch[]
): InlineParseResult {
    if (!noteText) return { pairedComments: [], orphanComments: [] };

    // Build a sorted list of highlight end positions for fast look-up.
    const sortedMatches = [...highlightMatches].sort((a, b) => a.end - b.end);

    // Accumulate comments per highlight (by index into sortedMatches)
    const commentsByHighlight = new Map<number, InlineCommentBlock[]>();
    const orphanComments: InlineCommentBlock[] = [];

    let match: RegExpExecArray | null;
    // Reset lastIndex before use since the regex has the /g flag.
    INLINE_COMMENT_RE.lastIndex = 0;

    while ((match = INLINE_COMMENT_RE.exec(noteText)) !== null) {
        const blockStart = match.index;
        const blockEnd = blockStart + match[0].length;
        const rawContent = match[1]; // content inside {>> ... <<}

        const block = parseBlockContent(rawContent, blockStart, blockEnd);

        // Find the closest highlight whose end is immediately at or before blockStart.
        // "Immediately" means blockStart === highlightEnd (KTD6 — no gap allowed between
        // the highlight marker end and {>>). We allow any amount of whitespace to be
        // lenient for user edits, so we accept blockStart >= highlightEnd.
        const hlIndex = findPrecedingHighlight(sortedMatches, blockStart);

        if (hlIndex === -1) {
            block.isOrphan = true;
            orphanComments.push(block);
        } else {
            if (!commentsByHighlight.has(hlIndex)) {
                commentsByHighlight.set(hlIndex, []);
            }
            const comments = commentsByHighlight.get(hlIndex)!;
            block.ordinal = comments.length;
            comments.push(block);
        }
    }

    // Build pairedComments only for highlights that have at least one comment.
    const pairedComments: ParsedHighlightComments[] = [];
    for (const [idx, comments] of commentsByHighlight.entries()) {
        const hl = sortedMatches[idx];
        pairedComments.push({
            highlightText: hl.text,
            highlightStart: hl.start,
            highlightEnd: hl.end,
            comments,
        });
    }

    // Preserve original highlight order.
    pairedComments.sort((a, b) => a.highlightStart - b.highlightStart);

    return { pairedComments, orphanComments };
}

// ── Helpers ──────────────────────────────────────────────────

function parseBlockContent(
    raw: string,
    blockStart: number,
    blockEnd: number
): InlineCommentBlock {
    let content = raw;
    let timestamp: string | null = null;

    // Extract end-anchored timestamp token (KTD1).
    const tsMatch = content.match(TIMESTAMP_SUFFIX_RE);
    if (tsMatch) {
        timestamp = tsMatch[1];
        content = content.slice(0, content.length - tsMatch[0].length);
    }

    // Detect and strip AI prefix.
    let isAI = false;
    if (content.startsWith(AI_PREFIX)) {
        isAI = true;
        content = content.slice(AI_PREFIX.length);
    }

    return {
        text: content,
        timestamp,
        isAI,
        isOrphan: false,
        ordinal: 0, // caller sets the real ordinal
        startOffset: blockStart,
        endOffset: blockEnd,
    };
}

/**
 * Returns the index of the highlight match whose `end` is the largest value
 * that is <= blockStart (i.e., the match immediately preceding the comment block).
 * Returns -1 if no such match exists.
 *
 * This allows any text between the highlight marker end and {>>, which makes
 * the parser resilient to user-added spaces while still correctly pairing.
 * The serializer ensures zero-gap on write, so re-parsed comments always land
 * on the right highlight.
 */
function findPrecedingHighlight(
    sortedMatches: HighlightMatch[],
    blockStart: number
): number {
    let best = -1;
    for (let i = 0; i < sortedMatches.length; i++) {
        if (sortedMatches[i].end <= blockStart) {
            best = i;
        } else {
            break; // matches are sorted by end; no need to continue
        }
    }
    return best;
}
