import { describe, it, expect } from 'vitest';
import {
    migrateNoteComments,
    type StoredHighlightData,
    type MigrationResult,
} from '../../src/migration/InlineMigration';

const FIXED_TS = '2024-01-15 10:30';

// ── Helpers ────────────────────────────────────────────────

function mkStored(text: string, comments: string[]): StoredHighlightData {
    return {
        text,
        comments: comments.map((content, i) => ({
            id: `id-${i}`,
            content,
            createdAt: new Date('2024-01-15T10:30:00').getTime(),
            updatedAt: new Date('2024-01-15T10:30:00').getTime(),
        })),
    };
}

// ── Scenario 1: single highlight + 1 comment ──────────────

describe('migrateNoteComments — single highlight', () => {
    const note = '# Title\n\n==cell powerhouse== some text';
    const stored = [mkStored('cell powerhouse', ['important'])];

    it('inserts inline block after the highlight', () => {
        const { noteText } = migrateNoteComments(note, stored);
        expect(noteText).toContain('==cell powerhouse=={>>important ^');
        expect(noteText).toContain('^<<}');
    });

    it('reports status migrated', () => {
        const { report } = migrateNoteComments(note, stored);
        expect(report).toHaveLength(1);
        expect(report[0].status).toBe('migrated');
        expect(report[0].highlightText).toBe('cell powerhouse');
    });

    it('preserves text before and after the highlight', () => {
        const { noteText } = migrateNoteComments(note, stored);
        expect(noteText.startsWith('# Title\n\n')).toBe(true);
        expect(noteText).toContain(' some text');
    });
});

// ── Scenario 2: multiple comments on one highlight ─────────

describe('migrateNoteComments — multiple comments', () => {
    const note = '==power== text';
    const stored = [mkStored('power', ['first', 'second'])];

    it('inserts all comments in order', () => {
        const { noteText } = migrateNoteComments(note, stored);
        const firstPos = noteText.indexOf('{>>first ^');
        const secondPos = noteText.indexOf('{>>second ^');
        expect(firstPos).toBeGreaterThanOrEqual(0);
        expect(secondPos).toBeGreaterThan(firstPos);
    });
});

// ── Scenario 3: file-level comments → frontmatter ─────────

describe('migrateNoteComments — file-level comments', () => {
    const note = '# Title\n\nsome content';
    const stored: StoredHighlightData[] = [];
    const fileLevel = [{ text: 'note about file', ts: FIXED_TS }];

    it('adds comments to frontmatter output', () => {
        const { frontmatterComments } = migrateNoteComments(note, stored, fileLevel);
        expect(frontmatterComments).toHaveLength(1);
        expect(frontmatterComments[0].text).toBe('note about file');
    });
});

// ── Scenario 4: ambiguous match (same text multiple times) ─

describe('migrateNoteComments — ambiguous', () => {
    const note = '==dup== first occurrence ==dup== second occurrence';
    const stored = [mkStored('dup', ['comment'])];

    it('does not modify note text', () => {
        const { noteText } = migrateNoteComments(note, stored);
        expect(noteText).toBe(note);
    });

    it('reports ambiguous', () => {
        const { report } = migrateNoteComments(note, stored);
        expect(report[0].status).toBe('ambiguous');
        expect(report[0].matchCount).toBe(2);
    });
});

// ── Scenario 5: highlight not found in note ────────────────

describe('migrateNoteComments — not found', () => {
    const note = '==other highlight== text';
    const stored = [mkStored('missing highlight', ['comment'])];

    it('does not modify note text', () => {
        const { noteText } = migrateNoteComments(note, stored);
        expect(noteText).toBe(note);
    });

    it('reports not_found', () => {
        const { report } = migrateNoteComments(note, stored);
        expect(report[0].status).toBe('not_found');
    });
});

// ── Scenario 6: already inlined — idempotent ──────────────

describe('migrateNoteComments — already inlined', () => {
    const note = `==hl=={>>already there ^${FIXED_TS}^<<} text`;
    const stored = [mkStored('hl', ['already there'])];

    it('does not insert duplicate block', () => {
        const { noteText } = migrateNoteComments(note, stored);
        const blockCount = (noteText.match(/\{>>/g) || []).length;
        expect(blockCount).toBe(1);
    });

    it('reports already_inlined', () => {
        const { report } = migrateNoteComments(note, stored);
        expect(report[0].status).toBe('already_inlined');
    });
});

// ── Scenario 7: stored highlight with no comments → skipped

describe('migrateNoteComments — no comments in stored highlight', () => {
    const note = '==hl== text';
    const stored: StoredHighlightData[] = [{ text: 'hl', comments: [] }];

    it('produces no change and no report entry', () => {
        const { noteText, report } = migrateNoteComments(note, stored);
        expect(noteText).toBe(note);
        expect(report).toHaveLength(0);
    });
});
