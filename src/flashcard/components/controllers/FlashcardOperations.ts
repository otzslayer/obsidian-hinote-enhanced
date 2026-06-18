import { FSRSRating } from "../../types/FSRSTypes";
import type { FlashcardComponentContext } from "../FlashcardComponentContext";
import {
    clearGroupCompletionMessage,
    findGroupByName,
    getCompletionMessage,
    getDueCardsForToday,
    resetGroupProgressForCompletion,
    restoreReviewPosition
} from "./FlashcardReviewQueue";

/**
 * 플래시카드 작업 클래스, 카드 뒤집기, 평가 등의 작업 처리 담당
 */
export class FlashcardOperations {
    private component: FlashcardComponentContext;
    
    constructor(component: FlashcardComponentContext) {
        this.component = component;
    }
    
    /**
     * 카드 뒤집기
     */
    public flipCard(): void {
        const flipped = !this.component.isCardFlipped();
        this.component.setCardFlipped(flipped);

        // 카드의 CSS 클래스만 전환하면 됨, 모든 스타일 및 애니메이션은 CSS에서 처리
        const cardElement = activeDocument.querySelector('.flashcard');
        if (cardElement) {
            if (flipped) {
                cardElement.classList.add('is-flipped');
            } else {
                cardElement.classList.remove('is-flipped');
            }
        }
        
        this.component.saveState();
    }
    
    /**
     * 다음 카드
     */
    public nextCard(): void {
        const cards = this.component.getCards();
        if (cards.length === 0) return;
        
        let nextIndex = this.component.getCurrentIndex() + 1;
        if (nextIndex >= cards.length) {
            nextIndex = 0;
        }
        
        this.component.setCurrentIndex(nextIndex);
        this.component.setCardFlipped(false);
        this.component.saveState();
        this.component.getRenderer().render();
    }
    
    /**
     * 카드 평가
     * @param rating 평가 점수
     */
    public rateCard(rating: FSRSRating): void {
        const cards = this.component.getCards();
        const currentIndex = this.component.getCurrentIndex();

        if (cards.length === 0 || currentIndex >= cards.length) {
            return;
        }

        const currentCard = cards[currentIndex];
        if (!currentCard) return;

        // FSRS 매니저로 평가, 통합된 학습 진도 추적 메서드 사용
        this.component.getFsrsManager().trackStudyProgress(currentCard.id, rating);

        // 현재 카드 제거
        cards.splice(currentIndex, 1);

        // 카드가 더 없으면 완료 메시지 표시
        if (cards.length === 0) {
            // 현재 그룹 확인
            const groupName = this.component.getCurrentGroupName();
            const message = getCompletionMessage(this.component.getFsrsManager(), groupName);

            // 그룹 완료 메시지 설정
            this.component.setGroupCompletionMessage(groupName, message);

            // 진도 업데이트
            this.component.updateProgress();

            // 다시 렌더링
            this.component.getRenderer().render();

            // 화면에 완료 메시지가 이미 표시되므로 알림 더 이상 표시 안 함

            return;
        }

        // 현재 인덱스 조정
        if (currentIndex >= cards.length) {
            this.component.setCurrentIndex(0);
        }

        // 뒤집기 상태 초기화
        this.component.setCardFlipped(false);

        // 상태 저장
        this.component.saveState();

        // 진도 업데이트
        this.component.updateProgress();

        // 다시 렌더링
        this.component.getRenderer().render();
    }
    
    /**
     * 현재 카드 목록 새로고침, 일일 학습 제한 고려
     * 참고: 이 메서드는 기존 카드에서만 데이터를 가져오며 새 카드를 자동으로 생성하지 않음
     */
    public refreshCardList(): void {
        // 현재 그룹 가져오기
        const groupName = this.component.getCurrentGroupName();
        const fsrsManager = this.component.getFsrsManager();

        // 그룹 ID 가져오기
        const group = findGroupByName(fsrsManager, groupName);
        if (!group) {
            console.error(`이름이 ${groupName}인 그룹을 찾을 수 없음`);
            return;
        }

        // 그룹에 오늘 학습할 카드가 있는지 확인
        const allCards = fsrsManager.getCardsByGroupId(group.id);
        const cardsForToday = getDueCardsForToday(allCards, fsrsManager);

        // 오늘 학습할 카드가 없으면 완료 메시지 표시
        if (cardsForToday.length === 0) {
            const message = getCompletionMessage(fsrsManager, groupName);
            this.component.setGroupCompletionMessage(groupName, message);
            this.component.setCards([]);
            this.component.updateProgress();
            resetGroupProgressForCompletion(fsrsManager, groupName, message);
            this.component.getRenderer().render();

            // 상태 저장
            this.component.saveState();
            return;
        }

        // 오늘 학습할 카드로 바로 사용
        const cards = cardsForToday;

        // 저장된 UI 상태 가져오기 (카드 목록 설정 전)
        const savedProgress = this.component.getGroupProgress(groupName);

        // 학습할 카드가 있으면 완료 메시지 초기화
        clearGroupCompletionMessage(fsrsManager, groupName);

        // 카드 목록 설정
        this.component.setCards(cards);

        if (cards.length > 0) {
            const restoredPosition = restoreReviewPosition(cards, savedProgress);
            this.component.setCurrentIndex(restoredPosition.currentIndex);
            this.component.setCardFlipped(restoredPosition.isFlipped);
        } else {
            // If there are no cards, show completion message
            const message = getCompletionMessage(fsrsManager, groupName);
            this.component.setGroupCompletionMessage(groupName, message);
        }

        // 상태 저장
        this.component.saveState();
    }
}
