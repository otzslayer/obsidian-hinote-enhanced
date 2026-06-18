import { 
    FlashcardState, 
    FlashcardProgress, 
    FSRSStorage, 
    FSRSGlobalStats,
    FSRSRating,
    CardGroup,
    HiCardState,
    DailyStats
} from '../types/FSRSTypes';
import { FSRSService } from './FSRSService';
import { FlashcardFactory } from './FlashcardFactory';
import { CardGroupRepository } from './CardGroupRepository';
import { DailyStatsService } from './DailyStatsService';
import { FlashcardEventSyncService } from './FlashcardEventSyncService';
import { SourceCardService, FlashcardSourceType } from './SourceCardService';
import { FlashcardStorageService } from './FlashcardStorageService';
import { FlashcardStudyService } from './FlashcardStudyService';
import { FlashcardReviewService } from './FlashcardReviewService';
import { FlashcardCardService } from './FlashcardCardService';
import { FlashcardUIStateService } from './FlashcardUIStateService';
import { FlashcardGroupService } from './FlashcardGroupService';
import { debounce } from 'obsidian';
import { HiNoteDataManager } from '../../storage/HiNoteDataManager';
import type CommentPlugin from '../../../main';

export class FSRSManager {
    public fsrsService: FSRSService;
    private cardFactory: FlashcardFactory;
    private groupRepository: CardGroupRepository;
    private dailyStatsService: DailyStatsService;
    private eventSyncService: FlashcardEventSyncService;
    private sourceCardService: SourceCardService;
    private storageService: FlashcardStorageService;
    private studyService: FlashcardStudyService;
    private reviewService: FlashcardReviewService;
    private cardService: FlashcardCardService;
    private uiStateService: FlashcardUIStateService;
    private groupService: FlashcardGroupService;
    private storage: FSRSStorage;
    private plugin: CommentPlugin;

    constructor(plugin: CommentPlugin, dataManager?: HiNoteDataManager) {
        this.plugin = plugin;
        this.storageService = new FlashcardStorageService(plugin, dataManager);
        this.fsrsService = new FSRSService();
        this.cardFactory = new FlashcardFactory(
            () => this.storage,
            () => this.plugin.eventManager.emitFlashcardChanged(),
            this.fsrsService
        );
        this.dailyStatsService = new DailyStatsService({
            getDailyStats: () => this.storage.dailyStats,
            setDailyStats: (dailyStats: DailyStats[]) => {
                this.storage.dailyStats = dailyStats;
            },
            getGlobalStats: () => this.storage.globalStats,
            getCardGroups: () => this.storage.cardGroups,
            getParameters: () => this.fsrsService.getParameters(),
            saveDebounced: () => this.saveStorageDebounced()
        });
        this.sourceCardService = new SourceCardService({
            getStorage: () => this.storage,
            removeCardFromGroup: (cardId: string, groupId: string) => this.removeCardFromGroup(cardId, groupId),
            saveDebounced: () => this.saveStorageDebounced()
        });
        this.studyService = new FlashcardStudyService({
            getStorage: () => this.storage,
            getGroupRepository: () => this.groupRepository,
            getRemainingNewCardsToday: (groupId?: string) => this.getRemainingNewCardsToday(groupId),
            getRemainingReviewsToday: (groupId?: string) => this.getRemainingReviewsToday(groupId)
        });
        this.reviewService = new FlashcardReviewService({
            getStorage: () => this.storage,
            getFsrsService: () => this.fsrsService,
            getDailyStatsService: () => this.dailyStatsService,
            saveStorage: async () => await this.saveStorage(),
            emitFlashcardChanged: () => this.plugin.eventManager.emitFlashcardChanged()
        });
        this.cardService = new FlashcardCardService({
            getStorage: () => this.storage,
            getCardFactory: () => this.cardFactory,
            getGroupRepository: () => this.groupRepository,
            addCardToGroup: (cardId: string, groupId: string) => this.addCardToGroup(cardId, groupId),
            removeCardFromGroup: (cardId: string, groupId: string) => this.removeCardFromGroup(cardId, groupId),
            saveDebounced: () => this.saveStorageDebounced(),
            emitFlashcardChanged: () => this.plugin.eventManager.emitFlashcardChanged()
        });
        this.uiStateService = new FlashcardUIStateService({
            getStorage: () => this.storage,
            saveStorage: async () => await this.saveStorage(),
            saveDebounced: () => this.saveStorageDebounced()
        });
        this.groupService = new FlashcardGroupService({
            getStorage: () => this.storage,
            getGroupRepository: () => this.groupRepository,
            saveStorage: async () => await this.saveStorage(),
            saveDebounced: () => this.saveStorageDebounced()
        });
        this.eventSyncService = new FlashcardEventSyncService({
            plugin: this.plugin,
            findCardsBySourceId: (sourceId, sourceType) => this.sourceCardService.findCardsBySourceId(sourceId, sourceType),
            updateCardsBySourceId: (sourceId, sourceType, newText, newAnswer) => this.sourceCardService.updateCardsBySourceId(sourceId, sourceType, newText, newAnswer),
            deleteCardsBySourceId: (sourceId, sourceType) => this.sourceCardService.deleteCardsBySourceId(sourceId, sourceType),
            saveDebounced: () => this.saveStorageDebounced(),
            emitFlashcardChanged: () => this.plugin.eventManager.emitFlashcardChanged()
        });
        // 빈 객체로 초기화, 나중에 로드된 데이터로 교체됨
        this.storage = this.storageService.createDefaultStorage();

        // 변경사항 자동 저장
        this.saveStorageDebounced = debounce(this.saveStorage.bind(this), 1000, true);

        // 저장소 데이터 비동기 로드
        this.storageService.load().then(storage => {

            this.storage = storage;

            // 로드 완료 후 그룹 레포지토리 초기화
            this.groupRepository = this.createGroupRepository();

            // 이벤트 리스너 등록
            this.eventSyncService.registerEventListeners();
        }).catch(error => {
            console.error('Loading storage data failed:', error);

            // Even if it fails, initialize the group repository
            this.groupRepository = this.createGroupRepository();

            // 이벤트 리스너 등록
            this.eventSyncService.registerEventListeners();
        });
    }

