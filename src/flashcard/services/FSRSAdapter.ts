import { 
    Card, 
    createEmptyCard, 
    fsrs, 
    generatorParameters, 
    FSRSParameters as TsFSRSParameters, 
    Rating,
    Grade,
    State, 
    RecordLogItem
} from 'ts-fsrs';

import { 
    FlashcardState, 
    FSRSParameters, 
    FSRSRating, 
    FSRS_RATING 
} from '../types/FSRSTypes';

import { IdGenerator } from '../../utils/IdGenerator';

/**
 * FSRSAdapter 클래스
 * ts-fsrs 라이브러리를 기존 FSRS 시스템과 연동하기 위한 어댑터
 */
export class FSRSAdapter {
    private fsrsInstance: ReturnType<typeof fsrs>;
    private params: TsFSRSParameters;

    constructor(customParams: Partial<FSRSParameters> = {}) {
        // 커스텀 파라미터를 ts-fsrs 라이브러리에 필요한 형식으로 변환
        this.params = this.convertToTsFSRSParams(customParams);
        this.fsrsInstance = fsrs(this.params);
    }

    /**
     * 커스텀 파라미터를 ts-fsrs 라이브러리 형식으로 변환
     */
    private convertToTsFSRSParams(customParams: Partial<FSRSParameters>): TsFSRSParameters {
        // 커스텀 파라미터에서 관련 설정 추출
        const {
            request_retention = 0.9,
            maximum_interval = 36500
        } = customParams;

        // ts-fsrs의 generatorParameters로 파라미터 생성
        return generatorParameters({
            request_retention,
            maximum_interval,
            // 단기 기억 모드 활성화, Again 평가 시 분 또는 시간 단위 간격 가능
            enable_fuzz: true,
            enable_short_term: true,
            // 기본 w 파라미터 사용, FSRS 알고리즘의 핵심 파라미터
            w: customParams.w || []
        });
    }

    /**
     * FlashcardState를 ts-fsrs의 Card 타입으로 변환
     */
    public toTsFSRSCard(card: FlashcardState): Card {
        // 새 카드이면 createEmptyCard 사용
        if (card.lastReview === 0) {
            return createEmptyCard(new Date(card.createdAt));
        }

        // 카드 상태 결정
        let state: State = State.New;
        if (card.reviews > 0) {
            if (card.lapses > 0) {
                state = State.Relearning;
            } else {
                state = State.Review;
            }
        }

        // ts-fsrs Card 객체 생성
        return {
            due: new Date(card.nextReview),
            stability: card.stability,
            difficulty: card.difficulty,
            elapsed_days: card.lastReview ? (Date.now() - card.lastReview) / (24 * 60 * 60 * 1000) : 0,
            scheduled_days: card.lastReview ? (card.nextReview - card.lastReview) / (24 * 60 * 60 * 1000) : 0,
            reps: card.reviews,
            lapses: card.lapses,
            state: state,
            last_review: card.lastReview ? new Date(card.lastReview) : undefined,
            learning_steps: 0 // 누락된 learning_steps 속성 추가, 숫자 타입 사용
        };
    }

    /**
     * FSRSRating을 ts-fsrs의 Rating으로 변환
     */
    public convertRating(rating: FSRSRating): Rating {
        switch (rating) {
            case FSRS_RATING.AGAIN:
                return Rating.Again;
            case FSRS_RATING.HARD:
                return Rating.Hard;
            case FSRS_RATING.GOOD:
                return Rating.Good;
            case FSRS_RATING.EASY:
                return Rating.Easy;
            default:
                return Rating.Good;
        }
    }

    /**
     * ts-fsrs의 Card와 ReviewLog를 FlashcardState로 역변환
     */
    public fromTsFSRSCard(originalCard: FlashcardState, recordItem: RecordLogItem): FlashcardState {
        const { card, log } = recordItem;
        const elapsedDays = originalCard.lastReview > 0
            ? (log.review.getTime() - originalCard.lastReview) / (24 * 60 * 60 * 1000)
            : 0;
        
        return {
            ...originalCard,
            difficulty: card.difficulty,
            stability: card.stability,
            retrievability: Math.exp(Math.log(0.9) * elapsedDays / card.stability), // 인출 가능성 계산
            lastReview: log.review.getTime(),
            nextReview: card.due.getTime(),
            reviews: card.reps,
            lapses: card.lapses,
            reviewHistory: [
                ...originalCard.reviewHistory,
                {
                    timestamp: log.review.getTime(),
                    rating: this.convertTsFSRSRatingToFSRSRating(log.rating),
                    elapsed: elapsedDays
                }
            ]
        };
    }

