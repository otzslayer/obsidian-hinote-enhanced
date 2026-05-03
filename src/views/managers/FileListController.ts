import { TFile } from "obsidian";
import { LicenseManager } from "../../services/LicenseManager";
import { FlashcardViewManager } from "../highlight";
import { FileListManager } from "./FileListManager";
import type { ViewState } from "../../core/ViewState";

interface FileListControllerOptions {
    state: ViewState;
    fileListManager: FileListManager;
    flashcardViewManager: FlashcardViewManager;
    highlightContainer: HTMLElement;
    searchContainer: HTMLElement;
    licenseManager: LicenseManager;
    updateViewLayout: () => Promise<void>;
    updateHighlights: () => Promise<void>;
    updateAllHighlights: () => Promise<void>;
}

export class FileListController {
    constructor(private options: FileListControllerOptions) {}

    getCallbacks() {
        return {
            onFileSelect: async (file: TFile | null) => this.selectFile(file),
            onFlashcardModeToggle: async (enabled: boolean) => this.toggleFlashcardMode(enabled),
            onAllHighlightsSelect: async () => this.selectAllHighlights(),
            onRefreshView: async () => this.refreshCurrentView()
        };
    }

    private async selectFile(file: TFile | null): Promise<void> {
        const { state } = this.options;

        state.currentFile = file;
        state.isFlashcardMode = false;
        this.options.flashcardViewManager.exitFlashcardMode();
        this.resetHighlightContainer();
        this.syncFileListState();
        this.showSearchActions();
        await this.enterContentPaneOnSmallMobile();
        await this.options.updateHighlights();
    }

    private async toggleFlashcardMode(enabled: boolean): Promise<void> {
        const { state } = this.options;

        state.currentFile = null;
        state.isFlashcardMode = enabled;
        this.syncFileListState();
        this.options.searchContainer.addClass('highlight-display-none');
        this.options.highlightContainer.empty();
        await this.enterContentPaneOnSmallMobile();
        await this.options.flashcardViewManager.activateFlashcardMode(
            this.options.highlightContainer,
            this.options.licenseManager
        );
    }

    private async selectAllHighlights(): Promise<void> {
        const { state } = this.options;

        state.currentFile = null;
        state.isFlashcardMode = false;
        this.options.flashcardViewManager.exitFlashcardMode();
        this.resetHighlightContainer();
        this.syncFileListState();
        this.options.searchContainer.removeClass('highlight-display-none');
        this.hideSearchActions();
        await this.enterContentPaneOnSmallMobile();
        await this.options.updateAllHighlights();
    }

    private async refreshCurrentView(): Promise<void> {
        const { state } = this.options;

        if (state.isFlashcardMode) {
            await this.options.flashcardViewManager.activateFlashcardMode(
                this.options.highlightContainer,
                this.options.licenseManager
            );
        } else if (state.currentFile === null) {
            await this.options.updateAllHighlights();
        } else {
            await this.options.updateHighlights();
        }
    }

    private resetHighlightContainer(): void {
        this.options.highlightContainer.empty();
        this.options.highlightContainer.removeClass('flashcard-mode');
    }

    private syncFileListState(): void {
        const { state, fileListManager } = this.options;
        fileListManager.updateState({
            currentFile: state.currentFile,
            isFlashcardMode: state.isFlashcardMode
        });
        fileListManager.updateFileListSelection();
    }

    private async enterContentPaneOnSmallMobile(): Promise<void> {
        const { state } = this.options;
        if (state.isMobileView && state.isSmallScreen && state.isDraggedToMainView) {
            state.isShowingFileList = false;
            await this.options.updateViewLayout();
        }
    }

    private showSearchActions(): void {
        this.options.searchContainer.removeClass('highlight-display-none');
        const iconButtons = this.getSearchActionsContainer();
        iconButtons?.removeClass('highlight-display-none');
    }

    private hideSearchActions(): void {
        const iconButtons = this.getSearchActionsContainer();
        iconButtons?.addClass('highlight-display-none');
    }

    private getSearchActionsContainer(): HTMLElement | null {
        return this.options.searchContainer.querySelector('.highlight-search-icons');
    }
}