    private createGroupRepository(): CardGroupRepository {
        return new CardGroupRepository({
            storage: this.storage,
            saveStorage: async () => await this.saveStorage(),
            saveStorageDebounced: () => this.saveStorageDebounced(),
            emitFlashcardChanged: () => this.plugin.eventManager.emitFlashcardChanged()
        });
    }

    private async saveStorage() {
        await this.storageService.save(this.storage);
    }

    private saveStorageDebounced: () => void;

    /**
     * 카드 추가
     * @param text 카드 앞면 텍스트
     * @param answer 카드 뒷면 텍스트
     * @param filePath 연결된 파일 경로
     * @param sourceId 출처 ID (하이라이트 또는 주석의 ID)
     * @param sourceType 출처 유형
     * @returns 추가된 카드
     */
    public addCard(text: string, answer: string, filePath?: string, sourceId?: string, sourceType?: 'highlight' | 'comment'): FlashcardState {
        return this.cardService.addCard(text, answer, filePath, sourceId, sourceType);
    }
    
    /**
     * 통합된 카드 학습 진입점, 지정된 그룹의 카드 가져오기
     * @param groupId 그룹 ID
     * @returns 그룹 내 카드 목록
     */
    public getCardsForStudy(groupId: string): FlashcardState[] {
        return this.studyService.getCardsForStudy(groupId);
    }
    
    /**
     * 통합된 학습 진도 추적 메서드
     * 학습 진도를 기록하는 유일한 진입점
     * @param cardId 카드 ID
     * @param rating 평가 점수
     * @returns 업데이트된 카드 상태
     */
    public trackStudyProgress(cardId: string, rating: FSRSRating): FlashcardState | null {
        return this.reviewService.trackStudyProgress(cardId, rating);
    }
    
    /**
     * 카드의 다양한 평가 점수에 따른 예측 결과 가져오기
     * @param cardId 카드 ID
     * @returns 각 평가 점수별 예측 결과, 카드가 없으면 null 반환
     */
    public getCardPredictions(cardId: string): Record<FSRSRating, FlashcardState> | null {
        return this.reviewService.getCardPredictions(cardId);
    }
    
