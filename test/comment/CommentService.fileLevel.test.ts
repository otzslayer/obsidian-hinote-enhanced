import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile, Notice } from 'obsidian';

// t()가 moment.locale()를 호출하므로 테스트 환경에서 모킹
vi.mock('../../src/i18n', () => ({ t: (key: string) => key }));

import { CommentService } from '../../src/services/comment/CommentService';
import type { HighlightInfo, CommentItem } from '../../src/types/highlight';
import type { WriteResult } from '../../src/services/comment/inline/InlineCommentWriter';

// ── Stubs ────────────────────────────────────────────────────

function mkPlugin() {
    return {
        eventManager: { emitCommentUpdate: vi.fn() },
        fsrsManager: null,
    } as unknown as import('../../main').default;
}

function mkHighlightManager() {
    return {} as unknown as import('../../src/services/HighlightManager').HighlightManager;
}

function mkInlineWriterMock() {
    return {
        addFileLevelComment: vi.fn<[], Promise<WriteResult>>(),
        updateFileLevelCommentAt: vi.fn<[], Promise<WriteResult>>(),
        deleteFileLevelCommentAt: vi.fn<[], Promise<WriteResult>>(),
        addComment: vi.fn<[], Promise<WriteResult>>(),
        updateComment: vi.fn<[], Promise<WriteResult>>(),
        deleteComment: vi.fn<[], Promise<WriteResult>>(),
    };
}

function mkFileLevelCard(
    comments: Array<{ id: string; content: string; fileCommentIndex: number }>
): HighlightInfo {
    return {
        id: 'highlight-file-1',
        text: '',
        position: -1,
        isVirtual: true,
        filePath: 'notes/test.md',
        comments: comments.map((c) => ({
            id: c.id,
            content: c.content,
            createdAt: 0,
            updatedAt: 0,
            fileCommentIndex: c.fileCommentIndex,
        })),
    };
}

function mkInlineCard(): HighlightInfo {
    return {
        id: 'highlight-123',
        text: 'hello',
        position: 5,
        comments: [{ id: 'c1', content: 'original', createdAt: 0, updatedAt: 0 }],
    };
}

interface ServiceFixture {
    service: CommentService;
    writerMock: ReturnType<typeof mkInlineWriterMock>;
    file: TFile;
    onCardUpdate: ReturnType<typeof vi.fn>;
    onCardRemove: ReturnType<typeof vi.fn>;
    onHighlightsUpdate: ReturnType<typeof vi.fn>;
}

function mkService(): ServiceFixture {
    const app = new App();
    (app.vault as unknown as { getAbstractFileByPath: (p: string) => TFile }).getAbstractFileByPath =
        vi.fn(() => new TFile('notes/test.md'));

    const service = new CommentService(app, mkPlugin(), mkHighlightManager());

    // replace private inlineWriter with our controlled mock
    const writerMock = mkInlineWriterMock();
    (service as unknown as { inlineWriter: typeof writerMock }).inlineWriter = writerMock;

    const file = new TFile('notes/test.md');
    service.updateState({ currentFile: file });

    const onCardUpdate = vi.fn();
    const onCardRemove = vi.fn();
    const onHighlightsUpdate = vi.fn();
    service.setCallbacks({ onCardUpdate, onCardRemove, onHighlightsUpdate });

    return { service, writerMock, file, onCardUpdate, onCardRemove, onHighlightsUpdate };
}

// ── updateComment — position:-1 ──────────────────────────────

