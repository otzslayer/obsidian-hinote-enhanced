import { TFile, App, Notice } from 'obsidian';
import { HighlightInfo, CommentItem } from '../../types/highlight';
import { HighlightManager } from '../HighlightManager';
import { IdGenerator } from '../../utils/IdGenerator';
import { InlineCommentWriter } from './inline/InlineCommentWriter';
import CommentPlugin from '../../../main';
import { t } from '../../i18n';

/**
 * 评论服务
 * 负责评论的添加、更新、删除等业务逻辑
 * 
 * 职责：
 * - 评论的 CRUD 操作
 * - 虚拟高亮的管理
 * - 闪卡关联检查
 * - 文件查找逻辑
 */
export class CommentService {
    private app: App;
    private plugin: CommentPlugin;
    private highlightManager: HighlightManager;
    private inlineWriter: InlineCommentWriter;

    // 回调函数
    private onRefreshView: (() => Promise<void>) | null = null;
    private onHighlightsUpdate: ((highlights: HighlightInfo[]) => void) | null = null;
    private onCardUpdate: ((highlight: HighlightInfo) => void) | null = null;
    private onCardRemove: ((highlight: HighlightInfo) => void) | null = null;

    // 当前状态
    private currentFile: TFile | null = null;
    private highlights: HighlightInfo[] = [];

    constructor(
        app: App,
        plugin: CommentPlugin,
        highlightManager: HighlightManager
    ) {
        this.app = app;
        this.plugin = plugin;
        this.highlightManager = highlightManager;
        this.inlineWriter = new InlineCommentWriter(app);
    }
    
    /**
     * 设置回调函数
     */
    setCallbacks(callbacks: {
        onRefreshView?: () => Promise<void>;
        onHighlightsUpdate?: (highlights: HighlightInfo[]) => void;
        onCardUpdate?: (highlight: HighlightInfo) => void;
        onCardRemove?: (highlight: HighlightInfo) => void;
    }) {
        if (callbacks.onRefreshView) {
            this.onRefreshView = callbacks.onRefreshView;
        }
        if (callbacks.onHighlightsUpdate) {
            this.onHighlightsUpdate = callbacks.onHighlightsUpdate;
        }
        if (callbacks.onCardUpdate) {
            this.onCardUpdate = callbacks.onCardUpdate;
        }
        if (callbacks.onCardRemove) {
            this.onCardRemove = callbacks.onCardRemove;
        }
    }
    
    /**
     * 更新状态
     */
    updateState(state: {
        currentFile?: TFile | null;
        highlights?: HighlightInfo[];
    }) {
        if (state.currentFile !== undefined) {
            this.currentFile = state.currentFile;
        }
        if (state.highlights !== undefined) {
            this.highlights = state.highlights;
        }
    }
    
    /**
     * 添加评论
     */
    async addComment(highlight: HighlightInfo, content: string): Promise<void> {
        const file = await this.getFileForHighlight(highlight);
        if (!file) {
            new Notice(t("No corresponding file found."));
            return;
        }

        if (!highlight.id) {
            highlight.id = IdGenerator.generateHighlightId(
                file.path,
                highlight.position || 0,
                highlight.text
            );
        }

        if (!highlight.comments) {
            highlight.comments = [];
        }

        const now = Date.now();
        const timestamp = formatTimestamp(now);
        const result = await this.inlineWriter.addComment(file, highlight, content, timestamp);
        if (!result.success) {
            new Notice(t("Failed to save comment: ") + (result.reason ?? ''));
            return;
        }

        // Update in-memory model so UI reflects the change immediately.
        const newComment: CommentItem = {
            id: IdGenerator.generateCommentId(),
            content,
            createdAt: now,
            updatedAt: now,
        };
        highlight.comments.push(newComment);
        highlight.updatedAt = now;

        if (this.onCardUpdate) {
            this.onCardUpdate(highlight);
        } else if (this.onRefreshView) {
            await this.onRefreshView();
        }
    }
    