    /**
     * 출처 ID로 카드 검색
     * @param sourceId 출처 ID (하이라이트 또는 주석의 ID)
     * @param sourceType 출처 유형
     * @returns 찾은 카드 목록
     */
    public findCardsBySourceId(sourceId: string, sourceType?: FlashcardSourceType): FlashcardState[] {
        return this.sourceCardService.findCardsBySourceId(sourceId, sourceType);
    }
    
    /**
     * 출처 ID로 카드 삭제
     * @param sourceId 출처 ID (하이라이트 또는 주석의 ID)
     * @param sourceType 출처 유형
     * @returns 삭제된 카드 수량
     */
    public deleteCardsBySourceId(sourceId: string, sourceType?: FlashcardSourceType): number {
        return this.sourceCardService.deleteCardsBySourceId(sourceId, sourceType);
    }
    
    /**
     * 출처 ID로 카드 내용 업데이트
     * @param sourceId 출처 ID
     * @param sourceType 출처 유형
     * @param newText 새 텍스트 내용
     * @param newAnswer 새 답변 내용
     * @returns 업데이트된 카드 수량
     */
    public updateCardsBySourceId(sourceId: string, sourceType: FlashcardSourceType, newText?: string, newAnswer?: string): number {
        return this.sourceCardService.updateCardsBySourceId(sourceId, sourceType, newText, newAnswer);
    }

    /**
     * 모든 카드의 총 수 가져오기 (커스텀 그룹 내 카드만 집계)
     * @returns 카드 총 수
     */
    public getTotalCardsCount(): number {
        return this.cardService.getTotalCardsCount();
    }

    public getProgress(): FlashcardProgress {
        return this.studyService.getProgress();
    }

    public getStats(): FSRSGlobalStats {
        return { ...this.storage.globalStats };
    }

    // UI 상태 관리
    public getUIState(): HiCardState {
        return this.uiStateService.getUIState();
    }

    public updateUIState(state: Partial<HiCardState>) {
        this.uiStateService.updateUIState(state);
    }

    /**
     * 카드 삭제
     * @param cardId 카드 ID
     * @returns 삭제 성공 여부
     */
    public deleteCard(cardId: string): boolean {
        return this.cardService.deleteCard(cardId);
    }

    /**
     * 파일 경로로 카드 가져오기
     * @param filePath 파일 경로
     * @returns 해당 파일의 카드 목록
     */
    public getCardsByFile(filePath: string): FlashcardState[] {
        return this.cardService.getCardsByFile(filePath);
    }

    /**
     * 플러그인 인스턴스 가져오기 (외부 접근용 공개 메서드)
     * @returns 플러그인 인스턴스
     */
    public getPlugin(): CommentPlugin {
        return this.plugin;
    }
    
    /**
     * 외부 호출용 공개 저장 메서드
     * @returns Promise<void>
     */
    public async saveStoragePublic(): Promise<void> {
        return this.saveStorage();
    }

    public async renameGroupUIState(oldName: string, newName: string): Promise<void> {
        await this.uiStateService.renameGroupUIState(oldName, newName);
    }

    /**
     * 오늘의 학습 통계 초기화.
     * @returns 오늘의 통계 데이터를 찾아 제거했으면 true 반환.
     */
    public async resetTodayStats(): Promise<boolean> {
        const reset = this.dailyStatsService.resetTodayStats();
        if (reset) {
            await this.saveStorage();
        }
        return reset;
    }

    public getDailyStats(): DailyStats[] {
        return this.dailyStatsService.getDailyStats();
    }

    /**
     * 오늘 새 카드를 더 학습할 수 있는지 확인
     * @param groupId 선택적 그룹 ID, 제공 시 그룹별 설정 사용
     */
    public canLearnNewCardsToday(groupId?: string): boolean {
        return this.dailyStatsService.canLearnNewCardsToday(groupId);
    }

