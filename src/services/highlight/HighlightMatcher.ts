import { TFile } from "obsidian";
import { HighlightInfo } from '../../types/highlight';
import { HighlightInfo as HiNote } from '../../types/highlight';
import { HighlightRepository } from '../../repositories/HighlightRepository';
import {
    buildHighlightMatchIndexes,
    findExactHighlightMatch,
    findMergeCandidate,
    findSimpleHighlightMatch,
    findStoredHighlightMatch
} from './HighlightMatchStrategies';

/**
 * 高亮匹配器
 * 职责：
 * 1. 将从文件中提取的高亮与存储的评论数据进行匹配合并
 * 2. 使用多种策略（ID、文本+位置、纯文本）进行匹配
 * 3. 匹配成功后异步更新存储中的 position，防止偏移累积
 */
export class HighlightMatcher {
    constructor(
        private getHighlightRepository?: () => HighlightRepository | undefined
    ) {}

    /**
     * 使用多种策略匹配高亮和候选评论。
     */
    static findMatch(
        target: HiNote,
        candidates: HiNote[]
    ): HiNote | null {
        return findSimpleHighlightMatch(target, candidates);
    }

    /**
     * 精确匹配高亮文本和近似位置。
     */
    static findExactMatch(target: HiNote, candidates: HiNote[]): HiNote | null {
        return findExactHighlightMatch(target, candidates);
    }

    /**
     * 查找与给定高亮最匹配的存储高亮
     * 使用多种策略进行匹配：精确匹配、位置匹配、模糊文本匹配
     */
    public findMatchingHighlight(file: TFile, highlight: HiNote, highlightRepository: HighlightRepository): HiNote | null {
        const fileHighlights = highlightRepository.getCachedHighlights(file.path) || [];
        return findStoredHighlightMatch(fileHighlights, highlight);
    }
    
    /**
     * 批量合并高亮和评论数据（统一的匹配逻辑）
     */
    public mergeHighlightsWithComments(
        highlights: HighlightInfo[],
        storedComments: HiNote[],
        file: TFile
    ): HighlightInfo[] {
        if (storedComments.length === 0) {
            return highlights.map(h => this.createHighlightInfo(h, file));
        }
        
        const indexes = buildHighlightMatchIndexes(storedComments);
        const usedCommentIds = new Set<string>();
        // 收集需要更新 position 的高亮，在合并完成后批量异步更新存储
        const positionUpdates: { id: string; newPosition: number }[] = [];
        
        // 合并高亮和评论数据
        const mergedHighlights = highlights.map(highlight => {
            const storedComment = findMergeCandidate(highlight, indexes, usedCommentIds);
            if (storedComment?.id) {
                usedCommentIds.add(storedComment.id);
                this.trackPositionUpdate(positionUpdates, storedComment, highlight);
                return this.createMergedHighlight(highlight, storedComment, file);
            }

            return this.createHighlightInfo(highlight, file);
        });

        // 添加虚拟高亮
        const virtualHighlights = storedComments
            .filter(c => c.id && c.isVirtual && c.comments && c.comments.length > 0 && !usedCommentIds.has(c.id))
            .map(vh => this.createHighlightInfo(vh, file));
        
        // 异步更新存储中的 position，防止偏移累积
        if (positionUpdates.length > 0) {
            this.applyPositionUpdates(file.path, storedComments, positionUpdates);
        }
        
        return [...virtualHighlights, ...mergedHighlights];
    }
    
    /**
     * 记录需要更新 position 的高亮
     */
    private trackPositionUpdate(
        updates: { id: string; newPosition: number }[],
        storedComment: HiNote,
        highlight: HighlightInfo
    ): void {
        if (storedComment.id &&
            highlight.position !== undefined &&
            storedComment.position !== undefined &&
            highlight.position !== storedComment.position &&
            storedComment.text === highlight.text) {
            updates.push({ id: storedComment.id, newPosition: highlight.position });
        }
    }
    
    /**
     * 异步批量更新存储中的 position，防止偏移累积导致匹配失败
     */
    private applyPositionUpdates(
        filePath: string,
        storedComments: HiNote[],
        updates: { id: string; newPosition: number }[]
    ): void {
        // 使用 setTimeout 异步执行，不阻塞合并流程
        setTimeout(async () => {
            try {
                const updateMap = new Map(updates.map(u => [u.id, u.newPosition]));
                let changed = false;
                
                for (const comment of storedComments) {
                    if (comment.id && updateMap.has(comment.id)) {
                        comment.position = updateMap.get(comment.id)!;
                        changed = true;
                    }
                }
                
                if (changed) {
                    const highlightRepository = this.getHighlightRepository?.();
                    if (highlightRepository) {
                        await highlightRepository.saveFileHighlights(filePath, storedComments);
                    }
                }
            } catch (error) {
                // 静默处理，position 更新失败不影响主流程
            }
        }, 100);
    }
    
    /**
     * 创建合并后的高亮信息
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
     * 创建高亮信息对象
     */
    private createHighlightInfo(highlight: HighlightInfo | HiNote, file: TFile): HighlightInfo {
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
