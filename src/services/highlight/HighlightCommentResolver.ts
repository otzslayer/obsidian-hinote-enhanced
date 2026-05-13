import { TFile } from "obsidian";
import { HighlightInfo as HiNote, CommentItem } from "../../types/highlight";
import { HighlightRepository } from "../../repositories/HighlightRepository";
import { HighlightMatcher } from "./HighlightMatcher";

interface CommentResolverOptions {
    onTextChanged?: (storedHighlight: HiNote, currentHighlight: HiNote) => void;
}

/**
 * 将当前文档中提取到的高亮，与仓库里保存的评论数据进行匹配。
 */
export class HighlightCommentResolver {
    constructor(private highlightRepository: HighlightRepository) {}

    normalizeHighlight(highlight: HiNote): HiNote {
        return {
            ...highlight,
            id: highlight.id || `highlight-${Date.now()}-${highlight.position}`,
            comments: highlight.comments || [],
            position: highlight.position,
            paragraphOffset: highlight.paragraphOffset || 0,
            blockId: highlight.blockId,
            createdAt: highlight.createdAt || Date.now(),
            updatedAt: highlight.updatedAt || Date.now(),
            text: highlight.text
        };
    }

    resolveHighlight(file: TFile, highlight: HiNote): HiNote {
        const normalizedHighlight = this.normalizeHighlight(highlight);
        const storedHighlight = this.findStoredHighlight(file, normalizedHighlight);

        return {
            ...normalizedHighlight,
            id: storedHighlight?.id || normalizedHighlight.id,
            comments: storedHighlight?.comments || []
        };
    }

    getCommentsForHighlight(
        file: TFile,
        highlight: HiNote,
        options: CommentResolverOptions = {}
    ): CommentItem[] {
        const storedHighlight = this.findStoredHighlight(file, highlight);

        if (!storedHighlight) {
            return [];
        }

        if (storedHighlight.text !== highlight.text) {
            options.onTextChanged?.(storedHighlight, highlight);
        }

        return storedHighlight.comments || [];
    }

    private findStoredHighlight(file: TFile, highlight: HiNote): HiNote | null {
        if (highlight.blockId) {
            const blockHighlights = this.highlightRepository.findHighlightsByBlockId(file, highlight.blockId);
            return HighlightMatcher.findMatch(highlight, blockHighlights) || null;
        }

        const fileHighlights = this.highlightRepository.getCachedHighlights(file.path) || [];
        return this.findStoredHighlightByTextOrPosition(fileHighlights, highlight);
    }

    private findStoredHighlightByTextOrPosition(
        storedHighlights: HiNote[],
        highlight: HiNote
    ): HiNote | null {
        if (highlight.id) {
            const idMatch = storedHighlights.find(storedHighlight => storedHighlight.id === highlight.id);
            if (idMatch) return idMatch;
        }

        const textMatches = storedHighlights.filter(storedHighlight => storedHighlight.text === highlight.text);
        if (textMatches.length === 0) return null;

        const positionMatch = textMatches
            .filter(storedHighlight => this.hasPositions(storedHighlight, highlight))
            .sort((a, b) =>
                Math.abs(a.position - highlight.position) -
                Math.abs(b.position - highlight.position)
            )
            .find(storedHighlight => this.isPositionNear(storedHighlight, highlight, 500));

        if (positionMatch) return positionMatch;

        const matchesWithoutPosition = textMatches.filter(storedHighlight => !this.hasPositions(storedHighlight, highlight));
        if (matchesWithoutPosition.length === 1) return matchesWithoutPosition[0];

        return textMatches.length === 1 ? textMatches[0] : null;
    }

    private isPositionNear(a: HiNote, b: HiNote, threshold: number): boolean {
        if (!this.hasPositions(a, b)) return false;
        return Math.abs(a.position - b.position) < threshold;
    }

    private hasPositions(a: HiNote, b: HiNote): boolean {
        return typeof a.position === 'number' && typeof b.position === 'number';
    }
}
