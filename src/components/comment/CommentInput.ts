import { CommentItem, HighlightInfo } from "../../types/highlight";
import { Platform } from "obsidian";
import type CommentPlugin from "../../../main";
import { InlineAICommentHandler } from "./InlineAICommentHandler";
import { CommentInputSaveController } from "./CommentInputSaveController";
import { CommentInputActionBar } from "./CommentInputActionBar";

export class CommentInput {
    private textarea: HTMLTextAreaElement;
    private actionHint: HTMLElement;
    private cancelEdit: () => void = () => {};
    private inlineAI: InlineAICommentHandler;
    private saveController: CommentInputSaveController;
    private boundHandleOutsideClick: (e: MouseEvent) => void;
    private commentEl: Element | null = null; // 保存批注元素引用，用于移除 editing 类

    constructor(
        private card: HTMLElement,
        private highlight: HighlightInfo,
        private existingComment: CommentItem | undefined,
        private plugin: CommentPlugin,
        private options: {
            onSave: (content: string) => Promise<void>;
            onDelete?: () => Promise<void>;
            onCancel: () => void;
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
        document.addEventListener('click', this.boundHandleOutsideClick);
        
        // 通知 HighlightCard 当前正在显示输入框
        this.notifyInputShown();
    }

    public show() {
        if (this.existingComment) {
            this.showEditMode();
        } else {
            this.showCreateMode();
        }
    }

    private showEditMode() {
        const commentEl = this.card.querySelector(`[data-comment-id="${this.existingComment!.id}"]`);
        if (!commentEl) return;

        // 保存引用，用于在 destroy 时移除 editing 类
        this.commentEl = commentEl;

        // 添加编辑状态类，用于隐藏展开/收起按钮
        commentEl.addClass('editing');

        const contentEl = commentEl.querySelector('.hi-note-content') as HTMLElement;
        if (!contentEl) return;

        // 使用原始评论内容而不是渲染后的文本内容，这样可以保留 Markdown 符号
        const originalContent = this.existingComment?.content || '';

        // 创建编辑框
        this.textarea = document.createElement('textarea');
        this.textarea.value = originalContent;
        this.textarea.className = 'hi-note-input';
        this.textarea.style.minHeight = `${contentEl.offsetHeight}px`;

        // 添加输入事件监听器
        this.textarea.addEventListener('input', () => {
            this.autoResizeTextarea();
        });
        
        // 阻止文本框的点击事件冒泡
        this.textarea.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 替换内容为编辑框
        contentEl.replaceWith(this.textarea);

        // 隐藏底部的时间和按钮
        const footer = commentEl.querySelector('.hi-note-footer');
        if (footer) {
            footer.addClass('hi-note-hidden');
        }

        this.actionHint = new CommentInputActionBar(commentEl as HTMLElement, {
            onSave: async () => await this.handleSave(),
            onDelete: this.options.onDelete ? async () => await this.handleDelete() : undefined
        }).render();

        this.setupKeyboardEvents(contentEl, footer || undefined);

        // 延迟一下再聚焦，确保DOM已经完全渲染
        setTimeout(() => {
            this.textarea.focus();
            this.textarea.setSelectionRange(this.textarea.value.length, this.textarea.value.length);
        }, 50);
    }

    private showCreateMode() {
        const inputSection = document.createElement('div');
        inputSection.className = 'hi-note-input';

        // 创建文本框
        this.textarea = inputSection.createEl("textarea");
        
        // 添加输入事件监听器
        this.textarea.addEventListener('input', () => {
            this.autoResizeTextarea();
        });
        
        // 阻止点击事件冒泡，防止触发高亮卡片的点击事件
        inputSection.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 添加到评论区域
        let commentsSection = this.card.querySelector('.hi-notes-section');
        if (!commentsSection) {
            commentsSection = this.card.createEl('div', {
                cls: 'hi-notes-section'
            });
            
            commentsSection.createEl('div', {
                cls: 'hi-notes-list'
            });
        }

        const commentsList = commentsSection.querySelector('.hi-notes-list');
        if (commentsList) {
            commentsList.insertBefore(inputSection, commentsList.firstChild);
        }

        this.actionHint = new CommentInputActionBar(inputSection, {
            onSave: async () => await this.handleSave()
        }).render();

        this.setupKeyboardEvents();
        
        // 延迟一下再聚焦，确保DOM已经完全渲染
        setTimeout(() => {
            this.textarea.focus();
        }, 50);
    }

    private setupKeyboardEvents(contentEl?: HTMLElement, footer?: Element) {
        // 保存编辑模式的上下文，用于取消时恢复
        const editContext = this.existingComment ? { contentEl, footer } : null;
        
        this.cancelEdit = () => {
            this.cancel(editContext);
        };

        this.textarea.onkeydown = async (e: KeyboardEvent) => {
            // Tab键触发AI内联生成
            if (e.key === 'Tab') {
                e.preventDefault();
                await this.inlineAI.generate();
                return;
            }
            
            // 移动端上 Enter 键为换行，非移动端上 Enter 键为保存
            if (e.key === 'Enter') {
                if (Platform.isMobile) {
                    // 移动端上不拦截 Enter 键，允许正常换行
                    return;
                } else if (e.shiftKey) {
                    // 非移动端上保持 Shift+Enter 换行功能
                    return;
                }
                
                // 非移动端上 Enter 键为保存
                e.preventDefault();
                
                await this.saveController.saveCurrentContent();
            }
        };
    }

    // 自动调整文本框高度以适应内容
    private autoResizeTextarea() {
        if (!this.textarea) return;
        
        // 使用 requestAnimationFrame 批处理 DOM 操作，减少强制重排
        requestAnimationFrame(() => {
            if (!this.textarea) return;
            
            // 保存当前滚动位置
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            // 重置高度，以便能够准确计算内容高度
            this.textarea.style.height = 'auto';
            
            // 设置新高度 (内容高度 + 边距)
            const newHeight = this.textarea.scrollHeight;
            this.textarea.style.height = `${newHeight}px`;
            
            // 恢复滚动位置，避免页面跳动
            window.scrollTo(0, scrollTop);
        });
    }


    private handleOutsideClick(e: MouseEvent) {
        if (!this.textarea || this.saveController.isProcessing()) return;
        
        const clickedElement = e.target as HTMLElement;
        const isOutside = !this.textarea.contains(clickedElement) && 
                         !clickedElement.closest('.hi-note-actions-hint');
        
        if (isOutside) {
            // 立即阻止事件传播，避免触发卡片点击
            e.preventDefault();
            e.stopPropagation();
            
            const content = this.textarea.value.trim();
            
            if (content) {
                // 有内容时保存
                void this.saveController.saveCurrentContent();
            } else {
                // 没有内容时取消
                this.cancel();
            }
        }
    }

    /**
     * 取消输入（不保存）
     * @param editContext 编辑模式的上下文信息，用于恢复原始内容
     */
    private cancel(editContext?: { contentEl?: HTMLElement, footer?: Element } | null) {
        // 立即通知 HighlightCard 输入框已关闭，确保状态同步
        this.notifyInputClosed();
        
        if (this.existingComment && editContext?.contentEl && editContext?.footer) {
            // 编辑模式：恢复原始内容
            this.textarea.replaceWith(editContext.contentEl);
            this.actionHint.remove();
            editContext.footer.removeClass('hi-note-hidden');
        } else {
            // 创建模式：移除整个输入框容器
            const inputContainer = this.textarea.closest('.hi-note-input');
            if (inputContainer) {
                inputContainer.remove();
            }
            
            // 如果没有其他评论，移除评论区域
            if (!this.card.querySelector('.hi-note')) {
                this.card.querySelector('.hi-notes-section')?.remove();
            }
        }
        
        // 清理事件监听器
        document.removeEventListener('click', this.boundHandleOutsideClick);
        this.saveController.reset();
        
        // 调用取消回调
        this.options.onCancel();
    }
    
    /**
     * 销毁输入框（保存后调用）
     */
    public destroy() {
        // 立即通知 HighlightCard 输入框已关闭
        this.notifyInputClosed();
        
        // 清理事件监听器
        document.removeEventListener('click', this.boundHandleOutsideClick);
        this.saveController.reset();
        
        // 移除 textarea
        if (this.textarea && this.textarea.parentElement) {
            this.textarea.remove();
        }
        
        // 移除 actionHint
        if (this.actionHint && this.actionHint.parentElement) {
            this.actionHint.remove();
        }
        
        // 移除编辑状态类，恢复展开/收起按钮
        if (this.commentEl) {
            this.commentEl.removeClass('editing');
            this.commentEl = null;
        }
    }
    
    /**
     * 安全销毁输入框（用于删除评论后调用）
     * 检查 DOM 元素是否仍然存在，避免操作已删除的元素
     */
    public destroySafe() {
        try {
            // 立即通知 HighlightCard 输入框已关闭
            this.notifyInputClosed();
            
            // 清理事件监听器
            document.removeEventListener('click', this.boundHandleOutsideClick);
            this.saveController.reset();
            
            // 检查 textarea 是否仍在 DOM 中
            if (this.textarea && this.textarea.isConnected && this.textarea.parentElement) {
                this.textarea.remove();
            }
            
            // 检查 actionHint 是否仍在 DOM 中
            if (this.actionHint && this.actionHint.isConnected && this.actionHint.parentElement) {
                this.actionHint.remove();
            }
            
            // 检查 commentEl 是否仍在 DOM 中
            if (this.commentEl && this.commentEl.isConnected) {
                this.commentEl.removeClass('editing');
                this.commentEl = null;
            }
        } catch (error) {
            // 捕获任何错误，避免应用冻结
            console.error('[CommentInput] 安全销毁时出错:', error);
        }
    }
    
    /**
     * 处理保存逻辑
     */
    private async handleSave() {
        await this.saveController.saveCurrentContent();
    }

    private async handleDelete(): Promise<void> {
        if (!this.saveController.startProcessing()) return;

        document.removeEventListener('click', this.boundHandleOutsideClick);

        try {
            await this.options.onDelete?.();

            setTimeout(() => {
                this.destroySafe();
            }, 0);
        } catch (error) {
            console.error('删除评论失败:', error);
            document.addEventListener('click', this.boundHandleOutsideClick);
            this.saveController.reset();
        }
    }
    
    /**
     * 通知 HighlightCard 输入框已显示
     */
    private notifyInputShown() {
        const event = new CustomEvent('comment-input-shown', {
            detail: { highlightId: this.highlight.id }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 通知 HighlightCard 输入框已关闭
     */
    private notifyInputClosed() {
        const event = new CustomEvent('comment-input-closed', {
            detail: { highlightId: this.highlight.id }
        });
        document.dispatchEvent(event);
    }
} 
