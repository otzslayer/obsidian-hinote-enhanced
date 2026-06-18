import { TFile, Notice, setIcon } from "obsidian";
import { HighlightInfo as HiNote, HighlightInfo } from "../../../types/highlight";
import { HighlightManager } from "../../../services/HighlightManager";
import { t } from "../../../i18n";

/**
 * 가상 하이라이트 매니저
 * 담당:
 * 1. 파일 댓글 버튼 생성 및 관리
 * 2. 가상 하이라이트 생성 (파일 수준의 댓글)
 * 3. 가상 하이라이트 목록 필터링 및 관리
 */
export class VirtualHighlightManager {
    private addCommentButton: HTMLElement | null = null;

    constructor(
        private highlightManager: HighlightManager
    ) {}

    /**
     * 파일 댓글 버튼 생성
     * @param container 버튼 컨테이너
     * @param callbacks 콜백 함수
     */
    createFileCommentButton(
        container: HTMLElement,
        callbacks: {
            getCurrentFile: () => TFile | null;
            getHighlights: () => HighlightInfo[];
            onVirtualHighlightCreated: (virtualHighlight: HiNote) => void;
            onShowCommentInput: (card: HTMLElement, highlight: HiNote) => void;
            getHighlightContainer: () => HTMLElement;
        }
    ): HTMLElement {
        this.addCommentButton = container.createEl("div", {
            cls: "highlight-icon-button"
        });
        
        setIcon(this.addCommentButton, "message-square-plus");
        this.addCommentButton.setAttribute("aria-label", t("Add File Comment"));

        // 파일 댓글 버튼 클릭 이벤트 추가
        this.addCommentButton.addEventListener("click", () => {
            void this.handleAddFileComment(callbacks);
        });

        return this.addCommentButton;
    }

    /**
     * 파일 댓글 추가 처리
     */
    private async handleAddFileComment(callbacks: {
        getCurrentFile: () => TFile | null;
        getHighlights: () => HighlightInfo[];
        onVirtualHighlightCreated: (virtualHighlight: HiNote) => void;
        onShowCommentInput: (card: HTMLElement, highlight: HiNote) => void;
        getHighlightContainer: () => HTMLElement;
    }): Promise<void> {
        const currentFile = callbacks.getCurrentFile();
        
        if (!currentFile) {
            new Notice(t("Please open a file first."));
            return;
        }

        // 고유 식별자 생성
        const timestamp = Date.now();
        const uniqueId = `file-comment-${timestamp}`;

        // 가상 하이라이트 정보 생성 - 문서 최상단에 보이지 않는 하이라이트 내용 생성
        const virtualHighlight: HiNote = {
            id: uniqueId,
            text: t("File Comment"),  // 파일 댓글의 표시 텍스트
            filePath: currentFile.path,
            isVirtual: true,  // 가상 하이라이트임을 표시
            position: 0,  // 기본 위치
            paragraphOffset: 0,  // 기본 오프셋
            blockId: `virtual-${timestamp}`,  // 가상 block ID 생성
            createdAt: timestamp,
            updatedAt: timestamp,
            comments: []  // 빈 댓글 배열 초기화
        };

        // 먼저 HighlightManager에 저장
        await this.highlightManager.addHighlight(currentFile, virtualHighlight);

        // 외부에 가상 하이라이트 생성됨을 알림
        callbacks.onVirtualHighlightCreated(virtualHighlight);

        // 새로 생성된 하이라이트 카드를 찾아 댓글 입력창 자동 열기
        window.setTimeout(() => {
            const highlightContainer = callbacks.getHighlightContainer();
            const highlightCard = highlightContainer.querySelector('.highlight-card') as HTMLElement;
            if (highlightCard) {
                // 댓글 입력창 자동 열기
                callbacks.onShowCommentInput(highlightCard, virtualHighlight);
                // 상단으로 스크롤
                highlightContainer.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }, 100);
    }

    /**
     * 가상 하이라이트 필터링
     * 저장된 댓글에서 가상 하이라이트를 추출하되, 이미 하이라이트 목록에 있는 것은 제외
     * @param currentFile 현재 파일
     * @param existingHighlights 기존 하이라이트 목록
     * @returns 추가할 가상 하이라이트 목록
     */
    async filterVirtualHighlights(
        currentFile: TFile,
        existingHighlights: HighlightInfo[]
    ): Promise<HiNote[]> {
        const storedComments = await this.highlightManager.getFileHighlights(currentFile);
        const usedCommentIds = new Set<string>();
        
        // 이미 사용된 댓글 ID 표시
        existingHighlights.forEach(h => {
            if (h.id) usedCommentIds.add(h.id);
        });

        // 가상 하이라이트 추가 (댓글이 있는 가상 하이라이트만 추가)
        const virtualHighlights = storedComments
            .filter(c => c.isVirtual && c.comments && c.comments.length > 0 && c.id && !usedCommentIds.has(c.id));

        // 중복 제거: 가상 하이라이트 텍스트가 기존 하이라이트와 겹치지 않도록
        const uniqueVirtualHighlights = virtualHighlights.filter(vh => {
            return !existingHighlights.some(h => h.text === vh.text);
        });

        // 해당 가상 하이라이트를 사용됨으로 표시
        uniqueVirtualHighlights.forEach(vh => {
            if (vh.id) usedCommentIds.add(vh.id);
        });
        
        return uniqueVirtualHighlights;
    }

    /**
     * 가상 하이라이트 매니저 소멸
     */
    destroy(): void {
        if (this.addCommentButton) {
            this.addCommentButton.remove();
            this.addCommentButton = null;
        }
    }
}
