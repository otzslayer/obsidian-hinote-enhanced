import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { CanvasService } from '../../services/CanvasService';
import { HighlightInfo } from '../../types/highlight';
import { HighlightManager } from '../../services/HighlightManager';
import { HighlightRepository } from '../../repositories/HighlightRepository';
import CommentPlugin from '../../../main';
import { HighlightService } from '../../services/HighlightService';
import { LocationService } from '../../services/LocationService';
import { ExportService } from '../../services/ExportService';
import {t} from "../../i18n";
import { LicenseManager } from '../../services/LicenseManager';
import { ExportManager, FlashcardViewManager, VirtualHighlightManager } from '../highlight';
import { DeviceManager, EventCoordinator, UIInitializer } from '../managers';
import { ViewState } from './ViewState';
import { setupHiNoteView } from './HiNoteViewSetup';
import { HiNoteViewSetupResult } from './HiNoteViewSetupTypes';
import type { PluginServices } from '../../plugin/PluginServices';

export const VIEW_TYPE_HINOTE = "hinote-enhanced-view";

/**
 * HiNote 메인 뷰
 * 하이라이트, 댓글, 플래시카드 등 핵심 기능의 표시 및 관리를 담당
 */
export class HiNoteView extends ItemView {
    // === 상수 정의 ===
    private static readonly CANVAS_UPDATE_DELAY = 10; // Canvas 업데이트 지연 시간 (밀리초)

    // === 뷰 상태 (중앙 관리) ===
    private state = new ViewState();

    // === 핵심 서비스 ===
    private plugin: CommentPlugin;
    private highlightManager: HighlightManager;
    private highlightRepository: HighlightRepository;
    private locationService: LocationService;
    private exportService: ExportService;
    private highlightService: HighlightService;
    private licenseManager: LicenseManager;
    private canvasService: CanvasService;

    // === 뷰 조립 결과물 ===
    private setupResult: HiNoteViewSetupResult | null = null;
    private exportManager: ExportManager | null = null;
    private virtualHighlightManager: VirtualHighlightManager | null = null;
    private flashcardViewManager: FlashcardViewManager | null = null;
    private deviceManager: DeviceManager | null = null;
    private uiInitializer: UIInitializer | null = null;
    private eventCoordinator: EventCoordinator | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: CommentPlugin, services: PluginServices) {
        super(leaf);
        this.plugin = plugin;
        this.highlightManager = services.highlightManager;
        this.highlightRepository = services.highlightRepository;
        // LocationService 초기화 (TextSimilarityService 의존성 제거됨)
        this.locationService = new LocationService(this.app);
        this.highlightService = services.highlightService;
        this.exportService = new ExportService(
            this.app,
            this.highlightService,
            () => this.plugin.settings
        );
        this.licenseManager = new LicenseManager(this.plugin);
        this.canvasService = services.canvasService;
        
        // === 새 Manager 초기화 (이벤트 등록 전에 초기화해야 함) ===
        this.deviceManager = new DeviceManager();
        this.uiInitializer = new UIInitializer();
        this.eventCoordinator = new EventCoordinator(this.app, this, services.eventManager);
        this.exportManager = new ExportManager(this.app, this.exportService);
        this.virtualHighlightManager = new VirtualHighlightManager(this.app, this.highlightManager);
        this.flashcardViewManager = new FlashcardViewManager(this.app, this.plugin);
    }

    getViewType(): string {
        return VIEW_TYPE_HINOTE;
    }

    getDisplayText(): string {
        return "HiNote Enhanced";
    }

    getIcon(): string {
        return "highlighter";  // 좌측 기능 패널과 동일한 아이콘 사용
    }

    isInMainWindowMode(): boolean {
        return this.state.isDraggedToMainView;
    }

    async setMainWindowMode(enabled: boolean, refreshHighlights = false): Promise<void> {
        this.state.isDraggedToMainView = enabled;
        this.setupResult?.fileListManager.invalidateCache();
        await this.updateViewLayout();

        if (refreshHighlights) {
            void this.setupResult?.highlightListController.updateHighlights().catch(error => {
                console.error('[HiNoteView] Failed to refresh highlights after mode switch:', error);
            });
        }
    }

    async onOpen() {
        this.setupResult = await setupHiNoteView({
            app: this.app,
            component: this,
            leaf: this.leaf,
            containerEl: this.containerEl,
            state: this.state,
            plugin: this.plugin,
            highlightManager: this.highlightManager,
            highlightRepository: this.highlightRepository,
            highlightService: this.highlightService,
            licenseManager: this.licenseManager,
            exportService: this.exportService,
            canvasService: this.canvasService,
            deviceManager: this.deviceManager!,
            uiInitializer: this.uiInitializer!,
            eventCoordinator: this.eventCoordinator!,
            exportManager: this.exportManager!,
            virtualHighlightManager: this.virtualHighlightManager!,
            flashcardViewManager: this.flashcardViewManager!,
            canvasUpdateDelay: HiNoteView.CANVAS_UPDATE_DELAY,
            jumpToHighlight: async (highlight) => await this.jumpToHighlight(highlight),
            checkViewPosition: async () => await this.checkViewPosition(),
            updateViewLayout: async () => await this.updateViewLayout()
        });
    }

    private async jumpToHighlight(highlight: HighlightInfo) {
        if (this.state.isDraggedToMainView) {
            // 메인 뷰에 있을 경우 이동을 실행하지 않음
            return;
        }

        // 전역 검색 결과인 경우 이동을 조용히 차단
        if (highlight.isGlobalSearch) {
            return;
        }

        if (!this.state.currentFile) {
            new Notice(t("No corresponding file found."));
            return;
        }
        await this.locationService.jumpToHighlight(highlight, this.state.currentFile.path);
    }

    // 뷰 위치 확인 (ViewPositionDetector 사용)
    private async checkViewPosition() {
        if (this.setupResult) {
            const wasInAllHighlightsView = this.setupResult.highlightListController.isInAllHighlightsView();
            await this.setupResult.viewPositionDetector.checkViewPosition(wasInAllHighlightsView);
        }
    }
    
    // 뷰 레이아웃 업데이트 (LayoutManager 사용)
    private async updateViewLayout() {
        if (this.setupResult) {
            this.setupResult.layoutManager.updateState({
                isDraggedToMainView: this.state.isDraggedToMainView,
                isFlashcardMode: this.state.isFlashcardMode,
                isShowingFileList: this.state.isShowingFileList
            });
            await this.setupResult.layoutManager.updateViewLayout();
            
            // 디바이스 정보 동기화 (DeviceManager 사용)
            const deviceInfo = this.deviceManager!.getDeviceInfo();
            this.state.isMobileView = deviceInfo.isMobile;
            this.state.isSmallScreen = deviceInfo.isSmallScreen;
        }
    }

    // onunload에서 정리 작업 보장
    onunload() {
        // destroy 메서드를 가진 매니저 정리
        this.setupResult?.searchUIManager.destroy();
        this.setupResult?.selectionManager.destroy();
        this.setupResult?.batchOperationsHandler.destroy();
        this.setupResult?.fileListManager.destroy();
        this.setupResult?.highlightRenderManager.destroy();
        this.setupResult?.commentInputManager.clearEditingState();
        this.deviceManager?.destroy();
        
        this.setupResult = null;
    }

}
