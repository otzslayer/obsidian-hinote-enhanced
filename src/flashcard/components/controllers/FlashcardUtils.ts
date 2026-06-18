import type { FlashcardComponentContext } from "../FlashcardComponentContext";

/**
 * 플래시카드 유틸리티 클래스, 각종 보조 메서드 포함
 */
export class FlashcardUtils {
    private component: FlashcardComponentContext;
    
    constructor(component: FlashcardComponentContext) {
        this.component = component;
    }
    
    
    /**
     * 페이지 미리보기 기능 추가
     * @param element 미리보기를 추가할 요소
     * @param filePath 파일 경로
     */
    public addPagePreview(element: HTMLElement, filePath: string | undefined) {
        if (!filePath) return;

        let hoverTimeout: number | undefined;

        // 호버 이벤트 추가
        element.addEventListener("mouseenter", (event) => {
            hoverTimeout = window.setTimeout(() => {
                const target = event.target as HTMLElement;

                // Obsidian 페이지 미리보기 이벤트 트리거
                this.component.getApp().workspace.trigger('hover-link', {
                    event,
                    source: 'hi-note',
                    hoverParent: target,
                    targetEl: target,
                    linktext: filePath
                });
            }, 300); // 300ms 지연 표시
        });

        // 마우스 이탈 이벤트 추가
        element.addEventListener("mouseleave", () => {
            if (hoverTimeout) {
                window.clearTimeout(hoverTimeout);
            }
        });
    }

}
