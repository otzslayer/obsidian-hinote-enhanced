import { TFile } from 'obsidian';
import { HighlightInfo as HiNote } from '../types/highlight';
import { HiNoteDataManager } from '../storage/HiNoteDataManager';

/**
 * 하이라이트 데이터 저장소 구현체
 * 책임:
 * 1. 하이라이트 데이터의 메모리 캐시 관리
 * 2. 데이터 영속성 작업 조율
 * 3. 통합된 데이터 접근 인터페이스 제공
 */
export class HighlightRepository {
    private cache: Map<string, HiNote[]> = new Map();
    private dataManager: HiNoteDataManager;

    constructor(dataManager: HiNoteDataManager) {
        this.dataManager = dataManager;
    }

    async initialize(): Promise<void> {
        await this.dataManager.initialize();
        await this.loadAllHighlightsToCache();
    }

    /**
     * 저장소 레이어에서 모든 하이라이트를 캐시로 로드
     */
    private async loadAllHighlightsToCache(): Promise<void> {
        try {
            const highlightFiles = await this.dataManager.getAllHighlightFiles();
            
            for (const filePath of highlightFiles) {
                if (!this.cache.has(filePath)) {
                    this.cache.set(filePath, []);
                }
            }
            
            for (const filePath of highlightFiles) {
                void this.loadFileHighlightsAsync(filePath);
            }
        } catch (error) {
            console.error('[HighlightRepository] 하이라이트 파일 목록 로드 실패:', error);
        }
    }

    /**
     * 단일 파일의 하이라이트 데이터를 비동기로 로드
     */
    private async loadFileHighlightsAsync(filePath: string): Promise<void> {
        try {
            const highlights = await this.dataManager.getFileHighlights(filePath);
            if (highlights.length > 0) {
                this.cache.set(filePath, highlights);
            } else {
                this.cache.delete(filePath);
            }
        } catch (error) {
            console.warn(`[HighlightRepository] 파일 ${filePath}의 하이라이트 데이터 로드 실패:`, error);
        }
    }

    async getFileHighlights(filePath: string): Promise<HiNote[]> {
        if (this.cache.has(filePath)) {
            return this.cache.get(filePath) || [];
        }
        
        const highlights = await this.dataManager.getFileHighlights(filePath);
        this.cache.set(filePath, highlights);
        return highlights;
    }

    async saveFileHighlights(filePath: string, highlights: HiNote[]): Promise<void> {
        this.cache.set(filePath, highlights);
        await this.dataManager.saveFileHighlights(filePath, highlights);
    }

    async deleteFileHighlights(filePath: string): Promise<void> {
        this.cache.delete(filePath);
        await this.dataManager.deleteFileHighlights(filePath);
    }

    async handleFileRename(oldPath: string, newPath: string): Promise<void> {
        await this.dataManager.handleFileRename(oldPath, newPath);
        
        const oldPathHighlights = this.cache.get(oldPath) || [];
        oldPathHighlights.forEach(highlight => {
            highlight.filePath = newPath;
        });
        this.cache.set(newPath, oldPathHighlights);
        this.cache.delete(oldPath);
    }

    async getAllHighlightFiles(): Promise<string[]> {
        return await this.dataManager.getAllHighlightFiles();
    }

    getCachedHighlights(filePath: string): HiNote[] | null {
        return this.cache.get(filePath) || null;
    }

    invalidateCache(filePath: string): void {
        this.cache.delete(filePath);
    }

    getAllCachedHighlights(): Map<string, HiNote[]> {
        return new Map(this.cache);
    }

    findHighlightById(highlightId: string): HiNote | null {
        if (!highlightId) return null;
        
        for (const fileHighlights of this.cache.values()) {
            const highlight = fileHighlights.find(h => h.id === highlightId);
            if (highlight) {
                return highlight;
            }
        }
        
        return null;
    }

    findHighlightsByBlockId(file: TFile, blockId: string): HiNote[] {
        if (!file || !blockId) return [];
        
        const filePath = file.path;
        const fileHighlights = this.cache.get(filePath) || [];
        
        return fileHighlights.filter(highlight => highlight.blockId === blockId);
    }
}
