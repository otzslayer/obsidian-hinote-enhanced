import { TFile, App } from 'obsidian';
import { HighlightInfo } from '../../types/highlight';
import { HighlightService } from '../HighlightService';

/**
 * 하이라이트 데이터 서비스
 * 하이라이트 데이터의 로드, 처리 및 매칭을 담당합니다
 *
 * 역할:
 * - 단일 파일 또는 모든 파일의 하이라이트 데이터 로드
 * - 하이라이트 텍스트와 댓글 데이터 병합
 * - 하이라이트의 출처 표시 (전역 검색, Canvas 등)
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
     * 단일 파일의 하이라이트 데이터를 로드합니다
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
     * 모든 파일의 하이라이트 데이터를 로드합니다
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
     * 하이라이트를 전역 검색 결과로 표시합니다
     */
    markAsGlobalSearch(highlights: HighlightInfo[], isGlobal: boolean = true): HighlightInfo[] {
        return highlights.map(h => ({
            ...h,
            isGlobalSearch: isGlobal
        }));
    }
    
    /**
     * 하이라이트를 Canvas 출처로 표시합니다
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
