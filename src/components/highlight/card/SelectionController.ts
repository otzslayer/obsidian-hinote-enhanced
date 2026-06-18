import type { HighlightInfo } from '../../../types/highlight';
import type { SelectionManager } from '../../../views/selection';
import { UnfocusedCommentInput } from '../../comment/UnfocusedCommentInput';

interface HighlightCardSelectionControllerOptions {
    getCard: () => HTMLElement;
    getHighlight: () => HighlightInfo;
    getSelectionManager: () => SelectionManager | undefined;
    onCommentAdd: (highlight: HighlightInfo) => void;
}

export class HighlightCardSelectionController {
    private isEditing = false;
    private isShowingRealInput = false;
    private unfocusedInput: UnfocusedCommentInput | null = null;

    constructor(private options: HighlightCardSelectionControllerOptions) {}

    shouldIgnoreCardClick(target: HTMLElement): boolean {
        return this.isEditing
            || this.isShowingRealInput
            || !!target.closest('.hi-note-input')
            || !!target.closest('.hi-note-actions-hint');
    }

    markEditing(): void {
        this.isEditing = true;
    }

    resetEditing(): void {
        this.isEditing = false;
    }

    handleInputShown(): void {
        this.isShowingRealInput = true;
        this.removeUnfocusedInput();
    }

    handleInputClosed(): void {
        this.isShowingRealInput = false;
    }

    showCommentInput(): void {
        this.removeUnfocusedInput();
        this.options.onCommentAdd(this.options.getHighlight());
    }

    selectCard(event?: MouseEvent): void {
        const selectionManager = this.options.getSelectionManager();
        if (!selectionManager) {
            console.error('[HighlightCard] SelectionManager가 전달되지 않아 선택 작업을 수행할 수 없습니다.');
            return;
        }

        const card = this.options.getCard();
        const highlight = this.options.getHighlight();

        if (event?.shiftKey) {
            if (selectionManager.isCardSelected(card)) {
                selectionManager.unselectCard(card);
            } else {
                selectionManager.selectCard(card, highlight);
            }
            return;
        }

        selectionManager.clearSelection();
        selectionManager.selectCard(card, highlight);
        this.showUnfocusedCommentInput();
    }

    removeUnfocusedInput(): void {
        if (!this.unfocusedInput) {
            return;
        }

        this.unfocusedInput.remove();
        this.unfocusedInput = null;
    }

    destroy(): void {
        this.removeUnfocusedInput();
    }

    private showUnfocusedCommentInput(): void {
        this.removeUnfocusedInput();

        if (this.isEditing || this.isShowingRealInput) {
            return;
        }

        const contentElement = this.options.getCard().querySelector('.highlight-content');
        if (!(contentElement instanceof HTMLElement)) {
            return;
        }

        this.unfocusedInput = new UnfocusedCommentInput(
            contentElement,
            this.options.getHighlight(),
            () => this.showCommentInput()
        );
    }
}
