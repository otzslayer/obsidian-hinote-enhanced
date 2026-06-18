import { TFile } from "obsidian";
import { HighlightInfo } from "../../types/highlight";
import CommentPlugin from "../../../main";

/**
 * 검색 서비스
 * 검색 관련 비즈니스 로직을 담당합니다
 *
 * 역할:
 * - 검색 입력 파싱 (접두사 인식)
 * - 하이라이트 데이터 필터링
 * - 검색 매칭 로직
 */
export class SearchService {
    private plugin: CommentPlugin;
    
    constructor(plugin: CommentPlugin) {
        this.plugin = plugin;
    }
    
    /**
     * 검색 입력을 파싱하여 검색어와 검색 유형을 추출합니다
     */
    parseSearchInput(searchInput: string): { searchTerm: string; searchType: string } {
        const normalizedInput = searchInput.toLowerCase().trim();
        
        const isGlobalSearch = normalizedInput.startsWith('all:');
        const isHiCardSearch = normalizedInput.startsWith('hicard:');
        const isCommentSearch = normalizedInput.startsWith('comment:');
        const isPathSearch = normalizedInput.startsWith('path:');
        
        let searchType = '';
        let searchTerm = normalizedInput;
        
        if (isGlobalSearch) {
            searchType = 'all';
            searchTerm = normalizedInput.substring(4).trim();
        } else if (isHiCardSearch) {
            searchType = 'hicard';
            searchTerm = normalizedInput.substring(7).trim();
        } else if (isCommentSearch) {
            searchType = 'comment';
            searchTerm = normalizedInput.substring(8).trim();
        } else if (isPathSearch) {
            searchType = 'path';
            searchTerm = normalizedInput.substring(5).trim();
        }
        
        return { searchTerm, searchType };
    }
    
    /**
     * 검색어와 검색 유형에 따라 하이라이트를 필터링합니다
     */
    filterHighlights(
        highlights: HighlightInfo[],
        searchTerm: string,
        searchType: string = '',
        currentFile: TFile | null
    ): HighlightInfo[] {
        // 경로로 검색하는 경우
        if (searchType === 'path') {
            return this.filterByPath(highlights, searchTerm);
        }
        
        // 플래시카드를 검색하는 경우
        if (searchType === 'hicard') {
            return this.filterByFlashcard(highlights, searchTerm, currentFile);
        }
        
        // 주석을 검색하는 경우
        if (searchType === 'comment') {
            return this.filterByComment(highlights, searchTerm, currentFile);
        }
        
        // 일반 검색 로직
        return this.filterByGeneral(highlights, searchTerm, currentFile);
    }
    
    /**
     * 경로로 하이라이트를 필터링합니다
     */
    private filterByPath(highlights: HighlightInfo[], searchTerm: string): HighlightInfo[] {
        // 모든 하이라이트에 파일 이름과 경로 정보가 있는지 확인합니다
        highlights.forEach(highlight => {
            if (highlight.filePath && !highlight.fileName) {
                const pathParts = highlight.filePath.split('/');
                highlight.fileName = pathParts[pathParts.length - 1];
            }
        });
        
        // 검색어가 비어 있으면 파일 경로가 있는 모든 하이라이트를 반환합니다
        if (!searchTerm || searchTerm.trim() === '') {
            return highlights.filter(highlight => !!highlight.filePath);
        }
        
        // 검색어가 있으면 경로가 일치하는 하이라이트를 필터링합니다
        return highlights.filter(highlight => {
            if (!highlight.filePath) {
                return false;
            }
            const filePath = highlight.filePath.toLowerCase();
            return filePath.includes(searchTerm.toLowerCase());
        });
    }
    
    /**
     * 플래시카드로 하이라이트를 필터링합니다
     */
    private filterByFlashcard(
        highlights: HighlightInfo[],
        searchTerm: string,
        currentFile: TFile | null
    ): HighlightInfo[] {
        const fsrsManager = this.plugin.fsrsManager;
        if (!fsrsManager) {
            return [];
        }
        
        return highlights.filter(highlight => {
            // 하이라이트가 플래시카드로 변환되었는지 확인합니다
            const hasFlashcard = highlight.id ? 
                fsrsManager.findCardsBySourceId(highlight.id, 'highlight').length > 0 : 
                false;
            
            if (!hasFlashcard) {
                return false;
            }
            
            // 검색어가 있으면 검색어와도 일치해야 합니다
            if (searchTerm) {
                return this.matchesSearchTerm(highlight, searchTerm, currentFile);
            }

            return true;
        });
    }

    /**
     * 주석으로 하이라이트를 필터링합니다
     */
    private filterByComment(
        highlights: HighlightInfo[],
        searchTerm: string,
        currentFile: TFile | null
    ): HighlightInfo[] {
        return highlights.filter(highlight => {
            // 하이라이트에 주석이 포함되어 있는지 확인합니다
            const hasComments = highlight.comments && highlight.comments.length > 0;
            
            if (!hasComments) {
                return false;
            }
            
            // 검색어가 있으면 검색어와도 일치해야 합니다
            if (searchTerm) {
                return this.matchesSearchTerm(highlight, searchTerm, currentFile);
            }

            return true;
        });
    }

    /**
     * 일반 검색 필터링
     */
    private filterByGeneral(
        highlights: HighlightInfo[],
        searchTerm: string,
        currentFile: TFile | null
    ): HighlightInfo[] {
        return highlights.filter(highlight => {
            return this.matchesSearchTerm(highlight, searchTerm, currentFile);
        });
    }
    
    /**
     * 하이라이트가 검색어와 일치하는지 확인합니다
     */
    private matchesSearchTerm(
        highlight: HighlightInfo,
        searchTerm: string,
        currentFile: TFile | null
    ): boolean {
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        // 하이라이트 텍스트를 검색합니다
        if (highlight.text.toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        
        // 댓글 내용을 검색합니다
        if (highlight.comments?.some(comment => 
            comment.content.toLowerCase().includes(lowerSearchTerm)
        )) {
            return true;
        }
        
        // 전체 보기에서는 파일 이름도 검색합니다
        if (currentFile === null && highlight.fileName?.toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        
        return false;
    }
}
