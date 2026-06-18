import { TFile } from 'obsidian';
import { HighlightInfo as HiNote } from '../types/highlight';

/**
 * 하이라이트 데이터 저장소 인터페이스
 * 하이라이트 데이터 접근 및 캐시 관리 담당
 */
export interface IHighlightRepository {
    /**
     * 저장소 초기화
     */
    initialize(): Promise<void>;

    /**
     * 파일의 모든 하이라이트 반환
     * @param filePath 파일 경로
     * @returns 하이라이트 배열
     */
    getFileHighlights(filePath: string): Promise<HiNote[]>;

    /**
     * 파일의 하이라이트 저장
     * @param filePath 파일 경로
     * @param highlights 하이라이트 배열
     */
    saveFileHighlights(filePath: string, highlights: HiNote[]): Promise<void>;

    /**
     * 파일의 모든 하이라이트 삭제
     * @param filePath 파일 경로
     */
    deleteFileHighlights(filePath: string): Promise<void>;

    /**
     * 파일 이름 변경 처리
     * @param oldPath 이전 경로
     * @param newPath 새 경로
     */
    handleFileRename(oldPath: string, newPath: string): Promise<void>;

    /**
     * 하이라이트가 포함된 모든 파일 경로 반환
     */
    getAllHighlightFiles(): Promise<string[]>;

    /**
     * 캐시에서 파일 하이라이트 반환 (로드를 트리거하지 않음)
     * @param filePath 파일 경로
     * @returns 하이라이트 배열, 캐시되지 않은 경우 null 반환
     */
    getCachedHighlights(filePath: string): HiNote[] | null;

    /**
     * 캐시 무효화
     * @param filePath 파일 경로
     */
    invalidateCache(filePath: string): void;

    /**
     * 캐시된 모든 하이라이트 데이터 반환
     */
    getAllCachedHighlights(): Map<string, HiNote[]>;

    /**
     * 하이라이트 ID로 하이라이트 검색
     * @param highlightId 하이라이트 ID
     */
    findHighlightById(highlightId: string): HiNote | null;

    /**
     * blockId로 하이라이트 검색
     * @param file 파일
     * @param blockId 블록 ID
     */
    findHighlightsByBlockId(file: TFile, blockId: string): HiNote[];
}
