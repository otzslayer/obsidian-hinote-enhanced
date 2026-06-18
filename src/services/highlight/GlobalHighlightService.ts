import { TFile, App } from 'obsidian';
import { HighlightInfo } from '../../types/highlight';
import { HighlightService } from '../HighlightService';

/**
 * 전역 하이라이트 서비스
 * 모든 파일의 하이라이트를 로드하고 처리합니다
 *
 * 역할:
 * - 모든 파일의 하이라이트 데이터 로드
 * - 경로 또는 키워드로 하이라이트 검색
 * - 캐시를 사용하여 성능 최적화
 * - 하이라이트 정렬
 */
export class GlobalHighlightService {
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
     * 모든 하이라이트를 업데이트합니다
     */
    async updateAllHighlights(searchTerm: string = '', searchType: string = ''): Promise<HighlightInfo[]> {
        // 경로 검색인 경우
        if (searchType === 'path') {
            return await this.loadHighlightsByPath(searchTerm);
        }
        
        // 검색어가 있으면 인덱스 검색을 사용합니다
        if (searchTerm) {
            return await this.searchHighlightsFromIndex(searchTerm);
        }
        
        // 그 외에는 모든 하이라이트를 로드합니다
        return await this.loadAllHighlights();
    }
    
    /**
     * 경로별로 하이라이트를 로드합니다
     * 캐시를 우선 사용하여 파일 중복 읽기를 방지합니다
     */
    private async loadHighlightsByPath(searchTerm: string): Promise<HighlightInfo[]> {
        // 캐시에서 가져오기를 시도합니다
        const cachedHighlights = this.highlightService.getAllHighlightsFromCache();

        if (cachedHighlights) {
            // 캐시 데이터를 사용하여 경로로 필터링합니다
            return this.filterCachedHighlightsByPath(cachedHighlights, searchTerm);
        }
        
        // 캐시를 사용할 수 없어 파일에서 읽습니다（comments come from inline parsing）
        const allHighlights = await this.highlightService.getAllHighlights();
        const result: HighlightInfo[] = [];

        for (const { file, highlights } of allHighlights) {
            if (searchTerm && !file.path.toLowerCase().includes(searchTerm.toLowerCase())) {
                continue;
            }
            result.push(...this.addFileIcon(highlights));
        }

        return this.sortHighlights(result);
    }
    
    /**
     * 캐시된 하이라이트에서 경로로 필터링합니다
     */
    private async filterCachedHighlightsByPath(cachedHighlights: HighlightInfo[], searchTerm: string): Promise<HighlightInfo[]> {
        const result: HighlightInfo[] = [];
        
        // 파일별로 그룹화하여 처리합니다
        const highlightsByFile = new Map<string, HighlightInfo[]>();
        for (const highlight of cachedHighlights) {
            const filePath = highlight.filePath || '';
            
            // 검색어가 있으면 파일 경로가 일치하는지 확인합니다
            if (searchTerm && !filePath.toLowerCase().includes(searchTerm.toLowerCase())) {
                continue;
            }
            
            if (!highlightsByFile.has(filePath)) {
                highlightsByFile.set(filePath, []);
            }
            highlightsByFile.get(filePath)!.push(highlight);
        }
        
        // 각 파일의 하이라이트를 처리합니다
        for (const [filePath, highlights] of highlightsByFile.entries()) {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!(file instanceof TFile)) continue;
            
            result.push(...this.addFileIcon(highlights));
        }
        
