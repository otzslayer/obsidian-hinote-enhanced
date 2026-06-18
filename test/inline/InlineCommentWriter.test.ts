import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { InlineCommentWriter } from '../../src/services/comment/inline/InlineCommentWriter';
import type { HighlightInfo } from '../../src/types/highlight';

// ── Test helpers ────────────────────────────────────────────

const FIXED_TS = '2024-01-15 10:30';

/** Create a testable App stub where vault tracks the current note text. */
function mkApp(initialContent: string): { app: App; getContent: () => string } {
    let content = initialContent;
    const file = new TFile('notes/test.md');

    const app = new App();
    app.vault.read = vi.fn(async () => content);
    app.vault.modify = vi.fn(async (_f: TFile, text: string) => { content = text; });
    app.fileManager.processFrontMatter = vi.fn(
        async (_f: TFile, fn: (fm: Record<string, unknown>) => void) => {
            const fm: Record<string, unknown> = {};
            fn(fm);
        }
    );

    // Make getAbstractFileByPath return the test file
    (app.vault as unknown as { getAbstractFileByPath: (p: string) => TFile })
        .getAbstractFileByPath = (_p: string) => file;

    return { app, getContent: () => content };
}

function mkHighlight(text: string, noteText: string): HighlightInfo {
    const pattern = new RegExp(`==${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}==`);
    const m = noteText.match(pattern);
    if (!m || m.index === undefined) throw new Error(`"${text}" not in note`);
    return {
        text,
        position: m.index,
        originalLength: m[0].length,
        comments: [],
    };
}

// ── addComment ───────────────────────────────────────────────

describe('InlineCommentWriter.addComment', () => {
    it('inserts {>>text ^ts^<<} after the highlight in the vault file', async () => {
        const note = '==powerhouse== rest';
        const { app, getContent } = mkApp(note);
        const writer = new InlineCommentWriter(app);
        const file = new TFile('notes/test.md');
        const hl = mkHighlight('powerhouse', note);

        await writer.addComment(file, hl, 'important', FIXED_TS);

        expect(getContent()).toContain(`==powerhouse=={>>important ^${FIXED_TS}^<<}`);
        expect(getContent()).toContain(' rest');
    });

    it('appends after existing comment on same highlight', async () => {
        const note = `==hl=={>>first ^${FIXED_TS}^<<} text`;
        const { app, getContent } = mkApp(note);
        const writer = new InlineCommentWriter(app);
        const file = new TFile('notes/test.md');
        const hl: HighlightInfo = {
            text: 'hl',
            position: 0,
            originalLength: '==hl=='.length,
            comments: [{ id: 'c1', content: 'first', createdAt: 0, updatedAt: 0 }],
        };

        await writer.addComment(file, hl, 'second', FIXED_TS);

        expect(getContent()).toContain('{>>first ^');
        expect(getContent()).toContain('{>>second ^');
    });

    it('returns success=true on successful write', async () => {
        const { app } = mkApp('==hl== text');
        const writer = new InlineCommentWriter(app);
        const file = new TFile('notes/test.md');
        const hl = mkHighlight('hl', '==hl== text');

        const result = await writer.addComment(file, hl, 'note', FIXED_TS);
        expect(result.success).toBe(true);
    });
});

// ── updateComment ────────────────────────────────────────────

describe('InlineCommentWriter.updateComment', () => {
    it('replaces the target block by ordinal and updates timestamp', async () => {
        const note = `==hl=={>>original ^2023-01-01 10:00^<<} text`;
        const { app, getContent } = mkApp(note);
        const writer = new InlineCommentWriter(app);
        const file = new TFile('notes/test.md');
        const hl: HighlightInfo = {
            text: 'hl',
            position: 0,
            originalLength: '==hl=='.length,
            comments: [{ id: 'c1', content: 'original', createdAt: 0, updatedAt: 0 }],
        };

        await writer.updateComment(file, hl, 'c1', 'updated', FIXED_TS);

        expect(getContent()).toContain(`{>>updated ^${FIXED_TS}^<<}`);
        expect(getContent()).not.toContain('original');
    });

    it('returns success=false and leaves note unchanged on anchor mismatch (KTD3)', async () => {
        // The note has been modified externally — comment text differs from hl.comments
        const note = `==hl=={>>different-content ^2023-01-01 10:00^<<} text`;
        const { app, getContent } = mkApp(note);
        const writer = new InlineCommentWriter(app);
        const file = new TFile('notes/test.md');
        const hl: HighlightInfo = {
            text: 'hl',
            position: 0,
            originalLength: '==hl=='.length,
            // The CommentItem content doesn't match what's in the note — simulates external edit
            comments: [{ id: 'c1', content: 'stale-cached-content', createdAt: 0, updatedAt: 0 }],
        };

        const result = await writer.updateComment(file, hl, 'c1', 'new-content', FIXED_TS);

        expect(result.success).toBe(false);
        expect(result.reason).toContain('anchor');
        // Note MUST be unchanged (damage prevention, KTD3)
        expect(getContent()).toBe(note);
    });

    it('selects correct block by ordinal when two comments exist', async () => {
        const note = `==hl=={>>first ^${FIXED_TS}^<<}{>>second ^${FIXED_TS}^<<} text`;
        const { app, getContent } = mkApp(note);
        const writer = new InlineCommentWriter(app);
        const file = new TFile('notes/test.md');
        const hl: HighlightInfo = {
            text: 'hl',
            position: 0,
            originalLength: '==hl=='.length,
            comments: [
                { id: 'c1', content: 'first', createdAt: 0, updatedAt: 0 },
                { id: 'c2', content: 'second', createdAt: 0, updatedAt: 0 },
            ],
        };

        await writer.updateComment(file, hl, 'c2', 'updated-second', FIXED_TS);

        expect(getContent()).toContain('{>>first ^'); // unchanged
        expect(getContent()).toContain('{>>updated-second ^');
    });
});

// ── deleteComment ────────────────────────────────────────────

describe('InlineCommentWriter.deleteComment', () => {
    it('removes the target block from the note', async () => {
        const note = `==hl=={>>to-delete ^${FIXED_TS}^<<} text`;
        const { app, getContent } = mkApp(note);
        const writer = new InlineCommentWriter(app);
        const file = new TFile('notes/test.md');
        const hl: HighlightInfo = {
            text: 'hl',
            position: 0,
            originalLength: '==hl=='.length,
            comments: [{ id: 'c1', content: 'to-delete', createdAt: 0, updatedAt: 0 }],
        };

        await writer.deleteComment(file, hl, 'c1');

        expect(getContent()).not.toContain('{>>');
        expect(getContent()).toContain('==hl==');
    });

    it('returns success=false on anchor mismatch, note unchanged (KTD3)', async () => {
        const note = `==hl=={>>actual ^${FIXED_TS}^<<} text`;
        const { app, getContent } = mkApp(note);
        const writer = new InlineCommentWriter(app);
        const file = new TFile('notes/test.md');
        const hl: HighlightInfo = {
            text: 'hl',
            position: 0,
            originalLength: '==hl=='.length,
            comments: [{ id: 'c1', content: 'wrong-cached', createdAt: 0, updatedAt: 0 }],
        };

        const result = await writer.deleteComment(file, hl, 'c1');

        expect(result.success).toBe(false);
        expect(getContent()).toBe(note);
    });
});
