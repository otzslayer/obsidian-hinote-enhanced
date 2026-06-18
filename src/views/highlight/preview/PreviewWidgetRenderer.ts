import { TFile, MarkdownPostProcessorContext } from "obsidian";
import { HighlightInfo as HiNote } from "../../../types/highlight";
import { HighlightService } from '../../../services/HighlightService';
import { CommentWidgetHelper } from '../../../components/comment';
import { PreviewHighlightResolver } from "./PreviewHighlightResolver";
import type { HiNotePluginContext } from "../../../types/plugin";

/**
 * 읽기 모드 주석 위젯 렌더러
 * 읽기 모드 (Preview Mode)에서 주석 아이콘과 툴팁 렌더링 담당
 */
export class PreviewWidgetRenderer {
    private highlightResolver: PreviewHighlightResolver;

    constructor(
        private plugin: HiNotePluginContext,
        private highlightService: HighlightService
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

        // 하이라이트 전처리: 댓글 가져오기 및 줄 번호 계산
        const highlightsWithComments = this.highlightResolver.enrichHighlightsWithComments(rawHighlights, file, content);

        if (highlightsWithComments.length === 0) return;

        // DOM 요소 순회하여 매칭
        marks.forEach((mark) => {
            if (mark.hasAttribute('data-hi-note-processed')) return;

            const text = mark.textContent;
            if (!text) return;

            // 매칭되는 하이라이트 검색
            const match = this.highlightResolver.findMatchingHighlight(
                text, 
                mark, 
                element, 
                context, 
                highlightsWithComments
            );

            if (match) {
                mark.setAttribute('data-hi-note-processed', 'true');
                this.renderPreviewWidget(mark as HTMLElement, match);
            }
        });
    }

    /**
     * 읽기 모드 주석 위젯 렌더링
     */
    private renderPreviewWidget(mark: HTMLElement, highlight: HiNote): void {
        const widget = mark.createSpan({ cls: 'hi-note-widget hi-note-preview-widget' });
        const hasComments = !!(highlight.comments && highlight.comments.length > 0);

        // 보조 클래스로 버튼 생성
        const button = CommentWidgetHelper.createButton(widget, hasComments);
        const iconContainer = button.querySelector('.hi-note-icon-container') as HTMLElement;

        if (hasComments && highlight.comments) {
            // 댓글 수 추가
            CommentWidgetHelper.addCommentCount(iconContainer, highlight.comments.length);

            // 툴팁 생성
            const tooltip = CommentWidgetHelper.createTooltip(this.plugin.app, highlight);

            // 툴팁 이벤트 설정
            CommentWidgetHelper.setupTooltipEvents(button, widget, tooltip);

            // 클릭 이벤트 설정
            CommentWidgetHelper.setupClickEvent(button, tooltip, () =>
                CommentWidgetHelper.openCommentPanel(this.plugin.app, highlight, this.plugin.eventManager)
            );

            // 정리 옵저버 생성
            CommentWidgetHelper.createCleanupObserver(widget, tooltip);
        }
    }
}
