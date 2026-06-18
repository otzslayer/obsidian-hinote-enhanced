import { describe, it, expect } from 'vitest';
import { formatTimestamp } from '../../src/utils/timestamp';

// Inline comment timestamps must store seconds so the displayed time
// (toLocaleString) does not always show :00 after a reload (TODO item 2B).

describe('formatTimestamp', () => {
    it('formats a Unix ms timestamp as "YYYY-MM-DD HH:mm:ss"', () => {
        // Local time — constructed and read back via local getters, TZ-stable.
        const ms = new Date(2026, 5, 18, 9, 7, 5).getTime();
        expect(formatTimestamp(ms)).toBe('2026-06-18 09:07:05');
    });

    it('zero-pads all fields', () => {
        const ms = new Date(2026, 0, 2, 3, 4, 5).getTime();
        expect(formatTimestamp(ms)).toBe('2026-01-02 03:04:05');
    });
});
