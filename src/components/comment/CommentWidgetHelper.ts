import { MarkdownRenderer, Component, App, setIcon } from "obsidian";
import { HighlightInfo as HiNote, CommentItem } from "../../types/highlight";
import type { EventManager } from "../../services/EventManager";
import { VIEW_TYPE_HINOTE } from "../../views/hinote/HiNoteView";
import { COMMENT_BOUNDARY_MARGIN } from "./constants";

/**
 * 주석 위젯 보조 클래스
 * 편집 모드와 읽기 모드에서 공유되는 유틸리티 메서드 제공
 */
export class CommentWidgetHelper {
    private static readonly MAX_TOOLTIP_COMMENTS = 3;
    private static readonly TOOLTIP_GAP = 4;

    /**
     * 주석 버튼 생성
     */
    static createButton(container: HTMLElement, hasComments: boolean): HTMLElement {
        const button = container.createEl("button", {
            cls: `hi-note-button clickable-icon ${!hasComments ? 'hi-note-button-hidden' : ''}`
        });

        const iconContainer = button.createEl("span", {
            cls: "hi-note-icon-container"
        });

        setIcon(iconContainer, "message-circle");

        return button;
    }

    /**
     * 댓글 수 라벨 추가
     */
    static addCommentCount(iconContainer: HTMLElement, count: number): void {
        if (count > 0) {
            iconContainer.createEl("span", {
                cls: "hi-note-count",
                text: count.toString()
            });
        }
    }

    /**
     * 툴팁 생성
     */
    static createTooltip(app: App, highlight: HiNote): HTMLElement {
        const tooltip = activeDocument.createElement("div");
        tooltip.addClass("hi-note-tooltip", "hi-note-tooltip-hidden");
        if (highlight.id) {
            tooltip.setAttribute("data-highlight-id", highlight.id);
        }

        const commentsList = tooltip.createEl("div", {
            cls: "hi-note-tooltip-list"
        });

        // 댓글 내용 렌더링
        this.renderTooltipContent(app, commentsList, tooltip, highlight.comments || []);

        activeDocument.body.appendChild(tooltip);
        
        return tooltip;
    }

    /**
     * 툴팁 내용 렌더링
     */
    private static renderTooltipContent(
        app: App,
        commentsList: HTMLElement, 
        tooltip: HTMLElement, 
        comments: CommentItem[]
    ): void {
        if (comments.length === 0) return;

        // 최대 3개의 댓글 표시
        comments.slice(0, this.MAX_TOOLTIP_COMMENTS).forEach(comment => {
            const item = commentsList.createEl('div', { cls: 'hi-note-tooltip-item' });

            // Markdown으로 내용 렌더링
            const contentEl = item.createEl('div', {
                cls: 'hi-note-tooltip-content markdown-rendered'
            });
            
            this.renderMarkdownContent(app, contentEl, comment.content);

            item.createEl('div', {
                cls: 'hi-note-tooltip-time',
                text: new Date(comment.createdAt).toLocaleString()
            });
        });

        // 남은 댓글 수 표시
        if (comments.length > this.MAX_TOOLTIP_COMMENTS) {
            tooltip.createEl("div", {
                cls: "hi-note-tooltip-more",
                text: `댓글 ${comments.length - this.MAX_TOOLTIP_COMMENTS}개 더 있음...`
            });
        }
    }

    /**
     * Markdown 내용 렌더링
     */
    private static renderMarkdownContent(app: App, containerEl: HTMLElement, content: string): void {
        const markdownComponent = new Component();
        MarkdownRenderer.render(
            app,
            content,
            containerEl,
            '',
            markdownComponent
        ).then(() => {
            containerEl.querySelectorAll('ul, ol').forEach(list => {
                list.addClass('tooltip-markdown-list');
            });
        }).catch(error => {
            console.error('Error rendering markdown in tooltip:', error);
            containerEl.textContent = content;
        });
    }

