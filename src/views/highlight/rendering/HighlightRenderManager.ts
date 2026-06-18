import { HighlightInfo, CommentItem } from '../../../types/highlight';
import { HighlightCard, defaultHighlightCardRegistry } from '../../../components/highlight';
import { SelectionManager } from '../../selection';
import { TFile } from 'obsidian';
import CommentPlugin from '../../../../main';
import { t } from '../../../i18n';

/**
 * 하이라이트 렌더링 매니저
 * 하이라이트 카드의 렌더링 및 표시 담당
 */
export class HighlightRenderManager {
    private static readonly MASONRY_MIN_COLUMN_WIDTH = 250;
    private static readonly MASONRY_GAP = 12;

    private container: HTMLElement;
    private plugin: CommentPlugin;
    private searchInput: HTMLInputElement;
    private selectionManager: SelectionManager | null = null;  // SelectionManager 인스턴스 저장

    // 콜백 함수
    private onHighlightClick: ((h: HighlightInfo) => Promise<void>) | null = null;
    private onCommentAdd: ((element: HTMLElement, h: HighlightInfo) => void) | null = null;
    private onCommentEdit: ((element: HTMLElement, h: HighlightInfo, c: CommentItem) => void) | null = null;
    private onExport: ((h: HighlightInfo) => void) | null = null;
    private onAIResponse: ((h: HighlightInfo, content: string) => Promise<void>) | null = null;
    
    // 상태
    private currentFile: TFile | null = null;
    private isDraggedToMainView: boolean = false;
    private highlightsWithFlashcards: Set<string> = new Set();
    private currentBatch: number = 0;
    private renderSequence = 0;
    private resizeObserver: ResizeObserver | null = null;
    private resizeTimer: number | null = null;
    private lastMasonryColumnCount = 0;
    
    constructor(
        container: HTMLElement,
        plugin: CommentPlugin,
        searchInput: HTMLInputElement
    ) {
        this.container = container;
        this.plugin = plugin;
        this.searchInput = searchInput;
        this.startResizeObserver();
    }
    
    /**
     * 콜백 함수 설정
     */
    setCallbacks(callbacks: {
        onHighlightClick?: (h: HighlightInfo) => Promise<void>;
        onCommentAdd?: (element: HTMLElement, h: HighlightInfo) => void;
        onCommentEdit?: (element: HTMLElement, h: HighlightInfo, c: CommentItem) => void;
        onExport?: (h: HighlightInfo) => void;
        onAIResponse?: (h: HighlightInfo, content: string) => Promise<void>;
    }) {
        if (callbacks.onHighlightClick) {
            this.onHighlightClick = callbacks.onHighlightClick;
        }
        if (callbacks.onCommentAdd) {
            this.onCommentAdd = callbacks.onCommentAdd;
        }
        if (callbacks.onCommentEdit) {
            this.onCommentEdit = callbacks.onCommentEdit;
        }
        if (callbacks.onExport) {
            this.onExport = callbacks.onExport;
        }
        if (callbacks.onAIResponse) {
            this.onAIResponse = callbacks.onAIResponse;
        }
    }
    
    /**
     * 상태 업데이트
     */
    updateState(state: {
        currentFile?: TFile | null;
        isDraggedToMainView?: boolean;
        highlightsWithFlashcards?: Set<string>;
        currentBatch?: number;
    }) {
        if (state.currentFile !== undefined) {
            this.currentFile = state.currentFile;
        }
        if (state.isDraggedToMainView !== undefined) {
            this.isDraggedToMainView = state.isDraggedToMainView;
        }
        if (state.highlightsWithFlashcards !== undefined) {
            this.highlightsWithFlashcards = state.highlightsWithFlashcards;
        }
        if (state.currentBatch !== undefined) {
            this.currentBatch = state.currentBatch;
        }
    }
    
