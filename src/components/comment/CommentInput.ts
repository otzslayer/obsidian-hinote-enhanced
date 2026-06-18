import { CommentItem, HighlightInfo } from "../../types/highlight";
import type CommentPlugin from "../../../main";
import { InlineAICommentHandler } from "./InlineAICommentHandler";
import { CommentInputSaveController } from "./CommentInputSaveController";
import {
    CommentInputEditContext,
    renderCreateCommentInput,
    renderEditCommentInput
} from "./CommentInputView";
import {
    removeCommentInputElements,
    restoreOrRemoveCommentInput
} from "./CommentInputCleanup";
import {
    autoResizeCommentTextarea,
    setupCommentInputKeyboard
} from "./CommentInputKeyboard";

export class CommentInput {
    private textarea: HTMLTextAreaElement;
    private actionHint: HTMLElement;
    private cancelEdit: () => void = () => {};
    private inlineAI: InlineAICommentHandler;
    private saveController: CommentInputSaveController;
    private boundHandleOutsideClick: (e: MouseEvent) => void;
    private commentEl: Element | null = null; // 주석 요소 참조 저장, editing 클래스 제거에 사용
    private isOpen = false;

    constructor(
        private card: HTMLElement,
        private highlight: HighlightInfo,
        private existingComment: CommentItem | undefined,
        private plugin: CommentPlugin,
        private options: {
            onSave: (content: string) => Promise<void>;
            onDelete?: () => Promise<void>;
            onCancel: () => void;
            onShown?: () => void;
            onClosed?: () => void;
        }
    ) {
        this.boundHandleOutsideClick = this.handleOutsideClick.bind(this);
        this.inlineAI = new InlineAICommentHandler({
            plugin: this.plugin,
            highlight: this.highlight,
            existingComment: this.existingComment,
            getTextarea: () => this.textarea,
            getActionHint: () => this.actionHint,
            resizeTextarea: () => this.autoResizeTextarea()
        });
        this.saveController = new CommentInputSaveController({
            getTextarea: () => this.textarea,
            onSave: this.options.onSave,
            onSaved: () => this.destroy()
        });
    }

    public show() {
        const didShow = this.existingComment
            ? this.showEditMode()
            : this.showCreateMode();

        if (didShow) {
            this.isOpen = true;
            activeDocument.addEventListener('click', this.boundHandleOutsideClick);
            this.options.onShown?.();
        }
    }

    private showEditMode(): boolean {
        const renderedInput = renderEditCommentInput(this.card, this.existingComment!, {
            onInput: () => this.autoResizeTextarea(),
            onSave: async () => await this.handleSave(),
            onDelete: this.options.onDelete ? async () => await this.handleDelete() : undefined
        });

        if (!renderedInput) return false;

        this.textarea = renderedInput.textarea;
        this.actionHint = renderedInput.actionHint;
        this.commentEl = renderedInput.commentEl || null;
        this.setupKeyboardEvents(renderedInput.editContext);

        // DOM이 완전히 렌더링된 후 포커스, 약간의 지연 적용
        window.setTimeout(() => {
            this.textarea.focus();
            this.textarea.setSelectionRange(this.textarea.value.length, this.textarea.value.length);
        }, 50);

        return true;
    }

    private showCreateMode(): boolean {
        const renderedInput = renderCreateCommentInput(this.card, {
            onInput: () => this.autoResizeTextarea(),
            onSave: async () => await this.handleSave()
        });

        this.textarea = renderedInput.textarea;
        this.actionHint = renderedInput.actionHint;
        this.setupKeyboardEvents(renderedInput.editContext);

        // DOM이 완전히 렌더링된 후 포커스, 약간의 지연 적용
        window.setTimeout(() => {
            this.textarea.focus();
        }, 50);

        return true;
    }