    /**
     * 툴팁 위치 업데이트
     */
    static updateTooltipPosition(widget: HTMLElement, tooltip: HTMLElement): void {
        const buttonRect = widget.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = COMMENT_BOUNDARY_MARGIN;
        const maxTooltipWidth = Math.max(160, viewportWidth - margin * 2);

        tooltip.addClass("hi-note-tooltip-positioned");

        const tooltipRect = tooltip.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width || tooltip.offsetWidth;
        const tooltipHeight = tooltipRect.height || tooltip.offsetHeight;

        const spaceRight = viewportWidth - buttonRect.left - margin;
        let left = spaceRight >= tooltipWidth
            ? buttonRect.left
            : buttonRect.right - tooltipWidth;

        left = Math.min(
            Math.max(left, margin),
            Math.max(margin, viewportWidth - tooltipWidth - margin)
        );

        let top = buttonRect.bottom + this.TOOLTIP_GAP;
        if (top + tooltipHeight + margin > viewportHeight) {
            top = buttonRect.top - tooltipHeight - this.TOOLTIP_GAP;
        }
        top = Math.max(margin, top);

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    /**
     * 툴팁 표시/숨김 이벤트 설정
     */
    static setupTooltipEvents(
        button: HTMLElement,
        widget: HTMLElement,
        tooltip: HTMLElement
    ): void {
        button.addEventListener("mouseenter", () => {
            tooltip.removeClass("hi-note-tooltip-hidden");
            this.updateTooltipPosition(widget, tooltip);
        });

        button.addEventListener("mouseleave", () => {
            tooltip.addClass("hi-note-tooltip-hidden");
        });
    }

    /**
     * 댓글이 없을 때 하이라이트 영역에 호버 시에만 주석 추가 버튼 표시
     */
    static setupEmptyCommentHover(widget: HTMLElement, button: HTMLElement): void {
        button.addClass("hi-note-button-hidden");

        widget.addEventListener("mouseenter", () => {
            button.removeClass("hi-note-button-hidden");
        });

        widget.addEventListener("mouseleave", () => {
            button.addClass("hi-note-button-hidden");
        });
    }

    /**
     * 독립적인 생명주기를 가진 위젯이 윈도우 리스너를 정리할 수 있도록 지원
     */
    static registerResizePositioning(widget: HTMLElement, tooltip: HTMLElement): () => void {
        const resizeListener = () => this.updateTooltipPosition(widget, tooltip);
        window.addEventListener("resize", resizeListener);
        return () => window.removeEventListener("resize", resizeListener);
    }

    /**
     * 댓글 패널 열기
     */
    static async openCommentPanel(app: App, highlight: HiNote, eventManager: EventManager): Promise<void> {
        const workspace = app.workspace;
        const existing = workspace.getLeavesOfType(VIEW_TYPE_HINOTE);

        if (existing.length) {
            await workspace.revealLeaf(existing[0]);
            await new Promise(resolve => window.setTimeout(resolve, 50));
        } else {
            const leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: VIEW_TYPE_HINOTE,
                    active: true
                });
                await new Promise(resolve => window.setTimeout(resolve, 200));
            }
        }
        
        eventManager.emitCommentInputOpen(highlight.id || '', highlight.text);
    }

    /**
     * 클릭 이벤트 설정
     */
    static setupClickEvent(
        button: HTMLElement,
        tooltip: HTMLElement,
        onClick: () => void | Promise<void>
    ): void {
        button.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            tooltip.addClass("hi-note-tooltip-hidden");
            void Promise.resolve(onClick()).catch(error => {
                console.error('[HiNote] Error handling comment widget click:', error);
            });
        });
    }

    /**
     * 정리 옵저버 생성 (읽기 모드용)
     */
    static createCleanupObserver(widget: HTMLElement, tooltip: HTMLElement): MutationObserver {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                     if (node === widget) {
                         tooltip.remove();
                         observer.disconnect();
                     }
                });
            });
        });
        
        if (widget.parentElement) {
            observer.observe(widget.parentElement, { childList: true });
        }
        
        return observer;
    }

    /**
     * 하이라이트 ID로 툴팁 정리, CSS 선택자 이스케이프 문제 방지
     */
    static removeTooltipsForHighlight(highlight: HiNote): void {
        if (!highlight.id) return;

        activeDocument.querySelectorAll(".hi-note-tooltip").forEach(tooltip => {
            if (tooltip.getAttribute("data-highlight-id") === highlight.id) {
                tooltip.remove();
            }
        });
    }
}
