import { Notice, setIcon } from "obsidian";
import { HighlightInfo } from "../../types/highlight";
import CommentPlugin from "../../../main";
import { ExportService } from "../../services/ExportService";
import { LicenseManager } from "../../services/LicenseManager";
import { HighlightService } from "../../services/HighlightService";
import { t } from "../../i18n";
import { BatchFlashcardOperations } from "./BatchFlashcardOperations";
import { BatchHighlightDeletionOperations } from "./BatchHighlightDeletionOperations";
import { BatchExportOperations } from "./BatchExportOperations";

/**
 * 일괄 작업 핸들러
 * 선택된 하이라이트에 대한 일괄 작업 처리 담당:
 * - 일괄 내보내기
 * - 일괄 플래시카드 생성/삭제
 * - 일괄 하이라이트 삭제
 */
export class BatchOperationsHandler {
    private plugin: CommentPlugin;
    private exportService: ExportService;
    private licenseManager: LicenseManager;
    private highlightService: HighlightService;
    private containerEl: HTMLElement;
    private multiSelectActionsContainer: HTMLElement | null = null;
    private exportOperations: BatchExportOperations | null = null;
    private flashcardOperations: BatchFlashcardOperations | null = null;
    private deletionOperations: BatchHighlightDeletionOperations | null = null;
    
    // 콜백 함수
    private getSelectedHighlightsCallback: () => Set<HighlightInfo>;
    
    constructor(
        plugin: CommentPlugin,
        exportService: ExportService,
        licenseManager: LicenseManager,
        highlightService: HighlightService,
        containerEl: HTMLElement
    ) {
        this.plugin = plugin;
        this.exportService = exportService;
        this.licenseManager = licenseManager;
        this.highlightService = highlightService;
        this.containerEl = containerEl;
    }
    
    /**
     * 콜백 함수 설정
     */
    setCallbacks(
        getSelectedHighlights: () => Set<HighlightInfo>,
        onClearSelection: () => void,
        onRefreshView: () => Promise<void>
    ) {
        this.getSelectedHighlightsCallback = getSelectedHighlights;
        this.exportOperations = new BatchExportOperations({
            exportService: this.exportService,
            getSelectedHighlights,
            clearSelection: onClearSelection
        });
        this.flashcardOperations = new BatchFlashcardOperations({
            plugin: this.plugin,
            licenseManager: this.licenseManager,
            getSelectedHighlights,
            clearSelection: onClearSelection,
            refreshView: onRefreshView
        });
        this.deletionOperations = new BatchHighlightDeletionOperations({
            plugin: this.plugin,
            highlightService: this.highlightService,
            getSelectedHighlights,
            clearSelection: onClearSelection
        });
    }
    
    /**
     * 다중 선택 작업 버튼 표시
     */
    async showMultiSelectActions(selectedCount: number) {
        if (selectedCount <= 1) {
            this.hideMultiSelectActions();
            return;
        }

        // 이미 존재하는 경우 먼저 제거
        this.hideMultiSelectActions();

        // 다중 선택 작업 컨테이너 생성
        if (!this.multiSelectActionsContainer) {
            this.multiSelectActionsContainer = this.containerEl.createEl('div', {
                cls: 'multi-select-actions'
            });
        }

        this.multiSelectActionsContainer.show();
        this.multiSelectActionsContainer.empty();

        // 제목 추가
        this.multiSelectActionsContainer.createEl('div', {
            cls: 'selected-count',
            text: `selected ${selectedCount}`
        });

        // 내보내기 버튼 추가
        this.createExportButton();

        // 플래시카드 관련 버튼 추가
        await this.createFlashcardButtons();

        // 삭제 버튼 추가
        this.createDeleteButton();
    }
    
    /**
     * 다중 선택 작업 버튼 숨김
     */
    hideMultiSelectActions() {
        if (this.multiSelectActionsContainer) {
            this.multiSelectActionsContainer.empty();
            this.multiSelectActionsContainer.hide();
        }
    }
    
    /**
     * 내보내기 버튼 생성
     */
    private createExportButton() {
        if (!this.multiSelectActionsContainer) return;
        
        const exportButton = this.multiSelectActionsContainer.createEl('div', {
            cls: 'multi-select-action-button'
        });
        exportButton.setAttribute('aria-label', t('Export'));
        setIcon(exportButton, 'file-input');
        exportButton.addEventListener('click', () => {
            void this.exportOperations?.exportSelectedHighlights();
        });
    }
    
