import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { InlineCommentWriter } from '../../src/services/comment/inline/InlineCommentWriter';
import type { FileLevelComment } from '../../src/services/comment/inline/FrontmatterComments';

// ── Helpers ──────────────────────────────────────────────────

/** Create an App stub where processFrontMatter operates on a shared fm object. */
function mkApp(): { app: App; getFm: () => Record<string, unknown> } {
    let fm: Record<string, unknown> = {};

    const app = new App();
    app.vault.read = vi.fn(async () => '');
    app.vault.modify = vi.fn(async () => {});
    app.fileManager.processFrontMatter = vi.fn(
        async (_f: TFile, fn: (fm: Record<string, unknown>) => void) => {
            fn(fm);
        }
    );

    return { app, getFm: () => fm };
}

function mkFile(): TFile {
    return new TFile('notes/test.md');
}

function seed(fm: Record<string, unknown>, comments: FileLevelComment[]): void {
    fm.comments = [...comments];
}

// ── addFileLevelComment ──────────────────────────────────────

describe('InlineCommentWriter.addFileLevelComment', () => {
    it('빈 프론트매터에 append → success:true, fm.comments 1개', async () => {
        const { app, getFm } = mkApp();
        const writer = new InlineCommentWriter(app);

        const result = await writer.addFileLevelComment(mkFile(), { text: 'hello', ts: '2024-01-01 10:00' });

        expect(result.success).toBe(true);
        const comments = getFm().comments as FileLevelComment[];
        expect(comments).toHaveLength(1);
        expect(comments[0]).toMatchObject({ text: 'hello', ts: '2024-01-01 10:00' });
    });

    it('foreign 항목 보존 + HiNote 항목 뒤에 append', async () => {
        const { app, getFm } = mkApp();
        seed(getFm(), []);
        (getFm() as Record<string, unknown>).comments = [
            { note: 'foreign' },
            { text: 'first', ts: '2024-01-01 09:00' },
        ];
        const writer = new InlineCommentWriter(app);

        await writer.addFileLevelComment(mkFile(), { text: 'second', ts: '2024-01-01 10:00' });

        const comments = getFm().comments as unknown[];
        // foreign preserved first, then hinote items in order
        expect(comments[0]).toMatchObject({ note: 'foreign' });
        expect(comments[1]).toMatchObject({ text: 'first' });
        expect(comments[2]).toMatchObject({ text: 'second' });
    });
});

// ── updateFileLevelCommentAt ─────────────────────────────────

describe('InlineCommentWriter.updateFileLevelCommentAt', () => {
    it('expectedText 일치 시 해당 index만 교체, 다른 index 불변, success:true', async () => {
        const { app, getFm } = mkApp();
        seed(getFm(), [
            { text: 'aaa', ts: '2024-01-01 09:00' },
            { text: 'bbb', ts: '2024-01-01 09:01' },
        ]);
        const writer = new InlineCommentWriter(app);

        const result = await writer.updateFileLevelCommentAt(
            mkFile(), 0, 'aaa', { text: 'AAA-updated', ts: '2024-01-01 10:00' }
        );

        expect(result.success).toBe(true);
        const comments = getFm().comments as FileLevelComment[];
        expect(comments[0]).toMatchObject({ text: 'AAA-updated', ts: '2024-01-01 10:00' });
        expect(comments[1]).toMatchObject({ text: 'bbb' }); // 불변
    });

    it('expectedText 불일치 시 fm.comments 불변, success:false', async () => {
        const { app, getFm } = mkApp();
        seed(getFm(), [{ text: 'original', ts: '2024-01-01 09:00' }]);
        const writer = new InlineCommentWriter(app);

        const result = await writer.updateFileLevelCommentAt(
            mkFile(), 0, 'wrong-text', { text: 'new', ts: '2024-01-01 10:00' }
        );

        expect(result.success).toBe(false);
        expect(result.reason).toContain('anchor');
        const comments = getFm().comments as FileLevelComment[];
        expect(comments[0]).toMatchObject({ text: 'original' }); // 불변
    });

    it('index out-of-bounds → success:false', async () => {
        const { app } = mkApp();
        const writer = new InlineCommentWriter(app);

        const result = await writer.updateFileLevelCommentAt(
            mkFile(), 5, 'any', { text: 'new', ts: '2024-01-01 10:00' }
        );

        expect(result.success).toBe(false);
    });
});

