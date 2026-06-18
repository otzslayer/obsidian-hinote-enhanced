import { App, TFile } from "obsidian";
import { HighlightInfo } from '../types/highlight';
import type { PluginSettings } from '../types/settings';
import {
    HighlightBatchOps,
    HighlightExtractor,
    HighlightIndexer,
} from './highlight';

/**
 * 하이라이트 서비스 - Facade 패턴
 *
 * 모든 하이라이트 관련 기능을 전담 하위 모듈에 위임합니다:
 * - HighlightExtractor: 하이라이트 텍스트 추출, 파일 제외 판단, 색상 추출, 파일 내용 캐싱
 * - HighlightMatcher: 하이라이트와 댓글의 매칭 및 병합 로직
 * - HighlightIndexer: 전역 인덱스 구축, 검색, 파일 이벤트 감지
 * - HighlightBatchOps: 하이라이트 마크 일괄 삭제
 *
 * 모든 외부 호출자는 여전히 HighlightService를 통해 접근하며, 임포트 경로를 변경할 필요가 없습니다.
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

    // ==================== 생명주기 ====================
    
    async initialize(): Promise<void> {
        return this.indexer.initialize();
    }
    
    destroy(): void {
        this.indexer.destroy();
    }

    // ==================== 추출 (HighlightExtractor에 위임) ====================
    
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

    // ==================== 인덱스 및 검색 (HighlightIndexer에 위임) ====================
    
    public getAllHighlightsFromCache(): HighlightInfo[] | null {
        return this.indexer.getAllHighlightsFromCache();
    }

    async searchHighlightsFromIndex(searchTerm: string): Promise<HighlightInfo[]> {
        return this.indexer.searchHighlightsFromIndex(searchTerm);
    }

    // ==================== 일괄 작업 (HighlightBatchOps에 위임) ====================
    
    public async batchRemoveHighlightMarks(highlights: Array<{ text: string; position?: number; filePath: string; originalLength?: number }>): Promise<{ success: number; failed: number }> {
        return this.batchOps.batchRemoveHighlightMarks(highlights);
    }
}
