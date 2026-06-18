import { TFile, App, Notice } from 'obsidian';
import { HighlightInfo, CommentItem } from '../../types/highlight';
import { HighlightManager } from '../HighlightManager';
import { IdGenerator } from '../../utils/IdGenerator';
import { InlineCommentWriter } from './inline/InlineCommentWriter';
import CommentPlugin from '../../../main';
import { t } from '../../i18n';
import { formatTimestamp } from '../../utils/timestamp';

/**
 * 댓글 서비스
 * 댓글의 추가, 업데이트, 삭제 등 비즈니스 로직을 담당합니다
 *
 * 역할:
 * - 댓글 CRUD 작업
 * - 가상 하이라이트 관리
 * - 플래시카드 연관 확인
 * - 파일 검색 로직
 */
export class CommentService {
    private app: App;
    private plugin: CommentPlugin;
    private highlightManager: HighlightManager;
    private inlineWriter: InlineCommentWriter;

    // 콜백 함수
    private onRefreshView: (() => Promise<void>) | null = null;
    private onHighlightsUpdate: ((highlights: HighlightInfo[]) => void) | null = null;
    private onCardUpdate: ((highlight: HighlightInfo) => void) | null = null;
    private onCardRemove: ((highlight: HighlightInfo) => void) | null = null;

    // 현재 상태
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
     * 콜백 함수를 설정합니다
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
     * 상태를 업데이트합니다
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
     * 댓글을 추가합니다
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
     * 댓글을 업데이트합니다
     */
    async updateComment(highlight: HighlightInfo, commentId: string, content: string): Promise<void> {
        const file = await this.getFileForHighlight(highlight);
        if (!file || !highlight.comments) return;

        const comment = highlight.comments.find(c => c.id === commentId);
        if (!comment) return;

        // 내용이 동일하면 (편집 모드에 진입했다가 수정 없이 저장/포커스 아웃한 경우 등)
        // 아무 작업도 하지 않습니다. 그렇지 않으면 변경이 없어도 타임스탬프가 갱신됩니다.
        if (comment.content === content) return;

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
     * 댓글을 삭제합니다
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
     * 가상 하이라이트를 삭제합니다 (댓글 추가를 취소할 때)
     */
    async deleteVirtualHighlight(highlight: HighlightInfo): Promise<void> {
        if (!highlight.isVirtual || (highlight.comments && highlight.comments.length > 0)) {
            return;
        }
        
        const file = await this.getFileForHighlight(highlight);
        if (file) {
            await this.highlightManager.removeHighlight(file, highlight);
            this.highlights = this.highlights.filter(h => {
                // ID가 있으면 ID로 비교합니다
                if (h.id && highlight.id) {
                    return h.id !== highlight.id;
                }
                // ID가 없으면 위치와 텍스트로 비교합니다
                return !(h.position === highlight.position && h.text === highlight.text);
            });
            
            // 외부에 하이라이트 목록 업데이트를 알립니다
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
     * 하이라이트에 해당하는 파일을 가져옵니다
     */
    private async getFileForHighlight(highlight: HighlightInfo): Promise<TFile | null> {
        // 현재 파일이 있으면 현재 파일을 사용합니다
        if (this.currentFile) {
            return this.currentFile;
        }
        // 전체 하이라이트 뷰인 경우 highlight.filePath로 파일을 가져옵니다
        if (highlight.filePath) {
            const file = this.app.vault.getAbstractFileByPath(highlight.filePath);
            if (file instanceof TFile) {
                return file;
            }
        }
        // filePath로 찾지 못하면 fileName으로 시도합니다
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
     * 하이라이트에 플래시카드가 이미 생성되었는지 확인합니다
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
