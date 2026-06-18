import { App, TFile, Notice, setIcon } from "obsidian";
import { HighlightInfo, CommentItem } from "../../../types/highlight";
import { ExportService } from "../../../services/ExportService";
import { t } from "../../../i18n";

/**
 * 내보내기 매니저
 * 담당:
 * 1. 내보내기 버튼 생성 및 이벤트 관리
 * 2. 노트로 내보내기 로직 처리
 * 3. 이미지로 내보내기 로직 처리
 */
export class ExportManager {
    private exportButton: HTMLElement | null = null;

    constructor(
        private app: App,
        private exportService: ExportService
    ) {}

    /**
     * 내보내기 버튼 생성
     * @param container 버튼 컨테이너
     * @param getCurrentFile 현재 파일을 가져오는 콜백
     */
    createExportButton(
        container: HTMLElement,
        getCurrentFile: () => TFile | null
    ): HTMLElement {
        this.exportButton = container.createEl("div", {
            cls: "highlight-icon-button"
        });
        
        setIcon(this.exportButton, "file-symlink");
        this.exportButton.setAttribute("aria-label", t("Export as notes"));

        // 내보내기 버튼 클릭 이벤트 추가
        this.exportButton.addEventListener("click", () => {
            void this.handleExportClick(getCurrentFile());
        });

        return this.exportButton;
    }

    /**
     * 내보내기 버튼 클릭 처리
     * @param currentFile 현재 파일
     */
    private async handleExportClick(currentFile: TFile | null): Promise<void> {
        if (!currentFile) {
            new Notice(t("Please open a file first."));
            return;
        }

        try {
            const newFile = await this.exportService.exportHighlightsToNote(currentFile);
            new Notice(t("Successfully exported highlights to: ") + newFile.path);

            // 새로 생성된 파일 열기
            const leaf = this.app.workspace.getLeaf();
            await leaf.openFile(newFile);
        } catch (error) {
            new Notice(t("Failed to export highlights: ") + error.message);
        }
    }

    /**
     * 하이라이트를 이미지로 내보내기
     * @param highlight 내보낼 하이라이트
     */
    async exportHighlightAsImage(highlight: HighlightInfo & { comments?: CommentItem[] }): Promise<void> {
        try {
            // html2canvas 동적 임포트
            const html2canvas = (await import('html2canvas')).default;
            const { ExportPreviewModal } = await import('../../../templates/ExportModal');
            new ExportPreviewModal(this.app, highlight, html2canvas).open();
        } catch (error) {
            console.error('[ExportManager] Error exporting as image:', error);
            new Notice(t("Export failed: Failed to load necessary components."));
        }
    }

    /**
     * 내보내기 매니저 소멸
     */
    destroy(): void {
        if (this.exportButton) {
            this.exportButton.remove();
            this.exportButton = null;
        }
    }
}
