import type CommentPlugin from '../../../main';
import type { HiNoteDataManager } from '../../storage/HiNoteDataManager';
import type { FSRSStorage } from '../types/FSRSTypes';

export class FlashcardStorageService {
    constructor(
        private plugin: CommentPlugin,
        private dataManager?: HiNoteDataManager
    ) {}

    createDefaultStorage(): FSRSStorage {
        return {
            version: '1.0',
            cards: {},
            globalStats: {
                totalReviews: 0,
                averageRetention: 1,
                streakDays: 0,
                lastReviewDate: 0
            },
            cardGroups: [],
            uiState: {
                currentGroupName: '',
                completionMessage: null,
                groupProgress: {}
            },
            dailyStats: []
        };
    }

    async load(): Promise<FSRSStorage> {
        const defaultStorage = this.createDefaultStorage();

        try {
            if (this.dataManager) {
                const data = await this.dataManager.getFlashcardData();
                return data || defaultStorage;
            }

            const data = await this.plugin.loadData();
            if (!data?.fsrs) {
                return defaultStorage;
            }

            return {
                version: data.fsrs.version || defaultStorage.version,
                cards: data.fsrs.cards || {},
                globalStats: data.fsrs.globalStats || defaultStorage.globalStats,
                cardGroups: Array.isArray(data.fsrs.cardGroups) ? data.fsrs.cardGroups : [],
                uiState: data.fsrs.uiState || defaultStorage.uiState,
                dailyStats: data.fsrs.dailyStats || []
            };
        } catch (error) {
            console.error('Loading storage data failed:', error);
            return defaultStorage;
        }
    }

    async save(storage: FSRSStorage): Promise<void> {
        this.normalize(storage);

        try {
            if (this.dataManager) {
                await this.dataManager.saveFlashcardData(storage);
                return;
            }

            const currentData = await this.plugin.loadData() || {};
            await this.plugin.saveData({
                ...currentData,
                fsrs: storage
            });
        } catch (error) {
            console.error('Saving data failed:', error);
            throw error;
        }
    }

    private normalize(storage: FSRSStorage): void {
        if (!Array.isArray(storage.cardGroups)) {
            storage.cardGroups = [];
        }

        if (!storage.cards) {
            storage.cards = {};
        }
    }
}
