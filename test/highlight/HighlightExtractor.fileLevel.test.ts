import { describe, it, expect, vi } from 'vitest';
import { App, TFile } from 'obsidian';
import { HighlightExtractor } from '../../src/services/highlight/HighlightExtractor';
import { IdGenerator } from '../../src/utils/IdGenerator';

// ── Helpers ──────────────────────────────────────────────────

type FrontmatterComment = { text: string; ts: string };

function mkApp(comments: FrontmatterComment[] = []): App {
    const app = new App() as unknown as App;
    (app.metadataCache.getFileCache as ReturnType<typeof vi.fn>) = vi.fn(() => ({
        frontmatter: { comments },
    }));
    return app;
}

function mkFile(path = 'notes/test.md'): TFile {
    const f = new TFile(path);
    return f;
}

function extractFileLevelCard(comments: FrontmatterComment[], path = 'notes/test.md') {
    const app = mkApp(comments);
    const extractor = new HighlightExtractor(app, () => undefined);
    const file = mkFile(path);
    const highlights = extractor.extractHighlights('', file);
    return highlights.find((h) => h.position === -1);
}

// ── 통합 카드 구조 ────────────────────────────────────────────

describe('HighlightExtractor — file-level comment card', () => {
    it('1개 → position:-1, isVirtual:true, comments[0].fileCommentIndex===0', () => {
        const card = extractFileLevelCard([{ text: 'hello', ts: '2024-01-01 10:00' }]);
        expect(card).toBeDefined();
        expect(card?.position).toBe(-1);
        expect(card?.isVirtual).toBe(true);
        expect(card?.comments?.[0]?.content).toBe('hello');
        expect(card?.comments?.[0]?.fileCommentIndex).toBe(0);
    });

    it('3개 → fileCommentIndex 0,1,2 (parse 순서)', () => {
        const card = extractFileLevelCard([
            { text: 'a', ts: '2024-01-01 09:00' },
            { text: 'b', ts: '2024-01-01 09:01' },
            { text: 'c', ts: '2024-01-01 09:02' },
        ]);
        expect(card?.comments?.map((c) => c.fileCommentIndex)).toEqual([0, 1, 2]);
    });

    it('카드 id가 같은 파일에 대해 재추출 시 동일 (결정적)', () => {
        const path = 'notes/deterministic.md';
        const comments = [{ text: 'x', ts: '2024-01-01 09:00' }];
        const id1 = extractFileLevelCard(comments, path)?.id;
        const id2 = extractFileLevelCard(comments, path)?.id;
        expect(id1).toBeDefined();
        expect(id1).toBe(id2);
        expect(id1).toBe(IdGenerator.generateHighlightId(path, -1, ''));
    });

    it('filePath가 file.path와 일치', () => {
        const path = 'some/folder/note.md';
        const card = extractFileLevelCard([{ text: 'y', ts: '2024-01-01 09:00' }], path);
        expect(card?.filePath).toBe(path);
    });

    it('file-level 코멘트 없음 → position:-1 카드 미생성', () => {
        const card = extractFileLevelCard([]);
        expect(card).toBeUndefined();
    });

    it('인라인 코멘트(회귀) → CommentItem.fileCommentIndex===undefined', () => {
        const app = mkApp([]); // 프론트매터 코멘트 없음
        const extractor = new HighlightExtractor(app, () => undefined);
        const file = mkFile();
        const highlights = extractor.extractHighlights(
            '==hello=={>>world ^2024-01-01 09:00^<<}',
            file
        );
        const inlineCard = highlights.find((h) => h.text === 'hello');
        expect(inlineCard).toBeDefined();
        inlineCard?.comments?.forEach((c) => {
            expect(c.fileCommentIndex).toBeUndefined();
        });
    });
});
