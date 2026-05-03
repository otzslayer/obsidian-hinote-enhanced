import {
    CardGroup,
    DailyStats,
    FSRSGlobalStats,
    FSRSParameters,
    FSRSRating,
    FSRS_RATING
} from "../types/FSRSTypes";

interface DailyStatsServiceOptions {
    getDailyStats: () => DailyStats[];
    setDailyStats: (stats: DailyStats[]) => void;
    getGlobalStats: () => FSRSGlobalStats;
    getCardGroups: () => CardGroup[];
    getParameters: () => FSRSParameters;
    saveDebounced: () => void;
}

export class DailyStatsService {
    constructor(private options: DailyStatsServiceOptions) {}

    public resetTodayStats(): boolean {
        const todayTimestamp = this.getTodayTimestamp();
        const dailyStats = this.options.getDailyStats();
        const todayStatsIndex = dailyStats.findIndex((stats: DailyStats) => stats.date === todayTimestamp);

        if (todayStatsIndex < 0) {
            return false;
        }

        dailyStats.splice(todayStatsIndex, 1);
        this.options.setDailyStats(dailyStats);
        return true;
    }

    public getDailyStats(): DailyStats[] {
        return this.options.getDailyStats().map((stats: DailyStats) => ({ ...stats }));
    }

    public canLearnNewCardsToday(groupId?: string): boolean {
        const todayStats = this.getTodayStats();
        return todayStats.newCardsLearned < this.getNewCardsLimit(groupId);
    }

    public canReviewCardsToday(groupId?: string): boolean {
        const todayStats = this.getTodayStats();
        return todayStats.cardsReviewed < this.getReviewsLimit(groupId);
    }

    public getRemainingNewCardsToday(groupId?: string): number {
        const todayStats = this.getTodayStats();
        return Math.max(0, this.getNewCardsLimit(groupId) - todayStats.newCardsLearned);
    }

    public getRemainingReviewsToday(groupId?: string): number {
        const todayStats = this.getTodayStats();
        return Math.max(0, this.getReviewsLimit(groupId) - todayStats.cardsReviewed);
    }

    public updateDailyStats(isNewCard: boolean, rating: FSRSRating): void {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();
        const globalStats = this.options.getGlobalStats();

        if (!globalStats.lastReviewDate) {
            globalStats.lastReviewDate = todayTimestamp;
            globalStats.streakDays = 1;
        } else if (globalStats.lastReviewDate === todayTimestamp) {
            // Already reviewed today.
        } else if (globalStats.lastReviewDate === todayTimestamp - 86400000) {
            globalStats.lastReviewDate = todayTimestamp;
            globalStats.streakDays++;
        } else if (globalStats.lastReviewDate < todayTimestamp) {
            globalStats.lastReviewDate = todayTimestamp;
            globalStats.streakDays = 1;
        }

        const todayStats = this.getTodayStats();
        todayStats.reviewCount++;

        if (isNewCard) {
            todayStats.newCount++;
            todayStats.newCardsLearned++;
        } else {
            todayStats.cardsReviewed++;
        }

        this.incrementRatingCount(todayStats, rating);
        this.options.saveDebounced();
    }

    private getTodayStats(): DailyStats {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();
        const todayDateStr = today.toDateString();
        const dailyStats = this.options.getDailyStats();

        let todayStats = dailyStats.find(stats => {
            const statsDate = new Date(stats.date);
            return statsDate.toDateString() === todayDateStr;
        });

        if (!todayStats) {
            todayStats = this.createEmptyStats(todayTimestamp);
            dailyStats.push(todayStats);
            this.options.setDailyStats(dailyStats);
            this.maintainDailyStats();
            this.options.saveDebounced();
        }

        return todayStats;
    }

    private maintainDailyStats(): number {
        const sortedStats = [...this.options.getDailyStats()].sort((a, b) => b.date - a.date);
        const uniqueDates = new Map<string, DailyStats>();

        sortedStats.forEach(stat => {
            const date = new Date(stat.date);
            const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
            if (!uniqueDates.has(dateKey)) {
                uniqueDates.set(dateKey, stat);
            }
        });

        const maintainedStats = Array.from(uniqueDates.values())
            .sort((a, b) => b.date - a.date)
            .slice(0, 84);

        this.options.setDailyStats(maintainedStats);
        return maintainedStats.length;
    }

    private getTodayTimestamp(): number {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today.getTime();
    }

    private getNewCardsLimit(groupId?: string): number {
        const group = this.findCustomSettingsGroup(groupId);
        return group?.settings?.newCardsPerDay ?? this.options.getParameters().newCardsPerDay;
    }

    private getReviewsLimit(groupId?: string): number {
        const group = this.findCustomSettingsGroup(groupId);
        return group?.settings?.reviewsPerDay ?? this.options.getParameters().reviewsPerDay;
    }

    private findCustomSettingsGroup(groupId?: string): CardGroup | undefined {
        if (!groupId) {
            return undefined;
        }

        const group = this.options.getCardGroups().find((cardGroup: CardGroup) => cardGroup.id === groupId);
        if (!group?.settings || group.settings.useGlobalSettings) {
            return undefined;
        }

        return group;
    }

    private incrementRatingCount(todayStats: DailyStats, rating: FSRSRating): void {
        switch (rating) {
            case FSRS_RATING.AGAIN:
                todayStats.againCount++;
                break;
            case FSRS_RATING.HARD:
                todayStats.hardCount++;
                break;
            case FSRS_RATING.GOOD:
                todayStats.goodCount++;
                break;
            case FSRS_RATING.EASY:
                todayStats.easyCount++;
                break;
        }
    }

    private createEmptyStats(date: number): DailyStats {
        return {
            date,
            newCardsLearned: 0,
            cardsReviewed: 0,
            reviewCount: 0,
            newCount: 0,
            againCount: 0,
            hardCount: 0,
            goodCount: 0,
            easyCount: 0
        };
    }
}
