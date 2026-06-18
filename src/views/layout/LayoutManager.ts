import { Platform } from 'obsidian';

/**
 * 레이아웃 매니저
 * 뷰 레이아웃 업데이트 및 반응형 디자인 담당
 */
export class LayoutManager {
    private containerEl: HTMLElement;
    private fileListContainer: HTMLElement;
    private mainContentContainer: HTMLElement;
    private searchContainer: HTMLElement;

    // 콜백 함수
    private onCreateFloatingButton: (() => void) | null = null;
    private onRemoveFloatingButton: (() => void) | null = null;
    private onUpdateFileList: ((forceRefresh?: boolean) => Promise<void>) | null = null;
    
    // 상태
    private isDraggedToMainView: boolean = false;
    private isFlashcardMode: boolean = false;
    private isShowingFileList: boolean = true;
    private isMobileView: boolean = false;
    private isSmallScreen: boolean = false;
    
    constructor(
        containerEl: HTMLElement,
        fileListContainer: HTMLElement,
        mainContentContainer: HTMLElement,
        searchContainer: HTMLElement
    ) {
        this.containerEl = containerEl;
        this.fileListContainer = fileListContainer;
        this.mainContentContainer = mainContentContainer;
        this.searchContainer = searchContainer;
    }
    
    /**
     * 콜백 함수 설정
     */
    setCallbacks(callbacks: {
        onCreateFloatingButton?: () => void;
        onRemoveFloatingButton?: () => void;
        onUpdateFileList?: (forceRefresh?: boolean) => Promise<void>;
    }) {
        if (callbacks.onCreateFloatingButton) {
            this.onCreateFloatingButton = callbacks.onCreateFloatingButton;
        }
        if (callbacks.onRemoveFloatingButton) {
            this.onRemoveFloatingButton = callbacks.onRemoveFloatingButton;
        }
        if (callbacks.onUpdateFileList) {
            this.onUpdateFileList = callbacks.onUpdateFileList;
        }
    }
    
    /**
     * 상태 업데이트
     */
    updateState(state: {
        isDraggedToMainView?: boolean;
        isFlashcardMode?: boolean;
        isShowingFileList?: boolean;
        isMobileView?: boolean;
        isSmallScreen?: boolean;
    }) {
        if (state.isDraggedToMainView !== undefined) {
            this.isDraggedToMainView = state.isDraggedToMainView;
        }
        if (state.isFlashcardMode !== undefined) {
            this.isFlashcardMode = state.isFlashcardMode;
        }
        if (state.isShowingFileList !== undefined) {
            this.isShowingFileList = state.isShowingFileList;
        }
        if (state.isMobileView !== undefined) {
            this.isMobileView = state.isMobileView;
        }
        if (state.isSmallScreen !== undefined) {
            this.isSmallScreen = state.isSmallScreen;
        }
    }
    
    /**
     * 뷰 레이아웃 업데이트
     */
    async updateViewLayout(): Promise<void> {
        // 디바이스 유형 및 화면 크기 감지
        this.isMobileView = this.checkIfMobile();
        this.isSmallScreen = this.checkIfSmallScreen();

        // 먼저 모든 표시 관련 클래스 제거
        this.fileListContainer.removeClass('highlight-display-block');
        this.fileListContainer.removeClass('highlight-display-none');
        this.mainContentContainer.removeClass('highlight-display-none');

        // 메인 뷰 마커 클래스 추가 또는 제거
        const container = this.containerEl.children[1];
        if (this.isDraggedToMainView) {
            container.addClass('is-in-main-view');
        } else {
            container.removeClass('is-in-main-view');
        }

        // 소형 화면 마커 클래스 추가 또는 제거
        if (this.isSmallScreen) {
            container.addClass('is-small-screen');
        } else {
            container.removeClass('is-small-screen');
        }

        if (this.isDraggedToMainView) {
            // UI 차단 없이 레이아웃 즉시 적용
            if (this.isMobileView && this.isSmallScreen) {
                this.applySmallScreenLayout();
            } else if (this.isSmallScreen) {
                this.applyCompactLayout();
            } else {
                this.applyLargeScreenLayout();
            }

            // 플로팅 버튼 생성
            if (this.onCreateFloatingButton) {
                this.onCreateFloatingButton();
            }

            // UI 렌더링을 차단하지 않고 파일 목록 상태를 지연 동기화.
            // 메인 뷰에 드래그 시 강제 새로고침하지 않아 캐시 초기화 후 전체 라이브러리 하이라이트 스캔 방지.
            if (this.onUpdateFileList) {
                window.setTimeout(() => {
                    void this.onUpdateFileList?.();
                }, 50);
            }
        } else {
            // 사이드바 레이아웃
            this.applySidebarLayout();
        }
    }
    
