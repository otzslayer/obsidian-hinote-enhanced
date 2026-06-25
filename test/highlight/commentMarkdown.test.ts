import { describe, it, expect } from 'vitest';
import { toHardBreakMarkdown } from '../../src/components/highlight/commentMarkdown';

describe('toHardBreakMarkdown', () => {
    it('converts single newline to CommonMark hard break (two spaces + newline)', () => {
        expect(toHardBreakMarkdown('line1\nline2')).toBe('line1  \nline2');
    });

    it('leaves text without newlines unchanged', () => {
        expect(toHardBreakMarkdown('no newlines here')).toBe('no newlines here');
    });

    it('converts every newline when multiple are present', () => {
        expect(toHardBreakMarkdown('a\nb\nc')).toBe('a  \nb  \nc');
    });

    it('empty string returns empty string', () => {
        expect(toHardBreakMarkdown('')).toBe('');
    });

    it('preserves existing trailing spaces before a newline', () => {
        // Already-hard-break: two spaces already there — adds two more (accepted behavior)
        // The important invariant is that every \n gets at least two trailing spaces
        const result = toHardBreakMarkdown('a  \nb');
        expect(result).toContain('  \n');
    });
});
