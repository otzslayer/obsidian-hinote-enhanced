import { TFile } from "obsidian";
import { HighlightInfo } from "../../types/highlight";
import CommentPlugin from "../../../main";
import { SearchUIHelper } from "./SearchUIHelper";
import { SearchService } from "../../services/search";

/**
 * 검색 UI 매니저
 * 검색 관련 UI 상호작용 로직을 담당
 *
 * 담당:
 * - 검색 입력 디바운스
 * - 로딩 표시기 표시/숨김
 * - UI 이벤트 처리
 * - SearchService와 협력하여 비즈니스 로직 실행
 */
export class SearchUIManager {
    private plugin: CommentPlugin;
    private searchInput: HTMLInputElement;
    private searchLoadingIndicator: HTMLElement;
    private searchDebounceTimer: number | null = null;
    private isSearching: boolean = false;
    private uiHelper: SearchUIHelper;
    private searchService: SearchService;
    
    // 디바운스 시간 설정
    private readonly localSearchDebounceTime = 200; // 로컬 검색 디바운스 시간 (밀리초)
    private readonly globalSearchDebounceTime = 500; // 전역 검색 디바운스 시간 (밀리초)

    // 콜백 함수
    private onSearchCallback: (searchTerm: string, searchType: string) => Promise<void>;
    private getHighlightsCallback: () => HighlightInfo[];
    private getCurrentFileCallback: () => TFile | null;
    
    constructor(
        plugin: CommentPlugin,
        searchInput: HTMLInputElement,
        searchLoadingIndicator: HTMLElement,
        searchContainer: HTMLElement
    ) {
        this.plugin = plugin;
        this.searchInput = searchInput;
        this.searchLoadingIndicator = searchLoadingIndicator;
        this.uiHelper = new SearchUIHelper(searchInput, searchContainer);
        this.searchService = new SearchService(plugin);
    }
    
    /**
     * 검색 콜백 함수 설정
     */
    setCallbacks(
        onSearch: (searchTerm: string, searchType: string) => Promise<void>,
        getHighlights: () => HighlightInfo[],
        getCurrentFile: () => TFile | null
    ) {
        this.onSearchCallback = onSearch;
        this.getHighlightsCallback = getHighlights;
        this.getCurrentFileCallback = getCurrentFile;
    }
    
    /**
     * 검색 기능 초기화
     */
    initialize() {
        // 포커스 이벤트 추가
        this.searchInput.addEventListener('focus', () => {
            this.uiHelper.showSearchPrefixHints();
        });

        // 검색 입력 이벤트 추가
        this.searchInput.addEventListener('input', this.handleSearchInputWithDebounce);
    }
    
    /**
     * 리소스 정리
     */
    destroy() {
        if (this.searchDebounceTimer !== null) {
            window.clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }
        this.uiHelper.destroy();
    }
    
    /**
     * 검색 입력 디바운스 처리 함수
     */
    private handleSearchInputWithDebounce = (e: Event) => {
        // 이전 타이머 초기화
        if (this.searchDebounceTimer !== null) {
            window.clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }

        // 검색 입력값 가져오기
        const searchInput = this.searchInput.value.toLowerCase().trim();

        // 검색 유형에 따라 디바운스 시간 결정
        const isGlobalSearch = searchInput.startsWith('all:');
        const debounceTime = isGlobalSearch ? this.globalSearchDebounceTime : this.localSearchDebounceTime;

        // 전역 검색이고 검색어가 비어있지 않으면 로딩 표시기 표시
        if (isGlobalSearch && searchInput.length > 4) {
            this.showSearchLoadingIndicator();
        }

        // 디바운스 타이머 설정
        this.searchDebounceTimer = window.setTimeout(() => {
            void this.performSearch();
            this.searchDebounceTimer = null;
        }, debounceTime);
    };
    
    /**
     * 검색 실행
     */
    private async performSearch() {
        try {
            // 검색어 가져와서 SearchService로 파싱
            const searchInput = this.searchInput.value.trim();
            const { searchTerm, searchType } = this.searchService.parseSearchInput(searchInput);

            // 콜백 함수로 검색 실행
            if (this.onSearchCallback) {
                await this.onSearchCallback(searchTerm, searchType);
            }
        } catch (error) {
            console.error('[검색 UI 매니저] 검색 중 오류 발생:', error);
        } finally {
            this.hideSearchLoadingIndicator();
        }
    }
    
    /**
     * 검색어와 검색 유형으로 하이라이트 필터링
     * 비즈니스 로직은 SearchService에 위임
     */
    filterHighlightsByTerm(searchTerm: string, searchType: string = ''): HighlightInfo[] {
        const highlights = this.getHighlightsCallback();
        const currentFile = this.getCurrentFileCallback();
        
        return this.searchService.filterHighlights(highlights, searchTerm, searchType, currentFile);
    }
    
    /**
     * 검색 로딩 표시기 표시
     */
    private showSearchLoadingIndicator(): void {
        if (!this.isSearching) {
            this.isSearching = true;
            this.searchLoadingIndicator.removeClass("highlight-display-none");
            this.searchLoadingIndicator.addClass("highlight-display-flex");
        }
    }
    
    /**
     * 검색 로딩 표시기 숨김
     */
    private hideSearchLoadingIndicator(): void {
        if (this.isSearching) {
            this.isSearching = false;
            this.searchLoadingIndicator.removeClass("highlight-display-flex");
            this.searchLoadingIndicator.addClass("highlight-display-none");
        }
    }
    
    /**
     * 현재 검색값 가져오기
     */
    getSearchValue(): string {
        return this.searchInput.value.trim();
    }
    
    /**
     * 검색어 존재 여부 확인
     */
    hasSearchTerm(): boolean {
        return this.searchInput.value.trim() !== '';
    }
}