describe('CommentService.updateComment — file-level (position:-1)', () => {
    it('updateFileLevelCommentAt에 fileCommentIndex와 OLD content(expectedText) 전달', async () => {
        const { service, writerMock } = mkService();
        const card = mkFileLevelCard([{ id: 'c0', content: 'old-text', fileCommentIndex: 0 }]);
        writerMock.updateFileLevelCommentAt.mockResolvedValue({ success: true });

        await service.updateComment(card, 'c0', 'new-text');

        expect(writerMock.updateFileLevelCommentAt).toHaveBeenCalledWith(
            expect.any(TFile),
            0,           // index (fileCommentIndex)
            'old-text',  // expectedText (OLD content)
            expect.objectContaining({ text: 'new-text' })
        );
    });

    it('성공 시 인메모리 content 갱신 + onCardUpdate 발화, inlineWriter.updateComment 미호출', async () => {
        const { service, writerMock, onCardUpdate } = mkService();
        const card = mkFileLevelCard([{ id: 'c0', content: 'old', fileCommentIndex: 0 }]);
        writerMock.updateFileLevelCommentAt.mockResolvedValue({ success: true });

        await service.updateComment(card, 'c0', 'new');

        expect(card.comments![0].content).toBe('new');
        expect(onCardUpdate).toHaveBeenCalledWith(card);
        expect(writerMock.updateComment).not.toHaveBeenCalled();
    });

    it('실패 시 Notice + 인메모리 불변', async () => {
        const { service, writerMock } = mkService();
        const card = mkFileLevelCard([{ id: 'c0', content: 'old', fileCommentIndex: 0 }]);
        writerMock.updateFileLevelCommentAt.mockResolvedValue({
            success: false,
            reason: 'anchor mismatch',
        });
        const noticeSpy = vi.spyOn(Notice.prototype, 'constructor' as never).mockImplementation(() => {});

        await service.updateComment(card, 'c0', 'new');

        expect(card.comments![0].content).toBe('old'); // 불변
        noticeSpy.mockRestore();
    });

    it('ts가 분 단위 16자 형식 (초 없음)', async () => {
        const { service, writerMock } = mkService();
        const card = mkFileLevelCard([{ id: 'c0', content: 'old', fileCommentIndex: 0 }]);
        writerMock.updateFileLevelCommentAt.mockResolvedValue({ success: true });

        await service.updateComment(card, 'c0', 'new');

        const call = writerMock.updateFileLevelCommentAt.mock.calls[0];
        const newComment = call[3] as { text: string; ts: string };
        expect(newComment.ts).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
});

// ── deleteComment — position:-1 ──────────────────────────────

describe('CommentService.deleteComment — file-level (position:-1)', () => {
    it('deleteFileLevelCommentAt에 index+expectedText 전달', async () => {
        const { service, writerMock } = mkService();
        const card = mkFileLevelCard([{ id: 'c0', content: 'text0', fileCommentIndex: 0 }]);
        service.updateState({ highlights: [card] });
        writerMock.deleteFileLevelCommentAt.mockResolvedValue({ success: true });

        await service.deleteComment(card, 'c0');

        expect(writerMock.deleteFileLevelCommentAt).toHaveBeenCalledWith(
            expect.any(TFile), 0, 'text0'
        );
    });

    it('재인덱싱: 3개(0,1,2) 중 index 1 삭제 → 남은 둘 fileCommentIndex 0,1', async () => {
        const { service, writerMock } = mkService();
        const card = mkFileLevelCard([
            { id: 'c0', content: 'a', fileCommentIndex: 0 },
            { id: 'c1', content: 'b', fileCommentIndex: 1 },
            { id: 'c2', content: 'c', fileCommentIndex: 2 },
        ]);
        service.updateState({ highlights: [card] });
        writerMock.deleteFileLevelCommentAt.mockResolvedValue({ success: true });

        await service.deleteComment(card, 'c1');

        expect(card.comments!.map((c) => c.content)).toEqual(['a', 'c']);
        expect(card.comments!.map((c) => c.fileCommentIndex)).toEqual([0, 1]);
    });

    it('마지막 코멘트 삭제 시 state.highlights에서 카드 제거 + onCardRemove', async () => {
        const { service, writerMock, onCardRemove, onHighlightsUpdate } = mkService();
        const card = mkFileLevelCard([{ id: 'c0', content: 'only', fileCommentIndex: 0 }]);
        const otherCard: HighlightInfo = { text: 'other', position: 10, id: 'other-1' };
        service.updateState({ highlights: [card, otherCard] });
        writerMock.deleteFileLevelCommentAt.mockResolvedValue({ success: true });

        await service.deleteComment(card, 'c0');

        expect(onCardRemove).toHaveBeenCalledWith(card);
        expect(onHighlightsUpdate).toHaveBeenCalledWith([otherCard]);
    });

    it('실패 시 Notice + 모델 유지', async () => {
        const { service, writerMock } = mkService();
        const card = mkFileLevelCard([{ id: 'c0', content: 'text', fileCommentIndex: 0 }]);
        service.updateState({ highlights: [card] });
        writerMock.deleteFileLevelCommentAt.mockResolvedValue({
            success: false,
            reason: 'anchor mismatch',
        });

        await service.deleteComment(card, 'c0');

        expect(card.comments).toHaveLength(1); // 불변
    });
});

// ── 회귀: 인라인 경로 (position !== -1) ──────────────────────

describe('CommentService — inline path regression (position:5)', () => {
    it('updateComment: inlineWriter.updateComment로 라우팅, *At 미호출', async () => {
        const { service, writerMock } = mkService();
        const card = mkInlineCard();
        writerMock.updateComment.mockResolvedValue({ success: true });

        await service.updateComment(card, 'c1', 'updated');

        expect(writerMock.updateComment).toHaveBeenCalled();
        expect(writerMock.updateFileLevelCommentAt).not.toHaveBeenCalled();
    });

    it('deleteComment: inlineWriter.deleteComment로 라우팅, *At 미호출', async () => {
        const { service, writerMock } = mkService();
        const card = mkInlineCard();
        service.updateState({ highlights: [card] });
        writerMock.deleteComment.mockResolvedValue({ success: true });

        await service.deleteComment(card, 'c1');

        expect(writerMock.deleteComment).toHaveBeenCalled();
        expect(writerMock.deleteFileLevelCommentAt).not.toHaveBeenCalled();
    });
});

// ── addFileLevelComment ──────────────────────────────────────

describe('CommentService.addFileLevelComment', () => {
    it('분 단위 ts 생성 + inlineWriter.addFileLevelComment 호출, writer 결과 반환', async () => {
        const { service, writerMock, file } = mkService();
        writerMock.addFileLevelComment.mockResolvedValue({ success: true });

        const result = await service.addFileLevelComment(file, 'new comment');

        expect(result.success).toBe(true);
        expect(writerMock.addFileLevelComment).toHaveBeenCalledWith(
            file,
            expect.objectContaining({
                text: 'new comment',
                ts: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
            })
        );
    });
});
