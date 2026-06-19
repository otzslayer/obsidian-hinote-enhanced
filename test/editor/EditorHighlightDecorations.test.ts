import { describe, it, expect } from 'vitest';
import { findInlineCommentRanges } from '../../src/editor/inlineCommentRanges';

describe('findInlineCommentRanges', () => {
    it('빈 문자열 → 빈 배열', () => {
        expect(findInlineCommentRanges('')).toEqual([]);
    });

    it('{>>...<<} 블록 없음 → 빈 배열', () => {
        expect(findInlineCommentRanges('==하이라이트== 일반 텍스트')).toEqual([]);
    });

    it('단일 블록 → from/to 범위 정확', () => {
        const text = 'hello{>>comment<<}world';
        const ranges = findInlineCommentRanges(text);
        expect(ranges).toHaveLength(1);
        expect(ranges[0].from).toBe(5);
        expect(ranges[0].to).toBe(5 + '{>>comment<<}'.length);
    });

    it('다중 블록 → 모두 반환, 순서 보존', () => {
        const text = '==a=={>>first<<}==b=={>>second<<}';
        const ranges = findInlineCommentRanges(text);
        expect(ranges).toHaveLength(2);
        expect(ranges[0].from).toBe(5);
        expect(ranges[0].to).toBe(5 + '{>>first<<}'.length);
        expect(ranges[1].from).toBe(text.indexOf('{>>second<<}'));
        expect(ranges[1].to).toBe(text.indexOf('{>>second<<}') + '{>>second<<}'.length);
    });

    it('멀티라인 블록 내용 → 범위 포함', () => {
        const text = 'text{>>\nline1\nline2\n<<}end';
        const ranges = findInlineCommentRanges(text);
        expect(ranges).toHaveLength(1);
        expect(ranges[0].from).toBe(4);
        expect(ranges[0].to).toBe(text.indexOf('}end') + 1);
    });
});
