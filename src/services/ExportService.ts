import { App, TFile } from "obsidian";
import { HighlightInfo } from "../types/highlight";
import { t } from "../i18n";
import { HighlightService } from "./HighlightService";
import type { PluginSettings } from "../types/settings";
import { ExportContentRenderer } from "./export/ExportContentRenderer";
import { ExportFileWriter } from "./export/ExportFileWriter";

export class ExportService {
    private highlightService: HighlightService;
    private contentRenderer: ExportContentRenderer;
    private fileWriter: ExportFileWriter;

    constructor(
        private app: App,
        highlightService?: HighlightService,
        private getSettings?: () => PluginSettings
    ) {
        this.highlightService = highlightService ?? new HighlightService(app);
        this.contentRenderer = new ExportContentRenderer(this.highlightService);
        this.fileWriter = new ExportFileWriter(app);
    }
    
    /**
     * 플러그인 설정 인스턴스를 가져옵니다
     */
    private getPluginSettings(): PluginSettings | undefined {
        return this.getSettings?.();
    }
    
    /**
     * 내보낼 파일을 생성합니다
     * @param fileName 파일 이름 (확장자 제외)
     * @param content 파일 내용
     * @param exportPath 내보내기 경로
     */
    private async createExportFile(fileName: string, content: string, exportPath: string): Promise<TFile> {
        return this.fileWriter.createMarkdownFile(fileName, content, exportPath);
    }
    
    /**
     * 선택된 여러 하이라이트를 Markdown 파일로 내보냅니다
     * @param highlights 내보낼 하이라이트 배열
     * @returns 생성된 새 파일
     * @throws 하이라이트가 없거나 파일 생성에 실패한 경우
     */
    async exportHighlightsAsMarkdown(highlights: HighlightInfo[]): Promise<TFile> {
        if (!highlights || highlights.length === 0) {
            throw new Error(t("No highlights to export."));
        }
        
        const settings = this.getPluginSettings();
        
        // 파일별로 하이라이트를 그룹화합니다
        const highlightsByFile: Record<string, HighlightInfo[]> = {};
        
        for (const highlight of highlights) {
            if (!highlight.filePath) continue;
            
            if (!highlightsByFile[highlight.filePath]) {
                highlightsByFile[highlight.filePath] = [];
            }
            
            highlightsByFile[highlight.filePath].push(highlight);
        }
        
        // 내용을 생성합니다
        const contentParts: string[] = [];
        
        // 각 파일별로 내용을 생성합니다
        for (const filePath in highlightsByFile) {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!(file instanceof TFile)) continue;
            
            contentParts.push(`## ${file.basename}`);
            contentParts.push("");
            
            // 템플릿 또는 기본 방식으로 내용을 생성합니다
            const fileHighlights = highlightsByFile[filePath];
            const customTemplate = settings?.export?.exportTemplate;
            
            // 사용자 정의 템플릿이 있고 비어 있지 않으면 템플릿 방식을 사용합니다
            if (customTemplate && customTemplate.trim() !== '') {
                const templateContent = await this.contentRenderer.generateContentFromTemplate(file, fileHighlights, customTemplate);
                if (templateContent.trim() !== '') {
                    contentParts.push(templateContent);
                }
            } else {
                // 사용자 정의 템플릿이 없거나 비어 있으면 기본 방식을 사용합니다
                const defaultContent = await this.contentRenderer.generateDefaultContent(file, fileHighlights);
                contentParts.push(defaultContent);
            }
        }
        
        const content = contentParts.join("\n");
        
        // 내보내기 경로를 가져와 파일을 생성합니다
        const exportPath = settings?.export?.exportPath || '';
        const fileName = `Selected Highlights ${window.moment().format("YYYYMMDDHHmmss")}`;
        
        return await this.createExportFile(fileName, content, exportPath);
    }

    /**
     * 파일의 하이라이트와 댓글 내용을 새 노트로 내보냅니다
     * @param sourceFile 원본 파일
     * @returns 생성된 새 파일
     */
    async exportHighlightsToNote(sourceFile: TFile): Promise<TFile> {
        // 파일의 모든 하이라이트와 댓글을 가져옵니다
        const highlights = await this.getFileHighlights(sourceFile);
        if (!highlights || highlights.length === 0) {
            throw new Error(t("No highlights found in the current file."));
        }

        // 내보낼 내용을 생성합니다
        const content = await this.generateExportContent(sourceFile, highlights);

        // 내보내기 경로를 가져와 파일을 생성합니다
        const settings = this.getPluginSettings();
        const exportPath = settings?.export?.exportPath || '';
        const fileName = `${sourceFile.basename} - HiNote ${window.moment().format("YYYYMMDDHHmmss")}`;
        
        return await this.createExportFile(fileName, content, exportPath);
    }

    /**
     * 파일의 모든 하이라이트와 댓글을 가져옵니다
     */
    private async getFileHighlights(file: TFile): Promise<HighlightInfo[]> {
        const content = await this.app.vault.read(file);
        // Comments come from inline parsing inside extractHighlights.
        return this.highlightService.extractHighlights(content, file);
    }

    /**
     * 내보낼 내용을 생성합니다
     */
    private async generateExportContent(file: TFile, highlights: HighlightInfo[]): Promise<string> {
        const settings = this.getPluginSettings();
        const customTemplate = settings?.export?.exportTemplate;
        return this.contentRenderer.generateExportContent(file, highlights, customTemplate);
    }
}
