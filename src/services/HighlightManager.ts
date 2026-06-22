import { App, TFile } from 'obsidian';
import { HighlightInfo as HiNote } from '../types/highlight';
import { HighlightRepository } from '../repositories/HighlightRepository';
import { EventManager } from './EventManager';
import { HighlightService } from './HighlightService';
import { IdGenerator } from '../utils/IdGenerator';

/**
 * 하이라이트 관리자 - 비즈니스 로직 레이어
 * 역할:
 * 1. 하이라이트 비즈니스 로직 처리 (추가, 삭제, 업데이트)
 * 2. 데이터 검증 및 정리
 * 3. 이벤트 트리거 조율
 * 4. 여러 서비스와 저장소 간 조율
 */
export class HighlightManager {
    constructor(
        private app: App,
        private repository: HighlightRepository,
        private eventManager: EventManager,
        private highlightService: HighlightService
    ) {}

    /**
     * 하이라이트를 추가하거나 업데이트합니다
     * @param file 파일
     * @param highlight 하이라이트 정보
     * @returns 추가된 하이라이트
     */
    async addHighlight(file: TFile, highlight: HiNote): Promise<HiNote> {
        if (!highlight.id) {
            highlight.id = IdGenerator.generateHighlightId(
                file.path,
                highlight.position || 0,
                highlight.text
            );
        }

        const now = Date.now();
        if (!highlight.createdAt) {
            highlight.createdAt = now;
        }
        highlight.updatedAt = now;

        const filePath = file.path;
        const fileHighlights = await this.repository.getFileHighlights(filePath);
        const existingIndex = fileHighlights.findIndex(h => h.id === highlight.id);

        if (existingIndex >= 0) {
            fileHighlights[existingIndex] = highlight;
        } else {
            fileHighlights.push(highlight);
        }

        await this.repository.saveFileHighlights(filePath, fileHighlights);

        if (this.eventManager) {
            if (highlight.comments && highlight.comments.length > 0) {
                const latestComment = highlight.comments[highlight.comments.length - 1];
                this.eventManager.emitCommentUpdate(filePath, highlight.text, latestComment.content, highlight.id);
            } else {
                this.eventManager.emitHighlightUpdate(filePath, highlight.text, highlight.text, highlight.id);
            }
        }

        return highlight;
    }

    /**
     * 하이라이트를 제거합니다
     * @param file 파일
     * @param highlight 하이라이트 정보
     * @returns 제거 성공 여부
     */
    async removeHighlight(file: TFile, highlight: HiNote): Promise<boolean> {
        const filePath = file.path;
        const fileHighlights = await this.repository.getFileHighlights(filePath);

        const highlightExists = fileHighlights.some(h => h.id === highlight.id);
        if (!highlightExists) {
            return false;
        }

        const updatedHighlights = fileHighlights.filter(h => h.id !== highlight.id);

        if (updatedHighlights.length > 0) {
            await this.repository.saveFileHighlights(filePath, updatedHighlights);
        } else {
            await this.repository.deleteFileHighlights(filePath);
        }

        if (this.eventManager && highlight.id) {
            if (highlight.comments && highlight.comments.length > 0) {
                const latestComment = highlight.comments[highlight.comments.length - 1];
                this.eventManager.emitCommentDelete(filePath, latestComment.content, highlight.id);
            } else {
                this.eventManager.emitHighlightDelete(filePath, highlight.text, highlight.id);
            }
        }

        return true;
    }

    /**
     * 파일의 모든 하이라이트를 가져옵니다
     * @param file 파일
     * @returns 하이라이트 배열
     */
    async getFileHighlights(file: TFile): Promise<HiNote[]> {
        if (!file) return [];
        return await this.repository.getFileHighlights(file.path);
    }

    /**
     * 텍스트와 위치로 하이라이트를 검색합니다
     * @param file 파일
     * @param highlight 하이라이트 정보 (text 및 position 포함)
     * @returns 일치하는 하이라이트 배열
     */
    async findHighlights(file: TFile, highlight: { text: string; position?: number }): Promise<HiNote[]> {
        if (!file) return [];

        const fileHighlights = await this.repository.getFileHighlights(file.path);

        return fileHighlights.filter(c => {
            const textMatch = c.text === highlight.text;
            if (!textMatch) return false;

            if (typeof c.position === 'number' && typeof highlight.position === 'number') {
                return Math.abs(c.position - highlight.position) < 1000;
            }
            return true;
        });
    }

