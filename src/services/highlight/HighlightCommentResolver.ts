import { TFile } from "obsidian";
import { HighlightInfo as HiNote, CommentItem } from "../../types/highlight";
import { HighlightRepository } from "../../repositories/HighlightRepository";
import { findStoredHighlightMatch } from "./HighlightMatchStrategies";

interface CommentResolverOptions {
    onTextChanged?: (storedHighlight: HiNote, currentHighlight: HiNote) => void;
}

/**
 * 현재 문서에서 추출된 하이라이트를 저장소에 저장된 댓글 데이터와 매칭합니다.
 */
export class HighlightCommentResolver {
    constructor(private highlightRepository: HighlightRepository) {}

    normalizeHighlight(highlight: HiNote): HiNote {
        return {
            ...highlight,
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
            const blockMatch = findStoredHighlightMatch(highlight, blockHighlights);
            if (blockMatch) return blockMatch.highlight;
        }

        const fileHighlights = this.highlightRepository.getCachedHighlights(file.path) || [];
        return findStoredHighlightMatch(highlight, fileHighlights)?.highlight || null;
    }
}
