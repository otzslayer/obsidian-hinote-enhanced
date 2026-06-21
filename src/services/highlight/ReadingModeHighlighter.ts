import { App, MarkdownView, Notice, TFile } from 'obsidian';
import { HighlightService } from '../HighlightService';
import { SectionLineRegistry } from '../../editor/SectionLineRegistry';
import { mapHighlightInsertion } from './HighlightInsertionMapper';
import { t } from '../../i18n';

/**
 * 읽기 모드에서 선택 텍스트를 ==...== 로 감싸 소스에 삽입한다.
 *
 * 실패 시 무수정 중단 + Notice.
 */
export class ReadingModeHighlighter {
    constructor(
        private app: App,
        private highlightService: HighlightService,
        private registry: SectionLineRegistry,
    ) {}

    async highlightSelection(): Promise<void> {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        const file = view.file;
        if (!file || !(file instanceof TFile)) return;

        if (!this.highlightService.shouldProcessFile(file)) return;

        const sel = activeWindow.getSelection();
        const selectedText = sel?.toString().trim() ?? '';
        if (!selectedText) {
            new Notice(t('No text selected'));
            return;
        }

        const anchorNode = sel?.anchorNode ?? null;
        const focusNode = sel?.focusNode ?? null;
        if (!anchorNode || !focusNode) return;

        const anchorRange = this.registry.findBlockRange(anchorNode);
        const focusRange = this.registry.findBlockRange(focusNode);

        if (!anchorRange || !focusRange) {
            new Notice(t('Cannot determine block range'));
            return;
        }

        // 다중 블록 선택 — anchor 와 focus 가 다른 블록에 있다
        if (
            anchorRange.lineStart !== focusRange.lineStart ||
            anchorRange.lineEnd !== focusRange.lineEnd
        ) {
            new Notice(t('Multi-block selection is not supported'));
            return;
        }

        const range = anchorRange;
        let insertionFailed = false;

        await this.app.vault.process(file, (content) => {
            const existing = this.highlightService.extractHighlights(content, file)
                .filter(h => !h.isVirtual && typeof h.position === 'number')
                .map(h => ({ position: h.position, originalLength: h.originalLength ?? 0 }));

            const result = mapHighlightInsertion(
                content,
                range.lineStart,
                range.lineEnd,
                selectedText,
                existing,
            );

            if (result.ok) return result.newText;

            insertionFailed = true;
            switch (result.reason) {
                case 'empty':
                    new Notice(t('No text selected'));
                    break;
                case 'not-found':
                    new Notice(t('Selected text not found in source (may contain inline markdown)'));
                    break;
                case 'ambiguous':
                    new Notice(t('Selected text is ambiguous (appears multiple times in block)'));
                    break;
                case 'overlap':
                    new Notice(t('Selection overlaps an existing highlight'));
                    break;
            }
            return content;
        });

        if (!insertionFailed) {
            // 성공 — 읽기 모드가 자동으로 재렌더되어 PreviewWidgetRenderer 가 새 mark 를 처리한다
        }
    }
}
