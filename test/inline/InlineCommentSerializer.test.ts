import { describe, it, expect } from 'vitest';
import {
    insertComment,
    updateComment,
    deleteComment,
    serializeBlock,
    type SerializeTarget,
} from '../../src/services/comment/inline/InlineCommentSerializer';
import { parseInlineComments, type HighlightMatch } from '../../src/services/comment/inline/InlineCommentParser';

// ── Helpers ────────────────────────────────────────────────

function mkMatch(text: string, noteText: string): HighlightMatch {
    const pattern = new RegExp(`==${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}==`);
    const m = noteText.match(pattern);
    if (!m || m.index === undefined) throw new Error(`"${text}" not found`);
    return { text, start: m.index, end: m.index + m[0].length };
}

const FIXED_TS = '2024-01-01 00:00';

// ── Scenario 1: insert new comment after highlight ────────

describe('insertComment', () => {
    it('inserts {>>text ^ts^<<} immediately after the highlight', () => {
        const note = '==cell powerhouse== rest of text';
        const match = mkMatch('cell powerhouse', note);
        const result = insertComment(note, match, 'important', FIXED_TS);
        expect(result).toBe(`==cell powerhouse=={>>important ^${FIXED_TS}^<<} rest of text`);
    });

    it('inserts after existing comment on same highlight', () => {
        const note = `==power=={>>first ^${FIXED_TS}^<<} text`;
        const match = mkMatch('power', note);
        const result = insertComment(note, match, 'second', FIXED_TS);
        expect(result).toBe(`==power=={>>first ^${FIXED_TS}^<<}{>>second ^${FIXED_TS}^<<} text`);
    });

    it('inserts on the correct highlight when a LATER highlight already has a comment', () => {
        const note = `==A== mid ==B=={>>onB ^${FIXED_TS}^<<} end`;
        const match = mkMatch('A', note);
        const result = insertComment(note, match, 'onA', FIXED_TS);
        expect(result).toBe(`==A=={>>onA ^${FIXED_TS}^<<} mid ==B=={>>onB ^${FIXED_TS}^<<} end`);
    });

    it('does not alter surrounding text', () => {
        const note = 'before ==hl== after';
        const match = mkMatch('hl', note);
        const result = insertComment(note, match, 'x', FIXED_TS);
        expect(result.startsWith('before ')).toBe(true);
        expect(result.endsWith(' after')).toBe(true);
    });

    it('serializes AI comment with 🤖 prefix', () => {
        const note = '==data== text';
        const match = mkMatch('data', note);
        const result = insertComment(note, match, '🤖 ai note', FIXED_TS);
        expect(result).toContain('{>>🤖 ai note ^');
    });

    it('sanitizes <<} in comment text to prevent block breakage (KTD1)', () => {
        const note = '==tricky== end';
        const match = mkMatch('tricky', note);
        const result = insertComment(note, match, 'text <<} edge', FIXED_TS);
        // The block must close exactly once, at the right place
        const blockCount = (result.match(/<<\}/g) || []).length;
        expect(blockCount).toBe(1);
        // Content must not break the block
        expect(result).toMatch(/\{>>.+<<\}/);
    });
});

// ── Scenario 2: update existing comment ──────────────────