    /**
     * 하이라이트 목록 렌더링
     */
    renderHighlights(
        highlightsToRender: HighlightInfo[],
        append = false,
        selectionManager?: SelectionManager
    ) {
        // SelectionManager 인스턴스 저장
        if (selectionManager) {
            this.selectionManager = selectionManager;
        }

        if (!append) {
            defaultHighlightCardRegistry.clearAll();

            this.container.empty();
            this.currentBatch = 0;
            this.renderSequence = 0;

            // 다중 선택 상태 초기화
            if (this.selectionManager) {
                this.selectionManager.clearSelection();
            }
        }

        if (highlightsToRender.length === 0) {
            this.renderEmptyState();
            return;
        }

        // 선택 기능 초기화
        if (this.selectionManager && !append) {
            this.selectionManager.initialize();
        }

        const highlightList = this.ensureHighlightList();
        this.syncMasonryColumns(highlightList);

        highlightsToRender.forEach((highlight) => {
            this.renderHighlightCard(this.getShortestMasonryColumn(highlightList), highlight);
        });
    }

    private ensureHighlightList(): HTMLElement {
        let highlightList = this.container.querySelector<HTMLElement>('.highlight-list');
        if (!highlightList) {
            highlightList = this.container.createEl("div", {
                cls: "highlight-list"
            });
        }
        return highlightList;
    }

    private syncMasonryColumns(highlightList: HTMLElement): void {
        const expectedColumnCount = this.getMasonryColumnCount(highlightList);
        this.lastMasonryColumnCount = expectedColumnCount;
        const columns = this.getMasonryColumns(highlightList);
        if (columns.length === expectedColumnCount) {
            return;
        }

        const cards = Array.from(highlightList.querySelectorAll<HTMLElement>('.highlight-card'))
            .sort((a, b) => Number(a.dataset.masonryOrder || 0) - Number(b.dataset.masonryOrder || 0));
        highlightList.empty();

        for (let index = 0; index < expectedColumnCount; index++) {
            highlightList.createEl('div', {
                cls: 'highlight-masonry-column'
            });
        }

        cards.forEach(card => {
            this.getShortestMasonryColumn(highlightList).appendChild(card);
        });
    }

    private getMasonryColumnCount(highlightList: HTMLElement): number {
        const width = highlightList.clientWidth || this.container.clientWidth;
        return Math.max(
            1,
            Math.floor((width + HighlightRenderManager.MASONRY_GAP) / (HighlightRenderManager.MASONRY_MIN_COLUMN_WIDTH + HighlightRenderManager.MASONRY_GAP))
        );
    }

    private getMasonryColumns(highlightList: HTMLElement): HTMLElement[] {
        return Array.from(highlightList.querySelectorAll<HTMLElement>('.highlight-masonry-column'));
    }

    private getShortestMasonryColumn(highlightList: HTMLElement): HTMLElement {
        const columns = this.getMasonryColumns(highlightList);
        if (columns.length === 0) {
            this.syncMasonryColumns(highlightList);
            return this.getMasonryColumns(highlightList)[0];
        }

        return columns.reduce((shortest, column) => {
            return column.scrollHeight < shortest.scrollHeight ? column : shortest;
        }, columns[0]);
    }

    private startResizeObserver(): void {
        this.resizeObserver = new ResizeObserver(() => {
            this.scheduleMasonryReflow();
        });
        this.resizeObserver.observe(this.container);
    }

    private scheduleMasonryReflow(): void {
        if (this.resizeTimer !== null) {
            window.clearTimeout(this.resizeTimer);
        }

        this.resizeTimer = window.setTimeout(() => {
            this.resizeTimer = null;
            this.reflowMasonryIfColumnCountChanged();
        }, 120);
    }

