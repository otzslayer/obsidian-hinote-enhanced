import { FlashcardState, FSRSStorage } from '../types/FSRSTypes';
import { FSRSService } from './FSRSService';

/**
 * 플래시카드 팩토리 클래스, 플래시카드의 생성, 업데이트 및 관리 담당
 * 모든 플래시카드 생성 관련 로직은 이 클래스에 집중
 */
export class FlashcardFactory {
    private fsrsService: FSRSService;

    constructor(
        private getStorage: () => FSRSStorage,
        private emitFlashcardChanged: () => void,
        fsrsService: FSRSService
    ) {
        this.fsrsService = fsrsService;
    }
    
    /**
     * 저장소 객체 가져오기
     * @private
     */
    private get storage(): FSRSStorage {
        return this.getStorage();
    }

    /**
     * 카드 생성
     * @param text 카드 앞면 텍스트
     * @param answer 카드 뒷면 답변
     * @param filePath 파일 경로
     * @returns 생성된 카드
     */
    public createCard(text: string, answer: string, filePath?: string): FlashcardState {
        // FSRS 서비스로 카드 생성
        try {
            // initializeCard 메서드로 카드 생성
            const card = this.fsrsService.initializeCard(text, answer, filePath);
            return card;
        } catch (err) {
            console.error('카드 생성 중 오류:', err);
            // 생성 실패 시 재시도
            try {
                return this.fsrsService.initializeCard(text, answer, filePath);
            } catch (e) {
                console.error('두 번째 카드 생성 시도 실패:', e);
                // 여전히 실패하면 가장 간단한 방법으로 카드 생성
                return this.fsrsService.initializeCard(text, answer, filePath);
            }
        }
    }
    
    /**
     * 저장소에 카드 추가
     * @param text 카드 앞면 텍스트
     * @param answer 카드 뒷면 답변
     * @param filePath 파일 경로
     * @returns 추가된 카드
     */
    public addCard(text: string, answer: string, filePath?: string): FlashcardState {
        // 새 카드 생성
        const card = this.createCard(text, answer, filePath);

        // storage.cards 존재 확인
        if (!this.storage.cards) {
            this.storage.cards = {};
        }

        // 카드 저장
        this.storage.cards[card.id] = card;

        // 이벤트 발생, FSRSManager가 저장 처리
        try {
            this.emitFlashcardChanged();
        } catch (err) {
            console.error('카드 저장 중 오류:', err);
        }

        return card;
    }
    
    /**
     * 파일 경로로 카드 가져오기
     * @param filePath 파일 경로
     * @returns 해당 파일의 모든 카드
     */
    public getCardsByFile(filePath: string): FlashcardState[] {
        if (!this.storage.cards) {
            return [];
        }
        
        return Object.values(this.storage.cards).filter((card: FlashcardState) => card.filePath === filePath);
    }
    
    /**
     * 카드 삭제
     * @param cardId 삭제할 카드 ID
     * @returns 삭제 성공 여부
     */
    public deleteCard(cardId: string): boolean {
        try {
            if (!this.storage.cards || !this.storage.cards[cardId]) {
                return false;
            }

            // 카드 삭제
            delete this.storage.cards[cardId];

            // 이벤트 발생, FSRSManager가 저장 처리
            this.emitFlashcardChanged();

            return true;
        } catch (err) {
            console.error('카드 삭제 중 오류:', err);
            return false;
        }
    }
}
