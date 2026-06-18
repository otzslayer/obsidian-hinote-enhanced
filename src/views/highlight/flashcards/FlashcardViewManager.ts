import { App } from "obsidian";
import { FlashcardComponent } from "../../../flashcard";
import { HighlightInfo } from "../../../types/highlight";
import CommentPlugin from "../../../../main";
import { LicenseManager } from "../../../services/LicenseManager";

/**
 * 플래시카드 뷰 매니저
 * 담당:
 * 1. 플래시카드 모드 전환 관리
 * 2. 플래시카드 컴포넌트 생성 및 소멸
 * 3. 플래시카드 상태 마커 관리
 * 4. 플래시카드 관련 UI 업데이트 처리
 */
export class FlashcardViewManager {
    private flashcardComponent: FlashcardComponent | null = null;
    private isFlashcardMode: boolean = false;
    private highlightsWithFlashcards: Set<string> = new Set<string>();

    constructor(
        private app: App,
        private plugin: CommentPlugin
    ) {}

    /**
     * 플래시카드 모드 상태 가져오기
     */
    isInFlashcardMode(): boolean {
        return this.isFlashcardMode;
    }

    /**
     * 플래시카드 모드 설정
     */
    setFlashcardMode(enabled: boolean): void {
        this.isFlashcardMode = enabled;
    }

    /**
     * 플래시카드 컴포넌트 가져오기
     */
    getFlashcardComponent(): FlashcardComponent | null {
        return this.flashcardComponent;
    }

    /**
     * 플래시카드 컴포넌트 생성
     * @param container 플래시카드 컨테이너
     */
    createFlashcardComponent(
        container: HTMLElement,
        licenseManager?: LicenseManager
    ): FlashcardComponent | null {
        // 이미 존재하는 경우 먼저 소멸
        if (this.flashcardComponent) {
            this.destroyFlashcardComponent();
        }

        // 새 플래시카드 컴포넌트 생성
        this.flashcardComponent = new FlashcardComponent(
            container,
            this.plugin
        );
        if (licenseManager) {
            this.flashcardComponent.setLicenseManager(licenseManager);
        }

        this.isFlashcardMode = true;
        return this.flashcardComponent;
    }

    async activateFlashcardMode(container: HTMLElement, licenseManager?: LicenseManager): Promise<void> {
        if (!this.flashcardComponent) {
            this.createFlashcardComponent(container, licenseManager);
        } else if (licenseManager) {
            this.flashcardComponent.setLicenseManager(licenseManager);
        }

        await this.flashcardComponent?.activate();
    }

    /**
     * 플래시카드 컴포넌트 소멸
     */
    destroyFlashcardComponent(): void {
        if (this.flashcardComponent) {
            this.flashcardComponent.deactivate();
            this.flashcardComponent = null;
        }
        this.isFlashcardMode = false;
    }

    /**
     * 플래시카드 모드 종료
     */
    exitFlashcardMode(): void {
        this.destroyFlashcardComponent();
    }

    /**
     * 플래시카드 마커 업데이트
     * 플래시카드가 생성된 하이라이트를 마킹
     * @param highlights 하이라이트 목록
     */
    updateFlashcardMarkers(highlights: HighlightInfo[]): void {
        // 이전 마커 초기화
        this.highlightsWithFlashcards.clear();

        if (!this.plugin || !this.plugin.fsrsManager) {
            return;
        }

        const fsrsManager = this.plugin.fsrsManager;

        // 모든 하이라이트 순회하여 플래시카드가 생성된 하이라이트 ID 기록
        for (const highlight of highlights) {
            if (highlight.id) {
                // 플래시카드 존재 여부 확인
                const existingCards = fsrsManager.findCardsBySourceId(highlight.id, 'highlight');
                // 플래시카드가 있으면 하이라이트 ID를 집합에 추가
                if (existingCards && existingCards.length > 0) {
                    this.highlightsWithFlashcards.add(highlight.id);
                }
            }
        }
    }

    /**
     * 플래시카드 마커 집합 가져오기
     */
    getFlashcardMarkers(): Set<string> {
        return this.highlightsWithFlashcards;
    }

    /**
     * 하이라이트에 플래시카드가 있는지 확인
     */
    hasFlashcard(highlightId: string): boolean {
        return this.highlightsWithFlashcards.has(highlightId);
    }

    /**
     * 뒤로가기 버튼 로직 처리 (모바일 플래시카드 모드)
     * @returns true: 처리됨, false: 처리되지 않음
     */
    handleBackButton(): boolean {
        if (!this.isFlashcardMode || !this.flashcardComponent) {
            return false;
        }

        // 플래시카드 렌더러 상태 확인
        const renderer = this.flashcardComponent.getRenderer();
        if (renderer) {
            // 카드 콘텐츠 페이지에 있는 경우 먼저 그룹 목록으로 돌아감
            if (!renderer.isShowingSidebar()) {
                renderer.showSidebar();
                return true; // 처리됨, 계속 돌아가지 않음
            }
            // 이미 그룹 목록 페이지에 있는 경우 false 반환, 외부에서 파일 목록으로 돌아가도록 처리
        }

        return false; // 처리되지 않았거나 이미 그룹 목록에 있음
    }

    /**
     * 플래시카드 뷰 매니저 소멸
     */
    destroy(): void {
        this.destroyFlashcardComponent();
        this.highlightsWithFlashcards.clear();
    }
}
