import { MarkdownRenderer, Component, App } from "obsidian";
import { HighlightInfo } from "../../types/highlight";
import { t } from "../../i18n";

export class HighlightContent extends Component {
    private container: HTMLElement;
    private textContainer: HTMLElement;

    // 미리보기 요소 추적을 위한 정적 속성 추가
    private static dragPreview: HTMLElement | null = null;

    constructor(
        parentEl: HTMLElement,
        private highlight: HighlightInfo,
        private onHighlightClick: (highlight: HighlightInfo) => Promise<void>,
        private app: App,
        private isInMainView: boolean = false
    ) {
        super();
        this.render(parentEl).catch(error => {
            console.error('Error rendering highlight content:', error);
        });
    }

    private async render(parentEl: HTMLElement) {
        this.container = parentEl.createEl("div", {
            cls: "highlight-content"
        });

        await this.renderText();
    }

    private async renderText() {
        // 하이라이트 텍스트 컨테이너
        this.textContainer = this.container.createEl("div", {
            cls: "highlight-text-container"
        });

        // 세로선 장식 추가
        const decorator = this.textContainer.createEl("div", {
            cls: "highlight-text-decorator"
        });

        // 배경색이 있으면 장식에 적용
        if (this.highlight.backgroundColor) {
            decorator.style.backgroundColor = this.highlight.backgroundColor;
        }

        // 하이라이트 텍스트
        const textEl = this.textContainer.createEl("div", {
            cls: "highlight-text"
        });

        // 텍스트 콘텐츠 요소 생성, 가상 하이라이트인 경우 displayText 사용
        const textContent = textEl.createEl("div", {
            cls: `highlight-text-content ${this.highlight.isVirtual ? 'virtual-highlight' : ''} markdown-rendered`
        });

        // 텍스트의 줄바꿈 처리, 빈 값 검사 추가
        const text = this.highlight.text || '';
        
        try {
            // Obsidian의 MarkdownRenderer.render 메서드를 사용해 Markdown 내용 렌더링
            // 복잡한 스타일 규칙 상속을 피하기 위해 this 대신 새 Component 인스턴스 사용
            const markdownComponent = new Component();
            await MarkdownRenderer.render(
                this.app,
                text,
                textContent,
                this.highlight.filePath || '',
                markdownComponent
            );
            
            // 스타일 문제를 수정하기 위한 커스텀 스타일 클래스 추가
            const lists = textContent.querySelectorAll('ul, ol');
            lists.forEach(list => {
                list.addClass('highlight-markdown-list');
            });

            // 내부 링크 활성화
            await this.activateInternalLinks(textContent, this.highlight.filePath || '');
        } catch (error) {
            console.error('Error rendering markdown in highlight:', error);

            // 렌더링 실패 시 일반 텍스트 렌더링으로 대체
            const lines = text.split('\n');
            lines.forEach((line: string, index: number) => {
                const p = textContent.createEl("p", {
                    text: line,
                    cls: "highlight-text-line"
                });

                // 마지막 줄이 아니면 줄바꿈 추가
                if (index < lines.length - 1) {
                    p.addClass('highlight-text-line-spacing');
                }
            });
        }

        // 전역 검색 결과가 아니고 메인 뷰가 아닌 경우 클릭 이벤트 추가
        if (!this.highlight.isGlobalSearch && !this.isInMainView) {
            // 툴팁 텍스트를 "하이라이트로 이동"으로 설정
            textContent.setAttribute('aria-label', t('Jump to highlight'));

            textContent.addEventListener("mousedown", (e) => {
                // 링크를 클릭한 경우 하이라이트 클릭 이벤트 미발생
                if ((e.target as HTMLElement).closest('a')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                void this.onHighlightClick(this.highlight);
            });
        } else {
            // 전역 검색 결과 또는 메인 뷰에 특수 스타일 클래스 추가
            textContent.addClass('global-search-highlight');

            // 존재할 수 있는 툴팁 텍스트 제거
            textContent.removeAttribute('aria-label');

            // 커서 스타일 힌트 추가
            textContent.setCssProps({ cursor: 'default' });
        }
    }
    
    /**
     * 내부 링크를 활성화하여 호버 미리보기 및 클릭 이동 기능 추가
     * @param element 링크를 포함하는 요소
     * @param sourcePath 소스 파일 경로
     */
    private async activateInternalLinks(element: HTMLElement, sourcePath: string) {
        // 모든 내부 링크 요소 탐색
        const internalLinks = element.querySelectorAll('a.internal-link');

        internalLinks.forEach(link => {
            // 링크 대상 가져오기
            const target = link.getAttribute('data-href') || link.getAttribute('href');
            if (!target) return;

            // 클릭 이벤트 추가
            link.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();

                // 링크 열기
                const targetFile = this.app.metadataCache.getFirstLinkpathDest(target, sourcePath);
                if (targetFile) {
                    void this.app.workspace.openLinkText(target, sourcePath, false);
                }
            });

            // 호버 미리보기 추가
            link.addEventListener('mouseenter', (event) => {
                this.app.workspace.trigger('hover-link', {
                    event,
                    source: 'hi-note',
                    hoverParent: element,
                    targetEl: link,
                    linktext: target,
                    sourcePath: sourcePath
                });
            });
        });

        // 모든 태그 탐색
        const tags = element.querySelectorAll('a.tag');

        tags.forEach(tag => {
            // 태그 텍스트 가져오기
            const tagText = tag.getAttribute('href');
            if (!tagText) return;

            // 클릭 이벤트 추가
            tag.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();

                // 태그 검색 열기
                this.app.workspace.trigger('search:open', tagText);
            });
        });
    }

    public getContainer(): HTMLElement {
        return this.container;
    }
} 
