import { TFile } from 'obsidian';
import type CommentPlugin from '../../../../main';
import type { HighlightInfo } from '../../../types/highlight';
import { DragContentGenerator } from '../DragContentGenerator';
import { DragPreview } from '../DragPreview';

export class HighlightCardDragController {
    constructor(
        private plugin: CommentPlugin,
        private getHighlight: () => HighlightInfo
    ) {}

    setup(element: HTMLElement): void {
        element.setAttribute('draggable', 'true');
        this.preloadDragContent();

        element.addEventListener('dragstart', async (event: DragEvent) => {
            try {
                const highlight = this.getHighlight();
                if (!highlight?.text) {
                    throw new Error('Invalid highlight data');
                }

                const formattedContent = await this.generateDragContentWithFallback();

                event.dataTransfer?.setData('text/plain', formattedContent);
                event.dataTransfer?.setData('application/highlight', JSON.stringify(highlight));

                element.addClass('dragging');
                DragPreview.start(event, highlight.text);
            } catch (error) {
                console.error('[HighlightCard] Error during drag start:', error);
                event.preventDefault();
                event.stopPropagation();
            }
        });

        element.addEventListener('dragend', () => {
            element.removeClass('dragging');
            DragPreview.clear();
        });
    }

    preloadDragContent(): void {
        const highlight = this.getHighlight();
        if (!highlight.filePath || typeof highlight.position !== 'number') {
            return;
        }

        const file = this.plugin.app.vault.getAbstractFileByPath(highlight.filePath);
        if (!(file instanceof TFile)) {
            return;
        }

        this.generateDragContent().catch(error => {
            console.error('[HighlightCard] Error pre-generating block ID:', error);
        });
    }

    private async generateDragContentWithFallback(): Promise<string> {
        try {
            const timeoutPromise = new Promise<string>((_, reject) => {
                window.setTimeout(() => reject(new Error('Block ID generation timeout')), 300);
            });

            return await Promise.race([
                this.generateDragContent(),
                timeoutPromise
            ]);
        } catch (error) {
            console.debug('[HighlightCard] Using sync fallback for drag content:', error);
            return this.generateDragContentSync();
        }
    }

    private generateDragContentSync(): string {
        const generator = new DragContentGenerator(this.getHighlight(), this.plugin);
        return generator.generateSync();
    }

    private async generateDragContent(): Promise<string> {
        const generator = new DragContentGenerator(this.getHighlight(), this.plugin);
        return generator.generate();
    }
}