    /**
     * blockId로 하이라이트를 검색합니다
     * @param file 파일
     * @param blockId 블록 ID
     * @returns 하이라이트 배열
     */
    async findHighlightsByBlockId(file: TFile, blockId: string): Promise<HiNote[]> {
        return this.repository.findHighlightsByBlockId(file, blockId);
    }

    /**
     * ID로 하이라이트를 검색합니다
     * @param highlightId 하이라이트 ID
     * @returns 하이라이트 정보, 찾지 못한 경우 null
     */
    findHighlightById(highlightId: string): HiNote | null {
        return this.repository.findHighlightById(highlightId);
    }

    /**
     * 고립 데이터 수를 확인합니다
     * 저장된 모든 하이라이트와 댓글을 검사하여, 문서에서 해당 하이라이트 텍스트를 찾을 수 없는 고립 데이터의 수를 집계합니다
     * @returns 고립 데이터 수
     */
    async checkOrphanedDataCount(): Promise<{ orphanedHighlights: number; affectedFiles: number }> {
        let orphanedHighlights = 0;
        let affectedFiles = new Set<string>();

        const allHighlights = this.repository.getAllCachedHighlights();

        for (const [filePath, highlights] of allHighlights.entries()) {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!file || !(file instanceof TFile)) {
                affectedFiles.add(filePath);
                orphanedHighlights += highlights.length;
                continue;
            }

            try {
                const content = await this.app.vault.read(file);
                const extractedHighlights = this.highlightService.extractHighlights(content, file);
                const extractedTexts = new Set(extractedHighlights.map(h => h.text));

                let fileHasOrphans = false;

                for (const highlight of highlights) {
                    if (highlight.isVirtual) continue;

                    if (!extractedTexts.has(highlight.text)) {
                        orphanedHighlights++;
                        fileHasOrphans = true;
                    }
                }

                if (fileHasOrphans) {
                    affectedFiles.add(filePath);
                }
            } catch {
                // 오류 처리
            }
        }

        return { orphanedHighlights, affectedFiles: affectedFiles.size };
    }

    /**
     * 고립 데이터를 정리합니다
     * 저장된 모든 하이라이트와 댓글을 검사하여, 문서에서 해당 하이라이트 텍스트를 찾을 수 없는 고립 데이터를 제거합니다
     * @returns 정리된 데이터 수
     */
    async cleanOrphanedData(): Promise<{ removedHighlights: number; affectedFiles: number }> {
        let removedHighlights = 0;
        let affectedFiles = new Set<string>();

        const allHighlights = this.repository.getAllCachedHighlights();

        for (const [filePath, highlights] of allHighlights.entries()) {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!file || !(file instanceof TFile)) {
                await this.repository.deleteFileHighlights(filePath);
                affectedFiles.add(filePath);
                removedHighlights += highlights.length;
                continue;
            }

            try {
                const content = await this.app.vault.read(file);
                const extractedHighlights = this.highlightService.extractHighlights(content, file);
                const extractedTexts = new Set(extractedHighlights.map(h => h.text));

                const validHighlights = highlights.filter(highlight => {
                    if (highlight.isVirtual) return true;
                    return extractedTexts.has(highlight.text);
                });

                if (validHighlights.length < highlights.length) {
                    removedHighlights += highlights.length - validHighlights.length;
                    affectedFiles.add(filePath);

                    if (validHighlights.length === 0) {
                        await this.repository.deleteFileHighlights(filePath);
                    } else {
                        await this.repository.saveFileHighlights(filePath, validHighlights);
                    }
                }
            } catch {
                // 오류 처리
            }
        }

        return { removedHighlights, affectedFiles: affectedFiles.size };
    }

    /**
     * 파일 이름 변경을 처리합니다
     * @param oldPath 이전 경로
     * @param newPath 새 경로
     */
    async handleFileRename(oldPath: string, newPath: string): Promise<void> {
        await this.repository.handleFileRename(oldPath, newPath);
    }
}
