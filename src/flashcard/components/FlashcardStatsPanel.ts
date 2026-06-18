import { FSRSManager } from "../services/FSRSManager";
import { DailyStats } from "../types/FSRSTypes";

/**
 * 플래시카드 통계 패널, 학습 통계 데이터 및 히트맵 표시
 */
export class FlashcardStatsPanel {
    private containerEl: HTMLElement;
    private fsrsManager: FSRSManager;
    
    constructor(containerEl: HTMLElement, fsrsManager: FSRSManager) {
        this.containerEl = containerEl;
        this.fsrsManager = fsrsManager;
    }
    
    /**
     * 통계 패널 렌더링
     */
    render() {
        this.containerEl.empty();
        this.containerEl.addClass('flashcard-stats-panel');

        // 통계 데이터 영역 생성
        this.renderStatsArea();

        // 히트맵 영역 생성
        this.renderHeatmap();
    }

    /**
     * 통계 데이터 영역 렌더링
     */
    private renderStatsArea() {
        const statsArea = this.containerEl.createDiv('flashcard-stats-area');

        // 학습 진도 데이터 가져오기
        const progress = this.fsrsManager.getProgress();

        // 통계 항목 생성
        this.createStatItem(statsArea, progress.newCards.toString(), 'New', 'flashcard-stat-new');
        this.createStatItem(statsArea, progress.learned.toString(), 'Learning', 'flashcard-stat-learning');
        this.createStatItem(statsArea, progress.due.toString(), 'Review', 'flashcard-stat-due');
    }
    
    /**
     * 단일 통계 항목 생성
     */
    private createStatItem(container: HTMLElement, value: string, label: string, className: string) {
        const statItem = container.createDiv(`flashcard-stat-item ${className}`);
        const valueEl = statItem.createDiv('flashcard-stat-value');
        valueEl.textContent = value;
        
        const labelEl = statItem.createDiv('flashcard-stat-label');
        labelEl.textContent = label;
    }
    
    /**
     * 히트맵 영역 렌더링
     */
    private renderHeatmap() {
        // 메인 컨테이너에 직접 히트맵 생성
        this.createHeatmap(this.containerEl, this.fsrsManager.getDailyStats());
    }

    /**
     * 히트맵 생성
     */
    private createHeatmap(container: HTMLElement, dailyStats: DailyStats[]) {
        // 히트맵 그리드 생성 (컨테이너에 직접 생성, 중첩 최소화)
        const grid = container.createDiv('flashcard-heatmap-grid');

        // 디버그 정보 추가 - 현재 날짜
        const today = new Date();

        // 과거 84일의 날짜 가져오기 (7행 * 12열)
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 83); // 83일로 조정하여 당일 포함

        // 특정 날짜 데이터를 빠르게 조회하기 위한 날짜 맵 생성
        const dateMap = new Map();

        // 당일 데이터 수동 추가 (없는 경우)
        const todayDate = new Date(today);
        todayDate.setHours(0, 0, 0, 0);
        const todayTimestamp = todayDate.getTime();
        const todayKey = `${todayDate.getFullYear()}-${todayDate.getMonth() + 1}-${todayDate.getDate()}`;

        // 당일 데이터 존재 여부 확인
        let hasTodayData = false;

        // 실제 학습 데이터 사용
        const allStats = [...dailyStats];

        // 모든 데이터 처리
        allStats.forEach(stat => {
            // 타임스탬프를 날짜 객체로 변환
            const date = new Date(stat.date);

            // 날짜의 연, 월, 일 가져오기
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();

            // 날짜 키 생성
            const dateKey = `${year}-${month}-${day}`;

            // 당일 데이터인지 확인
            if (dateKey === todayKey) {
                hasTodayData = true;
            }

            // 맵에 저장 (날짜 중복 시 마지막 데이터 사용)
            dateMap.set(dateKey, stat);
        });

        // 당일 데이터가 없으면 빈 레코드를 수동으로 추가
        // 당일 학습 데이터가 없어도 빈 셀이 표시되도록 함
        if (!hasTodayData) {
            dateMap.set(todayKey, {
                date: todayTimestamp,
                newCardsLearned: 0,
                cardsReviewed: 0,
                reviewCount: 0,
                newCount: 0,
                againCount: 0,
                hardCount: 0,
                goodCount: 0,
                easyCount: 0
            });
        }
        
        // 히트맵 셀 생성
        const rows = 7;
        const cols = 12;

