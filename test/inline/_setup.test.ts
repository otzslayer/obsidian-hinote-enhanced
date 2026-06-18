import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';

describe('obsidian mock alias', () => {
    it('resolves TFile stub without runtime error', () => {
        const f = new TFile('notes/test.md');
        expect(f.path).toBe('notes/test.md');
        expect(f.extension).toBe('md');
        expect(f.basename).toBe('test');
    });
});
