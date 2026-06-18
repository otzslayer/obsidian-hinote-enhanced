import { CardGroup, FlashcardState, FlashcardProgress, FSRSStorage } from '../types/FSRSTypes';
import { IdGenerator } from '../../utils/IdGenerator';
import { CardGroupFilterMatcher } from './CardGroupFilterMatcher';

interface CardGroupRepositoryOptions {
    storage: FSRSStorage;
    saveStorage: () => Promise<void>;
    saveStorageDebounced: () => void;
    emitFlashcardChanged: () => void;
}

interface LegacyHiCardState {
    currentGroupId?: string;
    currentGroupName: string;
    currentIndex?: number;
    isFlipped?: boolean;
    completionMessage?: string | null;
    groupCompletionMessages?: Record<string, string | null>;
    groupProgress?: FSRSStorage['uiState']['groupProgress'];
}

/**
 * 플래시카드 그룹 레포지토리 클래스, 플래시카드 그룹 데이터 관리 담당
 */
export class CardGroupRepository {
    private storage: FSRSStorage;
    
    constructor(private options: CardGroupRepositoryOptions) {
        this.storage = options.storage;
    }
    
    /**
     * 모든 그룹 가져오기
     * @returns 전체 그룹 목록
     */
    public getCardGroups(): CardGroup[] {
        return this.storage.cardGroups || [];
    }
    
    /**
     * ID로 그룹 가져오기
     * @param groupId 그룹 ID
     * @returns 찾은 그룹 또는 null
     */
    public getGroupById(groupId: string): CardGroup | null {
        return this.storage.cardGroups.find((g: CardGroup) => g.id === groupId) || null;
    }
    
    /**
     * 새 그룹 생성
     * @param group 그룹 데이터 (ID 제외)
     * @returns 생성된 그룹
     */
    public async createCardGroup(group: Omit<CardGroup, 'id'>): Promise<CardGroup> {

        // cardGroups 배열 초기화 확인
        if (!Array.isArray(this.storage.cardGroups)) {
            this.storage.cardGroups = [];
        }

        // 고유 ID 생성
        const id = IdGenerator.generateGroupId();

        // 새 그룹 생성
        const newGroup: CardGroup = {
            id,
            name: group.name,
            filter: group.filter,
            createdTime: group.createdTime || Date.now(),
            sortOrder: group.sortOrder || this.storage.cardGroups.length,
            isReversed: group.isReversed || false,
            settings: group.settings || {
                useGlobalSettings: true
            },
            cardIds: []
        };
        
        // 저장소에 추가
        this.storage.cardGroups.push(newGroup);

        // 필터 조건이 있으면 해당하는 카드 자동 추가
        if (group.filter && group.filter.trim().length > 0) {
            this.updateGroupCardIds(newGroup.id);
        }

        // 직접 한 번 저장하여 그룹 데이터 보장
        try {
            await this.options.saveStorage();
        } catch (error) {
            console.error('그룹 데이터 저장 중 오류:', error);
        }

        // 이벤트 발생
        this.options.emitFlashcardChanged();
        
        return newGroup;
    }
    
    /**
     * 그룹 업데이트
     * @param groupId 그룹 ID
     * @param updates 업데이트할 필드
     * @returns 업데이트 성공 여부
     */
    public async updateCardGroup(groupId: string, updates: Partial<CardGroup>): Promise<boolean> {

        const index = this.storage.cardGroups.findIndex((g: CardGroup) => g.id === groupId);
        if (index === -1) {
            return false;
        }

        // 그룹 업데이트
        this.storage.cardGroups[index] = {
            ...this.storage.cardGroups[index],
            ...updates
            // lastUpdated 필드 제거 (FlashcardState 타입에 없는 필드)
        };

        // 필터 조건이 업데이트된 경우 카드 목록 자동 업데이트
        if (updates.filter) {
            this.updateGroupCardIds(groupId);
        }

        // 이벤트 발생
        this.options.emitFlashcardChanged();
        
        return true;
    }
    