        // 히트맵 레이아웃 재설계, 당일이 올바른 위치에 표시되도록 함
        // 당일의 요일 계산 (0은 일요일, 1-6은 월요일-토요일)
        const todayDayOfWeek = today.getDay();
        // 히트맵에서 월요일은 0행, 토요일은 5행, 일요일은 6행
        // 이번 주 월요일 날짜 계산
        const thisWeekMonday = new Date(today);
        thisWeekMonday.setDate(today.getDate() - ((todayDayOfWeek === 0 ? 7 : todayDayOfWeek) - 1));

        // 히트맵 첫 번째 열 첫 번째 행 (좌상단) 날짜 계산
        // 11주 전으로 거슬러 올라가기
        const firstCellDate = new Date(thisWeekMonday);
        firstCellDate.setDate(firstCellDate.getDate() - 11 * 7);

        // 모든 셀의 날짜를 저장하는 2차원 배열 생성
        const cellDates = [];

        // 먼저 각 열의 월요일 날짜 채우기
        const mondayDates = [];
        for (let col = 0; col < cols; col++) {
            const mondayDate = new Date(firstCellDate);
            mondayDate.setDate(mondayDate.getDate() + col * 7);
            mondayDates.push(mondayDate);
        }

        // 각 열에 대해 나머지 날짜 채우기
        for (let col = 0; col < cols; col++) {
            const colDates = [];
            for (let row = 0; row < rows; row++) {
                const date = new Date(mondayDates[col]);
                date.setDate(date.getDate() + row);
                colDates.push(date);
            }
            cellDates.push(colDates);
        }

        // 행과 열로 히트맵 채우기
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const date = cellDates[col][row];

                // 날짜의 연, 월, 일 가져오기
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const day = date.getDate();

                // 날짜 키 생성
                const dateKey = `${year}-${month}-${day}`;

                // 맵에서 통계 데이터 가져오기
                const stat = dateMap.get(dateKey);

                // 셀 생성
                const cell = grid.createDiv('flashcard-heatmap-cell');

                // 당일 셀인지 확인
                const isTodayCell = dateKey === todayKey;

                // 학습 활동에 따라 색상 농도 설정
                if (stat) {
                    // 새 카드 학습은 일반적으로 더 많은 노력이 필요하므로 가중치 높음
                    let intensity = stat.newCardsLearned * 1.5 + stat.cardsReviewed;

                    // 평가 기록이 있으면 난이도 요소 고려
                    if (stat.reviewCount > 0) {
                        // 어려운 카드 가중치 높음
                        const difficultyFactor = (stat.againCount * 1.5 + stat.hardCount * 1.2 + stat.goodCount + stat.easyCount * 0.8) / stat.reviewCount;
                        intensity = intensity * (difficultyFactor + 0.5); // 최소 영향 보장을 위해 0.5 추가
                    }

                    // 최댓값 제한
                    intensity = Math.min(intensity, 20);
                    const level = Math.ceil(intensity / 4); // 0-5단계 농도
                    cell.addClass(`flashcard-heatmap-level-${level}`);

                    // 평가 분포를 포함한 더 자세한 툴팁 추가
                    let tooltipText = `${date.toLocaleDateString()}: Learned ${stat.newCardsLearned} new cards, reviewed ${stat.cardsReviewed} cards`;
                    
                    // 평가 기록이 있으면 평가 분포 정보 추가
                    if (stat.reviewCount > 0) {
                        tooltipText += `\nRating distribution: Again(${stat.againCount}), Hard(${stat.hardCount}), Good(${stat.goodCount}), Easy(${stat.easyCount})`;
                    }
                    
                    cell.setAttribute('title', tooltipText);
                } else {
                    // 당일에 더 이상 특수 스타일 사용하지 않음
                    if (isTodayCell) {
                        // 기본 스타일 사용
                        cell.addClass('flashcard-heatmap-level-0');
                    } else if (date > today) {
                        // 미래 날짜
                        cell.addClass('flashcard-heatmap-level-0');
                    } else {
                        // 과거의 빈 셀
                        cell.addClass('flashcard-heatmap-level-0');
                    }
                }
            }
            
        }
    }
    
    /**
     * 확대/축소 컨트롤 추가 - 삭제됨, 고정 일수 사용
     */
    private addZoomControl(container: HTMLElement, heatmapContainer: HTMLElement) {
        // 확대/축소 컨트롤 더 이상 불필요, 고정 일수 사용
    }
}
