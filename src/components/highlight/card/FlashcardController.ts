import { Notice } from 'obsidian';
import type CommentPlugin from '../../../../main';
import { t } from '../../../i18n';
import type { HighlightInfo } from '../../../types/highlight';
import { LicenseManager } from '../../../services/LicenseManager';
import { HighlightFlashcardManager } from '../../../views/highlight';

interface FlashcardControllerCallbacks {
    onCreated: () => void;
    onDeleted: () => void;
    onDeleteHighlightCompletely: () => Promise<void>;
}

export class HighlightCardFlashcardController {
    private flashcardManager: HighlightFlashcardManager;

    constructor(
        private plugin: CommentPlugin,
        private getHighlight: () => HighlightInfo,
        private getFileName: () => string | undefined,
        private callbacks: FlashcardControllerCallbacks
    ) {
        this.flashcardManager = new HighlightFlashcardManager(plugin);
    }

    checkHasFlashcard(): boolean {
        return this.flashcardManager.checkHasFlashcard(this.getHighlight().id || '');
    }

    async toggleFlashcard(): Promise<boolean> {
        try {
            const canUseFlashcards = await this.canUseFlashcards();
            if (!canUseFlashcards) {
                new Notice(t('Only HiNote Pro'));
                return false;
            }

            if (!this.plugin.fsrsManager) {
                new Notice(t('FSRS 매니저가 초기화되지 않았습니다.'));
                return false;
            }

            return this.checkHasFlashcard()
                ? await this.deleteFlashcard()
                : await this.createFlashcard();
        } catch (error) {
            console.error('플래시카드 작업 처리 중 오류:', error);
            const message = error instanceof Error ? error.message : String(error);
            new Notice(t(`작업 실패: ${message}`));
            return false;
        }
    }

    async createFlashcard(silent: boolean = false): Promise<boolean> {
        const success = await this.flashcardManager.createFlashcard(
            this.getHighlight(),
            this.getFileName(),
            silent
        );

        if (success) {
            this.callbacks.onCreated();
        }

        return success;
    }

    async deleteFlashcard(silent: boolean = false): Promise<boolean> {
        const result = await this.flashcardManager.deleteFlashcard(this.getHighlight(), silent);

        if (result.success) {
            this.callbacks.onDeleted();

            if (result.shouldDeleteHighlight && !silent) {
                await this.callbacks.onDeleteHighlightCompletely();
            }
        }

        return result.success;
    }

    private async canUseFlashcards(): Promise<boolean> {
        const licenseManager = new LicenseManager(this.plugin);
        const isActivated = await licenseManager.isActivated();
        return isActivated ? await licenseManager.isFeatureEnabled('flashcard') : false;
    }
}
