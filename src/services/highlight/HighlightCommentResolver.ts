import { TFile } from "obsidian";
import { HighlightInfo as HiNote, CommentItem } from "../../types/highlight";
import { HighlightRepository } from "../../repositories/HighlightRepository";
import { HighlightMatcher } from "../../utils/HighlightMatcher";

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
        return storedHighlights.find(storedHighlight => {
            const textMatch = storedHighlight.text === highlight.text;

            if (textMatch) {
                return this.isPositionNear(storedHighlight, highlight, 1000) || !this.hasPositions(storedHighlight, highlight);
            }

            return this.isPositionNear(storedHighlight, highlight, 30);
        }) || null;
    }

    private isPositionNear(a: HiNote, b: HiNote, threshold: number): boolean {
        if (!this.hasPositions(a, b)) return false;
        return Math.abs(a.position - b.position) < threshold;
    }

    private hasPositions(a: HiNote, b: HiNote): boolean {
        return typeof a.position === 'number' && typeof b.position === 'number';
    }
}
