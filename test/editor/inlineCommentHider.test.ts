// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { hideInlineCommentBlocks } from '../../src/editor/inlineCommentHider';

// `.hi-note-inline-comment-raw` 는 display:none 으로 화면에서 숨겨지지만
// textContent 에는 여전히 잡힌다. 그래서 "보이는 텍스트" = 숨김 span 제거 후 남는 텍스트.
function visibleText(el: HTMLElement): string {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.hi-note-inline-comment-raw').forEach(s => s.remove());
    return clone.textContent ?? '';
}

describe('hideInlineCommentBlocks', () => {
    it('단일 텍스트 노드의 {>>...<<} 블록을 숨긴다', () => {
        const p = document.createElement('p');
        p.appendChild(document.createTextNode('본문{>>코멘트<<}끝'));

        hideInlineCommentBlocks(p);

        expect(p.querySelector('.hi-note-inline-comment-raw')).not.toBeNull();
        expect(visibleText(p)).toBe('본문끝');
    });

    it('코멘트 본문에 마크다운(<strong>)이 있어 노드가 쪼개져도 블록 전체를 숨긴다', () => {
        // Obsidian 이 {>>**중요**<<} 를 렌더한 결과 모사:
        //   text("본문{>>") + <strong>중요</strong> + text("<<}끝")
        const p = document.createElement('p');
        p.appendChild(document.createTextNode('본문{>>'));
        const strong = document.createElement('strong');
        strong.appendChild(document.createTextNode('중요'));
        p.appendChild(strong);
        p.appendChild(document.createTextNode('<<}끝'));

        hideInlineCommentBlocks(p);

        expect(p.querySelector('.hi-note-inline-comment-raw')).not.toBeNull();
        const visible = visibleText(p);
        expect(visible).toBe('본문끝');
        expect(visible).not.toContain('{>>');
        expect(visible).not.toContain('<<}');
        expect(visible).not.toContain('중요');
    });

    it('마크다운 없는 일반 본문은 건드리지 않는다', () => {
        const p = document.createElement('p');
        p.appendChild(document.createTextNode('마커 없는 평범한 문장'));

        hideInlineCommentBlocks(p);

        expect(p.querySelector('.hi-note-inline-comment-raw')).toBeNull();
        expect(p.textContent).toBe('마커 없는 평범한 문장');
    });
});
