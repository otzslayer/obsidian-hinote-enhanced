import { CommentItem, HighlightInfo } from "../../types/highlight";
import { MarkdownRenderer, Component, App } from "obsidian";
import { toHardBreakMarkdown } from "./commentMarkdown";
import { t } from "../../i18n";

export class CommentList extends Component {
    private container: HTMLElement;
    private app: App;

    constructor(
        parentEl: HTMLElement,
        private highlight: HighlightInfo,
        private onCommentEdit: (comment: CommentItem) => void,
        app: App
    ) {
        super();
        this.app = app;
        this.render(parentEl);
    }

    private render(parentEl: HTMLElement) {
        const comments = this.highlight.comments || [];
        if (comments.length === 0) return;

        const commentsSection = parentEl.createEl("div", {
            cls: "hi-notes-section"
        });

        this.container = commentsSection.createEl("div", {
            cls: "hi-notes-list"
        });

        this.renderComments().catch(error => {
            console.error('Error rendering comments:', error);
        });
    }

    private async renderComments() {
        // 표시용 정렬은 복사본에서 수행합니다. 원본 highlight.comments는 노트의
        // 위치 순서를 유지해야 합니다 — 코멘트 수정/삭제 앵커(ordinal)가 이 순서에
        // 의존하므로, 제자리 정렬하면 잘못된 블록을 가리켜 anchor mismatch가 발생합니다.
        const comments = [...(this.highlight.comments || [])];

        // 업데이트 시간 기준 내림차순 정렬
        comments.sort((a, b) => b.updatedAt - a.updatedAt);

        // 컨테이너 초기화
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }

        // await를 지원하기 위해 for...of 루프 사용
        for (const comment of comments) {
            const commentEl = this.container.createEl("div", {
                cls: "hi-note",
                attr: { 'data-comment-id': comment.id }
            });

            // 콘텐츠 래퍼 생성 (펼치기/접기 기능용)
            const contentWrapper = commentEl.createEl("div", {
                cls: "hi-note-content-wrapper"
            });

            // 댓글 내용 - 더블클릭 이벤트 추가
            const contentEl = contentWrapper.createEl("div", {
                cls: "hi-note-content markdown-rendered"
            });

            const content = comment.content;
            try {
                const markdownContent = toHardBreakMarkdown(content);
                // MarkdownRenderer를 사용해 Markdown 내용 렌더링
                await MarkdownRenderer.render(
                    this.app,
                    markdownContent,
                    contentEl,
                    this.highlight.filePath || '',
                    this
                );
                
                // 스타일 문제를 수정하기 위한 커스텀 스타일 클래스 추가
                const lists = contentEl.querySelectorAll('ul, ol');
                lists.forEach(list => {
                    list.addClass('comment-markdown-list');
                });

                // 내부 링크 활성화
                await this.activateInternalLinks(contentEl, this.highlight.filePath || '');
            } catch (error) {
                console.error('Error rendering markdown in comment:', error);
                // 렌더링 실패 시 일반 텍스트 렌더링으로 대체
                contentEl.textContent = content;
            }

            // 더블클릭 이벤트 리스너 추가
            contentEl.addEventListener("dblclick", (e) => {
                // 링크를 클릭한 경우 편집 이벤트 미발생
                if ((e.target as HTMLElement).closest('a')) {
                    return;
                }
                e.stopPropagation();
                e.preventDefault(); // 기본 동작 방지
                this.onCommentEdit(comment);
            });

            // 더블클릭과의 충돌을 피하기 위해 단일 클릭 이벤트 버블링 방지
            contentEl.addEventListener("click", (e) => {
                // 링크를 클릭한 경우 이벤트 전달 허용
                if ((e.target as HTMLElement).closest('a')) {
                    return;
                }
                e.stopPropagation();
            });

            // 콘텐츠 높이 확인 및 펼치기/접기 버튼 추가 (다음 프레임에서 실행하여 콘텐츠 렌더링 보장)
            window.requestAnimationFrame(() => {
                this.checkAndAddToggleButton(contentWrapper, contentEl, comment);
            });

            // 하단 액션 바 생성
            const footer = commentEl.createEl("div", {
                cls: "hi-note-footer"
            });

            // 댓글 시간
            footer.createEl("div", {
                text: new Date(comment.updatedAt).toLocaleString(),
                cls: "hi-note-time"
            });

            // 더블클릭 편집 힌트 추가
            footer.createEl("span", {
                text: "Double click to edit",
                cls: "hi-note-edit-hint"
            });

            // 액션 버튼 컨테이너
            footer.createEl("div", {
                cls: "hi-note-actions"
            });
        }
    }
    
    /**
     * 콘텐츠 높이를 확인하고 펼치기/접기 버튼을 추가
     * @param wrapper 콘텐츠 래퍼
     * @param contentEl 콘텐츠 요소
     * @param comment 댓글 객체
     */
    private checkAndAddToggleButton(
        wrapper: HTMLElement,
        contentEl: HTMLElement,
        comment: CommentItem
    ): void {
        const MAX_HEIGHT = 240; // 접힌 상태의 최대 높이 (픽셀)
        const actualHeight = contentEl.scrollHeight;

        // 콘텐츠 높이가 임계값을 초과하면 펼치기/접기 기능 추가
        if (actualHeight > MAX_HEIGHT) {
            // 접을 수 있는 마커 클래스 추가
            wrapper.addClass('has-collapsible-content');
            wrapper.addClass('collapsed');

            // 그라디언트 마스크 추가
            wrapper.createEl("div", {
                cls: "content-fade-out"
            });

            // 펼치기/접기 버튼 추가
            const toggleBtn = wrapper.createEl("div", {
                cls: "toggle-content-btn"
            });

            // 버튼 텍스트 및 아이콘 생성
            const btnText = toggleBtn.createEl("span", {
                text: t("Expand")
            });

            // 클릭 이벤트 추가
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isCollapsed = wrapper.hasClass('collapsed');

                if (isCollapsed) {
                    // 펼치기
                    wrapper.removeClass('collapsed');
                    wrapper.addClass('expanded');
                    btnText.textContent = t("Collapse");
                } else {
                    // 접기
                    wrapper.addClass('collapsed');
                    wrapper.removeClass('expanded');
                    btnText.textContent = t("Expand");
                }
            });
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
} 
