import { describe, it, expect } from 'vitest';
import {
    parseInlineComments,
    type HighlightMatch,
    type InlineCommentBlock,
    type InlineParseResult,
} from '../../src/services/comment/inline/InlineCommentParser';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function mkMatch(text: string, noteText: string, nth = 0): HighlightMatch {
    // Find the nth occurrence of ==text== in noteText and return its full-match end
    const pattern = new RegExp(`==${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}==`, 'g');
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = pattern.exec(noteText)) !== null) {
        if (count === nth) {
            return { text, start: m.index, end: m.index + m[0].length };
        }
        count++;
    }
    throw new Error(`highlight "${text}" (nth=${nth}) not found in noteText`);
}

// ────────────────────────────────────────────────────────────
// Scenario 1: single highlight + single comment (with timestamp)
// ────────────────────────────────────────────────────────────
describe('parseInlineComments — single highlight + comment', () => {
    const note = '==cell powerhouse=={>>important point ^2024-01-15 10:30^<<} rest';
    const matches = [mkMatch('cell powerhouse', note)];

    it('returns one paired result for the highlight', () => {
        const result: InlineParseResult = parseInlineComments(note, matches);
        expect(result.pairedComments).toHaveLength(1);
        expect(result.orphanComments).toHaveLength(0);
    });

    it('extracts comment text correctly', () => {
        const { pairedComments } = parseInlineComments(note, matches);
        const block: InlineCommentBlock = pairedComments[0].comments[0];
        expect(block.text).toBe('important point');
    });

    it('extracts timestamp correctly', () => {
        const { pairedComments } = parseInlineComments(note, matches);
        const block = pairedComments[0].comments[0];
        expect(block.timestamp).toBe('2024-01-15 10:30');
    });

    it('is not AI, not orphan', () => {
        const { pairedComments } = parseInlineComments(note, matches);
        const block = pairedComments[0].comments[0];
        expect(block.isAI).toBe(false);
        expect(block.isOrphan).toBe(false);
    });

    it('ordinal is 0', () => {
        const { pairedComments } = parseInlineComments(note, matches);
        expect(pairedComments[0].comments[0].ordinal).toBe(0);
    });
});

// ────────────────────────────────────────────────────────────
// Scenario 2: multiple consecutive comment blocks on one highlight
// ────────────────────────────────────────────────────────────
describe('parseInlineComments — multiple comments on one highlight', () => {
    const note = '==power=={>>first ^2024-01-01 09:00^<<}{>>second ^2024-01-02 09:00^<<} end';
    const matches = [mkMatch('power', note)];

    it('returns two comments in order', () => {
        const { pairedComments } = parseInlineComments(note, matches);
        expect(pairedComments[0].comments).toHaveLength(2);
        expect(pairedComments[0].comments[0].text).toBe('first');
        expect(pairedComments[0].comments[1].text).toBe('second');
    });

    it('ordinals are 0 and 1', () => {
        const { pairedComments } = parseInlineComments(note, matches);
        expect(pairedComments[0].comments[0].ordinal).toBe(0);
        expect(pairedComments[0].comments[1].ordinal).toBe(1);
    });
});

// ────────────────────────────────────────────────────────────
// Scenario 3: AI comment prefix 🤖
// ────────────────────────────────────────────────────────────
describe('parseInlineComments — AI comment', () => {
    const note = '==data=={>>🤖 auto-generated note ^2024-03-01 12:00^<<}';
    const matches = [mkMatch('data', note)];

    it('sets isAI = true', () => {
        const { pairedComments } = parseInlineComments(note, matches);
        const block = pairedComments[0].comments[0];
        expect(block.isAI).toBe(true);
    });

    it('strips 🤖 from text', () => {
        const { pairedComments } = parseInlineComments(note, matches);
        const block = pairedComments[0].comments[0];
        expect(block.text).toBe('auto-generated note');
    });
});

// ────────────────────────────────────────────────────────────
// Scenario 4: block without timestamp
// ────────────────────────────────────────────────────────────
describe('parseInlineComments — no timestamp', () => {
    const note = '==idea=={>>no timestamp here<<}';
    const matches = [mkMatch('idea', note)];

    it('timestamp is null', () => {
        const { pairedComments } = parseInlineComments(note, matches);
        expect(pairedComments[0].comments[0].timestamp).toBeNull();
    });

    it('full raw text is the comment text', () => {
        const { pairedComments } = parseInlineComments(note, matches);
        expect(pairedComments[0].comments[0].text).toBe('no timestamp here');
    });
});

