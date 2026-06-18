import { WidgetType } from "@codemirror/view";
import type { Plugin } from "obsidian";
import { HighlightInfo as HiNote } from "../../types/highlight";
import { CommentWidgetHelper } from "./CommentWidgetHelper";

export class CommentWidget extends WidgetType {
    private cleanupResizePositioning: (() => void) | null = null;
    
    /**
     * 생성자
     * @param plugin Obsidian 플러그인 인스턴스
     * @param highlight 현재 하이라이트 객체
     * @param onClick 댓글 버튼 클릭 시 콜백 함수
     */
    constructor(
        private plugin: Plugin,
        private highlight: HiNote,
        private onClick: () => void
    ) {
        super();
    }

    /**
     * 두 위젯이 동일한지 비교
     * CodeMirror 최적화를 위해 불필요한 DOM 업데이트 방지
     * @param widget 비교할 다른 위젯
     * @returns 두 위젯의 내용이 동일하면 true 반환
     */
    eq(widget: WidgetType): boolean {
        if (!(widget instanceof CommentWidget)) return false;

        const idMatch = !!this.highlight.id && this.highlight.id === widget.highlight.id;
        const textMatch = this.highlight.text === widget.highlight.text;
        const positionMatch = this.highlight.position === widget.highlight.position;
        const commentsMatch = (this.highlight.comments?.length ?? 0) === (widget.highlight.comments?.length ?? 0);

        return (idMatch || (textMatch && positionMatch)) && commentsMatch;
    }

    /**
     * 위젯의 예상 높이 가져오기
     * 위젯이 인라인이므로 추가 수직 공간을 차지하지 않아 0 반환
     */
    get estimatedHeight(): number {
        return 0;
    }

    /**
     * 위젯에 포함된 줄바꿈 수 가져오기
     * 위젯이 인라인이므로 줄바꿈을 포함하지 않아 0 반환
     */
    get lineBreaks(): number {
        return 0;
    }

    /**
     * 위젯의 DOM 구조 생성
     * @returns 댓글 버튼과 미리보기를 포함하는 HTML 요소
     */
    toDOM(): HTMLElement {
        const wrapper = activeDocument.createElement("span");
        wrapper.addClass("hi-note-widget");

        // 각 위젯의 고유 식별을 위해 하이라이트 ID를 데이터 속성으로 추가
        if (this.highlight.id) {
            wrapper.setAttribute('data-highlight-id', this.highlight.id);
        }
        
        this.setupButton(wrapper);
        return wrapper;
    }

    /**
     * 댓글 버튼을 생성하고 공유 툴팁 및 클릭 동작 연결
     * @param wrapper 부모 컨테이너 요소
     */
    private setupButton(wrapper: HTMLElement): void {
        const comments = this.highlight.comments || [];
        const hasComments = comments.length > 0;
        const button = CommentWidgetHelper.createButton(wrapper, hasComments);
        const iconContainer = button.querySelector<HTMLElement>('.hi-note-icon-container');

        if (iconContainer) {
            CommentWidgetHelper.addCommentCount(iconContainer, comments.length);
        }

        const tooltip = CommentWidgetHelper.createTooltip(this.plugin.app, this.highlight);

        if (hasComments) {
            button.removeClass("hi-note-button-hidden");
            CommentWidgetHelper.setupTooltipEvents(button, wrapper, tooltip);
        } else {
            CommentWidgetHelper.setupEmptyCommentHover(wrapper, button);
        }

        CommentWidgetHelper.setupClickEvent(button, tooltip, () => this.onClick());

        // CodeMirror Widget은 독립적인 destroy 생명주기를 가지므로, 언로드를 위해 리스너 참조 보관.
        this.cleanupResizePositioning = CommentWidgetHelper.registerResizePositioning(wrapper, tooltip);
    }

    /**
     * 위젯 소멸 시 리소스 정리
     * @param dom 위젯의 DOM 요소
     */
    destroy(dom: HTMLElement): void {
        // 메모리 누수 방지를 위해 resize 리스너 제거
        if (this.cleanupResizePositioning) {
            this.cleanupResizePositioning();
            this.cleanupResizePositioning = null;
        }

        CommentWidgetHelper.removeTooltipsForHighlight(this.highlight);

        // DOM 요소 제거
        dom.remove();
    }

    /**
     * 위젯의 DOM 업데이트
     * DOM을 업데이트하지 않고 항상 재생성하므로 false 반환
     */
    updateDOM(dom: HTMLElement): boolean {
        return false;
    }

    /**
     * 이벤트 무시 여부
     * 에디터로의 이벤트 버블링 방지 및 소스 코드 모드 활성화 방지를 위해 true 반환
     */
    ignoreEvent(): boolean {
        return true; // 이벤트가 에디터로 버블링되지 않도록 true 반환, 소스 코드 모드 활성화 방지
    }
}
