import { HighlightInfo, CommentItem } from "../../types/highlight";
import { TFile } from "obsidian";
import type CommentPlugin from "../../../main";

export class DragContentGenerator {
    constructor(
        private highlight: HighlightInfo,
        private plugin: CommentPlugin
    ) {}

    /**
     * 드래그 시 서식 지정된 내용을 동기적으로 생성
     */
    public generateSync(): string {
        const lines: string[] = [];

        // ExportService와 동일한 형식 사용
        if (this.highlight.isVirtual) {
            const fileName = this.highlight.filePath?.split('/').pop()?.replace('.md', '') || 'File';
            lines.push(`> [!note] [[${fileName}]]`);
            lines.push("> ");
        } else {
            lines.push("> [!quote] HiNote");
            
            let hasAddedContent = false;
            
            // blockId가 있으면 인용 생성 시도
            if (this.highlight.blockId) {
                // 하이라이트의 filePath를 우선 사용
                let filePath = this.highlight.filePath;

                // 하이라이트에 filePath가 없으면 현재 파일 경로 가져오기 시도
                if (!filePath) {
                    const currentFile = this.plugin.app.workspace.getActiveFile();
                    if (currentFile) {
                        filePath = currentFile.path;
                    }
                }
                
                if (filePath) {
                    const fileName = filePath.split('/').pop()?.replace('.md', '');
                    if (fileName) {
                        const reference = `> ![[${fileName}#^${this.highlight.blockId}]]`;
                        lines.push(reference);
                        lines.push("> ");
                        hasAddedContent = true;
                    }
                }
            } else if (this.highlight.filePath && typeof this.highlight.position === 'number') {
                const file = this.plugin.app.vault.getAbstractFileByPath(this.highlight.filePath);
                if (file instanceof TFile) {
                    const cache = this.plugin.app.metadataCache.getFileCache(file);
                    if (cache?.sections) {
                        const position = this.highlight.position;
                        const section = cache.sections.find(section => 
                            section.position.start.offset <= position &&
                            section.position.end.offset >= position
                        );

                        if (section?.id) {
                            const fileName = this.highlight.filePath.split('/').pop()?.replace('.md', '');
                            if (fileName) {
                                const reference = `> ![[${fileName}#^${section.id}]]`;
                                lines.push(reference);
                                lines.push("> ");
                                hasAddedContent = true;
                            }
                        }
                    }
                }
            }
            
            // 블록 인용 추가에 실패한 경우 원본 텍스트 사용
            if (!hasAddedContent && this.highlight.text) {
                lines.push(`> ${this.highlight.text}`);
                lines.push("> ");
            }
        }

        // 댓글 추가
        if (this.highlight.comments && this.highlight.comments.length > 0) {
            for (const comment of this.highlight.comments) {
                lines.push(...this.formatComment(comment, false));
            }
        }

        return lines.join("\n");
    }

    /**
     * 기존 Block ID만 사용하여 전체 서식 지정된 내용을 비동기적으로 생성
     */
    public async generate(): Promise<string> {
        // 단순화된 구현으로 동기 메서드와 동일하며, Block ID 생성 시도 불필요
        return this.generateSync();
    }

    /**
     * 댓글 내용 서식 지정
     */
    private formatComment(comment: CommentItem, isVirtual: boolean): string[] {
        const lines: string[] = [];
        const indentation = isVirtual ? '>' : '>>';

        if (!isVirtual) {
            // 새 템플릿 형식 사용: 타임스탬프를 제목에 포함
            const date = comment.updatedAt ? window.moment(comment.updatedAt).format("YYYY-MM-DD HH:mm:ss") : '';
            lines.push(`>> [!note]+ ${date}`);
        }

        // 여러 줄 내용 처리, 각 줄에 올바른 들여쓰기 보장
        const commentLines = comment.content
            .split('\n')
            .map(line => {
                line = line.trim();
                return line ? `${indentation} ${line}` : indentation;
            })
            .join('\n');
        lines.push(commentLines);
        lines.push(isVirtual ? ">" : ">");

        return lines;
    }
}
