import { describe, it, expect } from 'vitest';
import { App, TFile } from 'obsidian';
import { HighlightExtractor } from '../../src/services/highlight/HighlightExtractor';

// Inline {>>...<<} comment text must not be re-scanned by the highlight
// extractor. Markdown highlight syntax (==text==, <mark>, <span>) inside a
// comment was being lifted out as a phantom highlight (TODO item 1).

function extract(note: string) {
    const app = new App() as unknown as App;
    const extractor = new HighlightExtractor(app, () => undefined);
    const file = new TFile('note.md');
    return extractor.extractHighlights(note, file);
}

describe('HighlightExtractor — markdown inside comments is not a phantom highlight', () => {
    it('does not extract ==text== inside a {>>...<<} comment', () => {
        const note = 'A ==real== text.{>>see ==foo== ^2026-06-18 12:00^<<}';
        const texts = extract(note).map(h => h.text).filter(Boolean);
        expect(texts).toContain('real');
        expect(texts).not.toContain('foo');
    });

    it('does not extract <mark> inside a comment', () => {
        const note = 'A ==real== text.{>>see <mark>foo</mark> ^2026-06-18 12:00^<<}';
        const texts = extract(note).map(h => h.text).filter(Boolean);
        expect(texts).not.toContain('foo');
    });

    it('still attaches the comment (markdown preserved) to the real highlight', () => {
        const note = 'A ==real== text.{>>see ==foo== ^2026-06-18 12:00^<<}';
        const real = extract(note).find(h => h.text === 'real');
        expect(real?.comments?.[0]?.content).toBe('see ==foo==');
    });

    it('**bold** in a comment stays unaffected (regression guard)', () => {
        const note = 'A ==real== text.{>>see **foo** ^2026-06-18 12:00^<<}';
        const texts = extract(note).map(h => h.text).filter(Boolean);
        expect(texts).toEqual(['real']);
    });

    it('still extracts a real ==highlight== that follows a comment block', () => {
        const note = '==first=={>>note ==inside== ^2026-06-18 12:00^<<} ==second==';
        const texts = extract(note).map(h => h.text).filter(Boolean);
        expect(texts).toContain('first');
        expect(texts).toContain('second');
        expect(texts).not.toContain('inside');
    });
});
