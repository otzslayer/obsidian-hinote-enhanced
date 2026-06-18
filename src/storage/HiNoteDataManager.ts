import { App } from 'obsidian';
import { HighlightInfo as HiNote } from '../types/highlight';
import { FSRSStorage } from '../flashcard';
import { DataValidator } from './DataValidator';
import {
    convertToLegacyHighlight,
    convertToOptimizedHighlight,
    OptimizedHighlight,
    OptimizedHighlightData
} from './HighlightDataFormat';
import { FileMappingStore } from './FileMappingStore';
import {
    detectHighlightFilesFromStorage,
    ensureHiNoteDirectoryStructure
} from './HiNoteStorageLayout';
import { FlashcardDataStore } from './FlashcardDataStore';

/**
 * HiNote 데이터 관리자 - 저장소 레이어 (리팩토링됨)
 * 책임:
 * 1. 순수한 파일 시스템 작업
 * 2. 데이터 직렬화/역직렬화
 * 3. 파일 경로 매핑 관리
 * 4. 비즈니스 로직 미포함
 */
export class HiNoteDataManager {
    private app: App;
    private vaultPath: string;
    private fileMappingStore: FileMappingStore;
    private flashcardDataStore: FlashcardDataStore;
    private readonly CURRENT_VERSION = '2.0';

    constructor(app: App) {
        this.app = app;
        // Obsidian에서는 상대 경로를 직접 사용하므로 절대 경로를 가져올 필요 없음
        this.vaultPath = '';
        this.fileMappingStore = new FileMappingStore(app, this.vaultPath, this.CURRENT_VERSION);
        this.flashcardDataStore = new FlashcardDataStore(app, this.vaultPath);
    }

    /**
     * 데이터 관리자 초기화
     */
    async initialize(): Promise<void> {
        await this.ensureDirectoryStructure();
        await this.loadFileMapping();
    }

    /**
     * 디렉토리 구조가 존재하는지 확인
     */
    private async ensureDirectoryStructure(): Promise<void> {
        await ensureHiNoteDirectoryStructure(this.app, this.vaultPath);
    }

    /**
     * 파일 매핑 로드
     */
    private async loadFileMapping(): Promise<void> {
        await this.fileMappingStore.load();
    }

    /**
     * 파일 매핑 저장
     */
    private async saveFileMapping(): Promise<void> {
        await this.fileMappingStore.save();
    }

    /**
     * 파일의 안전한 저장 경로 반환
     */
    private getStoragePathForFile(filePath: string): string {
        return this.fileMappingStore.getStoragePathForFile(filePath);
    }

    /**
     * 파일의 모든 하이라이트 데이터 반환
     * @param filePath 파일 경로
     * @returns 하이라이트 배열
     */
    async getFileHighlights(filePath: string): Promise<HiNote[]> {
        const storagePath = this.getStoragePathForFile(filePath);
        
        try {
            const content = await this.app.vault.adapter.read(storagePath);
            const data: OptimizedHighlightData = JSON.parse(content);
            
            // 데이터 형식 검증
            const validation = DataValidator.validateHighlightData(data);
            if (!validation.valid) {
                console.warn(`파일 ${filePath}의 하이라이트 데이터 유효성 검사 실패:`, validation.errors);
                return [];
            }

            // 호환성 유지를 위해 구 형식으로 변환
            return Object.entries(data.highlights).map(([id, highlight]) => 
                convertToLegacyHighlight(id, highlight, filePath)
            );
        } catch {
            // 파일이 없거나 읽기 실패
            return [];
        }
    }

    /**
     * 파일의 하이라이트 데이터 저장
     * @param filePath 파일 경로
     * @param highlights 하이라이트 배열
     */
    async saveFileHighlights(filePath: string, highlights: HiNote[]): Promise<void> {
        const storagePath = this.getStoragePathForFile(filePath);
        
        // 최적화된 형식으로 변환
        const optimizedHighlights: { [id: string]: OptimizedHighlight } = {};

        for (const highlight of highlights) {
            if (!highlight.id) continue; // ID가 없는 하이라이트 건너뜀
            const optimized = convertToOptimizedHighlight(highlight);
            optimizedHighlights[highlight.id] = optimized;
        }

        const data: OptimizedHighlightData = {
            version: this.CURRENT_VERSION,
            lastModified: Date.now(),
            highlights: optimizedHighlights
        };

        await this.app.vault.adapter.write(storagePath, JSON.stringify(data, null, 2));
    }

    /**
     * 파일의 모든 하이라이트 데이터 삭제
     * @param filePath 파일 경로
     */
    async deleteFileHighlights(filePath: string): Promise<void> {
        const storagePath = this.getStoragePathForFile(filePath);
        
        try {
            await this.app.vault.adapter.remove(storagePath);
            this.fileMappingStore.delete(filePath);
            await this.saveFileMapping();
        } catch {
            // 파일이 없을 수 있으므로 오류 무시
        }
    }

    /**
     * 파일 이름 변경 처리
     * @param oldPath 이전 경로
     * @param newPath 새 경로
     */
    async handleFileRename(oldPath: string, newPath: string): Promise<void> {
        const oldStoragePath = this.getStoragePathForFile(oldPath);
        const newStoragePath = this.getStoragePathForFile(newPath);

        try {
            // 이전 파일 존재 여부 확인
            const content = await this.app.vault.adapter.read(oldStoragePath);

            // 새 위치에 쓰기
            await this.app.vault.adapter.write(newStoragePath, content);

            // 이전 파일 삭제
            await this.app.vault.adapter.remove(oldStoragePath);

            // 매핑 업데이트
            this.fileMappingStore.delete(oldPath);
            await this.saveFileMapping();
        } catch {
            // 이전 파일이 없을 수 있으므로 오류 무시
        }
    }

    /**
     * 모든 하이라이트 파일 목록 반환
     */
    async getAllHighlightFiles(): Promise<string[]> {
        // 먼저 파일 매핑에서 가져오기
        const mappedFiles = this.fileMappingStore.getMappedFiles();

        // 매핑이 비어있으면 하이라이트 디렉토리 스캔 시도
        if (mappedFiles.length === 0) {
            const detectedFiles = await detectHighlightFilesFromStorage(
                this.app,
                this.vaultPath,
                (originalPath, baseName) => {
                    this.fileMappingStore.set(originalPath, baseName);
                }
            );
                
            if (detectedFiles.length > 0) {
                this.saveFileMapping().catch(err =>
                    console.warn('파일 매핑 저장 실패:', err)
                );
            }

            return detectedFiles;
        }
        
        return mappedFiles;
    }


    /**
     * 플래시카드 데이터 반환
     */
    async getFlashcardData(): Promise<FSRSStorage | null> {
        return this.flashcardDataStore.load();
    }

    /**
     * 플래시카드 데이터 저장
     */
    async saveFlashcardData(data: FSRSStorage): Promise<void> {
        await this.flashcardDataStore.save(data);
    }
}