describe('updateComment', () => {
    it('updates the target block by ordinal and refreshes timestamp', () => {
        const note = `==hl=={>>original ^2023-01-01 10:00^<<} text`;
        const match = mkMatch('hl', note);
        const target: SerializeTarget = { highlightText: 'hl', ordinal: 0, currentText: 'original' };
        const result = updateComment(note, match, target, 'updated', FIXED_TS);
        expect(result).toContain(`{>>updated ^${FIXED_TS}^<<}`);
        expect(result).not.toContain('original');
    });

    it('updates the correct block when multiple comments exist', () => {
        const note = `==hl=={>>first ^2023-01-01 10:00^<<}{>>second ^2023-01-01 11:00^<<} text`;
        const match = mkMatch('hl', note);
        const target: SerializeTarget = { highlightText: 'hl', ordinal: 1, currentText: 'second' };
        const result = updateComment(note, match, target, 'updated-second', FIXED_TS);
        expect(result).toContain('{>>first ^2023-01-01 10:00^<<}'); // first unchanged
        expect(result).toContain(`{>>updated-second ^${FIXED_TS}^<<}`);
    });

    it('returns original text when anchor mismatch (wrong currentText)', () => {
        const note = `==hl=={>>actual ^2023-01-01 10:00^<<} text`;
        const match = mkMatch('hl', note);
        const target: SerializeTarget = { highlightText: 'hl', ordinal: 0, currentText: 'wrong' };
        const result = updateComment(note, match, target, 'updated', FIXED_TS);
        // anchor mismatch — note unchanged, signal returned
        expect(result).toBe(note);
    });
});

// ── Scenario 3: delete comment ────────────────────────────

describe('deleteComment', () => {
    it('removes the target block by ordinal', () => {
        const note = `==hl=={>>to-delete ^${FIXED_TS}^<<} text`;
        const match = mkMatch('hl', note);
        const target: SerializeTarget = { highlightText: 'hl', ordinal: 0, currentText: 'to-delete' };
        const result = deleteComment(note, match, target);
        expect(result).not.toContain('{>>');
        expect(result).toContain('==hl==');
        expect(result).toContain('text');
    });

    it('removes only the target when multiple comments', () => {
        const note = `==hl=={>>keep ^${FIXED_TS}^<<}{>>remove ^${FIXED_TS}^<<} text`;
        const match = mkMatch('hl', note);
        const target: SerializeTarget = { highlightText: 'hl', ordinal: 1, currentText: 'remove' };
        const result = deleteComment(note, match, target);
        expect(result).toContain('{>>keep ^');
        expect(result).not.toContain('{>>remove ^');
    });
});

// ── Scenario 3b: anchor robust to stale ordinal (content-based fallback) ──

describe('anchor robustness — stale ordinal, unique content', () => {
    it('deleteComment removes the correct block when ordinal is stale but content is unique', () => {
        const note = `==hl=={>>first ^2023-01-01 10:00^<<}{>>second ^2023-01-01 11:00^<<} text`;
        const match = mkMatch('hl', note);
        // Caller's array was reordered: it thinks 'first' sits at ordinal 1.
        const target: SerializeTarget = { highlightText: 'hl', ordinal: 1, currentText: 'first' };
        const result = deleteComment(note, match, target);
        expect(result).toContain('{>>second ^2023-01-01 11:00^<<}'); // second kept
        expect(result).not.toContain('{>>first ^');                  // first removed
    });

    it('updateComment edits the correct block when ordinal is stale but content is unique', () => {
        const note = `==hl=={>>first ^2023-01-01 10:00^<<}{>>second ^2023-01-01 11:00^<<} text`;
        const match = mkMatch('hl', note);
        const target: SerializeTarget = { highlightText: 'hl', ordinal: 0, currentText: 'second' };
        const result = updateComment(note, match, target, 'updated-second', FIXED_TS);
        expect(result).toContain('{>>first ^2023-01-01 10:00^<<}'); // first unchanged
        expect(result).toContain(`{>>updated-second ^${FIXED_TS}^<<}`);
        expect(result).not.toContain('{>>second ^');
    });

    it('still aborts when content does not match any block (anchor mismatch preserved)', () => {
        const note = `==hl=={>>actual ^2023-01-01 10:00^<<} text`;
        const match = mkMatch('hl', note);
        const target: SerializeTarget = { highlightText: 'hl', ordinal: 5, currentText: 'wrong' };
        expect(deleteComment(note, match, target)).toBe(note);
    });

    it('aborts when multiple identical-content blocks and ordinal is out of range (ambiguous)', () => {
        const note = `==hl=={>>dup ^2023-01-01 10:00^<<}{>>dup ^2023-01-01 11:00^<<} text`;
        const match = mkMatch('hl', note);
        const target: SerializeTarget = { highlightText: 'hl', ordinal: 9, currentText: 'dup' };
        expect(deleteComment(note, match, target)).toBe(note);
    });

    // Cross-highlight safety: the content fallback must stay within the target
    // highlight's own contiguous blocks, never reaching an identical comment on a
    // different highlight.
    it('content fallback targets the right highlight, not a later one with identical content', () => {
        const note = `==H1=={>>foo ^2023-01-01 10:00^<<} mid ==H2=={>>foo ^2023-01-01 11:00^<<} end`;
        const match = mkMatch('H1', note);
        const target: SerializeTarget = { highlightText: 'H1', ordinal: 9, currentText: 'foo' };
        const result = deleteComment(note, match, target);
        expect(result).toContain('==H2=={>>foo ^2023-01-01 11:00^<<}'); // H2's foo intact
        expect(result).not.toContain('==H1=={>>foo');                   // H1's foo removed
    });

    it('does not delete a later highlight\'s comment when the target highlight has no own block', () => {
        const note = `==H1== mid ==H2=={>>foo ^2023-01-01 11:00^<<} end`;
        const match = mkMatch('H1', note);
        const target: SerializeTarget = { highlightText: 'H1', ordinal: 0, currentText: 'foo' };
        expect(deleteComment(note, match, target)).toBe(note); // unchanged — H2's foo untouched
    });
});

