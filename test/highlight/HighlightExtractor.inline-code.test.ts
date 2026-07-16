import { describe, it, expect } from 'vitest';
import { App, TFile } from 'obsidian';
import { HighlightExtractor } from '../../src/services/highlight/HighlightExtractor';

// 인라인 코드(백틱) 안의 == 는 마크다운 하이라이트 구분자가 아니라 리터럴
// 텍스트다. 서로 다른 두 인라인 코드의 == 가 짝을 이뤄 하이라이트로 오인되는
// 버그를 방지한다. 인라인 코드는 하이라이트 내부에 포함될 수도 있으므로
// (예: ==foo `bar` baz==) 단순 제외가 아니라 마스킹으로 처리해 실제
// 하이라이트는 보존해야 한다.

function extract(note: string) {
    const app = new App() as unknown as App;
    const extractor = new HighlightExtractor(app, () => undefined);
    const file = new TFile('note.md');
    return extractor.extractHighlights(note, file);
}

describe('HighlightExtractor — 인라인 코드 안의 == 는 하이라이트가 아니다', () => {
    it('서로 다른 두 인라인 코드의 == 가 하이라이트로 짝지어지지 않는다', () => {
        const note =
            'Continue when `stop_reason == "tool_use"`, terminate when `stop_reason == "end_turn"`.';
        const texts = extract(note).map(h => h.text).filter(Boolean);
        expect(texts).toEqual([]);
    });

    it('단일 인라인 코드 안의 == 는 하이라이트가 아니다', () => {
        const note = 'The check is `stop_reason == "tool_use"` here.';
        const texts = extract(note).map(h => h.text).filter(Boolean);
        expect(texts).toEqual([]);
    });

    it('인라인 코드를 포함한 실제 하이라이트는 원본 텍스트로 보존된다', () => {
        const note = '앞 ==foo `bar` baz== 뒤';
        const h = extract(note).find(x => x.text.includes('foo'));
        expect(h?.text).toBe('foo `bar` baz');
    });

    it('코드-== 가 인접 하이라이트의 구분자를 잠식하지 않는다', () => {
        const note = '==aa== `==` ==bb==';
        const texts = extract(note).map(h => h.text).filter(Boolean);
        expect(texts).toContain('aa');
        expect(texts).toContain('bb');
    });

    // 위 '==foo `bar` baz==' 케이스는 코드 구간 안에 == 가 없어 절단 경로를 밟지
    // 않는다. 하이라이트가 == 를 품은 코드 구간을 감싸는 교집합이 진짜 경계다.
    it('하이라이트가 == 를 품은 코드 구간을 감싸도 텍스트가 잘리지 않는다', () => {
        const note = '앞 ==foo `==` baz== 뒤';
        const h = extract(note).find(x => x.text.includes('foo'));
        expect(h?.text).toBe('foo `==` baz');
    });

    it('실제 사용례: == 를 품은 코드 구간을 감싼 하이라이트', () => {
        const note = '==Continue when `stop_reason == "tool_use"` is set==';
        const h = extract(note).find(x => x.text.includes('Continue'));
        expect(h?.text).toBe('Continue when `stop_reason == "tool_use"` is set');
    });

    // text 와 originalLength 가 어긋나면 id·textFingerprint 와
    // position+originalLength 페어링 범위가 서로 다른 실체를 가리킨다.
    it('text 와 originalLength 가 일관된다 (== 를 품은 코드 구간 포함)', () => {
        const note = '==Continue when `stop_reason == "tool_use"` is set==';
        const h = extract(note).find(x => x.text.includes('Continue'));
        expect(h?.originalLength).toBe(note.length);
        expect(h!.text.length + 4).toBe(h!.originalLength);
    });
});
