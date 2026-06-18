import { HighlightInfo } from "../../types/highlight";
import { SelectionBoxController } from "./SelectionBoxController";

/**
 * 선택 매니저
 * 하이라이트 카드의 선택 기능 처리 담당:
 * - 드래그 선택 기능
 * - 선택 상태 관리
 * - 선택 박스 그리기
 */
export class SelectionManager {
    private highlightContainer: HTMLElement;
    private selectionBoxController: SelectionBoxController;
    // Map으로 선택된 카드 저장, key는 DOM 요소, value는 하이라이트 데이터
    // highlight.id에 의존하지 않아 ID 없는 하이라이트도 정상 작동
    private selectedCards: Map<HTMLElement, HighlightInfo> = new Map();

    // 콜백 함수
    private onSelectionChangeCallback: ((selectedCount: number) => void) | null = null;
    
    constructor(highlightContainer: HTMLElement) {
        this.highlightContainer = highlightContainer;
        this.selectionBoxController = new SelectionBoxController({
            highlightContainer,
            clearSelection: () => this.clearSelection(),
            updateSelectedHighlights: () => this.updateSelectedHighlights()
        });
    }
    
    /**
     * 선택 변경 콜백 설정
     */
    setOnSelectionChange(callback: (selectedCount: number) => void) {
        this.onSelectionChangeCallback = callback;
    }
    
    /**
     * 선택 기능 초기화
     */
    initialize() {
        this.selectionBoxController.initialize();
    }
    
    /**
     * 모든 선택 상태 초기화
     */
    clearSelection() {
        // 모든 선택된 카드의 DOM 상태 초기화
        this.selectedCards.forEach((highlight, element) => {
            element.removeClass('selected');
        });

        // 선택된 카드 집합 초기화
        this.selectedCards.clear();

        // 선택 변경 알림
        this.notifySelectionChange();
    }
    
    /**
     * 선택된 하이라이트 목록 업데이트
     * DOM에서 내부 Map으로 선택 상태 동기화
     */
    updateSelectedHighlights() {
        this.selectedCards.clear();
        const selectedCardElements = Array.from(this.highlightContainer.querySelectorAll('.highlight-card.selected'));

        selectedCardElements.forEach(cardElement => {
            const highlightData = cardElement.getAttribute('data-highlight');
            if (highlightData) {
                try {
                    const highlight = JSON.parse(highlightData) as HighlightInfo;
                    // DOM 요소를 key로 사용, highlight.id에 더 이상 의존하지 않음
                    this.selectedCards.set(cardElement as HTMLElement, highlight);
                } catch (e) {
                    console.error('Error parsing highlight data:', e);
                }
            }
        });

        // 선택 변경 알림
        this.notifySelectionChange();
    }
    
    /**
     * 선택된 하이라이트 가져오기
     * 하위 호환성 유지를 위해 Set 반환
     */
    getSelectedHighlights(): Set<HighlightInfo> {
        const highlights = new Set<HighlightInfo>();
        this.selectedCards.forEach((highlight) => {
            highlights.add(highlight);
        });
        return highlights;
    }
    
    /**
     * 선택 수량 가져오기
     */
    getSelectedCount(): number {
        return this.selectedCards.size;
    }
    
    /**
     * 단일 카드 선택
     * @param element 카드 요소
     * @param highlight 하이라이트 데이터
     */
    selectCard(element: HTMLElement, highlight: HighlightInfo) {
        // 선택 집합에 추가
        this.selectedCards.set(element, highlight);

        // DOM 상태 업데이트
        element.addClass('selected');

        // 선택 변경 알림
        this.notifySelectionChange();
    }
    
    /**
     * 단일 카드 선택 해제
     * @param element 카드 요소
     */
    unselectCard(element: HTMLElement) {
        if (this.selectedCards.has(element)) {
            // DOM 상태 업데이트
            element.removeClass('selected');

            // 선택 집합에서 제거
            this.selectedCards.delete(element);

            // 선택 변경 알림
            this.notifySelectionChange();
        }
    }
    
    /**
     * 카드 선택 여부 확인
     * @param element 카드 요소
     */
    isCardSelected(element: HTMLElement): boolean {
        return this.selectedCards.has(element);
    }
    
    /**
     * 선택 모드 여부
     */
    isInSelectionMode(): boolean {
        return this.selectionBoxController.isInSelectionMode();
    }
    
    /**
     * 선택 변경 알림
     */
    private notifySelectionChange() {
        if (this.onSelectionChangeCallback) {
            this.onSelectionChangeCallback(this.selectedCards.size);
        }
    }
    
    /**
     * 리소스 정리
     */
    destroy() {
        this.selectionBoxController.destroy();
        // 선택 상태 초기화
        this.clearSelection();
    }
}
