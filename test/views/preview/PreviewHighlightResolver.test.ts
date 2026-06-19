// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { PreviewHighlightResolver, type PreviewHighlight } from '../../../src/views/highlight/preview/PreviewHighlightResolver';
import type { MarkdownPostProcessorContext } from 'obsidian';

// 읽기 모드에서 ==**중요**== 는 <mark><strong>중요</strong></mark> 로 렌더되어
// mark.textContent 는 '중요'(마크다운 제거)인데, 저장된 highlight.text 는
// '**중요**'(원본 마크다운)다. 매칭은 plainText(렌더 결과) 기준이어야 한다.

function makeContext(sectionInfo: { lineStart: number; lineEnd: number } | null): MarkdownPostProcessorContext {
    return { getSectionInfo: () => sectionInfo } as unknown as MarkdownPostProcessorContext;
}

function buildMark(rendered: HTMLElement): { root: HTMLElement; mark: HTMLElement } {
    const root = document.createElement('div');
    const p = document.createElement('p');
    p.appendChild(rendered);
    root.appendChild(p);
    return { root, mark: rendered };
}

describe('PreviewHighlightResolver.findMatchingHighlight', () => {
    it('마크다운이 제거된 mark 텍스트를 마크다운 포함 하이라이트와 매칭한다', () => {
        const resolver = new PreviewHighlightResolver();

        const mark = document.createElement('mark');
        const strong = document.createElement('strong');
        strong.textContent = '중요';
        mark.appendChild(strong);
        const { root } = buildMark(mark);

        const highlight = {
            text: '**중요**',
            plainText: '중요',
            line: 0,
            position: 0,
            comments: [],
        } as unknown as PreviewHighlight;

        const result = resolver.findMatchingHighlight('중요', mark, root, makeContext(null), [highlight]);
        expect(result).toBe(highlight);
    });

    it('마크다운 없는 일반 하이라이트도 그대로 매칭한다 (회귀 가드)', () => {
        const resolver = new PreviewHighlightResolver();

        const mark = document.createElement('mark');
        mark.textContent = '일반';
        const { root } = buildMark(mark);

        const highlight = {
            text: '일반',
            plainText: '일반',
            line: 0,
            position: 0,
            comments: [],
        } as unknown as PreviewHighlight;

        const result = resolver.findMatchingHighlight('일반', mark, root, makeContext(null), [highlight]);
        expect(result).toBe(highlight);
    });
});
