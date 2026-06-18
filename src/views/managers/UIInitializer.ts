import { setIcon } from "obsidian";
import { t } from "../../i18n";

/**
 * UI 요소 참조 인터페이스
 */
export interface UIElements {
    mainContainer: HTMLElement;
    fileListContainer: HTMLElement;
    mainContentContainer: HTMLElement;
    backButtonContainer: HTMLElement;
    backButton: HTMLElement;
    searchContainer: HTMLElement;
    searchInput: HTMLInputElement;
    searchLoadingIndicator: HTMLElement;
    iconButtonsContainer: HTMLElement;
    highlightContainer: HTMLElement;
    loadingIndicator: HTMLElement;
}

/**
 * UI 초기화 매니저
 * 담당:
 * 1. 모든 UI 요소 생성
 * 2. 아이콘 및 스타일 설정
 * 3. 다른 모듈이 사용할 UI 요소 참조 반환
 */
export class UIInitializer {
    /**
     * 모든 UI 요소 초기화
     * @param container 루트 컨테이너
     * @returns UI 요소 참조
     */
    initializeUI(container: HTMLElement): UIElements {
        // 컨테이너 비우고 클래스 추가
        container.empty();
        container.addClass("comment-view-container");
        container.addClass("hinote-view-container");

        // 메인 컨테이너 생성
        const mainContainer = container.createEl("div", {
            cls: "highlight-main-container"
        });

        // 파일 목록 영역 생성 (메인 뷰에서만 표시)
        const fileListContainer = mainContainer.createEl("div", {
            cls: "highlight-file-list-container"
        });

        // 우측 콘텐츠 영역 생성
        const mainContentContainer = mainContainer.createEl("div", {
            cls: "highlight-content-container"
        });

        // 뒤로가기 버튼 생성 (모바일에서만 표시)
        const { backButtonContainer, backButton } = this.createBackButton(mainContentContainer);

        // 검색 영역 생성
        const searchContainer = mainContentContainer.createEl("div", {
            cls: "highlight-search-container"
        });

        // 검색 입력창 생성
        const searchInput = this.createSearchInput(searchContainer);

        // 검색 로딩 표시기 생성
        const searchLoadingIndicator = this.createSearchLoadingIndicator(searchContainer);

        // 아이콘 버튼 컨테이너 생성
        const iconButtonsContainer = searchContainer.createEl("div", {
            cls: "highlight-search-icons"
        });

        // 하이라이트 컨테이너 생성
        const highlightContainer = mainContentContainer.createEl("div", {
            cls: "highlight-container"
        });

        // 로딩 표시기 생성
        const loadingIndicator = this.createLoadingIndicator();

        return {
            mainContainer,
            fileListContainer,
            mainContentContainer,
            backButtonContainer,
            backButton,
            searchContainer,
            searchInput,
            searchLoadingIndicator,
            iconButtonsContainer,
            highlightContainer,
            loadingIndicator
        };
    }

    /**
     * 뒤로가기 버튼 생성
     */
    private createBackButton(parent: HTMLElement): { backButtonContainer: HTMLElement; backButton: HTMLElement } {
        const backButtonContainer = parent.createEl("div", {
            cls: "highlight-back-button-container"
        });

        const backButton = backButtonContainer.createEl("div", {
            cls: "highlight-back-button"
        });

        setIcon(backButton, "arrow-left");
        backButton.createEl("span", {
            text: t("BACK"),
            cls: "highlight-back-button-text"
        });

        return { backButtonContainer, backButton };
    }

    /**
     * 검색 입력창 생성
     */
    private createSearchInput(parent: HTMLElement): HTMLInputElement {
        const searchInput = parent.createEl("input", {
            cls: "highlight-search-input",
            attr: {
                type: "text",
                placeholder: t("Search..."),
            }
        });

        // 포커스 및 블러 이벤트 추가
        searchInput.addEventListener('focus', () => {
            parent.addClass('focused');
        });

        searchInput.addEventListener('blur', () => {
            parent.removeClass('focused');
        });

        return searchInput;
    }

    /**
     * 검색 로딩 표시기 생성
     */
    private createSearchLoadingIndicator(parent: HTMLElement): HTMLElement {
        const indicator = parent.createEl("div", {
            cls: "highlight-search-loading"
        });

        const icon = indicator.createSpan({ cls: "loading-spinner" });
        setIcon(icon, "loader-circle");
        indicator.addClass("highlight-display-none");

        return indicator;
    }

    /**
     * 로딩 표시기 생성
     */
    private createLoadingIndicator(): HTMLElement {
        const loadingIndicator = createEl("div", {
            cls: "highlight-loading-indicator",
            text: t("Loading...")
        });
        loadingIndicator.addClass('highlight-display-none');

        return loadingIndicator;
    }

}
