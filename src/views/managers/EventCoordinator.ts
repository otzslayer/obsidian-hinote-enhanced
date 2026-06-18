import { App, TFile, Component, EventRef, MarkdownView } from "obsidian";
import { defaultHighlightCardRegistry } from "../../components/highlight";
import { HighlightInfo as HiNote } from "../../types/highlight";
import type { EventManager } from "../../services/EventManager";

/**
 * 이벤트 콜백 인터페이스
 */
export interface EventCallbacks {
    onFileOpen?: (file: TFile, isInCanvas: boolean) => void;
    onFileModify?: (file: TFile, isInCanvas: boolean) => void;
    onFileCreate?: () => void;
    onFileDelete?: () => void;
    onLayoutChange?: () => void;
    onCommentInput?: (highlightId: string, text: string) => void;
}

/**
 * 이벤트 코디네이터
 * 담당:
 * 1. 모든 이벤트 리스너 통합 관리
 * 2. 파일 이벤트 (열기, 수정, 생성, 삭제)
 * 3. 커스텀 이벤트 (댓글 입력, 다중 선택)
 * 4. 레이아웃 변경 이벤트
 */
export class EventCoordinator {
    private callbacks: EventCallbacks = {};
    private eventRefs: EventRef[] = [];
    constructor(
        private app: App,
        private component: Component,
        private eventManager: EventManager
    ) {}

    /**
     * 콜백 함수 설정
     */
    setCallbacks(callbacks: EventCallbacks): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * 모든 이벤트 리스너 등록
     */
    registerAllEvents(
        getCurrentFile: () => TFile | null,
        isDraggedToMainView: () => boolean
    ): void {
        // 문서 전환 감지
        this.registerFileOpenEvent(getCurrentFile, isDraggedToMainView);

        // 문서 수정 감지
        this.registerFileModifyEvent(getCurrentFile, isDraggedToMainView);

        // 파일 생성 및 삭제 감지
        this.registerFileCreateEvent();
        this.registerFileDeleteEvent();

        // 레이아웃 변경 감지
        this.registerLayoutChangeEvent();

        // 댓글 입력 이벤트 감지
        this.registerCommentInputEvent();
    }

    /**
     * 파일 열기 이벤트 등록
     */
    private registerFileOpenEvent(
        getCurrentFile: () => TFile | null,
        isDraggedToMainView: () => boolean
    ): void {
        const ref = this.app.workspace.on('file-open', (file) => {
            // 메인 뷰가 아닐 때만 파일 동기화
            if (file && !isDraggedToMainView()) {
                const activeMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                const isInCanvas = !activeMarkdownView && this.app.workspace.getActiveFile()?.path !== file.path;
                
                if (this.callbacks.onFileOpen) {
                    this.callbacks.onFileOpen(file, isInCanvas);
                }
            }
        });
        
        this.component.registerEvent(ref);
        this.eventRefs.push(ref);
    }

    /**
     * 파일 수정 이벤트 등록
     */
    private registerFileModifyEvent(
        getCurrentFile: () => TFile | null,
        isDraggedToMainView: () => boolean
    ): void {
        const ref = this.app.vault.on('modify', (file) => {
            const currentFile = getCurrentFile();
            
            // 메인 뷰가 아닐 때만 파일 동기화
            if (file === currentFile && !isDraggedToMainView() && file instanceof TFile) {
                const activeMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                const isInCanvas = !activeMarkdownView && this.app.workspace.getActiveFile()?.path !== file.path;
                
                if (this.callbacks.onFileModify) {
                    this.callbacks.onFileModify(file, isInCanvas);
                }
            }
        });
        
        this.component.registerEvent(ref);
        this.eventRefs.push(ref);
    }

    /**
     * 파일 생성 이벤트 등록
     */
    private registerFileCreateEvent(): void {
        const ref = this.app.vault.on('create', () => {
            if (this.callbacks.onFileCreate) {
                this.callbacks.onFileCreate();
            }
        });
        
        this.component.registerEvent(ref);
        this.eventRefs.push(ref);
    }

    /**
     * 파일 삭제 이벤트 등록
     */
    private registerFileDeleteEvent(): void {
        const ref = this.app.vault.on('delete', () => {
            if (this.callbacks.onFileDelete) {
                this.callbacks.onFileDelete();
            }
        });
        
        this.component.registerEvent(ref);
        this.eventRefs.push(ref);
    }

    /**
     * 레이아웃 변경 이벤트 등록
     */
    private registerLayoutChangeEvent(): void {
        const ref = this.app.workspace.on('layout-change', () => {
            if (this.callbacks.onLayoutChange) {
                this.callbacks.onLayoutChange();
            }
        });
        
        this.component.registerEvent(ref);
        this.eventRefs.push(ref);
    }

    /**
     * 댓글 입력 이벤트 등록
     */
    private registerCommentInputEvent(): void {
        const ref = this.eventManager.on('comment-input:open', (highlightId, text) => {
            if (this.callbacks.onCommentInput) {
                this.callbacks.onCommentInput(highlightId, text);
            }
        });

        this.component.registerEvent(ref);
        this.eventRefs.push(ref);
    }

    /**
     * 키보드 이벤트 등록 (다중 선택용)
     */
    registerKeyboardEvents(highlightContainer: HTMLElement): void {
        // Shift 키를 누른 채 다중 선택
        const keydownHandler = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                highlightContainer.addClass('multi-select-mode');
            }
        };

        const keyupHandler = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                highlightContainer.removeClass('multi-select-mode');
            }
        };

        this.component.registerDomEvent(activeDocument, 'keydown', keydownHandler);
        this.component.registerDomEvent(activeDocument, 'keyup', keyupHandler);
    }

    /**
     * 댓글 입력 표시 처리
     */
    handleCommentInputDisplay(
        highlightId: string,
        text: string,
        highlightContainer: HTMLElement,
        onShowCommentInput: (card: HTMLElement, highlight: HiNote) => void
    ): void {
        // 뷰가 업데이트될 때까지 잠시 대기
        window.setTimeout(() => {
            // 모든 카드의 선택 상태 제거
            highlightContainer.querySelectorAll('.highlight-card').forEach(card => {
                card.removeClass('selected');
            });

            // 먼저 하이라이트 ID로 카드 인스턴스 직접 검색 시도
            let cardInstance = defaultHighlightCardRegistry.findByHighlightId(highlightId);
            
            // 찾지 못한 경우 텍스트 내용으로 검색 시도
            if (!cardInstance) {
                const highlightCard = Array.from(highlightContainer.querySelectorAll('.highlight-card'))
                    .find(card => {
                        const textContent = card.querySelector('.highlight-text-content')?.textContent;
                        return textContent === text;
                    });

                if (highlightCard) {
                    // 선택 상태 추가
                    highlightCard.addClass('selected');

                    // HighlightCard 인스턴스 검색
                    cardInstance = defaultHighlightCardRegistry.findByElement(highlightCard as HTMLElement);

                    // 댓글 영역으로 스크롤
                    highlightCard.scrollIntoView({ behavior: "smooth" });
                }
            }
            
            // 카드 인스턴스를 찾은 경우 댓글 입력창 표시
            if (cardInstance) {
                cardInstance.showCommentInput();
            }
        }, 100);
    }

    /**
     * 이벤트 코디네이터 소멸
     */
    destroy(): void {
        // 이벤트 참조 정리
        this.eventRefs = [];
        this.callbacks = {};
    }
}
