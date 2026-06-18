import { t } from "../../i18n";

/**
 * 검색 UI 보조 클래스
 * 검색 관련 UI 상호작용 처리 담당:
 * - 검색 접두사 힌트
 * - 힌트 박스 위치 지정
 * - 이벤트 리스너 관리
 */
export class SearchUIHelper {
    private searchInput: HTMLInputElement;
    private searchContainer: HTMLElement;
    private searchHintsEventHandlers: {
        input: (e: Event) => void;
        blur: (e: FocusEvent) => void;
        click: (e: MouseEvent) => void;
    } | null = null;
    private documentClickTimer: number | null = null;
    
    constructor(searchInput: HTMLInputElement, searchContainer: HTMLElement) {
        this.searchInput = searchInput;
        this.searchContainer = searchContainer;
    }
    
    /**
     * 검색 접두사 힌트 표시
     */
    showSearchPrefixHints() {
        this.destroy();

        // 힌트 컨테이너 생성
        const hintsContainer = activeDocument.body.createDiv({
            cls: 'search-prefix-hints show'
        });
        
        // 사용 가능한 검색 접두사 정의
        const prefixes = [
            { prefix: 'all:', description: t('search-prefix-all') },
            { prefix: 'path:', description: t('search-prefix-path') },
            { prefix: 'hicard:', description: t('search-prefix-hicard') },
            { prefix: 'comment:', description: t('search-prefix-comment') }
        ];
        
        // 힌트 항목 생성
        prefixes.forEach(({ prefix, description }) => {
            const hintItem = hintsContainer.createDiv({
                cls: 'search-prefix-hint-item'
            });
            
            hintItem.createSpan({
                cls: 'search-prefix-tag',
                text: prefix
            });
            
            hintItem.createSpan({
                cls: 'search-prefix-description',
                text: description
            });
            
            // 클릭 이벤트 추가
            hintItem.addEventListener('click', () => {
                this.searchInput.value = prefix + ' ';
                this.searchInput.focus();
                hintsContainer.remove();

                // 검색 트리거
                const inputEvent = new Event('input', { bubbles: true });
                this.searchInput.dispatchEvent(inputEvent);
            });
        });
        
        // 힌트 컨테이너 위치 지정
        this.positionSearchHints(hintsContainer);

        // 입력 이벤트 리스너 추가
        const handleInputChange = () => {
            const inputValue = this.searchInput.value.trim();
            
            if (inputValue === '') {
                if (!activeDocument.body.contains(hintsContainer)) {
                    activeDocument.body.appendChild(hintsContainer);
                    this.positionSearchHints(hintsContainer);
                }
            } else {
                if (hintsContainer && activeDocument.body.contains(hintsContainer)) {
                    hintsContainer.remove();
                }
            }
        };
        
        this.searchInput.addEventListener('input', handleInputChange);
        
        // 다른 영역 클릭 시 힌트 박스 숨김
        const hideHintsOnClickOutside = (e: MouseEvent) => {
            if (hintsContainer && !hintsContainer.contains(e.target as Node) && 
                e.target !== this.searchInput) {
                hintsContainer.remove();
                activeDocument.removeEventListener('click', hideHintsOnClickOutside);
            }
        };
        
        // 포커스 잃을 때 정리
        const handleBlur = () => {
            window.setTimeout(() => {
                if (!activeDocument.activeElement ||
                    (activeDocument.activeElement !== this.searchInput &&
                     !hintsContainer.contains(activeDocument.activeElement as Node))) {
                    hintsContainer.remove();
                }
            }, 200);
        };
        
        this.searchInput.addEventListener('blur', handleBlur);
        
        // 클릭 이벤트 리스너 추가
        this.documentClickTimer = window.setTimeout(() => {
            activeDocument.addEventListener('click', hideHintsOnClickOutside);
            this.documentClickTimer = null;
        }, 10);
        
        // 이벤트 리스너 참조 저장
        this.searchHintsEventHandlers = {
            input: handleInputChange,
            blur: handleBlur,
            click: hideHintsOnClickOutside
        };
    }
    
    /**
     * 검색 힌트 컨테이너 위치 지정
     */
    private positionSearchHints(hintsContainer: HTMLElement) {
        const searchRect = this.searchInput.getBoundingClientRect();
        
        hintsContainer.addClass('search-hints-container');
        hintsContainer.setCssProps({
            top: (searchRect.bottom + 4) + 'px',
            left: searchRect.left + 'px',
            width: searchRect.width + 'px'
        });
    }
    
    /**
     * 리소스 정리
     */
    destroy() {
        if (this.documentClickTimer !== null) {
            window.clearTimeout(this.documentClickTimer);
            this.documentClickTimer = null;
        }

        // 힌트 박스 제거
        const existingHints = activeDocument.querySelector('.search-prefix-hints');
        if (existingHints) {
            existingHints.remove();
        }

        // 이벤트 리스너 정리
        if (this.searchHintsEventHandlers) {
            this.searchInput.removeEventListener('input', this.searchHintsEventHandlers.input);
            this.searchInput.removeEventListener('blur', this.searchHintsEventHandlers.blur);
            activeDocument.removeEventListener('click', this.searchHintsEventHandlers.click);
            this.searchHintsEventHandlers = null;
        }
    }
}
