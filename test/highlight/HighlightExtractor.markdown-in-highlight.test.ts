import { describe, it, expect } from 'vitest';
import { App, TFile } from 'obsidian';
import { HighlightExtractor } from '../../src/services/highlight/HighlightExtractor';

// 가정 실증: 하이라이트 자체에 인라인 마크다운이 들어가면 extractHighlights 는
// 마크다운을 보존한 원본 텍스트를 highlight.text 로 저장한다. 읽기 모드 매칭이
// 이 raw 텍스트를 mark.textContent(렌더 결과)와 직접 비교하면 어긋난다 (버그 2의 뿌리).

function extract(note: string) {
    const app = new App() as unknown as App;
    const extractor = new HighlightExtractor(app, () => undefined);
    const file = new TFile('note.md');
    return extractor.extractHighlights(note, file);
}

describe('HighlightExtractor — 하이라이트 내부 마크다운은 raw 로 보존된다', () => {
    it('==**중요**== 의 text 는 마크다운을 포함한 **중요** 다', () => {
        const h = extract('앞 ==**중요**== 뒤').find(x => x.text.includes('중요'));
        expect(h?.text).toBe('**중요**');
    });
});
