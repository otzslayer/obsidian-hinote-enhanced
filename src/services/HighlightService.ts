import { App, TFile } from "obsidian";
import { HighlightInfo } from '../types/highlight';
import type { PluginSettings } from '../types/settings';
import {
    HighlightBatchOps,
    HighlightExtractor,
    HighlightIndexer,
} from './highlight';

/**
 * 高亮服务 - Facade 门面模式
 * 
 * 将所有高亮相关功能委托给专门的子模块：
 * - HighlightExtractor: 提取高亮文本、文件排除判断、颜色提取、文件内容缓存
 * - HighlightMatcher: 高亮与评论的匹配合并逻辑
 * - HighlightIndexer: 全局索引构建、搜索、文件事件监听
 * - HighlightBatchOps: 批量删除高亮标记
 * 
 * 所有外部调用方仍通过 HighlightService 访问，无需修改导入路径。
 */
export class HighlightService {
    private extractor: HighlightExtractor;
    private indexer: HighlightIndexer;
    private batchOps: HighlightBatchOps;

    constructor(
        private app: App,
        getSettings?: () => PluginSettings | undefined,
    ) {
        this.extractor = new HighlightExtractor(app, getSettings);
        this.indexer = new HighlightIndexer(app, this.extractor);
        this.batchOps = new HighlightBatchOps(app, this.extractor);
    }

    // ==================== 生命周期 ====================
    
    async initialize(): Promise<void> {
        return this.indexer.initialize();
    }
    
    destroy(): void {
        this.indexer.destroy();
    }

    // ==================== 提取 (委托给 HighlightExtractor) ====================
    
    shouldProcessFile(file: TFile): boolean {
        return this.extractor.shouldProcessFile(file);
    }

    extractHighlights(content: string, file: TFile): HighlightInfo[] {
        return this.extractor.extractHighlights(content, file);
    }

    async getFilesWithHighlights(): Promise<TFile[]> {
        return this.extractor.getFilesWithHighlights();
    }

    async getAllHighlights(): Promise<{ file: TFile, highlights: HighlightInfo[] }[]> {
        return this.extractor.getAllHighlights();
    }

    public async createBlockIdForHighlight(file: TFile, position: number, length?: number): Promise<string> {
        return this.extractor.createBlockIdForHighlight(file, position, length);
    }

    // ==================== 索引与搜索 (委托给 HighlightIndexer) ====================
    
    public getAllHighlightsFromCache(): HighlightInfo[] | null {
        return this.indexer.getAllHighlightsFromCache();
    }

    async searchHighlightsFromIndex(searchTerm: string): Promise<HighlightInfo[]> {
        return this.indexer.searchHighlightsFromIndex(searchTerm);
    }

    // ==================== 批量操作 (委托给 HighlightBatchOps) ====================
    
    public async batchRemoveHighlightMarks(highlights: Array<{ text: string; position?: number; filePath: string; originalLength?: number }>): Promise<{ success: number; failed: number }> {
        return this.batchOps.batchRemoveHighlightMarks(highlights);
    }
}
