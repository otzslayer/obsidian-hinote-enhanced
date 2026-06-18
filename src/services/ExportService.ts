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
     * 获取插件实例
     */
    private getPluginSettings(): PluginSettings | undefined {
        return this.getSettings?.();
    }
    
    /**
     * 创建导出文件
     * @param fileName 文件名（不含扩展名）
     * @param content 文件内容
     * @param exportPath 导出路径
     */
    private async createExportFile(fileName: string, content: string, exportPath: string): Promise<TFile> {
        return this.fileWriter.createMarkdownFile(fileName, content, exportPath);
    }
    
    /**
     * 导出选中的多个高亮为 Markdown 文件
     * @param highlights 要导出的高亮数组
     * @returns 返回创建的新文件
     * @throws 如果没有高亮或创建文件失败
     */
    async exportHighlightsAsMarkdown(highlights: HighlightInfo[]): Promise<TFile> {
        if (!highlights || highlights.length === 0) {
            throw new Error(t("No highlights to export."));
        }
        
        const settings = this.getPluginSettings();
        
        // 按文件分组高亮
        const highlightsByFile: Record<string, HighlightInfo[]> = {};
        
        for (const highlight of highlights) {
            if (!highlight.filePath) continue;
            
            if (!highlightsByFile[highlight.filePath]) {
                highlightsByFile[highlight.filePath] = [];
            }
            
            highlightsByFile[highlight.filePath].push(highlight);
        }
        
        // 生成内容
        const contentParts: string[] = [];
        
        // 为每个文件生成内容
        for (const filePath in highlightsByFile) {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!(file instanceof TFile)) continue;
            
            contentParts.push(`## ${file.basename}`);
            contentParts.push("");
            
            // 使用模板或默认方式生成内容
            const fileHighlights = highlightsByFile[filePath];
            const customTemplate = settings?.export?.exportTemplate;
            
            // 如果有自定义模板且不为空，使用模板解析方式
            if (customTemplate && customTemplate.trim() !== '') {
                const templateContent = await this.contentRenderer.generateContentFromTemplate(file, fileHighlights, customTemplate);
                if (templateContent.trim() !== '') {
                    contentParts.push(templateContent);
                }
            } else {
                // 如果没有自定义模板或模板为空，使用原来的方式
                const defaultContent = await this.contentRenderer.generateDefaultContent(file, fileHighlights);
                contentParts.push(defaultContent);
            }
        }
        
        const content = contentParts.join("\n");
        
        // 获取导出路径并创建文件
        const exportPath = settings?.export?.exportPath || '';
        const fileName = `Selected Highlights ${window.moment().format("YYYYMMDDHHmmss")}`;
        
        return await this.createExportFile(fileName, content, exportPath);
    }

    /**
     * 导出文件的高亮和评论内容为新的笔记
     * @param sourceFile 源文件
     * @returns 返回创建的新文件
     */
    async exportHighlightsToNote(sourceFile: TFile): Promise<TFile> {
        // 获取文件的所有高亮和评论
        const highlights = await this.getFileHighlights(sourceFile);
        if (!highlights || highlights.length === 0) {
            throw new Error(t("No highlights found in the current file."));
        }

        // 生成导出内容
        const content = await this.generateExportContent(sourceFile, highlights);

        // 获取导出路径并创建文件
        const settings = this.getPluginSettings();
        const exportPath = settings?.export?.exportPath || '';
        const fileName = `${sourceFile.basename} - HiNote ${window.moment().format("YYYYMMDDHHmmss")}`;
        
        return await this.createExportFile(fileName, content, exportPath);
    }

    /**
     * 获取文件的所有高亮和评论
     */
    private async getFileHighlights(file: TFile): Promise<HighlightInfo[]> {
        const content = await this.app.vault.read(file);
        // Comments come from inline parsing inside extractHighlights.
        return this.highlightService.extractHighlights(content, file);
    }

    /**
     * 生成导出内容
     */
    private async generateExportContent(file: TFile, highlights: HighlightInfo[]): Promise<string> {
        const settings = this.getPluginSettings();
        const customTemplate = settings?.export?.exportTemplate;
        return this.contentRenderer.generateExportContent(file, highlights, customTemplate);
    }
}
