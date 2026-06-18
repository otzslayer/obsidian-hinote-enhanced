import { TFile } from "obsidian";
import { HighlightInfo } from '../../types/highlight';
import { HighlightRepository } from '../../repositories/HighlightRepository';
import {
    canUpdateStoredHighlight,
    findStoredHighlightMatch
} from './HighlightMatchStrategies';
import type { HighlightMatchConfidence } from './HighlightMatchStrategies';

type HiNote = HighlightInfo;

interface StoredHighlightUpdate {
    id: string;
    patch: Partial<HiNote>;
}

/**
 * 하이라이트 매처
 * 역할:
 * 1. 파일에서 추출된 하이라이트와 저장된 댓글 데이터를 매칭하여 병합합니다
 * 2. 통합 전략 (ID, block+text, text+position, context, unique text)으로 매칭합니다
 * 3. 높은 신뢰도 매칭 성공 후 저장소의 위치 앵커를 비동기로 업데이트하여 오프셋 누적을 방지합니다
 */
export class HighlightMatcher {
    constructor(
        private getHighlightRepository?: () => HighlightRepository | undefined
    ) {}

    /**
     * 여러 전략을 사용하여 하이라이트와 후보 댓글을 매칭합니다.
     */
    static findMatch(
        target: HiNote,
        candidates: HiNote[]
    ): HiNote | null {
        return findStoredHighlightMatch(target, candidates)?.highlight || null;
    }

    /**
     * 통합 매칭 전략으로 후보 하이라이트를 검색합니다.
     */
    static findExactMatch(target: HiNote, candidates: HiNote[]): HiNote | null {
        return findStoredHighlightMatch(target, candidates)?.highlight || null;
    }

    /**
     * 주어진 하이라이트와 가장 잘 일치하는 저장된 하이라이트를 검색합니다
     * 통합 전략으로 매칭하며 순수 위치 매칭은 허용하지 않습니다.
     */
    public findMatchingHighlight(file: TFile, highlight: HiNote, highlightRepository: HighlightRepository): HiNote | null {
        const fileHighlights = highlightRepository.getCachedHighlights(file.path) || [];
        return findStoredHighlightMatch(highlight, fileHighlights)?.highlight || null;
    }
    
    /**
     * 하이라이트와 댓글 데이터를 일괄 병합합니다 (통합 매칭 로직)
     */
    public mergeHighlightsWithComments(
        highlights: HighlightInfo[],
        storedComments: HiNote[],
        file: TFile
    ): HighlightInfo[] {
        if (storedComments.length === 0) {
            return highlights.map(h => this.createHighlightInfo(h, file));
        }
        
        const usedCommentIds = new Set<string>();
        // 위치 앵커를 업데이트해야 하는 하이라이트를 수집하여 병합 완료 후 일괄 비동기로 저장소를 업데이트합니다
        const highlightUpdates: StoredHighlightUpdate[] = [];
        
        // 하이라이트와 댓글 데이터를 병합합니다
        const mergedHighlights = highlights.map(highlight => {
            const match = findStoredHighlightMatch(highlight, storedComments, { usedIds: usedCommentIds });
            const storedComment = match?.highlight;
            if (storedComment?.id && match) {
                usedCommentIds.add(storedComment.id);
                this.trackStoredHighlightUpdate(highlightUpdates, storedComment, highlight, match.confidence);
                return this.createMergedHighlight(highlight, storedComment, file);
            }

            return this.createHighlightInfo(highlight, file);
        });

        // 가상 하이라이트를 추가합니다
        const virtualHighlights = storedComments
            .filter(c => c.id && c.isVirtual && c.comments && c.comments.length > 0 && !usedCommentIds.has(c.id))
            .map(vh => this.createHighlightInfo(vh, file));
        
        // 저장소의 위치 앵커를 비동기로 업데이트하여 오프셋 누적을 방지합니다
        if (highlightUpdates.length > 0) {
            this.applyStoredHighlightUpdates(file.path, storedComments, highlightUpdates);
        }
        
        return [...virtualHighlights, ...mergedHighlights];
    }
    
