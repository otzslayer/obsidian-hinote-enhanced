import { HighlightInfo } from '../../types/highlight';

export interface StatsInputFile {
    filePath: string;
    fileName: string;
    highlights: HighlightInfo[];
}

export interface NoteRankEntry {
    filePath: string;
    fileName: string;
    count: number;
}

export interface HighlightStats {
    totalHighlights: number;
    totalComments: number;
    notesWithHighlights: number;
    topByHighlights: NoteRankEntry[];
    topByComments: NoteRankEntry[];
}

const TOP_N = 10;

function isRealHighlight(h: HighlightInfo): boolean {
    return !h.isVirtual && !h.isOrphan && !!h.text;
}

function isFileLevelVirtual(h: HighlightInfo): boolean {
    return !!h.isVirtual && !h.isOrphan;
}

export function computeHighlightStats(files: StatsInputFile[]): HighlightStats {
    let totalHighlights = 0;
    let totalComments = 0;
    let notesWithHighlights = 0;
    const highlightRank: NoteRankEntry[] = [];
    const commentRank: NoteRankEntry[] = [];

    for (const file of files) {
        let fileHighlightCount = 0;
        let fileCommentCount = 0;

        for (const h of file.highlights) {
            if (isRealHighlight(h)) {
                fileHighlightCount++;
                fileCommentCount += h.comments?.length ?? 0;
            } else if (isFileLevelVirtual(h)) {
                fileCommentCount += h.comments?.length ?? 0;
            }
        }

        totalHighlights += fileHighlightCount;
        totalComments += fileCommentCount;

        if (fileHighlightCount > 0) {
            notesWithHighlights++;
        }

        highlightRank.push({ filePath: file.filePath, fileName: file.fileName, count: fileHighlightCount });
        commentRank.push({ filePath: file.filePath, fileName: file.fileName, count: fileCommentCount });
    }

    const sortRank = (a: NoteRankEntry, b: NoteRankEntry) =>
        b.count - a.count || a.fileName.localeCompare(b.fileName);

    return {
        totalHighlights,
        totalComments,
        notesWithHighlights,
        topByHighlights: highlightRank.filter(e => e.count > 0).sort(sortRank).slice(0, TOP_N),
        topByComments: commentRank.filter(e => e.count > 0).sort(sortRank).slice(0, TOP_N),
    };
}