    /**
     * 플래시카드 관련 버튼 생성
     */
    private async createFlashcardButtons() {
        if (!this.multiSelectActionsContainer) return;

        const fsrsManager = this.plugin.fsrsManager;
        if (!fsrsManager) {
            this.createDefaultFlashcardButton();
            return;
        }

        // 선택된 하이라이트 중 플래시카드가 생성된 항목 수 확인
        const selectedHighlights = this.getSelectedHighlightsCallback();
        let existingFlashcardCount = 0;

        for (const highlight of selectedHighlights) {
            if (highlight.id) {
                const existingCards = fsrsManager.findCardsBySourceId(highlight.id, 'highlight');
                if (existingCards && existingCards.length > 0) {
                    existingFlashcardCount++;
                }
            }
        }

        // 기존 플래시카드 수에 따라 표시할 버튼 결정
        if (existingFlashcardCount === 0) {
            this.createFlashcardCreateButton();
        } else if (existingFlashcardCount === selectedHighlights.size) {
            this.createFlashcardDeleteButton();
        } else {
            this.createFlashcardManageButton();
        }
    }
    
    /**
     * 기본 플래시카드 버튼 생성
     */
    private createDefaultFlashcardButton() {
        if (!this.multiSelectActionsContainer) return;
        
        const button = this.multiSelectActionsContainer.createEl('div', {
            cls: 'multi-select-action-button'
        });
        button.setAttribute('aria-label', t('Create HiCard'));
        setIcon(button, 'book-plus');
        button.addEventListener('click', () => {
            new Notice(t('HiCard function is not initialized, please enable FSRS function'));
        });
    }
    
    /**
     * 플래시카드 생성 버튼 생성
     */
    private createFlashcardCreateButton() {
        if (!this.multiSelectActionsContainer) return;

        const createButton = this.multiSelectActionsContainer.createEl('div', {
            cls: 'multi-select-action-button'
        });
        createButton.setAttribute('aria-label', t('Create HiCard'));
        setIcon(createButton, 'book-plus');

        // 라이선스 상태 확인
        void this.licenseManager.isActivated().then(isActivated => {
            if (isActivated) {
                return this.licenseManager.isFeatureEnabled('flashcard').then(isEnabled => {
                    if (!isEnabled) {
                        createButton.addClass('disabled-button');
                        createButton.setAttribute('aria-label', t('Only HiNote Pro'));
                    }
                });
            }

            createButton.addClass('disabled-button');
            createButton.setAttribute('aria-label', t('Only HiNote Pro'));
        }).catch(error => {
            console.error('[HiNote] Failed to check flashcard license:', error);
            createButton.addClass('disabled-button');
            createButton.setAttribute('aria-label', t('Only HiNote Pro'));
        });

        createButton.addEventListener('click', () => {
            if (createButton.hasClass('disabled-button')) {
                new Notice(t('Only HiNote Pro'));
                return;
            }
            void this.flashcardOperations?.createMissingFlashcards();
        });
    }
    
    /**
     * 플래시카드 삭제 버튼 생성
     */
    private createFlashcardDeleteButton() {
        if (!this.multiSelectActionsContainer) return;
        
        const deleteButton = this.multiSelectActionsContainer.createEl('div', {
            cls: 'multi-select-action-button delete-flashcard-button'
        });
        deleteButton.setAttribute('aria-label', t('Delete HiCard'));
        setIcon(deleteButton, 'book-x');
        deleteButton.addEventListener('click', () => {
            this.flashcardOperations?.confirmDeleteFlashcards();
        });
    }
    
    /**
     * 플래시카드 관리 버튼 생성
     */
    private createFlashcardManageButton() {
        if (!this.multiSelectActionsContainer) return;
        
        const manageButton = this.multiSelectActionsContainer.createEl('div', {
            cls: 'multi-select-action-button'
        });
        manageButton.setAttribute('aria-label', t('Manage HiCard'));
        setIcon(manageButton, 'book-heart');
        manageButton.addEventListener('click', (event) => {
            this.flashcardOperations?.showManageMenu(event);
        });
    }
    
    /**
     * 삭제 버튼 생성
     */
    private createDeleteButton() {
        if (!this.multiSelectActionsContainer) return;
        
        const deleteButton = this.multiSelectActionsContainer.createEl('div', {
            cls: 'multi-select-action-button'
        });
        deleteButton.setAttribute('aria-label', t('Delete'));
        setIcon(deleteButton, 'trash');
        deleteButton.addEventListener('click', () => {
            this.deletionOperations?.confirmDeleteSelectedHighlights();
        });
    }
    
    /**
     * 리소스 정리
     */
    destroy() {
        this.hideMultiSelectActions();
        if (this.multiSelectActionsContainer) {
            this.multiSelectActionsContainer.remove();
            this.multiSelectActionsContainer = null;
        }
    }
}
