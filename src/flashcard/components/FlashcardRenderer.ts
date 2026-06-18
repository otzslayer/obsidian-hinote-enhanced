import { Platform } from "obsidian";
import type { FlashcardState } from "../types/FSRSTypes";
import type { FlashcardComponentContext } from "./FlashcardComponentContext";
import {
    FlashcardActivationRenderer,
    FlashcardMarkdownRenderer,
    FlashcardGroupListRenderer,
    FlashcardEmptyStateRenderer,
    FlashcardCardRenderer
} from "./renderers";

/**
 * 플래시카드 렌더러, 모든 UI 렌더링 관련 기능 담당
 */
export class FlashcardRenderer {
    private component: FlashcardComponentContext;
    private isMobileView: boolean = false;
    private isSmallScreen: boolean = false;
    private showingSidebar: boolean = true;
    private activationRenderer: FlashcardActivationRenderer;
    private markdownRenderer: FlashcardMarkdownRenderer;
    private groupListRenderer: FlashcardGroupListRenderer;
    private emptyStateRenderer: FlashcardEmptyStateRenderer;
    private cardRenderer: FlashcardCardRenderer;
    
    constructor(component: FlashcardComponentContext) {
        this.component = component;
        this.activationRenderer = new FlashcardActivationRenderer(component, () => this.render());
        this.markdownRenderer = new FlashcardMarkdownRenderer(component);
        this.groupListRenderer = new FlashcardGroupListRenderer(component);
        this.emptyStateRenderer = new FlashcardEmptyStateRenderer(component);
        this.cardRenderer = new FlashcardCardRenderer(component, this.markdownRenderer);
        this.isMobileView = Platform.isMobile;
        this.isSmallScreen = window.innerWidth < 768;
        this.showingSidebar = this.isMobileView;
    }
    
    /**
     * 활성화 화면 렌더링
     */
    public renderActivation() {
        this.activationRenderer.render();
    }
    
    /**
     * 사이드바와 콘텐츠 영역 표시 상태 전환
     */
    public toggleSidebar() {
        this.showingSidebar = !this.showingSidebar;
        this.render();
    }
    
    /**
     * 현재 사이드바 표시 상태 가져오기
     */
    public isShowingSidebar(): boolean {
        return this.showingSidebar;
    }
    
    /**
     * 사이드바 표시
     */
    public showSidebar() {
        this.showingSidebar = true;

        const container = this.component.getContainer();
        if (this.isMobileView && this.isSmallScreen) {
            container.addClass('show-sidebar');
            container.removeClass('show-content');
        }

        this.render();
    }
    
    /**
     * 이전 단계로 돌아가기
     * 카드 내용 페이지에 있을 때는 그룹 목록으로 돌아가기
     * 그룹 목록 페이지에 있을 때는 파일 목록으로 돌아가기
     */
    public goBack() {
        if (this.isMobileView && this.isSmallScreen) {
            if (!this.showingSidebar) {
                // 현재 카드 내용을 표시 중이면 그룹 목록으로 돌아가기
                this.showingSidebar = true;
                this.render();
            }
        }
    }
    
    /**
     * 메인 화면 렌더링
     */
    public render() {
        if (!this.component.getIsActive()) {
            return;
        }
        
        const container = this.component.getContainer();
        container.empty();
        container.addClass('flashcard-mode');

        this.applyResponsiveClasses(container);
        this.renderProgress(container);

        const mainContainer = container.createEl("div", { cls: "flashcard-main-container" });
        const sidebar = mainContainer.createEl("div", { cls: "flashcard-sidebar" });
        this.groupListRenderer.render(sidebar, container, {
            isMobileView: this.isMobileView,
            onGroupSelected: () => {
                this.showingSidebar = false;
            },
            rerender: () => this.render()
        });

        const contentArea = mainContainer.createEl("div", { cls: "flashcard-content-area" });
        const cardContainer = contentArea.createEl("div", { cls: "flashcard-container" });

        if (this.emptyStateRenderer.render(cardContainer)) {
            return;
        }

        this.cardRenderer.render(cardContainer, this.getCurrentCard());
    }

    private applyResponsiveClasses(container: HTMLElement): void {
        if (!this.isMobileView) {
            return;
        }

        container.addClass('is-mobile');
        if (this.isSmallScreen) {
            container.addClass('is-small-screen');
        }

        container.addClass(this.showingSidebar ? 'show-sidebar' : 'show-content');
    }

    private renderProgress(container: HTMLElement): void {
        if (this.isMobileView && this.showingSidebar) {
            return;
        }

        const progressContainer = container.createEl("div", { cls: "flashcard-progress-container" });
        this.component.setProgressContainer(progressContainer);
        this.component.updateProgress();
    }

    private getCurrentCard(): FlashcardState | null {
        const cards = this.component.getCards();
        const currentIndex = this.component.getCurrentIndex();
        return cards.length > 0 && currentIndex < cards.length ? cards[currentIndex] : null;
    }
}