    private setupKeyboardEvents(editContext?: CommentInputEditContext | null) {
        this.cancelEdit = () => {
            this.cancel(editContext);
        };

        setupCommentInputKeyboard(this.textarea, {
            onInlineAI: async () => await this.inlineAI.generate(),
            onSave: async () => {
                await this.saveController.saveCurrentContent();
            }
        });
    }

    // 내용에 맞게 텍스트 영역 높이 자동 조정
    private autoResizeTextarea() {
        autoResizeCommentTextarea(this.textarea);
    }


    private handleOutsideClick(e: MouseEvent) {
        if (!this.textarea || this.saveController.isProcessing()) return;
        
        const clickedElement = e.target as HTMLElement;
        const isOutside = !this.textarea.contains(clickedElement) && 
                         !clickedElement.closest('.hi-note-actions-hint');
        
        if (isOutside) {
            // 카드 클릭 트리거 방지를 위해 이벤트 전파 즉시 차단
            e.preventDefault();
            e.stopPropagation();
            
            const content = this.textarea.value.trim();
            
            if (content) {
                // 내용이 있으면 저장
                void this.saveController.saveCurrentContent();
            } else {
                // 내용이 없으면 취소
                this.cancel();
            }
        }
    }

    /**
     * 입력 취소 (저장 없음)
     * @param editContext 원본 내용 복원을 위한 편집 모드 컨텍스트 정보
     */
    private cancel(editContext?: { contentEl?: HTMLElement, footer?: Element } | null) {
        // HighlightCard에 입력창이 닫혔음을 즉시 알려 상태 동기화
        this.notifyClosed();
        restoreOrRemoveCommentInput(this.getElements(), this.existingComment, editContext);

        // 이벤트 리스너 정리
        activeDocument.removeEventListener('click', this.boundHandleOutsideClick);
        this.saveController.reset();

        // 취소 콜백 호출
        this.options.onCancel();
    }

    /**
     * 입력창 소멸 (저장 후 호출)
     */
    public destroy() {
        // HighlightCard에 입력창이 닫혔음을 즉시 알림
        this.notifyClosed();

        // 이벤트 리스너 정리
        activeDocument.removeEventListener('click', this.boundHandleOutsideClick);
        this.saveController.reset();
        
        removeCommentInputElements(this.getElements());
        this.commentEl = null;
    }
    
    /**
     * 입력창 안전 소멸 (댓글 삭제 후 호출)
     * DOM 요소가 여전히 존재하는지 확인하여 이미 삭제된 요소 조작 방지
     */
    public destroySafe() {
        try {
            // HighlightCard에 입력창이 닫혔음을 즉시 알림
            this.notifyClosed();

            // 이벤트 리스너 정리
            activeDocument.removeEventListener('click', this.boundHandleOutsideClick);
            this.saveController.reset();

            removeCommentInputElements(this.getElements(), true);
            this.commentEl = null;
        } catch (error) {
            // 오류 캐치, 앱 동결 방지
            console.error('[CommentInput] 안전 소멸 중 오류:', error);
        }
    }

    /**
     * 저장 로직 처리
     */
    private async handleSave() {
        await this.saveController.saveCurrentContent();
    }

    private async handleDelete(): Promise<void> {
        if (!this.saveController.startProcessing()) return;

        activeDocument.removeEventListener('click', this.boundHandleOutsideClick);

        try {
            await this.options.onDelete?.();

            window.setTimeout(() => {
                this.destroySafe();
            }, 0);
        } catch (error) {
            console.error('댓글 삭제 실패:', error);
            activeDocument.addEventListener('click', this.boundHandleOutsideClick);
            this.saveController.reset();
        }
    }

    private notifyClosed(): void {
        if (!this.isOpen) {
            return;
        }

        this.isOpen = false;
        this.options.onClosed?.();
    }

    private getElements() {
        return {
            card: this.card,
            textarea: this.textarea,
            actionHint: this.actionHint,
            commentEl: this.commentEl
        };
    }
}
