import { App } from "obsidian";
import type { ViewState } from "../hinote/ViewState";
import { DeviceManager, FileListManager } from "../managers";
import { FlashcardViewManager } from "../highlight";
import { LayoutManager } from "./LayoutManager";
import type { HighlightInfo } from "../../types/highlight";

interface ViewPositionControllerOptions {
    app: App;
    state: ViewState;
    highlightContainer: HTMLElement;
    loadingIndicator: HTMLElement;
    searchInput: HTMLInputElement;
    canvasUpdateDelay: number;
    getDeviceManager: () => DeviceManager | null;
    getFileListManager: () => FileListManager | null;
    getFlashcardViewManager: () => FlashcardViewManager | null;
    getLayoutManager: () => LayoutManager | null;
    updateHighlights: () => Promise<void>;
    updateAllHighlights: () => Promise<void>;
    renderHighlights: (highlights: HighlightInfo[]) => void;
}

export class ViewPositionController {
    constructor(private options: ViewPositionControllerOptions) {}

    async handlePositionChange(isInMainView: boolean, wasInAllHighlightsView: boolean): Promise<void> {
        this.options.state.isDraggedToMainView = isInMainView;

        if (isInMainView) {
            await this.enterMainView();
        } else {
            this.enterSidebarView(wasInAllHighlightsView);
        }

        await this.updateLayout();
        this.refreshActiveSearch();
    }

    private async enterMainView(): Promise<void> {
        const { state } = this.options;
        const deviceInfo = this.options.getDeviceManager()?.getDeviceInfo();
        if (deviceInfo?.isMobile && deviceInfo.isSmallScreen) {
            state.isShowingFileList = true;
        }

        const activeFile = this.options.app.workspace.getActiveFile();
        if (activeFile) {
            state.currentFile = activeFile;
            await this.options.updateHighlights();
        } else {
            state.currentFile = null;
            await this.options.updateAllHighlights();
        }

        this.syncFileListSelection();
    }

    private enterSidebarView(wasInAllHighlightsView: boolean): void {
        const { state } = this.options;

        if (state.isFlashcardMode) {
            state.isFlashcardMode = false;
            this.options.getFlashcardViewManager()?.exitFlashcardMode();
            this.syncFileListSelection();
        }

        const activeFile = this.options.app.workspace.getActiveFile();
        if (activeFile) {
            state.currentFile = activeFile;
            if (wasInAllHighlightsView) {
                this.options.highlightContainer.empty();
                this.options.highlightContainer.appendChild(this.options.loadingIndicator);
                window.setTimeout(() => {
                    void this.options.updateHighlights();
                }, this.options.canvasUpdateDelay);
            } else {
                void this.options.updateHighlights();
            }
        } else {
            state.highlights = [];
            this.options.renderHighlights([]);
        }
    }

    private syncFileListSelection(): void {
        const { state } = this.options;
        const fileListManager = this.options.getFileListManager();
        if (!fileListManager) return;

        fileListManager.updateState({
            currentFile: state.currentFile,
            isFlashcardMode: state.isFlashcardMode
        });
        fileListManager.updateFileListSelection();
    }

    private async updateLayout(): Promise<void> {
        const { state } = this.options;
        const layoutManager = this.options.getLayoutManager();
        if (!layoutManager) return;

        layoutManager.updateState({
            isDraggedToMainView: state.isDraggedToMainView,
            isFlashcardMode: state.isFlashcardMode,
            isShowingFileList: state.isShowingFileList
        });
        await layoutManager.updateViewLayout();
    }

    private refreshActiveSearch(): void {
        if (this.options.searchInput.value.trim() === '') return;

        const inputEvent = new Event('input', { bubbles: true });
        this.options.searchInput.dispatchEvent(inputEvent);
    }
}
