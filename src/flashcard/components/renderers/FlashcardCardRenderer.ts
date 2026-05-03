import { TFile } from "obsidian";
import { t } from "../../../i18n";
import { CardGroup, FlashcardState, FSRS_RATING, FSRSRating } from "../../types/FSRSTypes";
import type { FlashcardComponentContext, FlashcardRatingButton } from "../FlashcardComponentContext";
import { FlashcardMarkdownRenderer } from "./FlashcardMarkdownRenderer";

export class FlashcardCardRenderer {
    constructor(
        private component: FlashcardComponentContext,
        private markdownRenderer: FlashcardMarkdownRenderer
    ) {}

    public render(cardContainer: HTMLElement, currentCard: FlashcardState | null): void {
        if (!currentCard) {
            cardContainer.createEl("div", {
                cls: "flashcard-empty-state",
                text: t("No cards available")
            });
            return;
        }

        const cardClasses = ["flashcard"];
        if (this.component.isCardFlipped()) {
            cardClasses.push("is-flipped");
        }

        const card = cardContainer.createEl("div", { cls: cardClasses.join(" ") });
        this.renderCardSides(card, currentCard);
        card.addEventListener("click", () => this.component.flipCard());

        this.renderRatingButtons(cardContainer, currentCard);

        if (this.component.isCardFlipped()) {
            card.classList.add("is-flipped");
        }

        this.renderCounter(cardContainer);
        this.renderSource(cardContainer, currentCard);
    }

    private renderCardSides(card: HTMLElement, currentCard: FlashcardState): void {
        const isReversed = this.isCardReversed(currentCard);
        const frontContent = isReversed ? currentCard.answer : currentCard.text;
        const backContent = isReversed ? currentCard.text : currentCard.answer;

        const frontEl = card.createEl("div", {
            cls: "flashcard-side flashcard-front"
        }).createEl("div", {
            cls: "flashcard-content markdown-rendered"
        });
        this.markdownRenderer.render(frontEl, frontContent, currentCard.filePath);

        const backEl = card.createEl("div", {
            cls: "flashcard-side flashcard-back"
        }).createEl("div", {
            cls: "flashcard-content markdown-rendered"
        });
        this.markdownRenderer.render(backEl, backContent, currentCard.filePath);
    }

    private isCardReversed(currentCard: FlashcardState): boolean {
        const allGroups = this.component.getFsrsManager().getCardGroups();
        return allGroups.some((group: CardGroup) => {
            if (!group.isReversed) {
                return false;
            }

            const groupCards = this.component.getFsrsManager().getCardsInGroup(group);
            return groupCards.some((card: FlashcardState) => card.id === currentCard.id);
        });
    }

    private renderRatingButtons(cardContainer: HTMLElement, currentCard: FlashcardState): void {
        const ratingContainer = cardContainer.createEl("div", { cls: "flashcard-rating" });
        const predictions = this.component.getFsrsManager().getCardPredictions(currentCard.id);

        this.component.getRatingButtons().forEach((buttonConfig: FlashcardRatingButton) => {
            const button = ratingContainer.createEl("button", {
                cls: "flashcard-rating-button",
                attr: {
                    "data-rating": buttonConfig.ratingText,
                    title: `${buttonConfig.label} (${buttonConfig.key})`
                }
            });

            button.createSpan({ text: buttonConfig.label });

            const predictedCard = predictions?.[buttonConfig.rating];
            if (predictedCard) {
                const predictionSpan = button.createSpan({ cls: "prediction-info" });
                predictionSpan.createSpan({
                    text: this.formatDiffFromNow(predictedCard.nextReview),
                    cls: "days"
                });
            } else {
                button.createSpan({
                    text: this.formatDefaultInterval(buttonConfig.rating, currentCard),
                    cls: "days"
                });
            }

            button.addEventListener("click", (event: MouseEvent) => {
                event.stopPropagation();
                this.component.rateCard(buttonConfig.rating);
            });
        });
    }

    private renderCounter(cardContainer: HTMLElement): void {
        const groupId = this.component.getCurrentGroupId();
        const remainingCards = this.component.getCards().length;
        const fsrsManager = this.component.getFsrsManager();
        const totalTodayCards = groupId ? fsrsManager.getCardsForStudy(groupId).length : 0;
        const totalToShow = Math.max(totalTodayCards, remainingCards);
        const currentCardNumber = totalToShow - remainingCards + 1;

        cardContainer.createEl("div", {
            cls: "flashcard-counter",
            text: `${currentCardNumber}/${totalToShow}`
        });
    }

    private renderSource(cardContainer: HTMLElement, currentCard: FlashcardState): void {
        if (!currentCard.filePath) {
            return;
        }

        const filePath = currentCard.filePath;
        const sourceEl = cardContainer.createEl("div", {
            cls: "flashcard-source"
        });
        const fileNameText = sourceEl.createEl("span", {
            text: filePath.split("/").pop() || ""
        });

        this.component.getUtils().addPagePreview(fileNameText, filePath);
        fileNameText.addEventListener("click", (event: MouseEvent) => {
            event.stopPropagation();
            const file = this.component.getApp().vault.getAbstractFileByPath(filePath);
            if (file && file instanceof TFile) {
                this.component.getApp().workspace.getLeaf().openFile(file);
            }
        });
    }

    private formatDiffFromNow(timestamp: number): string {
        const nextReview = new Date(timestamp);
        const now = new Date();
        const diffMs = nextReview.getTime() - now.getTime();

        if (diffMs < 60 * 60 * 1000) {
            const diffMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
            return `${diffMinutes}m`;
        }

        if (diffMs < 24 * 60 * 60 * 1000) {
            const diffHours = Math.round(diffMs / (1000 * 60 * 60));
            return `${diffHours}h`;
        }

        return this.formatIntervalDays(Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }

    private formatDefaultInterval(rating: FSRSRating, currentCard: FlashcardState): string {
        const isNewCard = currentCard.reviews === 0;
        const hasLapses = currentCard.lapses > 0;
        const intervalHours = this.getDefaultIntervalHours(rating, isNewCard, hasLapses);

        if (intervalHours < 1) {
            return `${Math.round(intervalHours * 60)}m`;
        }

        if (intervalHours < 24) {
            return `${Math.round(intervalHours)}h`;
        }

        return this.formatIntervalDays(intervalHours / 24);
    }

    private getDefaultIntervalHours(rating: FSRSRating, isNewCard: boolean, hasLapses: boolean): number {
        switch (rating) {
            case FSRS_RATING.AGAIN:
                return isNewCard ? 0.25 : (hasLapses ? 0.5 : 1);
            case FSRS_RATING.HARD:
                return isNewCard ? 24 : (hasLapses ? 36 : 48);
            case FSRS_RATING.GOOD:
                return isNewCard ? 24 * 3 : (hasLapses ? 24 * 5 : 24 * 7);
            case FSRS_RATING.EASY:
                return isNewCard ? 24 * 5 : (hasLapses ? 24 * 9 : 24 * 14);
        }
    }

    private formatIntervalDays(intervalDays: number): string {
        if (intervalDays < 1) {
            return `${Math.round(intervalDays * 24)}h`;
        }

        if (intervalDays < 30) {
            return `${Math.round(intervalDays)}d`;
        }

        if (intervalDays < 365) {
            return `${Math.round(intervalDays / 30)}mo`;
        }

        return `${Math.round(intervalDays / 365)}y`;
    }
}