// ── Scenario 4: round-trip parse → serialize → parse ─────

describe('round-trip', () => {
    it('parse(serialize(block)) yields same block shape (excluding ordinal reassignment)', () => {
        const original = '==hl== rest';
        const match = mkMatch('hl', original);
        const withComment = insertComment(original, match, 'my comment', FIXED_TS);

        // Re-parse the serialized text
        const pattern = /==hl==/;
        const m = withComment.match(pattern);
        if (!m || m.index === undefined) throw new Error('not found');
        const reparsedMatch: HighlightMatch = { text: 'hl', start: m.index, end: m.index + m[0].length };
        const { pairedComments } = parseInlineComments(withComment, [reparsedMatch]);

        expect(pairedComments).toHaveLength(1);
        const block = pairedComments[0].comments[0];
        expect(block.text).toBe('my comment');
        expect(block.timestamp).toBe(FIXED_TS);
        expect(block.isAI).toBe(false);
        expect(block.isOrphan).toBe(false);
    });

    it('round-trip preserves AI flag', () => {
        const original = '==hl== rest';
        const match = mkMatch('hl', original);
        const withComment = insertComment(original, match, '🤖 ai note', FIXED_TS);

        const m = withComment.match(/==hl==/);
        if (!m || m.index === undefined) throw new Error();
        const reparsedMatch: HighlightMatch = { text: 'hl', start: m.index, end: m.index + m[0].length };
        const { pairedComments } = parseInlineComments(withComment, [reparsedMatch]);

        const block = pairedComments[0].comments[0];
        expect(block.isAI).toBe(true);
        expect(block.text).toBe('ai note');
    });
});

// ── Scenario 5: serializeBlock helper ────────────────────

describe('serializeBlock', () => {
    it('produces correct format string', () => {
        expect(serializeBlock('hello', FIXED_TS)).toBe(`{>>hello ^${FIXED_TS}^<<}`);
    });

    it('handles AI prefix pass-through', () => {
        expect(serializeBlock('🤖 note', FIXED_TS)).toBe(`{>>🤖 note ^${FIXED_TS}^<<}`);
    });
});

// ── Scenario 5b: updateComment / deleteComment with multiline content ──
// The anchor comparison (atOrdinal.text === target.currentText) uses decoded text
// (real \n) on both sides. This test proves the round-trip: serialize an encoded
// block on disk, then update/delete it using the decoded form as currentText.

