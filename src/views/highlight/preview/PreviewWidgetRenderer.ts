import { TFile, MarkdownPostProcessorContext, MarkdownRenderer, Component } from "obsidian";
import { HighlightInfo as HiNote } from "../../../types/highlight";
import { HighlightService } from '../../../services/HighlightService';
import { CommentWidgetHelper, CommentInput } from '../../../components/comment';
import { CommentService } from '../../../services/comment/CommentService';
import { PreviewHighlightResolver } from "./PreviewHighlightResolver";
import type { HiNotePluginContext } from "../../../types/plugin";
import type CommentPlugin from "../../../../main";

/**
 * 읽기 모드 주석 위젯 렌더러
 * 읽기 모드 (Preview Mode)에서 주석 아이콘과 툴팁 렌더링 담당
 */
export class PreviewWidgetRenderer {
    private highlightResolver: PreviewHighlightResolver;
    // 렌더된 plainText 캐시. 키는 sourcePath + 원본 마크다운 — 내용이 키라
    // 하이라이트가 편집되면 새 키로 자동 미스되어 stale 값이 제공되지 않는다.
    private plainTextCache = new Map<string, string>();

    constructor(
        private plugin: HiNotePluginContext,
        private highlightService: HighlightService,
        private commentService: CommentService
    ) {
        this.highlightResolver = new PreviewHighlightResolver();
    }

    /**
     * 읽기 모드에서 하이라이트 렌더링 처리
     * Markdown Post Processor에서 호출
     */
    async processPreview(element: HTMLElement, context: MarkdownPostProcessorContext): Promise<void> {
        const file = this.plugin.app.vault.getAbstractFileByPath(context.sourcePath);
        if (!(file instanceof TFile)) return;

        // 해당 파일을 처리해야 하는지 확인
        if (!this.highlightService.shouldProcessFile(file)) return;

        // 하이라이트 요소 검색
        const marks = element.querySelectorAll('mark, span.highlight');
        if (marks.length === 0) return;

        // 해당 파일의 모든 하이라이트 데이터 가져오기
        const content = await this.plugin.app.vault.cachedRead(file);
        const rawHighlights = this.highlightService.extractHighlights(content, file);

        if (rawHighlights.length === 0) return;

        // 하이라이트 전처리: 줄 번호 계산 (코멘트 없는 하이라이트도 포함)
        const allHighlights = this.highlightResolver.enrichHighlightsWithLines(rawHighlights, file, content);

        if (allHighlights.length === 0) return;

        // 읽기 모드에서 ==**bold**== 는 마크다운이 제거된 채 렌더되므로 mark.textContent 와
        // 저장된 highlight.text(원본 마크다운)가 어긋난다. 비교 기준이 될 plainText 를
        // 렌더러로 미리 계산해 채운다.
        await Promise.all(allHighlights.map(async (highlight) => {
            highlight.plainText = await this.renderPlainText(highlight.text, context.sourcePath);
        }));

        // DOM 요소 순회하여 매칭
        marks.forEach((mark) => {
            if (mark.hasAttribute('data-hi-note-processed')) return;

            const text = mark.textContent?.trim();
            if (!text) return;

            // 매칭되는 하이라이트 검색
            const match = this.highlightResolver.findMatchingHighlight(
                text,
                mark,
                element,
                context,
                allHighlights
            );

            if (match) {
                mark.setAttribute('data-hi-note-processed', 'true');
                this.renderPreviewWidget(mark as HTMLElement, match);
            }
        });
    }

    /**
     * highlight.text 를 읽기 모드 렌더 결과의 순수 텍스트로 변환한다.
     * 마크다운 메타문자가 없으면 렌더 비용 없이 그대로 사용한다.
     */
    private async renderPlainText(markdown: string, sourcePath: string): Promise<string> {
        if (!markdown || !/[*`[\]~<>$_=]/.test(markdown)) return markdown.trim();

        const cacheKey = `${sourcePath}\u0000${markdown}`;
        const cached = this.plainTextCache.get(cacheKey);
        if (cached !== undefined) return cached;

        // 로컬 Component 로 렌더해 자식 컴포넌트(임베드 등)를 즉시 unload — plugin
        // 수명에 매달리지 않도록(R: 리스너/리소스 정리 안전성).
        const tmp = document.createElement('div');
        const component = new Component();
        component.load();
        try {
            await MarkdownRenderer.render(this.plugin.app, markdown, tmp, sourcePath, component);
            const result = (tmp.textContent ?? markdown).trim();
            this.plainTextCache.set(cacheKey, result);
            return result;
        } catch {
            return markdown.trim();
        } finally {
            component.unload();
            tmp.remove();
        }
    }

    /**
     * 읽기 모드 주석 위젯 렌더링
     */
    private renderPreviewWidget(mark: HTMLElement, highlight: HiNote): void {
        const widget = mark.createSpan({ cls: 'hi-note-widget hi-note-preview-widget' });
        const hasComments = !!(highlight.comments && highlight.comments.length > 0);

        // 코멘트 유무와 상관없이 버튼 생성 (항상 createButton 호출, hasComments=false → hidden 클래스 추가됨)
        const button = CommentWidgetHelper.createButton(widget, hasComments);
        const iconContainer = button.querySelector('.hi-note-icon-container') as HTMLElement;

        if (hasComments && highlight.comments) {
            // 댓글 수 추가
            CommentWidgetHelper.addCommentCount(iconContainer, highlight.comments.length);

            // 툴팁 생성
            const tooltip = CommentWidgetHelper.createTooltip(this.plugin.app, highlight);

            // 툴팁 이벤트 설정
            CommentWidgetHelper.setupTooltipEvents(button, widget, tooltip);

            // 클릭 이벤트: 인라인 추가 (기존 패널 열기 대신 통일)
            CommentWidgetHelper.setupClickEvent(button, tooltip, () =>
                this.openInlineCommentInput(widget, highlight)
            );

            // 정리 옵저버 생성
            CommentWidgetHelper.createCleanupObserver(widget, tooltip);
        } else {
            // 코멘트 없음: mark 요소(하이라이트 텍스트) 위에 호버 시 버튼 노출
            // widget이 width:0인 상태라 widget-hover는 면적이 없으므로 mark에 부착
            mark.addEventListener("mouseenter", () => {
                button.removeClass("hi-note-button-hidden");
            });
            mark.addEventListener("mouseleave", () => {
                button.addClass("hi-note-button-hidden");
            });

            // 클릭 이벤트: 인라인 추가
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openInlineCommentInput(widget, highlight);
            });
        }
    }

    /**
     * 읽기 모드에서 하이라이트 옆에 CommentInput을 마운트하여 인라인으로 코멘트 추가
     */
    private openInlineCommentInput(widget: HTMLElement, highlight: HiNote): void {
        // 중복 입력창 방지
        if (widget.querySelector('.hi-note-inline-comment-input')) return;

        const container = widget.createDiv({ cls: 'hi-note-inline-comment-input' });

        new CommentInput(
            container,
            highlight,
            undefined,
            this.plugin as unknown as CommentPlugin,
            {
                onSave: async (content: string) => {
                    await this.commentService.addComment(highlight, content);
                },
                onCancel: () => container.remove(),
                onClosed: () => container.remove(),
            }
        ).show();
    }
}
