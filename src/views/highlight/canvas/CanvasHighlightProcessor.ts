import { TFile, App } from 'obsidian';
import { HighlightInfo } from '../../../types/highlight';
import { CanvasService } from '../../../services/CanvasService';
import { HighlightDataService } from '../../../services/highlight';

/**
 * Canvas 하이라이트 프로세서
 * Canvas 파일의 하이라이트 표시 처리 담당
 */
export class CanvasHighlightProcessor {
    private app: App;
    private canvasService: CanvasService;
    private highlightDataService: HighlightDataService;
    
    // 콜백 함수
    private onShowLoading: (() => void) | null = null;
    private onHideLoading: (() => void) | null = null;
    private onShowError: ((message: string) => void) | null = null;
    private onShowEmpty: ((message: string) => void) | null = null;
    
    constructor(
        app: App,
        canvasService: CanvasService,
        highlightDataService: HighlightDataService
    ) {
        this.app = app;
        this.canvasService = canvasService;
        this.highlightDataService = highlightDataService;
    }
    
    /**
     * 콜백 함수 설정
     */
    setCallbacks(callbacks: {
        onShowLoading?: () => void;
        onHideLoading?: () => void;
        onShowError?: (message: string) => void;
        onShowEmpty?: (message: string) => void;
    }) {
        if (callbacks.onShowLoading) {
            this.onShowLoading = callbacks.onShowLoading;
        }
        if (callbacks.onHideLoading) {
            this.onHideLoading = callbacks.onHideLoading;
        }
        if (callbacks.onShowError) {
            this.onShowError = callbacks.onShowError;
        }
        if (callbacks.onShowEmpty) {
            this.onShowEmpty = callbacks.onShowEmpty;
        }
    }
    
    /**
     * Canvas 파일 처리
     * Canvas에서 참조된 파일의 하이라이트만 로드
     */
    async processCanvasFile(file: TFile): Promise<HighlightInfo[]> {
        // 로딩 표시기 표시
        if (this.onShowLoading) {
            this.onShowLoading();
        }

        try {
            // 1. Canvas 파일 파싱하여 모든 파일 경로 가져오기
            const filePaths = await this.canvasService.parseCanvasFile(file);

            if (filePaths.length === 0) {
                // 파일 노드가 없는 경우 안내 표시
                if (this.onShowEmpty) {
                    this.onShowEmpty('There are no file nodes in the current Canvas.');
                }
                return [];
            }

            // 2. Canvas에서 참조된 파일의 하이라이트만 로드
            const allHighlights: HighlightInfo[] = [];

            for (const filePath of filePaths) {
                const targetFile = this.app.vault.getAbstractFileByPath(filePath);
                if (targetFile instanceof TFile) {
                    // 해당 파일의 하이라이트 로드
                    const fileHighlights = await this.highlightDataService.loadFileHighlights(targetFile);

                    // 파일 정보 추가
                    const highlightsWithFileInfo = fileHighlights.map(h => ({
                        ...h,
                        fileName: targetFile.basename,
                        filePath: targetFile.path,
                        fileIcon: 'file-text'
                    }));

                    allHighlights.push(...highlightsWithFileInfo);
                }
            }

            // 3. Canvas 하이라이트로 마킹
            return this.markAsCanvasHighlights(allHighlights, file);

        } catch (error) {
            console.error('Canvas 파일 처리 실패:', error);
            if (this.onShowError) {
                this.onShowError('Canvas 파일 처리 중 오류 발생');
            }
            return [];
        } finally {
            // 로딩 표시기 숨김
            if (this.onHideLoading) {
                this.onHideLoading();
            }
        }
    }
    
    /**
     * 하이라이트를 Canvas 출처로 마킹
     */
    private markAsCanvasHighlights(highlights: HighlightInfo[], canvasFile: TFile): HighlightInfo[] {
        return highlights.map(highlight => ({
            ...highlight,
            isFromCanvas: true,
            canvasSource: canvasFile.path,
            isGlobalSearch: true // 전역 검색 결과로 마킹하여 파일명이 표시되도록 함
        }));
    }
}
