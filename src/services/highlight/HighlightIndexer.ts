import { App, TFile } from "obsidian";
import { HighlightInfo } from '../../types/highlight';
import { HighlightExtractor } from './HighlightExtractor';
import { HighlightIndexStore } from "./HighlightIndexStore";
import { HighlightIndexFileWatcher } from "./HighlightIndexFileWatcher";
import { ObsidianInternals } from "../../utils/ObsidianInternals";

/**
 * 하이라이트 인덱서
 * 역할:
 * 1. 전역 하이라이트 인덱스를 구축하고 유지합니다
 * 2. 파일 이벤트 리스너를 등록하여 인덱스를 자동으로 업데이트합니다
 * 3. 인덱스 기반 키워드 검색
 * 4. 인덱스의 증분 업데이트 및 만료 관리
 */
export class HighlightIndexer {
    private indexStore = new HighlightIndexStore();
    private fileWatcher: HighlightIndexFileWatcher;
    
    // 인덱스 구축 중 여부
    private isIndexing: boolean = false;
    private indexBuildTimer: number | null = null;
    
    constructor(
        private app: App,
        private extractor: HighlightExtractor
    ) {
        this.fileWatcher = new HighlightIndexFileWatcher({
            app,
            extractor,
            updateFileInIndex: (file) => {
                void this.updateFileInIndex(file);
            },
            removeFileFromIndex: (filePath) => this.removeFileFromIndex(filePath)
        });
    }

    /**
     * 인덱서를 초기화합니다 (인덱스 구축 및 파일 이벤트 리스너 등록 포함)
     */
    async initialize(): Promise<void> {
        // 파일 이벤트 리스너를 등록하여 인덱스를 자동으로 업데이트합니다
        this.fileWatcher.register();
        
        // 디바이스 유형에 따라 인덱스 구축 전략을 조정합니다
        // 모바일에서는 시작 성능에 영향을 주지 않도록 더 오래 지연합니다
        const isMobile = ObsidianInternals.isMobile(this.app);
        const delay = isMobile ? 10000 : 3000; // 모바일 10초, 데스크톱 3초
        
        this.indexBuildTimer = window.setTimeout(() => {
            this.indexBuildTimer = null;
            void this.buildFileIndex();
        }, delay);
    }
    
    /**
     * 인덱서를 소멸시키고 리소스를 정리합니다
     */
    destroy(): void {
        // 파일 이벤트 리스너를 해제합니다
        this.fileWatcher.unregister();

        if (this.indexBuildTimer !== null) {
            window.clearTimeout(this.indexBuildTimer);
            this.indexBuildTimer = null;
        }
        
        // 인덱스를 초기화합니다
        this.indexStore.reset();
        
        // 파일 내용 캐시를 지웁니다
        this.extractor.clearContentCache();
    }
    
    /**
     * 파일 수준의 하이라이트 인덱스를 구축합니다
     * 각 하이라이트별로 인덱싱하지 않고 하이라이트가 포함된 파일만 인덱싱합니다
     */
    async buildFileIndex(): Promise<void> {
        // 이미 인덱스를 구축 중이면 건너뜁니다
        if (this.isIndexing) {
            return;
        }
        
        this.isIndexing = true;
        try {
            // 모든 하이라이트를 가져옵니다
            const allHighlights = await this.extractor.getAllHighlights();
            
            // 새 인덱스를 생성합니다
            const newWordToFiles = new Map<string, Set<string>>();
            const newFileToHighlights = new Map<string, HighlightInfo[]>();
            
            // 인덱스를 채웁니다
            for (const { file, highlights } of allHighlights) {
                // 각 파일의 하이라이트에 파일 정보를 추가합니다
                const highlightsWithFileInfo = highlights.map(h => ({
                    ...h,
                    fileName: file.basename,
                    filePath: file.path
                }));
                
                // 파일 매핑에 추가합니다
                newFileToHighlights.set(file.path, highlightsWithFileInfo);
                
                // 키워드를 추출하여 인덱스에 추가합니다
                const fileWords = this.indexStore.extractKeywordsFromHighlights(highlights);
                this.indexStore.addKeywordsToIndex(fileWords, file.path, newWordToFiles);
            }
            
            // 인덱스를 업데이트합니다
            this.indexStore.replace(newWordToFiles, newFileToHighlights);
            
        } catch {
            // 인덱스 구축 오류를 무시합니다
        } finally {
            this.isIndexing = false;
        }
    }
    
    /**
     * 인덱스에서 모든 하이라이트를 가져옵니다 (외부 호출용 공개 메서드)
     * 인덱스를 사용할 수 있으면 캐시에서 바로 반환하여 파일 재읽기를 방지합니다
     * 인덱스가 구축되지 않았으면 주문형 구축을 트리거하고 이번에는 null을 반환합니다
     * @returns 모든 하이라이트 배열, 인덱스가 구축되지 않았으면 null
     */
    public getAllHighlightsFromCache(): HighlightInfo[] | null {
        // 인덱스가 한 번도 구축되지 않았으면 주문형 구축을 트리거합니다
        if (this.indexStore.lastUpdated === 0 && !this.isIndexing) {
            void this.buildFileIndex();
        }
        
        // 인덱스를 사용할 수 있는지 확인합니다
        if (!this.indexStore.isExpired() && this.indexStore.fileToHighlights.size > 0) {
            return this.indexStore.getAllHighlights();
        }
        return null;
    }
    
