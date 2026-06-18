import { App, Modal, Notice } from 'obsidian';
import { HighlightInfo } from '../types/highlight';
import { getTemplate, templates } from './index';
import { CommentItem } from '../types/highlight';
import { t } from "../i18n";
import { exportStyles } from './exportStyles';
import type html2canvas from 'html2canvas';

type Html2Canvas = typeof html2canvas;

export class ExportPreviewModal extends Modal {
    private highlight: HighlightInfo & { comments?: CommentItem[] };
    private html2canvasInstance: Html2Canvas;
    private selectedTemplateId: string = 'default';
    private previewContainer: HTMLElement;
    private includeComments: boolean = false;

    constructor(app: App, highlight: HighlightInfo & { comments?: CommentItem[] }, html2canvas: Html2Canvas) {
        super(app);
        this.highlight = highlight;
        this.html2canvasInstance = html2canvas;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('highlight-export-modal');

        // 메인 컨테이너 생성
        const mainContainer = contentEl.createEl('div', {
            cls: 'highlight-export-main-container'
        });

        // 드롭다운 직접 생성
        const selectEl = mainContainer.createEl('select', {
            cls: 'highlight-template-select'
        });

        // 사용 가능한 모든 템플릿 옵션 추가
        templates.forEach(template => {
            const option = selectEl.createEl('option', {
                text: template.name,
                value: template.id
            });
            
            if (this.selectedTemplateId === template.id) {
                option.selected = true;
            }
        });

        // 선택 변경 감지
        selectEl.addEventListener('change', (e) => {
            const select = e.target as HTMLSelectElement;
            this.selectedTemplateId = select.value;
            this.updatePreview();
        });

        // 미리보기 컨테이너 생성
        this.previewContainer = mainContainer.createEl('div', {
            cls: 'highlight-export-preview-container'
        });

        // 초기 미리보기
        this.updatePreview();

        // 버튼 그룹
        const buttonContainer = contentEl.createEl('div', {
            cls: 'highlight-export-modal-buttons'
        });

        // 버튼 그룹 왼쪽에 주석 표시 체크박스 추가
        if (this.highlight.comments && this.highlight.comments.length > 0) {
            const showCommentsContainer = buttonContainer.createEl('div', {
                cls: 'highlight-export-checkbox-container'
            });

            // 체크박스 생성
            const checkbox = showCommentsContainer.createEl('input', {
                attr: { 
                    type: 'checkbox',
                    id: 'include-comments-checkbox'
                },
                cls: 'highlight-export-checkbox'
            });

            // 라벨 생성
            showCommentsContainer.createEl('label', {
                text: t('Include Comments'),
                attr: {
                    for: 'include-comments-checkbox'
                },
                cls: 'highlight-export-checkbox-label'
            });

            // 체크박스 상태 변경 감지
            checkbox.addEventListener('change', (e) => {
                this.includeComments = (e.target as HTMLInputElement).checked;
                this.updatePreview();
            });
        }

        // 취소 버튼
        buttonContainer.createEl('button', {
            cls: 'highlight-btn',
            text: t('Cancel')
        }).addEventListener('click', () => this.close());

        // 다운로드 버튼
        buttonContainer.createEl('button', {
            cls: 'highlight-btn highlight-btn-primary',
            text: t('Download')
        }).addEventListener('click', () => {
            void this.downloadImage();
        });
    }

    private async downloadImage(): Promise<void> {
        try {
            // 내보내기용 임시 컨테이너 생성
            const exportContainer = activeDocument.createElement('div');
            exportContainer.className = 'highlight-export-container';

            const template = getTemplate(this.selectedTemplateId);
            const cardElement = template.render(this.highlight);
            exportContainer.appendChild(cardElement);

            // 주석 표시가 활성화된 경우 주석 추가
            if (this.includeComments && this.highlight.comments && this.highlight.comments.length > 0) {
                this.addCommentsToContainer(exportContainer);
            }

            activeDocument.body.appendChild(exportContainer);

            const canvas = await this.html2canvasInstance(exportContainer, {
                backgroundColor: null,
                scale: window.devicePixelRatio * 2, // 선명도를 위해 장치 픽셀 비율의 2배 사용
                useCORS: true,
                allowTaint: true,
                logging: false,
                imageTimeout: 0, // 이미지 타임아웃 비활성화
                removeContainer: true, // 임시 컨테이너 자동 제거
                onclone: (clonedDoc: Document) => {
                    const style = clonedDoc.createElement('style');
                    style.textContent = this.getExportStyles();
                    clonedDoc.head.appendChild(style);
                }
            });

            // canvas 내보내기 품질 최적화
            const dataUrl = canvas.toDataURL('image/png', 1.0);

            const link = activeDocument.createElement('a');
            link.download = `highlight-${this.selectedTemplateId}-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();

            this.close();
            new Notice(t('Export successful!'));
        } catch {
            new Notice(t('Export failed, please try again'));
        }
    }

    private updatePreview() {
        this.previewContainer.empty();
        this.previewContainer.className = 'highlight-export-preview';
        const template = getTemplate(this.selectedTemplateId);
        const cardElement = template.render(this.highlight);
        this.previewContainer.appendChild(cardElement);
        
        // 주석 표시가 활성화된 경우 주석 추가
        if (this.includeComments && this.highlight.comments && this.highlight.comments.length > 0) {
            this.addCommentsToContainer(this.previewContainer);
        }
    }

    private addCommentsToContainer(container: HTMLElement) {
        // 카드 요소 가져오기
        const cardElement = container.querySelector('.highlight-export-card');
        if (!cardElement) return;

        // 푸터 요소 가져오기
        const footerElement = cardElement.querySelector('.highlight-export-footer');
        if (!footerElement) return;

        // 주석 영역 생성
        const commentsContainer = activeDocument.createElement('div');
        commentsContainer.className = 'highlight-export-comments-section';

        // 주석 목록 추가
        const commentsList = activeDocument.createElement('div');
        commentsList.className = 'highlight-export-comments-list';
        commentsContainer.appendChild(commentsList);

        // 각 주석 렌더링
        if (this.highlight.comments) {
            this.highlight.comments.forEach(comment => {
                const commentItem = activeDocument.createElement('div');
                commentItem.className = 'highlight-export-comment-item';

                // 주석 내용
                const content = activeDocument.createElement('div');
                content.className = 'highlight-export-comment-content';
                content.textContent = comment.content;
                commentItem.appendChild(content);

                // 주석 시간
                if (comment.createdAt) {
                    const time = activeDocument.createElement('div');
                    time.className = 'highlight-export-comment-time';
                    time.textContent = new Date(comment.createdAt).toLocaleString();
                    commentItem.appendChild(time);
                }

                commentsList.appendChild(commentItem);
            });
        }

        // 주석 영역을 푸터 앞에 삽입
        cardElement.insertBefore(commentsContainer, footerElement);
    }

    private getExportStyles(): string {
        return `
            body {
                margin: 0;
                background: none;
            }
            ${exportStyles}
        `;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
