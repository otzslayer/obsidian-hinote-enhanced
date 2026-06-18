import { App, Component } from "obsidian";
import { LicenseManager } from "../../services/LicenseManager";
import { FSRSManager } from "../services/FSRSManager";
import { 
    FlashcardState, 
    FSRS_RATING, 
    FSRSRating, 
    GroupProgressState
} from "../types/FSRSTypes";
import { t } from "../../i18n";

import { FlashcardRenderer } from "./FlashcardRenderer";
import {
    FlashcardOperations,
    FlashcardGroupManager,
    FlashcardProgressManager,
    FlashcardUtils
} from "./controllers";
import type CommentPlugin from "../../../main";
import type { FlashcardRatingButton } from "./FlashcardComponentContext";
import {
    findGroupIdByName,
    findGroupNameById,
    getGroupCompletionMessage,
    loadFlashcardUIState,
    saveFlashcardUIState,
    setGroupCompletionMessage
} from "./FlashcardUIState";

/**
 * 플래시카드 컴포넌트, 모든 플래시카드 관련 기능 통합
 */
export class FlashcardComponent extends Component {
    // 핵심 속성
    private progressContainer: HTMLElement | null = null;
    private container: HTMLElement;
    private currentIndex: number = 0;
    private isFlipped: boolean = false;
    private cards: FlashcardState[] = [];
    private isActive: boolean = false;
    private licenseManager: LicenseManager;
    private fsrsManager: FSRSManager;
    private currentGroupName: string = '';
    private currentGroupId: string = '';
    private app: App;
    private plugin: CommentPlugin;
    private completionMessage: string | null = null;
    
    // 각 그룹의 학습 진도 및 완료 상태 저장
    private groupProgress: Record<string, GroupProgressState> = {};

    // 평가 버튼 설정
    private readonly ratingButtons: FlashcardRatingButton[] = [
        { label: t('Again'), rating: FSRS_RATING.AGAIN, key: '1', ratingText: 'again' },
        { label: t('Hard'), rating: FSRS_RATING.HARD, key: '2', ratingText: 'hard' },
        { label: t('Good'), rating: FSRS_RATING.GOOD, key: '3', ratingText: 'good' },
        { label: t('Easy'), rating: FSRS_RATING.EASY, key: '4', ratingText: 'easy' }
    ];
    
    // 하위 컴포넌트
    public renderer: FlashcardRenderer;
    public operations: FlashcardOperations;
    public groupManager: FlashcardGroupManager;
    public progressManager: FlashcardProgressManager;
    public utils: FlashcardUtils;

    constructor(container: HTMLElement, plugin: CommentPlugin) {
        super();
        this.container = container;
        this.plugin = plugin;
        this.app = plugin.app;
        this.fsrsManager = plugin.fsrsManager;
        
        // 하위 컴포넌트 초기화
        this.renderer = new FlashcardRenderer(this);
        this.operations = new FlashcardOperations(this);
        this.groupManager = new FlashcardGroupManager(this);
        this.progressManager = new FlashcardProgressManager(this);
        this.utils = new FlashcardUtils(this);
        
        const uiState = loadFlashcardUIState(this.fsrsManager);
        this.currentGroupName = uiState.currentGroupName;
        this.currentGroupId = uiState.currentGroupId;
        this.currentIndex = uiState.currentIndex;
        this.isFlipped = uiState.isFlipped;
        this.completionMessage = uiState.completionMessage;
        this.groupProgress = uiState.groupProgress;
    }
    
    /**
     * 라이선스 매니저 설정
     * @param licenseManager 라이선스 매니저
     */
    public setLicenseManager(licenseManager: LicenseManager) {
        this.licenseManager = licenseManager;
    }
    
    /**
     * 카드 목록 설정
     * @param highlights 하이라이트 목록
     */
    public setCards(cards: FlashcardState[]) {
        // 카드 목록 직접 설정, 플래시카드 자동 생성 없음
        this.cards = cards;
    }
    
    /**
     * 컴포넌트 정리
     */
    public cleanup() {
        // 키보드 이벤트 리스너 제거됨
    }
    
    /**
     * 컴포넌트 활성화
     */
    public async activate() {
        this.isActive = true;

        // 라이선스 상태 확인
        if (this.licenseManager) {
            const isActivated = await this.licenseManager.isActivated();
            const isFeatureEnabled = isActivated ? await this.licenseManager.isFeatureEnabled('flashcard') : false;

            if (isActivated && isFeatureEnabled) {
                // 활성화되고 플래시카드 기능이 활성화된 경우 카드 목록 새로고침
                this.operations.refreshCardList();

                // 기능 화면 렌더링
                this.renderer.render();
                return;
            }
        }

        // 비활성화 또는 플래시카드 기능 미활성화, 활성화 화면 표시
        this.renderer.renderActivation();
    }
    
    /**
     * 활성화 화면 렌더링
     */
    public renderActivation() {
        this.renderer.renderActivation();
    }
    