    /**
     * 인덱스에서 파일을 제거합니다
     * @param filePath 제거할 파일 경로
     */
    removeFileFromIndex(filePath: string): void {
        // 인덱스가 초기화되지 않았거나 만료된 경우 건너뜁니다
        this.indexStore.removeFile(filePath);
    }
    
    /**
     * 파일의 인덱스를 증분 업데이트합니다
     * @param file 업데이트할 파일
     */
    async updateFileInIndex(file: TFile): Promise<void> {
        // 인덱스 구축 중이면 증분 업데이트를 건너뜁니다
        if (this.isIndexing) {
            return;
        }
        
        // 인덱스가 초기화되지 않았으면 빈 인덱스 구조를 초기화합니다
        this.indexStore.ensureInitialized();
        
        // 인덱스가 만료된 경우 전체 재구축을 트리거합니다 (비동기, 현재 업데이트를 차단하지 않음)
        if (this.indexStore.isExpired()) {
            // 재구축을 비동기로 트리거하되 기다리지 않습니다
            void this.buildFileIndex();
            return;
        }
        
        try {
            // 먼저 인덱스에서 해당 파일의 모든 연관을 제거합니다
            this.removeFileFromIndex(file.path);
            
            // 해당 파일을 다시 인덱싱합니다
            if (this.extractor.shouldProcessFile(file)) {
                const content = await this.app.vault.read(file);
                const highlights = this.extractor.extractHighlights(content, file);

                if (highlights.length > 0) {
                    // 하이라이트에 파일 정보를 추가합니다
                    const highlightsWithFileInfo = highlights.map(h => ({
                        ...h,
                        fileName: file.basename,
                        filePath: file.path
                    }));
                    
                    // 파일 매핑에 추가합니다
                    this.indexStore.setFileHighlights(file.path, highlightsWithFileInfo);
                }
            }
        } catch {
            // 인덱스 업데이트 오류를 무시합니다
        }
    }
    
    /**
     * 파일 수준 인덱스를 사용하여 하이라이트를 검색합니다
     * @param searchTerm 검색어
     * @returns 일치하는 하이라이트 배열
     */
    async searchHighlightsFromIndex(searchTerm: string): Promise<HighlightInfo[]> {
        // 인덱스를 재구축해야 하는지 확인합니다
        if (this.indexStore.isExpired() || this.indexStore.fileToHighlights.size === 0) {
            await this.buildFileIndex();
        }
        
        // 검색어가 비어 있으면 모든 하이라이트를 반환합니다
        if (!searchTerm.trim()) {
            return this.indexStore.getAllHighlights();
        }
        
        // 단어 분리 검색
        const terms = this.indexStore.tokenizeText(searchTerm);
        if (terms.length === 0) {
            return this.indexStore.getAllHighlights();
        }
        
        // 각 단어에 대해 일치하는 파일을 찾습니다
        const matchingFileSets: Set<string>[] = [];
        for (const term of terms) {
            const matchingFiles = new Set<string>();
            
            // 해당 단어를 포함하는 모든 파일을 찾습니다
            for (const [word, files] of this.indexStore.wordToFiles.entries()) {
                if (word.includes(term)) {
                    for (const filePath of files) {
                        matchingFiles.add(filePath);
                    }
                }
            }
            
            matchingFileSets.push(matchingFiles);
        }
        
        // 교집합을 구합니다 (모든 단어가 일치하는 파일)
        let resultFilePaths: Set<string>;
        if (matchingFileSets.length > 0) {
            resultFilePaths = matchingFileSets[0];
            for (let i = 1; i < matchingFileSets.length; i++) {
                resultFilePaths = new Set([...resultFilePaths].filter(path => matchingFileSets[i].has(path)));
            }
        } else {
            resultFilePaths = new Set();
        }
        
        // 일치하는 파일에서 하이라이트를 가져옵니다
        const results: HighlightInfo[] = [];
        for (const filePath of resultFilePaths) {
            const fileHighlights = this.indexStore.fileToHighlights.get(filePath) || [];
            
            // 하이라이트를 추가로 필터링하여 모든 검색어를 포함하는 것만 유지합니다
            for (const highlight of fileHighlights) {
                const highlightText = highlight.text.toLowerCase();
                const commentTexts = highlight.comments?.map(c => c.content.toLowerCase()) || [];
                
                // 모든 검색어가 하이라이트 텍스트 또는 댓글에 있는지 확인합니다
                const allTermsFound = terms.every(term => {
                    return highlightText.includes(term) || 
                           commentTexts.some(commentText => commentText.includes(term));
                });
                
                if (allTermsFound) {
                    results.push(highlight);
                }
            }
        }
        
        return results;
    }
}
