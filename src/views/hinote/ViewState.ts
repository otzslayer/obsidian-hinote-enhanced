import { TFile } from "obsidian";
import { HighlightInfo } from '../../types/highlight';

/**
 * HiNote 뷰 상태 관리
 * 모든 뷰 상태 데이터를 중앙 집중 관리하여 HiNoteView에 분산되지 않도록 함
 */
export class ViewState {
    currentFile: TFile | null = null;
    highlights: HighlightInfo[] = [];
    highlightsWithFlashcards: Set<string> = new Set<string>();
    isFlashcardMode: boolean = false;
    isDraggedToMainView: boolean = false;
    isMobileView: boolean = false;
    isSmallScreen: boolean = false;
    isShowingFileList: boolean = true;
    currentEditingHighlightId: string | null | undefined = null;

    /**
     * 전체 하이라이트 뷰 여부 판단
     */
    isInAllHighlightsView(): boolean {
        return this.currentFile === null;
    }

    /**
     * 하이라이트 데이터 초기화
     */
    resetHighlights(): void {
        this.highlights = [];
    }
}