describe('updateComment and deleteComment with multiline content', () => {
    it('updateComment succeeds when currentText contains real newlines (decoded form)', () => {
        // Disk: '\n' token (backslash + n), not real newline
        const encodedBlock = serializeBlock('line1\nline2', FIXED_TS);
        const note = `==hl==${encodedBlock} rest`;
        const match = mkMatch('hl', note);
        // The caller supplies decoded content (real \n) as currentText — matching block.text
        const target: SerializeTarget = {
            highlightText: 'hl',
            ordinal: 0,
            currentText: 'line1\nline2',
        };
        const result = updateComment(note, match, target, 'updated', FIXED_TS);
        expect(result).toContain(`{>>updated ^${FIXED_TS}^<<}`);
        expect(result).not.toContain('line1');
    });

    it('deleteComment succeeds when currentText contains real newlines (decoded form)', () => {
        const encodedBlock = serializeBlock('line1\nline2', FIXED_TS);
        const note = `==hl==${encodedBlock} rest`;
        const match = mkMatch('hl', note);
        const target: SerializeTarget = {
            highlightText: 'hl',
            ordinal: 0,
            currentText: 'line1\nline2',
        };
        const result = deleteComment(note, match, target);
        expect(result).not.toContain('{>>');
        expect(result).toContain('==hl==');
        expect(result).toContain(' rest');
    });

    it('anchor mismatch when currentText is the encoded token (not decoded)', () => {
        // If a caller accidentally passes the raw token string 'line1\\nline2' (not real \n),
        // the anchor check correctly fails — the block.text is decoded (real \n).
        const encodedBlock = serializeBlock('line1\nline2', FIXED_TS);
        const note = `==hl==${encodedBlock} rest`;
        const match = mkMatch('hl', note);
        const target: SerializeTarget = {
            highlightText: 'hl',
            ordinal: 0,
            currentText: 'line1\\nline2', // encoded token, NOT real \n
        };
        // Should abort and return original note
        expect(updateComment(note, match, target, 'updated', FIXED_TS)).toBe(note);
    });
});

// ── Scenario 6: newline encoding (KTD-A) ─────────────────

describe('newline encoding in serializeBlock', () => {
    it('encodes LF newline as \\n token', () => {
        const result = serializeBlock('line1\nline2', FIXED_TS);
        expect(result).toBe(`{>>line1\\nline2 ^${FIXED_TS}^<<}`);
        expect(result).not.toContain('\n');
    });

    it('normalizes CRLF to \\n token', () => {
        const result = serializeBlock('line1\r\nline2', FIXED_TS);
        expect(result).toBe(`{>>line1\\nline2 ^${FIXED_TS}^<<}`);
        expect(result).not.toContain('\r');
        expect(result).not.toContain('\n');
    });

    it('normalizes CR-only to \\n token', () => {
        const result = serializeBlock('line1\rline2', FIXED_TS);
        expect(result).toBe(`{>>line1\\nline2 ^${FIXED_TS}^<<}`);
        expect(result).not.toContain('\r');
    });

    it('encodes backslash as \\\\', () => {
        const result = serializeBlock('C:\\path', FIXED_TS);
        expect(result).toBe(`{>>C:\\\\path ^${FIXED_TS}^<<}`);
    });

    it('encodes backslash before newline without ambiguity (KTD-A order)', () => {
        // '\' followed by actual newline: backslash encoded first → '\\' + '\n' → '\\\\n'
        const result = serializeBlock('a\\\nb', FIXED_TS);
        expect(result).toBe(`{>>a\\\\\\nb ^${FIXED_TS}^<<}`);
        expect(result).not.toContain('\n');
    });

    it('output contains no literal newlines', () => {
        const multiline = 'first\nsecond\nthird';
        const result = serializeBlock(multiline, FIXED_TS);
        expect(result.includes('\n')).toBe(false);
        expect(result.includes('\r')).toBe(false);
    });
});
