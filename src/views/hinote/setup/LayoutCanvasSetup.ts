import { App, WorkspaceLeaf } from "obsidian";
import { CanvasService } from "../../../services/CanvasService";
import { HighlightRepository } from "../../../repositories/HighlightRepository";
import { HighlightService } from "../../../services/HighlightService";
import { GlobalHighlightService, HighlightDataService } from "../../../services/highlight";
import { CanvasHighlightProcessor, FlashcardViewManager, HighlightListController } from "../../highlight";
import { LayoutManager, ViewPositionController, ViewPositionDetector } from "../../layout";
import { DeviceManager, FileListManager } from "../../managers";
import { ViewState } from "../ViewState";

interface LayoutAndCanvasSetupOptions {
    app: App;
    leaf: WorkspaceLeaf;
    containerEl: HTMLElement;
    state: ViewState;
    canvasService: CanvasService;
    canvasUpdateDelay: number;
    deviceManager: DeviceManager;
    highlightRepository: HighlightRepository;
    highlightService: HighlightService;
    highlightDataService: HighlightDataService;
    fileListManager: FileListManager;
    flashcardViewManager: FlashcardViewManager;
    highlightListController: HighlightListController;
    fileListContainer: HTMLElement;
    mainContentContainer: HTMLElement;
    searchContainer: HTMLElement;
    searchInput: HTMLInputElement;
    highlightContainer: HTMLElement;
    loadingIndicator: HTMLElement;
}

export function setupLayoutAndCanvas(options: LayoutAndCanvasSetupOptions): {
    layoutManager: LayoutManager;
    viewPositionDetector: ViewPositionDetector;
    viewPositionController: ViewPositionController;
    canvasProcessor: CanvasHighlightProcessor;
    globalHighlightService: GlobalHighlightService;
} {
    const {
        app,
        leaf,
        containerEl,
        state,
        canvasService,
        canvasUpdateDelay,
        deviceManager,
        highlightRepository,
        highlightService,
        highlightDataService,
        fileListManager,
        flashcardViewManager,
        highlightListController,
        fileListContainer,
        mainContentContainer,
        searchContainer,
        searchInput,
        highlightContainer,
        loadingIndicator
    } = options;

    const layoutManager = new LayoutManager(
        containerEl,
        fileListContainer,
        mainContentContainer,
        searchContainer
    );
    layoutManager.setCallbacks({
        onCreateFloatingButton: () => {},
        onRemoveFloatingButton: () => {},
        onUpdateFileList: async (forceRefresh?: boolean) => {
            fileListManager.updateState({
                currentFile: state.currentFile,
                isFlashcardMode: state.isFlashcardMode,
                isMobileView: state.isMobileView,
                isSmallScreen: state.isSmallScreen,
                isDraggedToMainView: state.isDraggedToMainView
            });
            await fileListManager.updateFileList(forceRefresh);
        }
    });

    const viewPositionDetector = new ViewPositionDetector(app, leaf);
    const viewPositionController = new ViewPositionController({
        app,
        state,
        highlightContainer,
        loadingIndicator,
        searchInput,
        canvasUpdateDelay,
        getDeviceManager: () => deviceManager,
        getFileListManager: () => fileListManager,
        getFlashcardViewManager: () => flashcardViewManager,
        getLayoutManager: () => layoutManager,
        updateHighlights: async () => await highlightListController.updateHighlights(),
        updateAllHighlights: async () => await highlightListController.updateAllHighlights(),
        renderHighlights: (highlights) => highlightListController.renderHighlights(highlights)
    });

    const globalHighlightService = new GlobalHighlightService(
        app,
        highlightService,
    );

    const canvasProcessor = new CanvasHighlightProcessor(
        app,
        canvasService,
        highlightDataService
    );
    canvasProcessor.setCallbacks({
        onShowLoading: () => {
            highlightContainer.empty();
            highlightContainer.appendChild(loadingIndicator);
            loadingIndicator.removeClass("highlight-display-none");
        },
        onHideLoading: () => {
            loadingIndicator.addClass("highlight-display-none");
        },
        onShowError: (message) => {
            highlightContainer.empty();
            highlightContainer.createDiv({
                cls: "error-message",
                text: message
            });
        },
        onShowEmpty: (message) => {
            highlightContainer.empty();
            highlightContainer.createDiv({
                cls: "no-highlights-message",
                text: message
            });
        }
    });
    viewPositionDetector.setCallbacks({
        onPositionChange: async (isInMainView, wasInAllHighlightsView) => {
            await viewPositionController.handlePositionChange(isInMainView, wasInAllHighlightsView);
        }
    });

    return {
        layoutManager,
        viewPositionDetector,
        viewPositionController,
        canvasProcessor,
        globalHighlightService
    };
}