    private reflowMasonryIfColumnCountChanged(): void {
        const highlightList = this.container.querySelector<HTMLElement>('.highlight-list');
        if (!highlightList) return;

        const nextColumnCount = this.getMasonryColumnCount(highlightList);
        if (nextColumnCount === this.lastMasonryColumnCount) {
            return;
        }

        this.syncMasonryColumns(highlightList);
    }
    
    /**
     * 단일 하이라이트 카드 렌더링
     */
    private renderHighlightCard(container: HTMLElement, highlight: HighlightInfo) {
        // 특정 파일 뷰에서 하이라이트에 filePath가 있는지 확인
        if (this.currentFile && !highlight.filePath) {
            highlight.filePath = this.currentFile.path;
        }

        const highlightCard = new HighlightCard(
            container,
            highlight,
            this.plugin,
            {
                onHighlightClick: async (h: HighlightInfo) => {
                    if (this.onHighlightClick) {
                        await this.onHighlightClick(h);
                    }
                },
                onCommentAdd: (h: HighlightInfo) => {
                    if (this.onCommentAdd) {
                        this.onCommentAdd(highlightCard.getElement(), h);
                    }
                },
                onExport: (h: HighlightInfo) => {
                    if (this.onExport) {
                        this.onExport(h);
                    }
                },
                onCommentEdit: (h: HighlightInfo, c: CommentItem) => {
                    if (this.onCommentEdit) {
                        this.onCommentEdit(highlightCard.getElement(), h, c);
                    }
                },
                onAIResponse: async (content: string) => {
                    if (this.onAIResponse) {
                        await this.onAIResponse(highlight, content);
                    }
                }
            },
            this.isDraggedToMainView,
            // 전체 하이라이트 표시 시 (currentFile이 null이면) 하이라이트의 fileName 사용, 아니면 현재 파일명 사용
            this.currentFile === null ? highlight.fileName : this.currentFile.basename,
            this.selectionManager ?? undefined,  // SelectionManager 인스턴스 전달, null은 undefined로 변환
            defaultHighlightCardRegistry
        );
        
        // 하이라이트에 플래시카드가 이미 생성된 경우 즉시 UI 상태 업데이트
        if (highlight.id && this.highlightsWithFlashcards.has(highlight.id)) {
            window.setTimeout(() => {
                if (highlight.id) {
                    defaultHighlightCardRegistry.updateCardUIByHighlightId(highlight.id);
                }
            }, 0);
        }

        // 위치에 따라 스타일 업데이트
        const cardElement = highlightCard.getElement();
        cardElement.dataset.masonryOrder = String(this.renderSequence++);
        if (this.isDraggedToMainView) {
            cardElement.classList.add('in-main-view');
            // 텍스트 내용 요소를 찾아 클릭 힌트 제거
            const textContent = cardElement.querySelector('.highlight-text-content');
            if (textContent) {
                textContent.removeAttribute('title');
            }
        } else {
            cardElement.classList.remove('in-main-view');
        }
    }
    
    /**
     * 빈 상태 렌더링
     */
    private renderEmptyState() {
        // 검색어 존재 여부 확인
        const hasSearchTerm = this.searchInput && this.searchInput.value.trim() !== '';
        
        this.container.createEl("div", {
            cls: "highlight-empty-state",
            text: hasSearchTerm 
                ? t("No matching highlights found for your search.")
                : t("The current document has no highlighted content.")
        });
    }
    
    /**
     * 컨테이너 비우기
     */
    clear() {
        if (this.resizeTimer !== null) {
            window.clearTimeout(this.resizeTimer);
            this.resizeTimer = null;
        }
        defaultHighlightCardRegistry.clearAll();
        this.container.empty();
        this.lastMasonryColumnCount = 0;
    }

    destroy(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.clear();
    }
    
    /**
     * 현재 배치 가져오기
     */
    getCurrentBatch(): number {
        return this.currentBatch;
    }
    
    /**
     * 현재 배치 설정
     */
    setCurrentBatch(batch: number) {
        this.currentBatch = batch;
    }
}