    /**
     * 위치 앵커를 업데이트해야 하는 하이라이트를 기록합니다
     */
    private trackStoredHighlightUpdate(
        updates: StoredHighlightUpdate[],
        storedComment: HiNote,
        highlight: HighlightInfo,
        confidence: HighlightMatchConfidence
    ): void {
        if (!storedComment.id || !canUpdateStoredHighlight(confidence)) {
            return;
        }

        const patch: Partial<HiNote> = {};
        if (highlight.position !== undefined && highlight.position !== storedComment.position) {
            patch.position = highlight.position;
        }
        if (highlight.text && highlight.text !== storedComment.text) {
            patch.text = highlight.text;
        }
        if (highlight.contextBefore && highlight.contextBefore !== storedComment.contextBefore) {
            patch.contextBefore = highlight.contextBefore;
        }
        if (highlight.contextAfter && highlight.contextAfter !== storedComment.contextAfter) {
            patch.contextAfter = highlight.contextAfter;
        }
        if (highlight.textFingerprint && highlight.textFingerprint !== storedComment.textFingerprint) {
            patch.textFingerprint = highlight.textFingerprint;
        }
        if (highlight.blockId && highlight.blockId !== storedComment.blockId) {
            patch.blockId = highlight.blockId;
        }
        if (Object.keys(patch).length > 0) {
            updates.push({ id: storedComment.id, patch });
        }
    }
    
    /**
     * 저장소의 위치 앵커를 비동기로 일괄 업데이트하여 오프셋 누적으로 인한 매칭 실패를 방지합니다
     */
    private applyStoredHighlightUpdates(
        filePath: string,
        storedComments: HiNote[],
        updates: StoredHighlightUpdate[]
    ): void {
        // setTimeout으로 비동기 실행하여 병합 흐름을 차단하지 않습니다
        window.setTimeout(() => {
            void this.saveStoredHighlightUpdates(filePath, storedComments, updates);
        }, 100);
    }

    private async saveStoredHighlightUpdates(
        filePath: string,
        storedComments: HiNote[],
        updates: StoredHighlightUpdate[]
    ): Promise<void> {
        try {
            const updateMap = new Map(updates.map(u => [u.id, u.patch]));
            let changed = false;

            for (const comment of storedComments) {
                if (comment.id && updateMap.has(comment.id)) {
                    Object.assign(comment, updateMap.get(comment.id)!);
                    comment.updatedAt = Date.now();
                    changed = true;
                }
            }

            if (changed) {
                const highlightRepository = this.getHighlightRepository?.();
                if (highlightRepository) {
                    await highlightRepository.saveFileHighlights(filePath, storedComments);
                }
            }
        } catch {
            // 조용히 처리합니다. 위치 앵커 업데이트 실패는 주 흐름에 영향을 주지 않습니다
        }
    }

    /**
     * 병합된 하이라이트 정보를 생성합니다
     */
    private createMergedHighlight(highlight: HighlightInfo, storedComment: HiNote, file: TFile): HighlightInfo {
        return {
            ...highlight,
            id: storedComment.id,
            comments: storedComment.comments || [],
            createdAt: storedComment.createdAt,
            updatedAt: storedComment.updatedAt,
            fileName: file.basename,
            filePath: file.path,
            fileIcon: 'file-text'
        };
    }
    
    /**
     * 하이라이트 정보 객체를 생성합니다
     */
    private createHighlightInfo(highlight: HighlightInfo, file: TFile): HighlightInfo {
        return {
            ...highlight,
            comments: highlight.comments || [],
            fileName: file.basename,
            filePath: file.path,
            fileIcon: 'file-text',
            position: highlight.position || 0
        };
    }
}
