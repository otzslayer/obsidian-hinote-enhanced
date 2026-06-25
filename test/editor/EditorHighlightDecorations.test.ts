import { describe, it, expect } from 'vitest';
import { findInlineCommentRanges, selectHideableRanges } from '../../src/editor/inlineCommentRanges';

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

// selectHideableRanges: 멀티라인 블록을 제외한 숨김 가능 범위만 반환
describe('selectHideableRanges', () => {
    it('단일 라인 블록 → 포함', () => {
        const text = 'hello{>>single line comment<<}world';
        const ranges = selectHideableRanges(text);
        expect(ranges).toHaveLength(1);
        expect(ranges[0].from).toBe(5);
    });

    it('멀티라인 블록(레거시 개행) → 제외 (CodeMirror 크래시 방지)', () => {
        const text = 'text{>>\nline1\nline2\n<<}end';
        const ranges = selectHideableRanges(text);
        expect(ranges).toHaveLength(0);
    });

    it('\\n 토큰(인코딩된 개행)은 제외하지 않음 — 실제 개행 아님', () => {
        // 디스크에 저장된 형태: \n은 실제 개행이 아닌 백슬래시+n
        const text = 'text{>>line1\\nline2<<}end';
        const ranges = selectHideableRanges(text);
        expect(ranges).toHaveLength(1); // 포함 — 실제 개행 없음
    });

    it('혼합: 단일 라인만 포함', () => {
        const text = '{>>ok<<} mid {>>\nbad\n<<} end {>>also-ok<<}';
        const ranges = selectHideableRanges(text);
        expect(ranges).toHaveLength(2); // multiline 제외
        expect(ranges.some(r => text.slice(r.from, r.to).includes('\n'))).toBe(false);
    });

    it('빈 문자열 → 빈 배열', () => {
        expect(selectHideableRanges('')).toEqual([]);
    });
});