    /**
     * 오늘 카드를 더 복습할 수 있는지 확인
     * @param groupId 선택적 그룹 ID, 제공 시 그룹별 설정 사용
     */
    public canReviewCardsToday(groupId?: string): boolean {
        return this.dailyStatsService.canReviewCardsToday(groupId);
    }

    /**
     * 오늘 남은 새 카드 학습 수량 가져오기
     * @param groupId 선택적 그룹 ID, 제공 시 그룹별 설정 사용
     */
    public getRemainingNewCardsToday(groupId?: string): number {
        return this.dailyStatsService.getRemainingNewCardsToday(groupId);
    }

    /**
     * 오늘 남은 복습 카드 수량 가져오기
     * @param groupId 선택적 그룹 ID, 제공 시 그룹별 설정 사용
     */
    public getRemainingReviewsToday(groupId?: string): number {
        return this.dailyStatsService.getRemainingReviewsToday(groupId);
    }
    /**
     * 새 그룹 생성
     * @param group 그룹 데이터 (ID 제외)
     * @returns 생성된 그룹
     */
    public async createCardGroup(group: Omit<CardGroup, 'id'>): Promise<CardGroup> {
        return this.groupService.createCardGroup(group);
    }
    
    /**
     * 그룹 업데이트
     * @param groupId 그룹 ID
     * @param updates 업데이트할 필드
     * @returns 업데이트 성공 여부
     */
    public async updateCardGroup(groupId: string, updates: Partial<Omit<CardGroup, 'id'>>): Promise<boolean> {
        return this.groupService.updateCardGroup(groupId, updates);
    }
    
    /**
     * 그룹 삭제
     * @param groupId 그룹 ID
     * @param deleteCards 그룹 내 카드도 함께 삭제 여부
     * @returns 삭제 성공 여부
     */
    public async deleteCardGroup(groupId: string, deleteCards = false): Promise<boolean> {
        return this.groupService.deleteCardGroup(groupId);
    }
    
    /**
     * 그룹의 모든 카드 가져오기 (필터 조건 기반)
     * @param group 그룹 객체
     * @returns 조건에 맞는 카드 목록
     */
    public getCardsInGroup(group: CardGroup): FlashcardState[] {
        return this.groupService.getCardsInGroup(group);
    }
    
    /**
     * 그룹에 카드 추가
     * @param cardId 카드 ID
     * @param groupId 그룹 ID
     * @returns 추가 성공 여부
     */
    public addCardToGroup(cardId: string, groupId: string): boolean {
        return this.groupService.addCardToGroup(cardId, groupId);
    }
    
    /**
     * 그룹에서 카드 제거
     * @param cardId 카드 ID
     * @param groupId 그룹 ID
     * @returns 제거 성공 여부
     */
    public removeCardFromGroup(cardId: string, groupId: string): boolean {
        return this.groupService.removeCardFromGroup(cardId, groupId);
    }
    
    /**
     * 그룹의 학습 진도 가져오기
     * @param groupId 그룹 ID
     * @returns 그룹의 학습 진도
     */
    public getGroupProgress(groupId: string): FlashcardProgress | null {
        return this.groupService.getGroupProgress(groupId);
    }
    
    /**
     * 그룹의 모든 카드 가져오기
     * @param groupId 그룹 ID
     * @returns 그룹 내 카드 목록
     */
    public getCardsByGroupId(groupId: string): FlashcardState[] {
        return this.groupService.getCardsByGroupId(groupId);
    }
    
    /**
     * 모든 카드 배열 가져오기
     * @returns 모든 카드의 배열
     */
    public getAllCards(): FlashcardState[] {
        return this.cardService.getAllCards();
    }
    
    /**
     * 모든 그룹 가져오기
     * @returns 전체 그룹 목록
     */
    public getCardGroups(): CardGroup[] {
        return this.groupService.getCardGroups();
    }
    /**
     * 모든 그룹의 유효하지 않은 카드 참조 정리
     * 이 메서드는 그룹에서 존재하지 않는 카드를 가리키는 참조를 제거
     */
    public cleanupInvalidCardReferences(): number {
        return this.groupService.cleanupInvalidCardReferences();
    }
}
