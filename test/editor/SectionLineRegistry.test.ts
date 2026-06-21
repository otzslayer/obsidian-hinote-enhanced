// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { SectionLineRegistry } from '../../src/editor/SectionLineRegistry';

describe('SectionLineRegistry', () => {
    let registry: SectionLineRegistry;

    beforeEach(() => {
        registry = new SectionLineRegistry();
    });

    it('set 후 같은 엘리먼트로 findBlockRange → 동일 범위 반환', () => {
        const el = document.createElement('p');
        registry.set(el, { lineStart: 3, lineEnd: 5 });
        expect(registry.findBlockRange(el)).toEqual({ lineStart: 3, lineEnd: 5 });
    });

    it('자식 텍스트 노드에서 findBlockRange → 등록된 블록 조상 범위 반환', () => {
        const parent = document.createElement('div');
        const child = document.createElement('span');
        const text = document.createTextNode('hello');
        child.appendChild(text);
        parent.appendChild(child);

        registry.set(parent, { lineStart: 10, lineEnd: 12 });

        expect(registry.findBlockRange(text)).toEqual({ lineStart: 10, lineEnd: 12 });
        expect(registry.findBlockRange(child)).toEqual({ lineStart: 10, lineEnd: 12 });
    });

    it('미등록 노드 → null 반환', () => {
        const el = document.createElement('p');
        expect(registry.findBlockRange(el)).toBeNull();
    });

    it('단일 줄 블록(lineStart === lineEnd) 기록/조회', () => {
        const el = document.createElement('p');
        registry.set(el, { lineStart: 7, lineEnd: 7 });
        expect(registry.findBlockRange(el)).toEqual({ lineStart: 7, lineEnd: 7 });
    });

    it('더 가까운 조상이 먼저 등록된 경우 → 더 가까운 조상 범위 반환', () => {
        const grandparent = document.createElement('div');
        const parent = document.createElement('p');
        const text = document.createTextNode('text');
        parent.appendChild(text);
        grandparent.appendChild(parent);

        registry.set(grandparent, { lineStart: 0, lineEnd: 10 });
        registry.set(parent, { lineStart: 5, lineEnd: 6 });

        expect(registry.findBlockRange(text)).toEqual({ lineStart: 5, lineEnd: 6 });
    });
});