    /**
     * 그룹 삭제
     * @param groupId 그룹 ID
     * @param deleteCards 그룹 내 카드도 함께 삭제 여부
     * @returns 삭제 성공 여부
     */
    public async deleteCardGroup(groupId: string, deleteCards = false): Promise<boolean> {
        const index = this.storage.cardGroups.findIndex((g: CardGroup) => g.id === groupId);
        if (index === -1) return false;

        // 삭제된 그룹 저장 (오류 시 복원용)
        const deletedGroup = this.storage.cardGroups[index];

        // 현재 UI 상태가 해당 그룹을 사용 중이면 UI 상태 초기화
        const uiState = this.storage.uiState as LegacyHiCardState;

        // UI 상태의 그룹 정보 초기화
        if (uiState.currentGroupId === groupId) {
            uiState.currentGroupId = '';
            uiState.currentGroupName = ''; // 하위 호환성 유지
            uiState.currentIndex = 0;
            uiState.isFlipped = false;
            uiState.completionMessage = null;
        }

        // 그룹 완료 메시지 초기화
        if (uiState.groupCompletionMessages && groupId in uiState.groupCompletionMessages) {
            delete uiState.groupCompletionMessages[groupId];
        }

        // 그룹 학습 진도 초기화 (groupId를 키로 사용)
        if (uiState.groupProgress && groupId in uiState.groupProgress) {
            delete uiState.groupProgress[groupId];
        }

        // 해당 그룹의 모든 카드 가져오기
        const cardsInGroup = [...(deletedGroup.cardIds || [])];

        // 카드와 그룹의 연결만 해제, 카드 삭제 없음
        for (const cardId of cardsInGroup) {
            this.removeCardFromGroup(cardId, groupId);
        }

        // 그룹 삭제
        this.storage.cardGroups.splice(index, 1);

        // 이벤트 발생
        this.options.emitFlashcardChanged();
        
        return true;
    }
    
    /**
     * 그룹에 카드 추가
     * @param cardId 카드 ID
     * @param groupId 그룹 ID
     * @returns 추가 성공 여부
     */
    public addCardToGroup(cardId: string, groupId: string): boolean {
        // 그룹 검색
        const group = this.storage.cardGroups.find((g: CardGroup) => g.id === groupId);
        if (!group) return false;

        // 카드 검색
        const card = this.storage.cards[cardId];
        if (!card) return false;

        // 그룹에 cardIds 배열 확인
        if (!group.cardIds) {
            group.cardIds = [];
        }

        // 카드에 groupIds 배열 확인
        if (!card.groupIds) {
            card.groupIds = [];
        }

        // 카드가 이미 그룹에 있으면 성공 반환
        if (group.cardIds.includes(cardId)) {
            return true;
        }

        // 그룹에 카드 추가
        group.cardIds.push(cardId);

        // 카드의 그룹 목록에 그룹 추가
        if (!card.groupIds.includes(groupId)) {
            card.groupIds.push(groupId);
        }

        return true;
    }

    /**
     * 그룹에서 카드 제거
     * @param cardId 카드 ID
     * @param groupId 그룹 ID
     * @returns 제거 성공 여부
     */
    public removeCardFromGroup(cardId: string, groupId: string): boolean {
        // 그룹 검색
        const group = this.storage.cardGroups.find((g: CardGroup) => g.id === groupId);
        if (!group || !group.cardIds) return false;

        // 카드 검색
        const card = this.storage.cards[cardId];
        if (!card) return false;

        // 그룹에서 카드 제거
        group.cardIds = group.cardIds.filter((id: string) => id !== cardId);

        // 카드의 그룹 목록에서 그룹 제거
        if (card.groupIds) {
            card.groupIds = card.groupIds.filter((id: string) => id !== groupId);
        }

        return true;
    }

    public cleanupInvalidCardReferences(): number {
        let cleanedCount = 0;

        if (!this.storage.cardGroups) {
            return cleanedCount;
        }

        for (const group of this.storage.cardGroups) {
            if (!group.cardIds || group.cardIds.length === 0) {
                continue;
            }

            const originalLength = group.cardIds.length;
            group.cardIds = group.cardIds.filter((cardId: string) => Boolean(this.storage.cards?.[cardId]));

            const removedCount = originalLength - group.cardIds.length;
            if (removedCount > 0) {
                cleanedCount += removedCount;
                group.lastUpdated = Date.now();
            }
        }

        if (cleanedCount > 0) {
            this.options.saveStorageDebounced();
        }

        return cleanedCount;
    }
    