// ────────────────────────────────────────────────────────────
// Scenario 5: ^ in middle of text — NOT treated as timestamp (KTD1)
// ────────────────────────────────────────────────────────────
describe('parseInlineComments — ^ in middle is not a timestamp', () => {
    const note = '==formula=={>>x^2 form ^2024-05-01 08:00^<<}';
    const matches = [mkMatch('formula', note)];

    it('only the end-anchored token is the timestamp', () => {
        const { pairedComments } = parseInlineComments(note, matches);
        const block = pairedComments[0].comments[0];
        expect(block.timestamp).toBe('2024-05-01 08:00');
        expect(block.text).toBe('x^2 form');
    });
});

// ────────────────────────────────────────────────────────────
// Scenario 5b: timestamp with seconds + legacy minute-only back-compat
// ────────────────────────────────────────────────────────────
describe('parseInlineComments — timestamp with seconds (and back-compat)', () => {
    it('parses an HH:mm:ss timestamp', () => {
        const note = '==x=={>>note ^2026-06-18 12:34:56^<<}';
        const matches = [mkMatch('x', note)];
        const { pairedComments } = parseInlineComments(note, matches);
        const block = pairedComments[0].comments[0];
        expect(block.timestamp).toBe('2026-06-18 12:34:56');
        expect(block.text).toBe('note');
    });

    it('still parses a legacy HH:mm timestamp', () => {
        const note = '==x=={>>note ^2026-06-18 12:34^<<}';
        const matches = [mkMatch('x', note)];
        const { pairedComments } = parseInlineComments(note, matches);
        const block = pairedComments[0].comments[0];
        expect(block.timestamp).toBe('2026-06-18 12:34');
        expect(block.text).toBe('note');
    });
});

// ────────────────────────────────────────────────────────────
// Scenario 6: orphan — {>>...<<} with no preceding highlight (KTD5)
// ────────────────────────────────────────────────────────────
describe('parseInlineComments — orphan comment', () => {
    const note = 'no highlight here {>>orphaned comment ^2024-06-01 10:00^<<}';

    it('lands in orphanComments', () => {
        const { pairedComments, orphanComments } = parseInlineComments(note, []);
        expect(orphanComments).toHaveLength(1);
        expect(pairedComments).toHaveLength(0);
    });

    it('isOrphan = true', () => {
        const { orphanComments } = parseInlineComments(note, []);
        expect(orphanComments[0].isOrphan).toBe(true);
        expect(orphanComments[0].text).toBe('orphaned comment');
    });
});

// ────────────────────────────────────────────────────────────
// Scenario 7: <mark> match end pairing (KTD6)
// ────────────────────────────────────────────────────────────
describe('parseInlineComments — <mark> highlight pairing', () => {
    const note = '<mark>nucleus</mark>{>>important ^2024-07-01 09:00^<<}';

    function markMatch(): HighlightMatch {
        const m = note.match(/<mark[^>]*>(.*?)<\/mark>/);
        if (!m) throw new Error('no match');
        return { text: 'nucleus', start: 0, end: m[0].length };
    }

    it('pairs comment with <mark> highlight', () => {
        const { pairedComments } = parseInlineComments(note, [markMatch()]);
        expect(pairedComments).toHaveLength(1);
        expect(pairedComments[0].comments[0].text).toBe('important');
    });
});

// ────────────────────────────────────────────────────────────
// Scenario 8: empty note / no comments — no error
// ────────────────────────────────────────────────────────────
describe('parseInlineComments — edge cases', () => {
    it('empty note returns empty result', () => {
        const result = parseInlineComments('', []);
        expect(result.pairedComments).toHaveLength(0);
        expect(result.orphanComments).toHaveLength(0);
    });

    it('highlight with no adjacent comment returns entry with empty comments', () => {
        const note = '==lonely highlight== and some text';
        const matches = [mkMatch('lonely highlight', note)];
        const { pairedComments } = parseInlineComments(note, matches);
        // Highlights without adjacent blocks should still appear with empty comments array
        // or not appear at all — the contract is: no crash, no orphan
        expect(pairedComments.every(p => !p.comments.some(c => c.isOrphan))).toBe(true);
    });

    it('multiple highlights — each comment goes to its nearest preceding highlight', () => {
        const note = '==A=={>>comment-a ^2024-01-01 00:00^<<} text ==B=={>>comment-b ^2024-01-02 00:00^<<}';
        const matchA = mkMatch('A', note);
        const matchB = mkMatch('B', note);
        const { pairedComments } = parseInlineComments(note, [matchA, matchB]);
        const commentA = pairedComments.find(p => p.highlightText === 'A');
        const commentB = pairedComments.find(p => p.highlightText === 'B');
        expect(commentA?.comments[0].text).toBe('comment-a');
        expect(commentB?.comments[0].text).toBe('comment-b');
    });
});
