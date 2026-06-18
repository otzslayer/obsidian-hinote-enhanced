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
