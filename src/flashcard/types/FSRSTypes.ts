export interface ReviewLog {
    timestamp: number;
    rating: number;     // 1-4는 각각 Again/Hard/Good/Easy에 대응
    elapsed: number;    // 마지막 복습 이후 경과 일수
}

export interface FlashcardState {
    id: string;           // 카드 고유 식별자
    difficulty: number;   // 카드 난이도
    stability: number;    // 기억 안정성
    retrievability: number; // 인출 가능성
    lastReview: number;   // 마지막 복습 타임스탬프
    nextReview: number;   // 다음 복습 타임스탬프
    reviewHistory: ReviewLog[];
    text: string;         // 카드 앞면 내용
    answer: string;       // 카드 뒷면 내용
    filePath?: string;    // 연결된 파일 경로
    createdAt: number;    // 카드 생성 타임스탬프
    updatedAt?: number;   // 마지막 업데이트 타임스탬프
    reviews: number;      // 총 복습 횟수
    lapses: number;       // 망각 횟수
    groupIds?: string[];  // 카드가 속한 그룹 ID 목록
    sourceId?: string;    // 출처 ID (하이라이트 또는 주석의 ID)
    sourceType?: 'highlight' | 'comment'; // 출처 유형
}

export interface FlashcardProgress {
    due: number;        // 오늘 복습할 수량
    newCards: number;   // 새 카드 수량
    learned: number;    // 학습 완료 수량
    retention: number;  // 기억 유지율
}

export interface FSRSGlobalStats {
    totalReviews: number;
    averageRetention: number;
    streakDays: number;
    lastReviewDate: number;
}

export interface CardGroup {
    id: string;           // 그룹 고유 식별자
    name: string;         // 그룹 이름
    filter: string;       // 필터 조건, 파일명 및 태그 지원
    createdTime: number;  // 생성 시간
    sortOrder: number;    // 정렬 순서
    isReversed?: boolean; // 카드 앞뒷면 반전 여부 (댓글을 질문으로)
    settings?: {
        newCardsPerDay?: number;     // 일일 새 카드 수량 제한
        reviewsPerDay?: number;      // 일일 복습 수량 제한
        useGlobalSettings?: boolean; // 전역 설정 사용 여부
    };
    cardIds?: string[];    // 해당 그룹에 포함된 카드 ID 목록
    lastUpdated?: number;  // 마지막 업데이트 타임스탬프
}

export interface GroupProgressState {
    currentIndex: number;
    isFlipped: boolean;
    currentCardId?: string;
    completionMessage?: string | null;
}

export interface HiCardState {
    currentGroupName: string;
    completionMessage?: string | null;
    groupProgress?: Record<string, GroupProgressState>;
}

export interface DailyStats {
    date: number;             // 날짜 타임스탬프 (당일 자정 0시)
    newCardsLearned: number;  // 당일 학습한 새 카드 수량
    cardsReviewed: number;    // 당일 복습한 카드 수량
    reviewCount: number;      // 당일 총 평가 횟수
    newCount: number;         // 당일 새 카드 수
    againCount: number;       // Again 평가 수량
    hardCount: number;        // Hard 평가 수량
    goodCount: number;        // Good 평가 수량
    easyCount: number;        // Easy 평가 수량
}

export interface FSRSStorage {
    version: string;
    cards: { [id: string]: FlashcardState };
    globalStats: FSRSGlobalStats;
    cardGroups: CardGroup[];  // 사용자 정의 카드 그룹
    uiState: HiCardState;     // UI 상태 저장
    dailyStats: DailyStats[]; // 일일 학습 통계 데이터
}

export const FSRS_RATING = {
    AGAIN: 1,
    HARD: 2,
    GOOD: 3,
    EASY: 4,
} as const;

export type FSRSRating = typeof FSRS_RATING[keyof typeof FSRS_RATING];

export interface FSRSParameters {
    request_retention: number;   // 목표 기억 유지율
    maximum_interval: number;    // 최대 간격 일수
    w: number[];                // FSRS 알고리즘 파라미터
    newCardsPerDay: number;     // 일일 새 카드 학습 상한
    reviewsPerDay: number;      // 일일 복습 카드 상한
}

export const DEFAULT_FSRS_PARAMETERS: FSRSParameters = {
    request_retention: 0.9,
    maximum_interval: 36500,
    newCardsPerDay: 20,         // 기본 하루 20장 새 카드 학습
    reviewsPerDay: 100,         // 기본 하루 100장 카드 복습
    // FSRS-5는 21개의 파라미터 필요 (ts-fsrs v5부터)
    w: [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 
        0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755, 0.0, 0.0, 0.0, 0.0]
};
