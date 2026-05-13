import type { HighlightInfo } from '../../types/highlight';
import type { HighlightInfo as HiNote } from '../../types/highlight';

export interface HighlightMatchIndexes {
    idIndex: Map<string, HiNote>;
    textIndex: Map<string, HiNote[]>;
}

export function findSimpleHighlightMatch(target: HiNote, candidates: HiNote[]): HiNote | null {
    if (!candidates || candidates.length === 0) return null;

    return findExactHighlightMatch(target, candidates)
        || findPositionHighlightMatch(target, candidates);
}

export function findExactHighlightMatch(target: HiNote, candidates: HiNote[]): HiNote | null {
    return candidates.find(h =>
        h.text === target.text &&
        (typeof h.position !== 'number' ||
         typeof target.position !== 'number' ||
         Math.abs(h.position - target.position) < 10)
    ) || null;
}

export function findStoredHighlightMatch(
    fileHighlights: HiNote[],
    highlight: HiNote
): HiNote | null {
    if (!fileHighlights || fileHighlights.length === 0) {
        return null;
    }

    const exactMatch = fileHighlights.find((h: HiNote) => {
        if (h.text !== highlight.text) return false;
        if (typeof h.position === 'number' && typeof highlight.position === 'number') {
            return Math.abs(h.position - highlight.position) < 10;
        }
        return false;
    });

    if (exactMatch) return exactMatch;

    if (highlight.text && highlight.position !== undefined) {
        const textCandidates = fileHighlights
            .filter((h: HiNote) => h.text === highlight.text && typeof h.position === 'number')
            .sort((a, b) =>
                Math.abs((a.position ?? 0) - (highlight.position ?? 0)) -
                Math.abs((b.position ?? 0) - (highlight.position ?? 0))
            );
        if (textCandidates.length > 0 &&
            Math.abs((textCandidates[0].position ?? 0) - (highlight.position ?? 0)) < 500) {
            return textCandidates[0];
        }
    }

    if (highlight.text) {
        const textOnlyCandidates = fileHighlights.filter((h: HiNote) => h.text === highlight.text);
        if (textOnlyCandidates.length === 1) {
            return textOnlyCandidates[0];
        }
    }

    if (highlight.position !== undefined) {
        return fileHighlights.find((h: HiNote) =>
            typeof h.position === 'number' &&
            Math.abs(h.position - highlight.position) < 50
        ) || null;
    }

    return null;
}

export function buildHighlightMatchIndexes(storedComments: HiNote[]): HighlightMatchIndexes {
    const idIndex = new Map<string, HiNote>();
    const textIndex = new Map<string, HiNote[]>();

    for (const comment of storedComments) {
        if (comment.id) idIndex.set(comment.id, comment);
        if (comment.text) {
            if (!textIndex.has(comment.text)) textIndex.set(comment.text, []);
            textIndex.get(comment.text)!.push(comment);
        }
    }

    return { idIndex, textIndex };
}

export function findMergeCandidate(
    highlight: HighlightInfo,
    indexes: HighlightMatchIndexes,
    usedCommentIds: Set<string>
): HiNote | null {
    if (highlight.id && indexes.idIndex.has(highlight.id)) {
        const storedComment = indexes.idIndex.get(highlight.id)!;
        if (storedComment.id && !usedCommentIds.has(storedComment.id)) {
            return storedComment;
        }
    }

    const textPositionMatch = findTextPositionMergeCandidate(highlight, indexes.textIndex, usedCommentIds);
    if (textPositionMatch) return textPositionMatch;

    const textOnlyMatch = findTextOnlyMergeCandidate(highlight, indexes.textIndex, usedCommentIds);
    if (textOnlyMatch) return textOnlyMatch;

    return null;
}

function findPositionHighlightMatch(target: HiNote, candidates: HiNote[]): HiNote | null {
    if (typeof target.position !== 'number') return null;

    return candidates.find(h =>
        typeof h.position === 'number' &&
        Math.abs(h.position - target.position) < 30
    ) || null;
}

function findTextPositionMergeCandidate(
    highlight: HighlightInfo,
    textIndex: Map<string, HiNote[]>,
    usedCommentIds: Set<string>
): HiNote | null {
    if (!highlight.text || !textIndex.has(highlight.text)) return null;

    const sortedCandidates = textIndex.get(highlight.text)!
        .filter(c => c.id && !usedCommentIds.has(c.id) &&
            highlight.position !== undefined &&
            c.position !== undefined)
        .sort((a, b) =>
            Math.abs((a.position ?? 0) - (highlight.position ?? 0)) -
            Math.abs((b.position ?? 0) - (highlight.position ?? 0))
        );

    for (const candidate of sortedCandidates) {
        if (Math.abs((candidate.position ?? 0) - (highlight.position ?? 0)) < 500) {
            return candidate;
        }
    }

    return null;
}

function findTextOnlyMergeCandidate(
    highlight: HighlightInfo,
    textIndex: Map<string, HiNote[]>,
    usedCommentIds: Set<string>
): HiNote | null {
    if (!highlight.text || !textIndex.has(highlight.text)) return null;

    const candidates = textIndex.get(highlight.text)!
        .filter(c => c.id && !usedCommentIds.has(c.id));

    return candidates.length === 1 ? candidates[0] : null;
}
