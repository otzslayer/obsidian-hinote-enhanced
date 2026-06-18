import { Notice } from 'obsidian';
import type { HighlightInfo } from '../../../types/highlight';

export class HighlightCardClipboard {
    static copyHighlightContent(highlight: HighlightInfo, fileName?: string): void {
        try {
            const content = this.formatHighlightContent(highlight, fileName);

            navigator.clipboard.writeText(content).then(() => {
                new Notice('Copied');
            }).catch(error => {
                console.error('내용 복사 실패:', error);
                new Notice('Failed to copy content');
            });
        } catch (error) {
            console.error('하이라이트 내용 복사 중 오류:', error);
            new Notice('Failed to copy content');
        }
    }

    private static formatHighlightContent(highlight: HighlightInfo, fileName?: string): string {
        let content = '> [!quote] HiNote\n';
        content += `> ${highlight.text}`;

        if (highlight.filePath) {
            const displayName = fileName || highlight.filePath.split('/').pop() || highlight.filePath;
            content += '\n> \n';
            content += `> From: [[${displayName}]]`;
        }

        return `${content}\n\n`;
    }
}
