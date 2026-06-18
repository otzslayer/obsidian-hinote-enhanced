import { HighlightInfo, CommentItem } from "../../types/highlight";
import type CommentPlugin from "../../../main";
import { Notice } from "obsidian";
import { t } from "../../i18n";
import { SelectionManager } from "../../views/selection";
import { HighlightDeletionManager, HighlightIconManager } from "../../views/highlight";
import {
    HighlightCardClipboard,
    HighlightCardDragController,
    HighlightCardFileNavigator,
    HighlightCardFlashcardController,
    HighlightCardMenuController,
    HighlightCardSelectionController,
    HighlightCardTitleBarRenderer
} from "./card";
import { defaultHighlightCardRegistry, HighlightCardRegistry } from "./HighlightCardRegistry";
import {
    createHighlightCardElement,
    renderHighlightCardComments,
    renderHighlightCardContent
} from "./HighlightCardView";

export class HighlightCard {
    private card: HTMLElement;
    private fileName: string | undefined;
    private hasFlashcard: boolean = false; // 플래시카드 상태 저장
    private dragController: HighlightCardDragController;
    private flashcardController: HighlightCardFlashcardController;
    private fileNavigator: HighlightCardFileNavigator;
    private selectionController: HighlightCardSelectionController;
    private titleBarRenderer: HighlightCardTitleBarRenderer;
    private menuController = new HighlightCardMenuController();
    
    // 매니저 인스턴스
    private deletionManager: HighlightDeletionManager;

    constructor(
        private container: HTMLElement,
        private highlight: HighlightInfo,
        private plugin: CommentPlugin,
        private options: {
            onHighlightClick: (highlight: HighlightInfo) => Promise<void>;
            onCommentAdd: (highlight: HighlightInfo) => void;
            onExport: (highlight: HighlightInfo) => void;
            onCommentEdit: (highlight: HighlightInfo, comment: CommentItem) => void;
            onAIResponse: (content: string) => Promise<void>;
        },
        private isInMainView: boolean = false,
        fileName?: string,
        private selectionManager?: SelectionManager,  // SelectionManager 인스턴스
        private registry: HighlightCardRegistry = defaultHighlightCardRegistry
    ) {
        this.fileName = fileName;
        this.highlight = highlight;
        this.plugin = plugin;
        this.options = options;
        this.fileName = this.highlight.filePath?.split('/').pop();
        
        // 매니저 초기화
        this.deletionManager = new HighlightDeletionManager(plugin);
        this.dragController = new HighlightCardDragController(plugin, () => this.highlight);
        this.selectionController = new HighlightCardSelectionController({
            getCard: () => this.card,
            getHighlight: () => this.highlight,
            getSelectionManager: () => this.selectionManager,
            onCommentAdd: (highlight) => this.options.onCommentAdd(highlight)
        });
        this.fileNavigator = new HighlightCardFileNavigator(
            plugin,
            () => this.highlight,
            () => this.fileName
        );
        this.titleBarRenderer = new HighlightCardTitleBarRenderer({
            plugin,
            getHighlight: () => this.highlight,
            getFileName: () => this.fileName,
            isInMainView: this.isInMainView,
            dragController: this.dragController,
            fileNavigator: this.fileNavigator,
            hasFlashcard: () => this.checkHasFlashcard(),
            onAIResponse: async (content) => {
                await this.options.onAIResponse(content);
            },
            onMoreActions: (button) => this.toggleMoreActionsDropdown(button)
        });
        this.flashcardController = new HighlightCardFlashcardController(
            plugin,
            () => this.highlight,
            () => this.fileName,
            {
                onCreated: () => {
                    this.hasFlashcard = true;
                    this.updateIconsAfterCardCreation();
                },
                onDeleted: () => {
                    this.hasFlashcard = false;
                    this.updateIconsAfterCardDeletion();
                },
                onDeleteHighlightCompletely: () => this.deletionManager.deleteHighlightCompletely(this.highlight)
            }
        );
        
        this.registry.register(this);
        
        this.render();
    }

    private render() {
        this.card = createHighlightCardElement(this.container, this.highlight);

        // 선택 상태 전환을 위한 클릭 이벤트 추가, 다중 선택 지원
        this.card.addEventListener("click", (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (this.selectionController.shouldIgnoreCardClick(target)) {
                return;
            }
            
            this.selectCard(e);
        });
        
        this.titleBarRenderer.render(this.card);

        renderHighlightCardContent(
            this.card,
            this.highlight,
            this.plugin.app,
            this.isInMainView,
            this.options.onHighlightClick
        );

        this.renderComments();
    }
    
    /**
     * 댓글 입력창 표시
     * 외부에서 호출하여 댓글 입력창을 직접 표시하는 용도
     */
    public showCommentInput(): void {
        // 모든 카드의 포커스 해제 입력창 초기화
        this.registry.clearAllUnfocusedInputs();
        this.selectionController.showCommentInput();
    }

    // 카드 선택 메서드 추가, 다중 선택 및 선택 해제 지원
    private selectCard(event?: MouseEvent) {
        // 먼저 모든 카드의 포커스 해제 입력창 초기화
        this.registry.clearAllUnfocusedInputs();
        this.selectionController.selectCard(event);
    }
    
    public getElement(): HTMLElement {
        return this.card;
    }

    public getHighlightId(): string | undefined {
        return this.highlight.id;
    }

    public clearUnfocusedInput(): void {
        this.selectionController.removeUnfocusedInput();
    }

