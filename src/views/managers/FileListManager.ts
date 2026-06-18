import { TFile } from "obsidian";
import { HighlightService } from "../../services/HighlightService";
import CommentPlugin from "../../../main";
import { LicenseManager } from "../../services/LicenseManager";
import { FileListDataSource } from "./FileListDataSource";
import { FileListItemRenderer } from "./FileListItemRenderer";

/**
 * 파일 목록 매니저
 * 파일 목록의 생성, 업데이트 및 상호작용을 관리
 */
export class FileListManager {
    private container: HTMLElement;
    private plugin: CommentPlugin;
    private dataSource: FileListDataSource;
    private itemRenderer: FileListItemRenderer;
    
    // 콜백 함수
    private onFileSelect: ((file: TFile | null) => void) | null = null;
    private onFlashcardModeToggle: ((enabled: boolean) => void) | null = null;
    private onAllHighlightsSelect: (() => void) | null = null;
    private onRefreshView: (() => Promise<void>) | null = null;
    
    // 상태
    private currentFile: TFile | null = null;
    private isFlashcardMode: boolean = false;
    private isMobileView: boolean = false;
    private isSmallScreen: boolean = false;
    private isDraggedToMainView: boolean = false;
    
    constructor(
        container: HTMLElement,
        plugin: CommentPlugin,
        highlightService: HighlightService,
        _licenseManager: LicenseManager
    ) {
        this.container = container;
        this.plugin = plugin;
        this.dataSource = new FileListDataSource(plugin, highlightService);
        this.itemRenderer = new FileListItemRenderer({
            plugin,
            dataSource: this.dataSource,
            getState: () => ({
                currentFile: this.currentFile,
                isFlashcardMode: this.isFlashcardMode,
                isDraggedToMainView: this.isDraggedToMainView
            }),
            onFileSelect: () => this.onFileSelect,
            onFlashcardModeToggle: () => this.onFlashcardModeToggle,
            onAllHighlightsSelect: () => this.onAllHighlightsSelect
        });
    }
    
    /**
     * 콜백 함수 설정
     */
    setCallbacks(callbacks: {
        onFileSelect?: (file: TFile | null) => void;
        onFlashcardModeToggle?: (enabled: boolean) => void;
        onAllHighlightsSelect?: () => void;
        onRefreshView?: () => Promise<void>;
    }) {
        if (callbacks.onFileSelect) {
            this.onFileSelect = callbacks.onFileSelect;
        }
        if (callbacks.onFlashcardModeToggle) {
            this.onFlashcardModeToggle = callbacks.onFlashcardModeToggle;
        }
        if (callbacks.onAllHighlightsSelect) {
            this.onAllHighlightsSelect = callbacks.onAllHighlightsSelect;
        }
        if (callbacks.onRefreshView) {
            this.onRefreshView = callbacks.onRefreshView;
        }
    }
    
    /**
     * 상태 업데이트
     */
    updateState(state: {
        currentFile?: TFile | null;
        isFlashcardMode?: boolean;
        isMobileView?: boolean;
        isSmallScreen?: boolean;
        isDraggedToMainView?: boolean;
    }) {
        if (state.currentFile !== undefined) {
            this.currentFile = state.currentFile;
        }
        if (state.isFlashcardMode !== undefined) {
            this.isFlashcardMode = state.isFlashcardMode;
        }
        if (state.isMobileView !== undefined) {
            this.isMobileView = state.isMobileView;
        }
        if (state.isSmallScreen !== undefined) {
            this.isSmallScreen = state.isSmallScreen;
        }
        if (state.isDraggedToMainView !== undefined) {
            this.isDraggedToMainView = state.isDraggedToMainView;
        }
    }
    
    /**
     * 파일 목록 생성 또는 업데이트
     * @param forceRefresh 강제 새로고침 여부 (캐시 초기화 후 재조회)
     */
    async updateFileList(forceRefresh: boolean = false) {
        // 강제 새로고침 시 캐시 초기화
        if (forceRefresh) {
            this.invalidateCache();
        }

        // 파일 목록이 이미 존재하고 강제 새로고침이 아닌 경우 선택 상태만 업데이트
        if (this.container.children.length > 0 && !forceRefresh) {
            this.updateFileListSelection();
            return;
        }

        // 파일 목록 생성 또는 재생성
        await this.createFileList();
    }
    
    /**
     * 파일 목록 생성
     */
    private async createFileList() {
        this.container.empty();

        // 파일 목록 헤더 생성
        const titleContainer = this.container.createEl("div", {
            cls: "highlight-file-list-header"
        });

        const titleEl = titleContainer.createEl("div", {
            text: "HiNote",
            cls: "highlight-file-list-title"
        });
        
        // 클릭 새로고침 기능 추가
        titleEl.setCssProps({ cursor: 'pointer' });
        titleEl.addEventListener("click", () => {
            void this.refreshFromTitle();
        });

        // 파일 목록 생성
        const fileList = this.container.createEl("div", {
            cls: "highlight-file-list"
        });

        // "전체" 항목 추가
        this.itemRenderer.createAllHighlightsItem(fileList);

        // 플래시카드 항목 추가
        this.itemRenderer.createFlashcardItem(fileList);

        // 구분선 추가
        fileList.createEl("div", {
            cls: "highlight-file-list-separator"
        });

        // 하이라이트가 포함된 모든 파일을 가져와 목록 항목 생성
        const files = await this.dataSource.getFilesWithHighlights();
        this.itemRenderer.updateAllHighlightsCount(fileList);

        for (const file of files) {
            await this.itemRenderer.createFileItem(fileList, file);
        }
    }

    private async refreshFromTitle(): Promise<void> {
        // 파일 목록 새로고침
        await this.updateFileList(true);
        // 메인 뷰의 하이라이트 카드 새로고침
        if (this.onRefreshView) {
            await this.onRefreshView();
        }
    }
    
    /**
     * 파일 목록 선택 상태 업데이트
     */
    updateFileListSelection() {
        this.itemRenderer.updateSelection(this.container);
    }
    
    /**
     * 캐시 초기화
     */
    invalidateCache(): void {
        this.dataSource.invalidateCache();
    }
    
    /**
     * 리소스 정리
     */
    destroy() {
        this.itemRenderer.destroy();
        this.container.empty();
        this.onFileSelect = null;
        this.onFlashcardModeToggle = null;
        this.onAllHighlightsSelect = null;
        this.onRefreshView = null;
    }
}
