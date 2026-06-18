import { describe, it, expect } from 'vitest';
import {
    parseFileLevelComments,
    mergeFileLevelComments,
    type FileLevelComment,
} from '../../src/services/comment/inline/FrontmatterComments';

// ── Scenario 1: parse {text, ts} list → FileLevelComment[] ──

describe('parseFileLevelComments', () => {
    it('parses a valid {text, ts} list', () => {
        const fm = {
            comments: [
                { text: 'note one', ts: '2024-01-01 10:00' },
                { text: 'note two', ts: '2024-02-01 11:00' },
            ],
        };
        const result = parseFileLevelComments(fm);
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ text: 'note one', ts: '2024-01-01 10:00' });
        expect(result[1]).toMatchObject({ text: 'note two', ts: '2024-02-01 11:00' });
    });

    it('ignores items that are not {text, ts} shaped (KTD4)', () => {
        const fm = {
            comments: [
                { text: 'valid', ts: '2024-01-01 10:00' },
                'plain string',            // foreign shape
                { label: 'other plugin' }, // foreign shape
                42,                        // foreign shape
            ],
        };
        const result = parseFileLevelComments(fm);
        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('valid');
    });

    it('returns empty array when comments key is absent', () => {
        expect(parseFileLevelComments({})).toHaveLength(0);
        expect(parseFileLevelComments(null)).toHaveLength(0);
        expect(parseFileLevelComments(undefined)).toHaveLength(0);
    });

    it('returns empty array when comments is empty', () => {
        expect(parseFileLevelComments({ comments: [] })).toHaveLength(0);
    });

    it('returns empty array when comments is not an array', () => {
        expect(parseFileLevelComments({ comments: 'bad' })).toHaveLength(0);
        expect(parseFileLevelComments({ comments: { text: 'x', ts: 'y' } })).toHaveLength(0);
    });
});

// ── Scenario 2: merge — add / update / delete HiNote items ──

describe('mergeFileLevelComments', () => {
    it('adds a new HiNote comment to an empty frontmatter', () => {
        const newComment: FileLevelComment = { text: 'added', ts: '2024-03-01 09:00' };
        const result = mergeFileLevelComments([], [newComment]);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ text: 'added', ts: '2024-03-01 09:00' });
    });

    it('preserves foreign-shaped items untouched (KTD4)', () => {
        const existing: unknown[] = [
            'plain string',
            { label: 'other-plugin item' },
            { text: 'hinote-item', ts: '2024-01-01 00:00' },
        ];
        const newComments: FileLevelComment[] = [
            { text: 'replaced', ts: '2024-06-01 00:00' },
        ];
        const result = mergeFileLevelComments(existing, newComments);
        // Foreign items preserved
        expect(result).toContain('plain string');
        expect(result).toContainEqual({ label: 'other-plugin item' });
        // HiNote items replaced by newComments
        expect(result).toContainEqual({ text: 'replaced', ts: '2024-06-01 00:00' });
        // Old hinote item gone
        expect(result).not.toContainEqual({ text: 'hinote-item', ts: '2024-01-01 00:00' });
    });

    it('replaces all existing HiNote items with the new set', () => {
        const existing: unknown[] = [
            { text: 'old-1', ts: '2024-01-01 00:00' },
            { text: 'old-2', ts: '2024-01-02 00:00' },
        ];
        const newComments: FileLevelComment[] = [
            { text: 'new-1', ts: '2024-05-01 00:00' },
        ];
        const result = mergeFileLevelComments(existing, newComments);
        const hinoteItems = result.filter(
            (x): x is FileLevelComment =>
                typeof x === 'object' && x !== null && 'text' in x && 'ts' in x
        );
        expect(hinoteItems).toHaveLength(1);
        expect(hinoteItems[0].text).toBe('new-1');
    });

    it('removes all HiNote items when newComments is empty', () => {
        const existing: unknown[] = [
            { text: 'hi', ts: '2024-01-01 00:00' },
            'foreign',
        ];
        const result = mergeFileLevelComments(existing, []);
        expect(result).toContain('foreign');
        expect(result.filter((x): x is FileLevelComment =>
            typeof x === 'object' && x !== null && 'text' in x && 'ts' in x
        )).toHaveLength(0);
    });

    it('handles null/undefined existing gracefully', () => {
        const newComment: FileLevelComment = { text: 'x', ts: '2024-01-01 00:00' };
        expect(() => mergeFileLevelComments(null, [newComment])).not.toThrow();
        expect(() => mergeFileLevelComments(undefined, [newComment])).not.toThrow();
        const result = mergeFileLevelComments(null, [newComment]);
        expect(result).toContainEqual({ text: 'x', ts: '2024-01-01 00:00' });
    });
});