    /**
     * 소형 화면 레이아웃 적용 (휴대폰)
     */
    private applySmallScreenLayout(): void {
        if (this.isShowingFileList) {
            // 파일 목록 표시, 콘텐츠 영역 숨김
            this.fileListContainer.addClass('highlight-display-block');
            this.mainContentContainer.addClass('highlight-display-none');
            this.fileListContainer.addClass('highlight-full-width');
        } else {
            // 콘텐츠 영역 표시, 파일 목록 숨김
            this.fileListContainer.addClass('highlight-display-none');
            this.mainContentContainer.removeClass('highlight-display-none');
            this.fileListContainer.removeClass('highlight-full-width');
        }
    }
    
    /**
     * 대형 화면 레이아웃 적용 (태블릿, 데스크톱)
     */
    private applyLargeScreenLayout(): void {
        // 파일 목록과 콘텐츠 동시 표시
        this.fileListContainer.addClass('highlight-display-block');
        this.mainContentContainer.removeClass('highlight-display-none');
        this.fileListContainer.removeClass('highlight-full-width');
    }

    /**
     * 좁은 창 레이아웃 적용 (데스크톱 Obsidian 창이 좁아졌을 때)
     */
    private applyCompactLayout(): void {
        this.fileListContainer.addClass('highlight-display-none');
        this.mainContentContainer.removeClass('highlight-display-none');
        this.fileListContainer.removeClass('highlight-full-width');
    }
    
    /**
     * 사이드바 레이아웃 적용
     */
    private applySidebarLayout(): void {
        // 파일 목록 숨김
        this.fileListContainer.addClass('highlight-display-none');

        // 플로팅 버튼 제거
        if (this.onRemoveFloatingButton) {
            this.onRemoveFloatingButton();
        }

        // 검색 컨테이너 표시 (플래시카드 모드가 아닌 경우)
        if (!this.isFlashcardMode) {
            this.searchContainer.removeClass('highlight-display-none');
            const iconButtons = this.searchContainer.querySelector('.highlight-search-icons') as HTMLElement;
            if (iconButtons) {
                iconButtons.removeClass('highlight-display-none');
            }
        }
    }
    
    /**
     * 모바일 디바이스 여부 감지
     */
    checkIfMobile(): boolean {
        return Platform.isMobile;
    }
    
    /**
     * 소형 화면 디바이스 여부 감지 (너비 768px 미만)
     */
    checkIfSmallScreen(): boolean {
        const containerWidth = this.containerEl.getBoundingClientRect().width;
        return (containerWidth || window.innerWidth) < 768;
    }
    
    /**
     * 현재 디바이스 정보 가져오기
     */
    getDeviceInfo(): {
        isMobile: boolean;
        isSmallScreen: boolean;
        isDraggedToMainView: boolean;
    } {
        return {
            isMobile: this.isMobileView,
            isSmallScreen: this.isSmallScreen,
            isDraggedToMainView: this.isDraggedToMainView
        };
    }
}