// ── deleteAllFileLevelComments ───────────────────────────────

describe('InlineCommentWriter.deleteAllFileLevelComments', () => {
    it('HiNote 항목만 존재 시 전부 제거 → comments:[], success:true', async () => {
        const { app, getFm } = mkApp();
        seed(getFm(), [
            { text: 'a', ts: '2026-06-23 10:00' },
            { text: 'b', ts: '2026-06-23 10:01' },
        ]);
        const writer = new InlineCommentWriter(app);

        const result = await writer.deleteAllFileLevelComments(mkFile());

        expect(result.success).toBe(true);
        const comments = getFm().comments as unknown[];
        expect(comments).toEqual([]);
    });

    it('foreign 항목 보존: HiNote 항목만 제거됨, success:true', async () => {
        const { app, getFm } = mkApp();
        (getFm() as Record<string, unknown>).comments = [
            { note: 'foreign' },
            { text: 'a', ts: '2026-06-23 10:00' },
            { text: 'b', ts: '2026-06-23 10:01' },
        ];
        const writer = new InlineCommentWriter(app);

        const result = await writer.deleteAllFileLevelComments(mkFile());

        expect(result.success).toBe(true);
        const comments = getFm().comments as unknown[];
        expect(comments).toHaveLength(1);
        expect(comments[0]).toMatchObject({ note: 'foreign' });
    });

    it('comments 키 없음 → success:true, graceful no-op', async () => {
        const { app } = mkApp();
        const writer = new InlineCommentWriter(app);

        const result = await writer.deleteAllFileLevelComments(mkFile());

        expect(result.success).toBe(true);
    });

    it('빈 배열 → success:true, graceful no-op', async () => {
        const { app, getFm } = mkApp();
        (getFm() as Record<string, unknown>).comments = [];
        const writer = new InlineCommentWriter(app);

        const result = await writer.deleteAllFileLevelComments(mkFile());

        expect(result.success).toBe(true);
        const comments = getFm().comments as unknown[];
        expect(comments).toEqual([]);
    });

    it('processFrontMatter가 throw 시 success:false, reason 포함', async () => {
        const { app } = mkApp();
        app.fileManager.processFrontMatter = vi.fn(async () => {
            throw new Error('disk full');
        });
        const writer = new InlineCommentWriter(app);

        const result = await writer.deleteAllFileLevelComments(mkFile());

        expect(result.success).toBe(false);
        expect(result.reason).toBe('disk full');
    });
});

// ── deleteFileLevelCommentAt ─────────────────────────────────

describe('InlineCommentWriter.deleteFileLevelCommentAt', () => {
    it('일치 시 해당 index 제거, success:true', async () => {
        const { app, getFm } = mkApp();
        seed(getFm(), [
            { text: 'aaa', ts: '2024-01-01 09:00' },
            { text: 'bbb', ts: '2024-01-01 09:01' },
        ]);
        const writer = new InlineCommentWriter(app);

        const result = await writer.deleteFileLevelCommentAt(mkFile(), 0, 'aaa');

        expect(result.success).toBe(true);
        const comments = getFm().comments as FileLevelComment[];
        expect(comments).toHaveLength(1);
        expect(comments[0]).toMatchObject({ text: 'bbb' });
    });

    it('불일치 시 불변, success:false', async () => {
        const { app, getFm } = mkApp();
        seed(getFm(), [{ text: 'original', ts: '2024-01-01 09:00' }]);
        const writer = new InlineCommentWriter(app);

        const result = await writer.deleteFileLevelCommentAt(mkFile(), 0, 'wrong');

        expect(result.success).toBe(false);
        const comments = getFm().comments as FileLevelComment[];
        expect(comments).toHaveLength(1);
    });

    it('유일 HiNote 항목 삭제 시 foreign 보존', async () => {
        const { app, getFm } = mkApp();
        (getFm() as Record<string, unknown>).comments = [
            { note: 'foreign' },
            { text: 'only', ts: '2024-01-01 09:00' },
        ];
        const writer = new InlineCommentWriter(app);

        const result = await writer.deleteFileLevelCommentAt(mkFile(), 0, 'only');

        expect(result.success).toBe(true);
        const comments = getFm().comments as unknown[];
        expect(comments).toHaveLength(1);
        expect(comments[0]).toMatchObject({ note: 'foreign' });
    });
});