        // 안정적인 정렬을 적용합니다
        return this.sortHighlights(result);
    }

    /**
     * 인덱스에서 하이라이트를 검색합니다
     */
    private async searchHighlightsFromIndex(searchTerm: string): Promise<HighlightInfo[]> {
        const searchResults = await this.highlightService.searchHighlightsFromIndex(searchTerm);
        
        return searchResults.map(highlight => ({
            ...highlight,
            comments: highlight.comments || [],
            fileName: highlight.fileName || this.extractFileNameFromPath(highlight.filePath),
            filePath: highlight.filePath || '',
            fileIcon: 'file-text'
        }));
    }
    
    /**
     * 모든 하이라이트를 로드합니다
     * 캐시를 우선 사용하여 파일 중복 읽기를 방지합니다
     */
    private async loadAllHighlights(): Promise<HighlightInfo[]> {
        // 캐시에서 가져오기를 시도합니다
        const cachedHighlights = this.highlightService.getAllHighlightsFromCache();

        if (cachedHighlights) {
            // 캐시 데이터를 사용하여 빠르게 반환합니다
            return this.processCachedHighlights(cachedHighlights);
        }
        
        // 캐시를 사용할 수 없어 파일에서 읽습니다
        const allHighlights = await this.highlightService.getAllHighlights();
        const result: HighlightInfo[] = [];
        
        for (const { file, highlights } of allHighlights) {
            result.push(...this.addFileIcon(highlights));
        }
        
        // 안정적인 정렬 추가: 파일 경로 및 위치 기준 정렬
        return this.sortHighlights(result);
    }

    /**
     * 캐시된 하이라이트 데이터를 처리합니다
     * 인덱스의 데이터를 직접 사용하여 댓글 정보를 병합합니다
     */
    private async processCachedHighlights(cachedHighlights: HighlightInfo[]): Promise<HighlightInfo[]> {
        const result: HighlightInfo[] = [];
        
        // 파일별로 그룹화하여 처리합니다
        const highlightsByFile = new Map<string, HighlightInfo[]>();
        for (const highlight of cachedHighlights) {
            const filePath = highlight.filePath || '';
            if (!highlightsByFile.has(filePath)) {
                highlightsByFile.set(filePath, []);
            }
            highlightsByFile.get(filePath)!.push(highlight);
        }
        
        // 각 파일의 하이라이트를 처리합니다
        for (const [filePath, highlights] of highlightsByFile.entries()) {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!(file instanceof TFile)) continue;
            
            result.push(...this.addFileIcon(highlights));
        }
        
        // 안정적인 정렬 추가: 파일 경로 및 위치 기준 정렬
        return this.sortHighlights(result);
    }

    private addFileIcon(highlights: HighlightInfo[]): HighlightInfo[] {
        return highlights.map(h => ({ ...h, fileIcon: h.fileIcon ?? 'file-text' }));
    }
    
    /**
     * 경로에서 파일 이름을 추출합니다
     */
    private extractFileNameFromPath(filePath?: string): string {
        if (!filePath) return '';
        return filePath.split('/').pop()?.replace('.md', '') || '';
    }
    
    /**
     * 하이라이트를 안정적으로 정렬합니다
     * 정렬 규칙:
     * 1. 파일 경로 알파벳 순서
     * 2. 같은 파일 내에서 위치 기준 (position 필드)
     * 3. 가상 하이라이트는 파일 맨 앞에 배치
     */
    private sortHighlights(highlights: HighlightInfo[]): HighlightInfo[] {
        return highlights.sort((a, b) => {
            // 파일 경로를 가져옵니다. 가상 하이라이트는 자체 filePath를 사용합니다
            const pathA = a.filePath || '';
            const pathB = b.filePath || '';
            
            // 먼저 파일 경로 기준으로 정렬합니다
            if (pathA !== pathB) {
                return pathA.localeCompare(pathB);
            }
            
            // 같은 파일 내에서 가상 하이라이트를 앞에 배치합니다
            if (a.isVirtual && !b.isVirtual) return -1;
            if (!a.isVirtual && b.isVirtual) return 1;
            
            // 둘 다 가상 하이라이트이거나 둘 다 아닌 경우 위치 기준으로 정렬합니다
            // position은 문서에서 텍스트의 위치 (숫자)
            if (a.position !== undefined && b.position !== undefined) {
                if (a.position !== b.position) {
                    return a.position - b.position;
                }
            }
            
            // 위치가 같거나 위치 정보가 없으면 생성 시간 기준으로 정렬합니다
            if (a.createdAt !== undefined && b.createdAt !== undefined) {
                if (a.createdAt !== b.createdAt) {
                    return a.createdAt - b.createdAt;
                }
            }
            
            // 마지막으로 ID 기준으로 정렬합니다 (안정성 보장)
            const idA = a.id || '';
            const idB = b.id || '';
            return idA.localeCompare(idB);
        });
    }
}
