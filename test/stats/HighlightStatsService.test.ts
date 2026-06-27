import { describe, it, expect } from 'vitest';
import { computeHighlightStats, StatsInputFile } from '../../src/services/stats/HighlightStatsService';
import { HighlightInfo } from '../../src/types/highlight';

function makeHighlight(overrides: Partial<HighlightInfo> = {}): HighlightInfo {
    return {
        text: 'sample',
        position: 0,
        ...overrides,
    };
}

function makeFile(filePath: string, fileName: string, highlights: HighlightInfo[]): StatsInputFile {
    return { filePath, fileName, highlights };
}

describe('computeHighlightStats', () => {
    it('빈 입력 → 모든 카운트 0, 빈 랭킹 배열', () => {
        const result = computeHighlightStats([]);
        expect(result.totalHighlights).toBe(0);
        expect(result.totalComments).toBe(0);
        expect(result.notesWithHighlights).toBe(0);
        expect(result.topByHighlights).toEqual([]);
        expect(result.topByComments).toEqual([]);
    });

    it('단일 파일 N개 하이라이트 → totalHighlights=N, 포함 노트=1', () => {
        const highlights = [
            makeHighlight({ text: 'a' }),
            makeHighlight({ text: 'b' }),
            makeHighlight({ text: 'c' }),
        ];
        const result = computeHighlightStats([makeFile('note.md', 'note', highlights)]);
        expect(result.totalHighlights).toBe(3);
        expect(result.notesWithHighlights).toBe(1);
    });

    it('다중 파일 합산(하이라이트·코멘트 총합 정확)', () => {
        const file1 = makeFile('a.md', 'a', [
            makeHighlight({ text: 'x', comments: [{ id: '1', content: 'c1', createdAt: 0, updatedAt: 0 }] }),
            makeHighlight({ text: 'y' }),
        ]);
        const file2 = makeFile('b.md', 'b', [
            makeHighlight({ text: 'z', comments: [{ id: '2', content: 'c2', createdAt: 0, updatedAt: 0 }, { id: '3', content: 'c3', createdAt: 0, updatedAt: 0 }] }),
        ]);
        const result = computeHighlightStats([file1, file2]);
        expect(result.totalHighlights).toBe(3);
        expect(result.totalComments).toBe(3);
        expect(result.notesWithHighlights).toBe(2);
    });

    it('가상(파일레벨, text 빈값) 항목은 총 하이라이트에서 제외되나, 그 comments는 총 코멘트에 포함', () => {
        const virtualItem = makeHighlight({
            text: '',
            isVirtual: true,
            isOrphan: false,
            comments: [{ id: '1', content: 'file comment', createdAt: 0, updatedAt: 0 }],
        });
        const realItem = makeHighlight({ text: 'real' });
        const result = computeHighlightStats([makeFile('note.md', 'note', [virtualItem, realItem])]);
        expect(result.totalHighlights).toBe(1);
        expect(result.totalComments).toBe(1);
    });

    it('고아(isOrphan) 항목은 하이라이트·코멘트 양쪽에서 제외', () => {
        const orphan = makeHighlight({
            text: 'orphan',
            isOrphan: true,
            comments: [{ id: '1', content: 'c', createdAt: 0, updatedAt: 0 }],
        });
        const real = makeHighlight({ text: 'real' });
        const result = computeHighlightStats([makeFile('note.md', 'note', [orphan, real])]);
        expect(result.totalHighlights).toBe(1);
        expect(result.totalComments).toBe(0);
    });

    it('comments undefined인 하이라이트 방어(코멘트 0으로 계산)', () => {
        const h = makeHighlight({ text: 'no comments' });
        const result = computeHighlightStats([makeFile('note.md', 'note', [h])]);
        expect(result.totalComments).toBe(0);
    });

    it('랭킹 내림차순 + 동점 시 fileName 오름차순', () => {
        const files = [
            makeFile('b.md', 'b', [makeHighlight({ text: '1' }), makeHighlight({ text: '2' })]),
            makeFile('a.md', 'a', [makeHighlight({ text: '3' }), makeHighlight({ text: '4' })]),
            makeFile('c.md', 'c', [makeHighlight({ text: '5' })]),
        ];
        const result = computeHighlightStats(files);
        expect(result.topByHighlights[0].fileName).toBe('a');
        expect(result.topByHighlights[1].fileName).toBe('b');
        expect(result.topByHighlights[2].fileName).toBe('c');
        expect(result.topByHighlights[0].count).toBe(2);
        expect(result.topByHighlights[2].count).toBe(1);
    });

    it('파일 11개 → 랭킹 정확히 10개로 절단', () => {
        const files = Array.from({ length: 11 }, (_, i) =>
            makeFile(`file${i}.md`, `file${i}`, [
                makeHighlight({
                    text: `h${i}`,
                    comments: [{ id: `c${i}`, content: `comment${i}`, createdAt: 0, updatedAt: 0 }],
                }),
            ])
        );
        const result = computeHighlightStats(files);
        expect(result.topByHighlights).toHaveLength(10);
        expect(result.topByComments).toHaveLength(10);
    });

    it('코멘트 랭킹: 실제 하이라이트의 코멘트 + 파일레벨 가상 항목의 코멘트 합산', () => {
        const fileLevelVirtual = makeHighlight({
            text: '',
            isVirtual: true,
            isOrphan: false,
            comments: [{ id: 'fc1', content: 'file comment', createdAt: 0, updatedAt: 0 }],
        });
        const realWithComment = makeHighlight({
            text: 'real',
            comments: [{ id: 'rc1', content: 'real comment', createdAt: 0, updatedAt: 0 }],
        });
        const file1 = makeFile('a.md', 'a', [fileLevelVirtual, realWithComment]);
        const file2 = makeFile('b.md', 'b', [makeHighlight({ text: 'only' })]);
        const result = computeHighlightStats([file1, file2]);
        expect(result.totalComments).toBe(2);
        expect(result.topByComments[0].fileName).toBe('a');
        expect(result.topByComments[0].count).toBe(2);
    });
});
