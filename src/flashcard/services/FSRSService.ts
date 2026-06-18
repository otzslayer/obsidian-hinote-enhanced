import { 
    FlashcardState, 
    FSRSParameters, 
    DEFAULT_FSRS_PARAMETERS,
    FSRSRating
} from '../types/FSRSTypes';
import { FSRSAdapter } from './FSRSAdapter';

export class FSRSService {
    private params: FSRSParameters;
    private adapter: FSRSAdapter;

    constructor(params: Partial<FSRSParameters> = {}) {
        this.params = { ...DEFAULT_FSRS_PARAMETERS, ...params };
        this.adapter = new FSRSAdapter(this.params);
    }

    // 모든 알고리즘 구현은 FSRSAdapter에 위임

    public initializeCard(text: string, answer: string, filePath?: string): FlashcardState {
        // adapter로 카드 초기화
        return this.adapter.initializeCard(text, answer, filePath);
    }

    public reviewCard(card: FlashcardState, rating: FSRSRating): FlashcardState {
        // adapter로 카드 복습
        return this.adapter.reviewCard(card, rating);
    }

    public isDue(card: FlashcardState): boolean {
        // adapter로 카드 만기 여부 판단
        return this.adapter.isDue(card);
    }

    public getReviewableCards(cards: FlashcardState[]): FlashcardState[] {
        return cards.filter(card => this.isDue(card))
            .sort((a, b) => a.nextReview - b.nextReview);
    }

    /**
     * 현재 FSRS 파라미터 가져오기
     * @returns 현재 사용 중인 FSRS 파라미터
     */
    public getParameters(): FSRSParameters {
        return { ...this.params };
    }

    /**
     * FSRS 파라미터 설정
     * @param params 설정할 FSRS 파라미터
     */
    public setParameters(params: Partial<FSRSParameters>): void {
        this.params = { ...this.params, ...params };
        // adapter 파라미터 업데이트
        this.adapter.setParameters(this.params);
    }

    /**
     * FSRS 파라미터를 기본값으로 초기화
     */
    public resetParameters(): void {
        this.params = { ...DEFAULT_FSRS_PARAMETERS };
        // adapter 파라미터 업데이트
        this.adapter.setParameters(this.params);
    }

    /**
     * 카드의 다양한 평가 점수에 따른 예측 결과 가져오기
     * @param card 예측할 카드
     * @returns 각 평가 점수별 예측 결과
     */
    public getSchedulingCards(card: FlashcardState): Record<FSRSRating, FlashcardState> {
        return this.adapter.getSchedulingCards(card);
    }
}