    public handleInputShown(): void {
        this.selectionController.handleInputShown();
    }

    public handleInputClosed(): void {
        this.selectionController.handleInputClosed();
    }

    public update(highlight: HighlightInfo) {
        this.highlight = highlight;
        this.selectionController.resetEditing();
        this.card.empty();
        this.render();
    }

    /**
     * 하이라이트 및 주석 내용 복사
     */
    private copyHighlightContent(): void {
        HighlightCardClipboard.copyHighlightContent(this.highlight, this.fileName);
    }
    
    /**
     * 이미지로 내보내기 기능 처리
     */
    private handleExportAsImage(): void {
        this.options.onExport(this.highlight);
    }

    /**
     * 추가 액션 드롭다운 메뉴 표시/숨김 전환
     * @param dropdown 드롭다운 메뉴 요소
     * @param button 메뉴를 트리거하는 버튼 요소
     */
    private toggleMoreActionsDropdown(button: HTMLElement) {
        // 플래시카드 상태 확인
        this.hasFlashcard = this.checkHasFlashcard();

        this.menuController.show(button, this.hasFlashcard, {
            onToggleFlashcard: () => this.handleCreateHiCard(),
            onCopyHighlight: () => this.copyHighlightContent(),
            onExportImage: () => this.handleExportAsImage(),
            onDeleteHighlight: () => this.handleDeleteHighlight()
        });
    }

    /**
     * 하이라이트에 플래시카드가 이미 생성되었는지 확인
     * @returns 플래시카드 생성 여부
     */
    private checkHasFlashcard(): boolean {
        return this.flashcardController.checkHasFlashcard();
    }
    
    /**
     * HiCard 생성/삭제 로직 처리
     */
    private async handleCreateHiCard() {
        await this.flashcardController.toggleFlashcard();
    }

    /**
     * 공개 메서드: 하이라이트의 플래시카드 삭제
     * 외부에서 호출 가능하며, 일괄 삭제에 사용
     * @param silent 무음 모드 여부 (알림 미표시, 이벤트 미발생)
     * @returns 삭제 성공 여부
     */
    public async deleteHiCardForHighlight(silent: boolean = false): Promise<boolean> {
        return this.flashcardController.deleteFlashcard(silent);
    }

    /**
     * 공개 메서드: 하이라이트의 플래시카드 생성
     * 외부에서 호출 가능하며, 일괄 생성에 사용
     * @returns 생성 성공 여부
     */
    public async createHiCardForHighlight(silent: boolean = false): Promise<boolean> {
        return this.flashcardController.createFlashcard(silent);
    }

    /**
     * 플래시카드 삭제 후 아이콘 표시 업데이트
     */
    private updateIconsAfterCardDeletion() {
        HighlightIconManager.updateCardIcons(this.card, false);
    }

    /**
     * 플래시카드 생성 후 아이콘 표시 업데이트
     */
    public updateIconsAfterCardCreation() {
        HighlightIconManager.updateCardIcons(this.card, true);
    }

    /**
     * 하이라이트 삭제 로직 처리
     * 이 메서드는 에디터의 하이라이트 형식과 주석 데이터를 삭제
     * @param skipConfirmation 확인 대화상자 건너뛰기 여부, 기본값 false
     * @param skipNotice 성공 알림 건너뛰기 여부, 기본값 false
     */
    public async handleDeleteHighlight(skipConfirmation: boolean = false, skipNotice: boolean = false) {
        try {
            // 플래시카드가 있으면 먼저 삭제
            if (this.hasFlashcard) {
                await this.deleteHiCardForHighlight(true); // 무음 모드, 알림 미표시
            }

            // 삭제 매니저에 위임
            const success = await this.deletionManager.deleteHighlight(
                this.highlight,
                skipConfirmation,
                skipNotice
            );
            
            if (success) {
                // 카드 제거
                this.card.remove();

                this.registry.unregister(this);
            }
        } catch (error) {
            console.error('하이라이트 삭제 중 오류:', error);
            const message = error instanceof Error ? error.message : String(error);
            new Notice(t(`하이라이트 삭제 실패: ${message}`));
        }
    }
    
    /**
     * 댓글 목록 업데이트 (댓글 부분만 업데이트하며 전체 카드를 다시 렌더링하지 않음)
     */
    public updateComments(updatedHighlight: HighlightInfo): void {
        // 하이라이트 데이터 업데이트
        this.highlight = updatedHighlight;

        // 편집 상태 리셋, 카드 재선택 허용
        this.selectionController.resetEditing();

        // 댓글 목록 컨테이너 탐색
        const commentsSection = this.card.querySelector('.hi-notes-section');

        if (commentsSection) {
            // 댓글 목록이 있으면 제거
            commentsSection.remove();
        }
        
        this.renderComments();
    }

    private renderComments(): void {
        renderHighlightCardComments(
            this.card,
            this.highlight,
            this.plugin.app,
            (comment) => {
                this.selectionController.markEditing();
                this.selectCard(); // 편집 모드 진입 시 카드 선택
                this.options.onCommentEdit(this.highlight, comment);
            }
        );
    }
    
    /**
     * 소멸 메서드, 이벤트 리스너 정리 및 정적 컬렉션에서 인스턴스 제거에 사용
     */
    public destroy(): void {
        // 이벤트 리스너 제거
        this.selectionController.destroy();
        
        this.registry.unregister(this);
    }
}
