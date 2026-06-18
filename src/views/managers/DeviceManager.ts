import { Platform } from 'obsidian';

/**
 * 디바이스 매니저
 * 담당:
 * 1. 디바이스 유형 감지 (모바일, 데스크톱)
 * 2. 화면 크기 감지
 * 3. 반응형 레이아웃 지원 제공
 * 4. 디바이스 관련 상태 통합 관리
 */
export class DeviceManager {
    private isMobileView: boolean = false;
    private isSmallScreen: boolean = false;
    private resizeObserver: ResizeObserver | null = null;
    private observedElement: HTMLElement | null = null;
    private onDeviceChangeCallback: ((deviceInfo: DeviceInfo) => void) | null = null;

    constructor() {
        this.updateDeviceInfo();
    }

    /**
     * 디바이스 변경 콜백 설정
     */
    setOnDeviceChange(callback: (deviceInfo: DeviceInfo) => void): void {
        this.onDeviceChangeCallback = callback;
    }

    /**
     * 화면 크기 변경 감지 시작
     */
    startWatching(element: HTMLElement): void {
        this.observedElement = element;
        this.updateDeviceInfo();

        // ResizeObserver로 요소 크기 변경 감지
        this.resizeObserver = new ResizeObserver(() => {
            const oldIsMobile = this.isMobileView;
            const oldIsSmallScreen = this.isSmallScreen;

            this.updateDeviceInfo();

            // 디바이스 정보가 변경된 경우 콜백 호출
            if (oldIsMobile !== this.isMobileView || oldIsSmallScreen !== this.isSmallScreen) {
                if (this.onDeviceChangeCallback) {
                    this.onDeviceChangeCallback(this.getDeviceInfo());
                }
            }
        });
        
        this.resizeObserver.observe(element);
    }

    /**
     * 감지 중지
     */
    stopWatching(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }

    /**
     * 디바이스 정보 업데이트
     */
    private updateDeviceInfo(): void {
        this.isMobileView = this.checkIfMobile();
        this.isSmallScreen = this.checkIfSmallScreen();
    }

    /**
     * 모바일 디바이스 여부 감지
     */
    private checkIfMobile(): boolean {
        return Platform.isMobile;
    }

    /**
     * 소형 화면 디바이스 여부 감지 (너비 768px 미만)
     */
    private checkIfSmallScreen(): boolean {
        const elementWidth = this.observedElement?.getBoundingClientRect().width;
        return (elementWidth || window.innerWidth) < 768;
    }

    /**
     * 현재 디바이스 정보 가져오기
     */
    getDeviceInfo(): DeviceInfo {
        return {
            isMobile: this.isMobileView,
            isSmallScreen: this.isSmallScreen,
            isDesktop: !this.isMobileView,
            isLargeScreen: !this.isSmallScreen
        };
    }

    /**
     * 모바일 디바이스 여부
     */
    isMobile(): boolean {
        return this.isMobileView;
    }

    /**
     * 소형 화면 여부
     */
    isSmall(): boolean {
        return this.isSmallScreen;
    }

    /**
     * 데스크톱 디바이스 여부
     */
    isDesktop(): boolean {
        return !this.isMobileView;
    }

    /**
     * 대형 화면 여부
     */
    isLarge(): boolean {
        return !this.isSmallScreen;
    }

    /**
     * 디바이스 매니저 소멸
     */
    destroy(): void {
        this.stopWatching();
        this.observedElement = null;
        this.onDeviceChangeCallback = null;
    }
}

/**
 * 디바이스 정보 인터페이스
 */
export interface DeviceInfo {
    isMobile: boolean;
    isSmallScreen: boolean;
    isDesktop: boolean;
    isLargeScreen: boolean;
}