    /**
     * 그룹의 모든 카드 가져오기
     * @param groupId 그룹 ID
     * @returns 그룹 내 카드 목록
     */
    public getCardsByGroupId(groupId: string): FlashcardState[] {

        const group = this.getGroupById(groupId);
        if (!group) {
            console.error(`[getCardsByGroupId] 오류: 그룹을 찾을 수 없음: ${groupId}`);
            return [];
        }

        // 그룹에 cardIds 배열이 있으면 해당 카드 직접 반환
        if (group.cardIds && group.cardIds.length > 0) {

            const filteredCards = group.cardIds
                .filter((id: string) => {
                    const exists = !!this.storage.cards[id];
                    if (!exists) {
                        console.warn(`[getCardsByGroupId] 카드 없음: ${id}`);
                    }
                    return exists;
                })
                .map((id: string) => this.storage.cards[id]);

            return filteredCards;
        }

        // 카드 ID는 없지만 필터 조건이 있으면 필터 조건으로 카드 가져오기
        if (group.filter && group.filter.trim().length > 0) {
            const allCards = Object.values(this.storage.cards);
            return allCards.filter((card: FlashcardState) => this.matchesGroupFilter(card, group.filter));
        }

        return [];
    }

    /**
     * 그룹의 학습 진도 가져오기
     * @param groupId 그룹 ID
     * @returns 그룹의 학습 진도
     */
    public getGroupProgress(groupId: string): FlashcardProgress | null {
        const group = this.getGroupById(groupId);
        if (!group) return null;
        
        const cards = this.getCardsByGroupId(groupId);
        const now = Date.now();
        
        return {
            due: cards.filter((c: FlashcardState) => c.nextReview <= now).length,
            newCards: cards.filter((c: FlashcardState) => c.lastReview === 0).length,
            learned: cards.filter((c: FlashcardState) => c.lastReview > 0).length,
            retention: this.calculateGroupRetention(cards)
        };
    }
    
    /**
     * 그룹의 기억 유지율 계산
     * @private
     */
    private calculateGroupRetention(cards: FlashcardState[]): number {
        const reviewedCards = cards.filter((c: FlashcardState) => c.lastReview > 0);
        if (reviewedCards.length === 0) return 1;
        
        const totalRetention = reviewedCards.reduce((sum: number, card: FlashcardState) => sum + card.retrievability, 0);
        return totalRetention / reviewedCards.length;
    }
    
    /**
     * 카드가 속한 그룹 가져오기
     * @param cardId 카드 ID
     * @returns 카드가 속한 그룹 목록
     */
    public getGroupsByCardId(cardId: string): CardGroup[] {
        const card = this.storage.cards[cardId];
        if (!card || !card.groupIds) return [];
        
        return card.groupIds
            .map((id: string) => this.storage.cardGroups.find((g: CardGroup) => g.id === id))
            .filter((group): group is CardGroup => group !== undefined);
    }
    
    /**
     * 그룹의 카드 목록 업데이트, 필터 조건에 맞는 카드 자동 추가
     * @param groupId 그룹 ID
     * @returns 업데이트 성공 여부
     */
    public updateGroupCardIds(groupId: string): boolean {
        const group = this.getGroupById(groupId);
        if (!group || !group.filter || group.filter.trim().length === 0) {
            return false;
        }

        const allCards = Object.values(this.storage.cards || {});
        const matchedCards = allCards.filter((card: FlashcardState) => this.matchesGroupFilter(card, group.filter));

        // 매칭된 카드의 ID 목록 가져오기
        const matchedCardIds = matchedCards.map(card => card.id);

        // 그룹의 cardIds 배열 업데이트
        if (!group.cardIds) {
            group.cardIds = [];
        }

        // 조건에 맞는 카드 ID를 그룹에 추가
        let updated = false;
        for (const cardId of matchedCardIds) {
            if (!group.cardIds.includes(cardId)) {
                group.cardIds.push(cardId);
                updated = true;
            }
        }

        if (updated) {
            // 저장 트리거
            this.options.saveStorageDebounced();
        }

        return updated;
    }

    private matchesGroupFilter(card: FlashcardState, filter: string): boolean {
        return CardGroupFilterMatcher.matches(card, filter);
    }
}