    /**
     * ts-fsrs의 Rating을 FSRSRating으로 역변환
     */
    private convertTsFSRSRatingToFSRSRating(rating: Rating): FSRSRating {
        switch (rating) {
            case Rating.Again:
                return FSRS_RATING.AGAIN;
            case Rating.Hard:
                return FSRS_RATING.HARD;
            case Rating.Good:
                return FSRS_RATING.GOOD;
            case Rating.Easy:
                return FSRS_RATING.EASY;
            default:
                return FSRS_RATING.GOOD;
        }
    }

    /**
     * 새 카드 초기화
     */
    public initializeCard(text: string, answer: string, filePath?: string): FlashcardState {
        const now = Date.now();
        const emptyCard = createEmptyCard(new Date(now));
        
        return {
            id: IdGenerator.generateCardId(),
            difficulty: emptyCard.difficulty,
            stability: emptyCard.stability,
            retrievability: 1,
            lastReview: 0,
            nextReview: now,
            reviews: 0,
            lapses: 0,
            reviewHistory: [],
            text,
            answer,
            filePath,
            createdAt: now
        };
    }

    /**
     * 카드 복습
     */
    public reviewCard(card: FlashcardState, rating: FSRSRating): FlashcardState {
        // ts-fsrs 카드로 변환
        const tsCard = this.toTsFSRSCard(card);
        const tsRating = this.convertRating(rating);
        const now = new Date();

        // ts-fsrs의 next 메서드로 평가
        // tsRating이 Rating.Manual이 아닌지 확인 (next 메서드는 Grade 타입 기대)
        // Grade 타입은 Rating.Manual을 제외한 Rating 타입
        if (tsRating !== Rating.Manual) {
            const result = this.fsrsInstance.next(tsCard, now, tsRating as Grade);

            // FlashcardState로 역변환
            return this.fromTsFSRSCard(card, result);
        } else {
            // Manual 평가인 경우 원래 카드 반환
            return card;
        }
    }

    /**
     * 카드의 다양한 평가 점수에 따른 예측 결과 가져오기
     */
    public getSchedulingCards(card: FlashcardState): Record<FSRSRating, FlashcardState> {
        // ts-fsrs 카드로 변환
        const tsCard = this.toTsFSRSCard(card);
        const now = new Date();

        // ts-fsrs의 repeat 메서드로 모든 가능한 평가 결과 가져오기
        // ts-fsrs 4.x 버전에서 repeat은 Record<Grade, RecordLogItem> 반환
        const recordLog = this.fsrsInstance.repeat(tsCard, now);

        // FlashcardState로 역변환 후 평가 점수별 분류
        // 타입 안전성을 위해 타입 단언 사용
        return {
            [FSRS_RATING.AGAIN]: this.fromTsFSRSCard(card, recordLog[Rating.Again as Grade]),
            [FSRS_RATING.HARD]: this.fromTsFSRSCard(card, recordLog[Rating.Hard as Grade]),
            [FSRS_RATING.GOOD]: this.fromTsFSRSCard(card, recordLog[Rating.Good as Grade]),
            [FSRS_RATING.EASY]: this.fromTsFSRSCard(card, recordLog[Rating.Easy as Grade])
        };
    }

    /**
     * 카드 만기 여부 판단
     */
    public isDue(card: FlashcardState): boolean {
        return Date.now() >= card.nextReview;
    }

    /**
     * 현재 파라미터 가져오기
     */
    public getParameters(): TsFSRSParameters {
        return { ...this.params };
    }

    /**
     * 파라미터 설정
     */
    public setParameters(params: Partial<FSRSParameters>): void {
        this.params = this.convertToTsFSRSParams(params);
        this.fsrsInstance = fsrs(this.params);
    }
}
