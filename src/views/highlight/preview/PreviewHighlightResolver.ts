import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { HighlightInfo as HiNote } from "../../../types/highlight";

// plainText: highlight.text 를 읽기 모드 렌더 결과(마크다운 제거)로 변환한 값.
// mark.textContent 도 마크다운이 제거된 상태라 매칭은 이 값을 기준으로 한다.
export type PreviewHighlight = HiNote & { line: number; plainText: string };

const BLOCK_TAGS = new Set([
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'li',
    'div',
    'blockquote',
    'pre',
    'td',
    'th'
]);

/**
 * 읽기 모드에서 렌더링 가능한 하이라이트 데이터 파싱.
 *
 * Preview renderer는 DOM 렌더링만 담당하며, 여기서는 저장소 매칭, 댓글 보완, 줄 번호 계산을 집중 처리.
 */
export class PreviewHighlightResolver {
    constructor() {}


    enrichHighlightsWithLines(
        rawHighlights: HiNote[],
        file: TFile,
        content: string
    ): PreviewHighlight[] {
        return rawHighlights
            .map(highlight => this.enrichHighlight(highlight, file))
            .map(highlight => ({
                ...highlight,
                line: this.getLineForPosition(content, highlight.position),
                // 기본값은 원본 text. 마크다운이 포함된 경우 렌더러가 채운 plainText로
                // PreviewWidgetRenderer 가 덮어쓴다.
                plainText: highlight.text
            }));
    }

    findMatchingHighlight(
        text: string,
        mark: Element,
        rootElement: HTMLElement,
        context: MarkdownPostProcessorContext,
        highlightsWithComments: PreviewHighlight[]
    ): PreviewHighlight | null {
        const sectionInfo = this.getSectionInfo(mark, rootElement, context);

        if (!sectionInfo) {
            return highlightsWithComments.find(highlight => highlight.plainText === text) || null;
        }

        return highlightsWithComments.find(highlight =>
            highlight.plainText === text &&
            highlight.line >= sectionInfo.lineStart &&
            highlight.line <= sectionInfo.lineEnd
        ) || null;
    }

    private enrichHighlight(highlight: HiNote, _file: TFile): HiNote {
        // Comments are already populated inline by extractHighlights — return as-is.
        return { ...highlight, comments: highlight.comments ?? [] };
    }

    private getSectionInfo(
        mark: Element,
        rootElement: HTMLElement,
        context: MarkdownPostProcessorContext
    ): { lineStart: number; lineEnd: number } | null {
        let block = mark.parentElement;

        while (block && !this.isBlockElement(block) && block !== rootElement) {
            block = block.parentElement;
        }

        return block ? context.getSectionInfo(block) : null;
    }

    private isBlockElement(element: Element): boolean {
        return BLOCK_TAGS.has(element.tagName.toLowerCase());
    }

    private getLineForPosition(content: string, position: number): number {
        return content.substring(0, position).split('\n').length - 1;
    }

}