    /**
     * 更新评论
     */
    async updateComment(highlight: HighlightInfo, commentId: string, content: string): Promise<void> {
        const file = await this.getFileForHighlight(highlight);
        if (!file || !highlight.comments) return;

        const comment = highlight.comments.find(c => c.id === commentId);
        if (!comment) return;

        const oldContent = comment.content;
        const now = Date.now();
        const timestamp = formatTimestamp(now);

        const result = await this.inlineWriter.updateComment(file, highlight, commentId, content, timestamp);
        if (!result.success) {
            new Notice(t("Failed to update comment: ") + (result.reason ?? ''));
            return;
        }

        // Update in-memory model.
        comment.content = content;
        comment.updatedAt = now;
        highlight.updatedAt = now;

        if (highlight.id) {
            this.plugin.eventManager.emitCommentUpdate(file.path, oldContent, content, highlight.id);
        }

        if (this.onCardUpdate) {
            this.onCardUpdate(highlight);
        } else if (this.onRefreshView) {
            await this.onRefreshView();
        }
    }
    
    /**
     * 删除评论
     */
    async deleteComment(highlight: HighlightInfo, commentId: string): Promise<void> {
        const file = await this.getFileForHighlight(highlight);
        if (!file || !highlight.comments) return;

        const result = await this.inlineWriter.deleteComment(file, highlight, commentId);
        if (!result.success) {
            new Notice(t("Failed to delete comment: ") + (result.reason ?? ''));
            return;
        }

        // Update in-memory model.
        highlight.comments = highlight.comments.filter(c => c.id !== commentId);
        highlight.updatedAt = Date.now();

        let removedHighlight = false;
        if (highlight.comments.length === 0) {
            const hasFlashcard = highlight.id ? this.checkHasFlashcard(highlight.id) : false;
            if (!hasFlashcard) {
                removedHighlight = true;
                this.highlights = this.highlights.filter(h => {
                    if (h.id && highlight.id) return h.id !== highlight.id;
                    return !(h.position === highlight.position && h.text === highlight.text);
                });
                if (this.onHighlightsUpdate) {
                    this.onHighlightsUpdate(this.highlights);
                }
            }
        }

        if (removedHighlight && this.onCardRemove) {
            this.onCardRemove(highlight);
        } else if (this.onCardUpdate) {
            this.onCardUpdate(highlight);
        } else if (this.onRefreshView) {
            await this.onRefreshView();
        }
    }
    
    /**
     * 删除虚拟高亮（当取消添加评论时）
     */
    async deleteVirtualHighlight(highlight: HighlightInfo): Promise<void> {
        if (!highlight.isVirtual || (highlight.comments && highlight.comments.length > 0)) {
            return;
        }
        
        const file = await this.getFileForHighlight(highlight);
        if (file) {
            await this.highlightManager.removeHighlight(file, highlight);
            this.highlights = this.highlights.filter(h => {
                // 如果有 ID，通过 ID 比较
                if (h.id && highlight.id) {
                    return h.id !== highlight.id;
                }
                // 如果没有 ID，通过位置和文本比较
                return !(h.position === highlight.position && h.text === highlight.text);
            });
            
            // 通知外部更新高亮列表
            if (this.onHighlightsUpdate) {
                this.onHighlightsUpdate(this.highlights);
            }

            if (this.onCardRemove) {
                this.onCardRemove(highlight);
            } else if (this.onRefreshView) {
                await this.onRefreshView();
            }
        }
    }
    
    /**
     * 获取高亮对应的文件
     */
    private async getFileForHighlight(highlight: HighlightInfo): Promise<TFile | null> {
        // 如果有当前文件，使用当前文件
        if (this.currentFile) {
            return this.currentFile;
        }
        // 如果是全部高亮视图，使用 highlight.filePath 获取文件
        if (highlight.filePath) {
            const file = this.app.vault.getAbstractFileByPath(highlight.filePath);
            if (file instanceof TFile) {
                return file;
            }
        }
        // 如果通过 filePath 找不到，尝试通过 fileName
        if (highlight.fileName) {
            const files = this.app.vault.getFiles();
            const file = files.find(f => f.basename === highlight.fileName || f.name === highlight.fileName);
            if (file) {
                return file;
            }
        }
        return null;
    }
    
    /**
     * 检查高亮是否已经创建了闪卡
     */
    private checkHasFlashcard(highlightId: string): boolean {
        const fsrsManager = this.plugin.fsrsManager;
        if (!fsrsManager || !highlightId) {
            return false;
        }

        const cards = fsrsManager.findCardsBySourceId(highlightId, 'highlight');
        return cards && cards.length > 0;
    }
}

/** Format a Unix ms timestamp as "YYYY-MM-DD HH:mm". */
function formatTimestamp(ms: number): string {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