    /**
     * 컴포넌트 비활성화
     */
    public deactivate() {
        this.isActive = false;
        this.container.empty();
        this.container.removeClass('flashcard-mode');
        // 키보드 이벤트 리스너 제거됨
    }
    
    /**
     * 컴포넌트 소멸
     */
    public destroy() {
        // 키보드 이벤트 리스너 제거됨
        this.container.removeClass('flashcard-mode');
        this.container.empty();
    }
    
    // Getter/Setter 메서드
    
    public getContainer(): HTMLElement {
        return this.container;
    }

    public getPlugin(): CommentPlugin {
        return this.plugin;
    }
    
    public getIsActive(): boolean {
        return this.isActive;
    }
    
    public getApp(): App {
        return this.app;
    }
    
    public getFsrsManager(): FSRSManager {
        return this.fsrsManager;
    }
    
    public getLicenseManager(): LicenseManager {
        return this.licenseManager;
    }
    
    public getCards(): FlashcardState[] {
        return this.cards;
    }
    
    public getCurrentIndex(): number {
        return this.currentIndex;
    }
    
    public setCurrentIndex(index: number) {
        this.currentIndex = index;
    }
    
    public isCardFlipped(): boolean {
        return this.isFlipped;
    }
    
    public setCardFlipped(flipped: boolean) {
        this.isFlipped = flipped;
    }
    
    public getCurrentGroupName(): string {
        return this.currentGroupName;
    }
    
    public setCurrentGroupName(groupName: string) {
        this.currentGroupName = groupName;
        this.currentGroupId = findGroupIdByName(this.fsrsManager, groupName);
    }
    
    public getCurrentGroupId(): string {
        return this.currentGroupId;
    }
    
    public setCurrentGroupId(groupId: string) {
        this.currentGroupId = groupId;
        this.currentGroupName = findGroupNameById(this.fsrsManager, groupId);
    }
    
    /**
     * 전역 완료 메시지 가져오기
     * @returns 완료 메시지 또는 null
     */
    public getCompletionMessage(): string | null {
        return this.completionMessage;
    }
    
    /**
     * 전역 완료 메시지 설정
     * @param message 완료 메시지 또는 null
     */
    public setCompletionMessage(message: string | null) {
        this.completionMessage = message;
    }
    
    /**
     * 지정된 그룹의 완료 메시지 가져오기
     * @param groupName 그룹 이름
     * @returns 완료 메시지 또는 null
     */
    public getGroupCompletionMessage(groupName: string): string | null {
        return getGroupCompletionMessage(this.groupProgress, groupName);
    }
    
    /**
     * 지정된 그룹의 완료 메시지 설정
     * @param groupName 그룹 이름
     * @param message 완료 메시지 또는 null
     */
    public setGroupCompletionMessage(groupName: string, message: string | null) {
        setGroupCompletionMessage(this.fsrsManager, this.groupProgress, groupName, message);
    }
    
    public getGroupProgress(groupName?: string): GroupProgressState | null {
        const name = groupName || this.currentGroupName;
        return this.groupProgress[name] || null;
    }
    
    public isComponentActive(): boolean {
        return this.isActive;
    }
    
    public getProgressContainer(): HTMLElement | null {
        return this.progressContainer;
    }
    
    public setProgressContainer(container: HTMLElement) {
        this.progressContainer = container;
    }
    
    // 키보드 단축키 관련 메서드 제거됨
    
    public getRatingButtons() {
        return this.ratingButtons;
    }
    
    // 프록시 메서드, 호출 단순화용
    
    public flipCard() {
        this.operations.flipCard();
    }
    
    public nextCard() {
        this.operations.nextCard();
    }
    
    public rateCard(rating: FSRSRating) {
        this.operations.rateCard(rating);
    }
    
    public refreshCardList() {
        this.operations.refreshCardList();
    }
    
    // 키보드 단축키 설정 메서드 제거됨

    /**
     * 현재 상태 저장
     * 최적화 버전: 컴포넌트 내에서 직접 상태 저장 처리, 모든 상태가 올바르게 저장되도록 보장
     */
    public saveState() {
        saveFlashcardUIState(this.fsrsManager, {
            currentGroupName: this.currentGroupName,
            completionMessage: this.completionMessage,
            cards: this.cards,
            currentIndex: this.currentIndex,
            isFlipped: this.isFlipped,
            groupProgress: this.groupProgress
        });
    }
    
    public updateProgress() {
        this.progressManager.updateProgress();
    }
    
    public getRenderer(): FlashcardRenderer {
        return this.renderer;
    }
    
    public getOperations(): FlashcardOperations {
        return this.operations;
    }
    
    public getGroupManager(): FlashcardGroupManager {
        return this.groupManager;
    }
    
    public getProgressManager(): FlashcardProgressManager {
        return this.progressManager;
    }
    
    public getUtils(): FlashcardUtils {
        return this.utils;
    }
}
