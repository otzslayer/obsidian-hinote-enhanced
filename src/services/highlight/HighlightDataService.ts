import { TFile, App } from 'obsidian';
import { HighlightInfo } from '../../types/highlight';
import { HighlightService } from '../HighlightService';

/**
 * 高亮数据服务
 * 负责高亮数据的加载、处理和匹配
 * 
 * 职责：
 * - 加载单个文件或所有文件的高亮数据
 * - 合并高亮文本和评论数据
 * - 标记高亮的来源（全局搜索、Canvas等）
 */
export class HighlightDataService {
    private app: App;
    private highlightService: HighlightService;

    constructor(
        app: App,
        highlightService: HighlightService,
    ) {
        this.app = app;
        this.highlightService = highlightService;
    }
    
    /**
     * 加载单个文件的高亮数据
     */
    async loadFileHighlights(file: TFile): Promise<HighlightInfo[]> {
        if (!this.highlightService.shouldProcessFile(file)) {
            return [];
        }
        const content = await this.app.vault.read(file);
        // Comments are already populated inline by extractHighlights — no sidecar merge needed.
        return this.highlightService.extractHighlights(content, file);
    }
    
    /**
     * 加载所有文件的高亮数据
     */
    async loadAllHighlights(searchTerm: string = '', searchType: string = ''): Promise<HighlightInfo[]> {
        const allHighlights: HighlightInfo[] = [];
        // Comments come from inline parsing inside extractHighlights — no sidecar merge needed.
        const highlightResults = await this.highlightService.getAllHighlights();

        for (const { file, highlights } of highlightResults) {
            if (searchType === 'path' && searchTerm &&
                !file.path.toLowerCase().includes(searchTerm.toLowerCase())) {
                continue;
            }

            if (searchTerm && searchType !== 'path') {
                const filtered = highlights.filter(h =>
                    h.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    h.comments?.some(c => c.content.toLowerCase().includes(searchTerm.toLowerCase()))
                );
                allHighlights.push(...filtered);
            } else {
                allHighlights.push(...highlights);
            }
        }

        return allHighlights;
    }
    
    /**
     * 标记高亮为全局搜索结果
     */
    markAsGlobalSearch(highlights: HighlightInfo[], isGlobal: boolean = true): HighlightInfo[] {
        return highlights.map(h => ({
            ...h,
            isGlobalSearch: isGlobal
        }));
    }
    
    /**
     * 标记高亮为 Canvas 来源
     */
    markAsCanvasSource(highlights: HighlightInfo[], canvasFile: TFile): HighlightInfo[] {
        return highlights.map(h => ({
            ...h,
            isFromCanvas: true,
            isGlobalSearch: true,
            canvasSource: canvasFile.path
        }));
    }
}
