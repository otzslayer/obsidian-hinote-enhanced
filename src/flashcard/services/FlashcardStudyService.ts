import type {
    CardGroup,
    FlashcardProgress,
    FlashcardState,
    FSRSStorage
} from '../types/FSRSTypes';
import type { CardGroupRepository } from './CardGroupRepository';

interface FlashcardStudyServiceOptions {
    getStorage: () => FSRSStorage;
    getGroupRepository: () => CardGroupRepository;
    getRemainingNewCardsToday: (groupId?: string) => number;
    getRemainingReviewsToday: (groupId?: string) => number;
}

export class FlashcardStudyService {
    constructor(private options: FlashcardStudyServiceOptions) {}

    getCardsForStudy(groupId: string): FlashcardState[] {
        if (!groupId) {
            console.warn('No group ID specified, returning empty card list');
            return [];
        }

        const groupRepository = this.options.getGroupRepository();
        const allCards = groupRepository.getCardsByGroupId(groupId);
        if (allCards.length === 0) {
            return [];
        }

        const now = Date.now();
        const newCards = allCards.filter(card => card.reviews === 0 && card.lastReview === 0);
        const reviewCards = allCards.filter(card => {
            return !(card.reviews === 0 && card.lastReview === 0) && card.nextReview <= now;
        });

        const remainingNewCards = this.options.getRemainingNewCardsToday(groupId);
        const remainingReviews = this.options.getRemainingReviewsToday(groupId);

        return [
            ...newCards.slice(0, remainingNewCards),
            ...reviewCards.slice(0, remainingReviews)
        ];
    }

    getProgress(): FlashcardProgress {
        const storage = this.options.getStorage();
        const allGroupCards = this.getAllGroupCards();
        const now = Date.now();

        if (allGroupCards.length === 0) {
            return {
                due: 0,
                newCards: 0,
                learned: 0,
                retention: storage.globalStats.averageRetention
            };
        }

        return {
            due: allGroupCards.filter(card => card.nextReview <= now).length,
            newCards: allGroupCards.filter(card => card.lastReview === 0).length,
            learned: allGroupCards.filter(card => card.lastReview > 0).length,
            retention: storage.globalStats.averageRetention
        };
    }

    private getAllGroupCards(): FlashcardState[] {
        const groups = this.options.getGroupRepository().getCardGroups();
        if (!groups || groups.length === 0) {
            return [];
        }

        const uniqueCardIds = new Set<string>();
        const uniqueCards: FlashcardState[] = [];

        for (const group of groups) {
            this.collectGroupCards(group, uniqueCardIds, uniqueCards);
        }

        return uniqueCards;
    }

    private collectGroupCards(
        group: CardGroup,
        uniqueCardIds: Set<string>,
        uniqueCards: FlashcardState[]
    ): void {
        const groupCards = this.options.getGroupRepository().getCardsByGroupId(group.id);

        for (const card of groupCards) {
            if (!uniqueCardIds.has(card.id)) {
                uniqueCardIds.add(card.id);
                uniqueCards.push(card);
            }
        }
    }
}
