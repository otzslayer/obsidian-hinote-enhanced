import { Notice } from "obsidian";
import { HighlightInfo } from "../../../types/highlight";

/**
 * 무한 스크롤 매니저
 * 담당:
 * 1. 하이라이트 일괄 로드 관리
 * 2. 무한 스크롤 기능 구현
 * 3. 화면이 채워질 때까지 자동 로드
 */
export class InfiniteScrollManager {
    private currentBatch: number = 0;
    private isLoading: boolean = false;
    private readonly BATCH_SIZE = 20;
    private observer: IntersectionObserver | null = null;
    private sentinel: HTMLElement | null = null;
    private loadingIndicator: HTMLElement | null = null;

    constructor(
        private highlightContainer: HTMLElement
    ) {}

    /**
     * 로딩 표시기 설정
     */
    setLoadingIndicator(indicator: HTMLElement): void {
        this.loadingIndicator = indicator;
    }

    /**
     * 배치 카운트 초기화
     */
    reset(): void {
        this.currentBatch = 0;
        this.isLoading = false;
        this.cleanup();
    }

    /**
     * 현재 배치 가져오기
     */
    getCurrentBatch(): number {
        return this.currentBatch;
    }

    /**
     * 현재 배치 설정
     */
    setCurrentBatch(batch: number): void {
        this.currentBatch = batch;
    }

    /**
     * 추가 하이라이트 로드
     * @param allHighlights 모든 하이라이트 데이터
     * @param renderCallback 렌더링 콜백 함수
     */
    async loadMoreHighlights(
        allHighlights: HighlightInfo[],
        renderCallback: (batch: HighlightInfo[], append: boolean) => Promise<void>
    ): Promise<void> {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();

        try {
            const start = this.currentBatch * this.BATCH_SIZE;
            const batch = allHighlights.slice(start, start + this.BATCH_SIZE);

            if (batch.length === 0) {
                this.hideLoading();
                if (this.loadingIndicator) {
                    this.loadingIndicator.remove();
                }
                return;
            }

            // 새 하이라이트 렌더링 (추가 모드)
            await renderCallback(batch, true);
            this.currentBatch++;
        } catch (error) {
            console.error('[InfiniteScrollManager] Error loading highlights:', error);
            new Notice("하이라이트 내용 로드 중 오류 발생");
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    /**
     * 컨테이너가 스크롤 가능해질 때까지 콘텐츠 로드
     * 콘텐츠가 한 화면을 채우지 못할 때 스크롤 로드가 트리거되지 않는 문제 해결
     */
    async loadUntilScrollable(
        allHighlights: HighlightInfo[],
        renderCallback: (batch: HighlightInfo[], append: boolean) => Promise<void>
    ): Promise<void> {
        const maxAttempts = 10; // 최대 10회 시도, 무한 루프 방지
        let attempts = 0;

        while (attempts < maxAttempts) {
            const { scrollHeight, clientHeight } = this.highlightContainer;

            // 스크롤 가능 여부 확인 (콘텐츠 높이 > 컨테이너 높이)
            if (scrollHeight > clientHeight) {
                break; // 이미 스크롤 가능, 종료
            }

            // 추가 콘텐츠 여부 확인
            const start = this.currentBatch * this.BATCH_SIZE;
            if (start >= allHighlights.length) {
                break; // 더 이상 콘텐츠 없음, 종료
            }

            // 다음 배치 로드
            await this.loadMoreHighlights(allHighlights, renderCallback);
            attempts++;

            // DOM 업데이트 대기
            await new Promise(resolve => window.setTimeout(resolve, 50));
        }
    }

    /**
     * 무한 스크롤 로드 설정
     * Intersection Observer를 사용한 고성능 무한 스크롤 구현
     */
    setupInfiniteScroll(
        allHighlights: HighlightInfo[],
        renderCallback: (batch: HighlightInfo[], append: boolean) => Promise<void>
    ): void {
        // 이전 옵저버 정리
        this.cleanup();

        // 센티넬 요소 생성
        this.sentinel = this.highlightContainer.createEl('div', {
            cls: 'scroll-sentinel'
        });
        this.sentinel.setCssProps({
            height: '1px',
            width: '100%'
        });

        // Intersection Observer로 센티넬 요소 감지
        this.observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && !this.isLoading) {
                    void this.loadMoreHighlights(allHighlights, renderCallback);
                }
            },
            {
                root: this.highlightContainer,
                rootMargin: '300px', // 300px 앞에서 로드 트리거
                threshold: 0
            }
        );

        this.observer.observe(this.sentinel);
    }

    /**
     * 로딩 표시기 표시
     */
    private showLoading(): void {
        if (this.loadingIndicator) {
            this.loadingIndicator.addClass('highlight-display-block');
            this.loadingIndicator.removeClass('highlight-display-none');
        }
    }

    /**
     * 로딩 표시기 숨김
     */
    private hideLoading(): void {
        if (this.loadingIndicator) {
            this.loadingIndicator.removeClass('highlight-display-block');
            this.loadingIndicator.addClass('highlight-display-none');
        }
    }

    /**
     * 리소스 정리
     */
    private cleanup(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        if (this.sentinel) {
            this.sentinel.remove();
            this.sentinel = null;
        }
    }

    /**
     * 무한 스크롤 매니저 소멸
     */
    destroy(): void {
        this.cleanup();
        this.loadingIndicator = null;
    }
}
