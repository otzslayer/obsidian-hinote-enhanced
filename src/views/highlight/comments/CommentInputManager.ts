import { HighlightInfo, CommentItem } from '../../../types/highlight';
import { CommentInput } from '../../../components/comment';
import { defaultHighlightCardRegistry } from '../../../components/highlight';
import CommentPlugin from '../../../../main';

/**
 * 댓글 입력 매니저
 * 댓글 입력창의 표시 및 상호작용 관리 담당
 */
export class CommentInputManager {
    private plugin: CommentPlugin;

    // 콜백 함수
    private onCommentSave: ((highlight: HighlightInfo, content: string, existingComment?: CommentItem) => Promise<void>) | null = null;
    private onCommentDelete: ((highlight: HighlightInfo, commentId: string) => Promise<void>) | null = null;
    private onCommentCancel: ((highlight: HighlightInfo) => Promise<void>) | null = null;
    
    // 현재 편집 상태
    private currentEditingHighlightId: string | undefined;
    
    constructor(plugin: CommentPlugin) {
        this.plugin = plugin;
    }
    
    /**
     * 콜백 함수 설정
     */
    setCallbacks(callbacks: {
        onCommentSave?: (highlight: HighlightInfo, content: string, existingComment?: CommentItem) => Promise<void>;
        onCommentDelete?: (highlight: HighlightInfo, commentId: string) => Promise<void>;
        onCommentCancel?: (highlight: HighlightInfo) => Promise<void>;
    }) {
        if (callbacks.onCommentSave) {
            this.onCommentSave = callbacks.onCommentSave;
        }
        if (callbacks.onCommentDelete) {
            this.onCommentDelete = callbacks.onCommentDelete;
        }
        if (callbacks.onCommentCancel) {
            this.onCommentCancel = callbacks.onCommentCancel;
        }
    }
    
    /**
     * 댓글 입력창 표시
     */
    showCommentInput(
        card: HTMLElement, 
        highlight: HighlightInfo, 
        existingComment?: CommentItem
    ): void {
        this.currentEditingHighlightId = highlight.id;
        
        new CommentInput(card, highlight, existingComment, this.plugin, {
            onSave: async (content: string) => {
                if (this.onCommentSave) {
                    await this.onCommentSave(highlight, content, existingComment);
                }
            },
            onDelete: existingComment ? async () => {
                if (this.onCommentDelete) {
                    await this.onCommentDelete(highlight, existingComment.id);
                }
            } : undefined,
            onCancel: () => {
                if (this.onCommentCancel) {
                    void this.onCommentCancel(highlight);
                }
            },
            onShown: () => {
                defaultHighlightCardRegistry.findByElement(card)?.handleInputShown();
            },
            onClosed: () => {
                defaultHighlightCardRegistry.findByElement(card)?.handleInputClosed();
            }
        }).show();
    }
    
    /**
     * 현재 편집 중인 하이라이트 ID 가져오기
     */
    getCurrentEditingHighlightId(): string | undefined {
        return this.currentEditingHighlightId;
    }
    
    /**
     * 현재 편집 상태 초기화
     */
    clearEditingState(): void {
        this.currentEditingHighlightId = undefined;
    }
}
