import { App, TFile, Notice, setIcon } from "obsidian";
import { HighlightInfo as HiNote, HighlightInfo } from "../../../types/highlight";
import { HighlightManager } from "../../../services/HighlightManager";
import { t } from "../../../i18n";
import { showFileCommentModal } from "../../../components/comment/FileCommentModal";

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
        private app: App,
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
            onAddFileComment: (file: TFile, text: string) => void;
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
        onAddFileComment: (file: TFile, text: string) => void;
    }): Promise<void> {
        const currentFile = callbacks.getCurrentFile();

        if (!currentFile) {
            new Notice(t("Please open a file first."));
            return;
        }

        const text = await showFileCommentModal(this.app);
        if (text) {
            callbacks.onAddFileComment(currentFile, text);
        }
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
