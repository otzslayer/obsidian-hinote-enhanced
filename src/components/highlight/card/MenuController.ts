import { Menu, MenuItem } from 'obsidian';
import { t } from '../../../i18n';

interface HighlightCardMenuActions {
    onToggleFlashcard: () => void | Promise<void>;
    onCopyHighlight: () => void;
    onExportImage: () => void;
    onDeleteHighlight: () => void | Promise<void>;
}

export class HighlightCardMenuController {
    show(button: HTMLElement, hasFlashcard: boolean, actions: HighlightCardMenuActions): void {
        const menu = new Menu();

        menu.addItem((item: MenuItem) => item
            .setTitle(hasFlashcard ? t('Delete HiCard') : t('Create HiCard'))
            .onClick(() => {
                void actions.onToggleFlashcard();
            })
        );

        menu.addItem((item: MenuItem) => item
            .setTitle(t('Copy Highlight'))
            .onClick(actions.onCopyHighlight)
        );

        menu.addItem((item: MenuItem) => item
            .setTitle(t('Export as Image'))
            .onClick(actions.onExportImage)
        );

        menu.addItem((item: MenuItem) => item
            .setTitle(t('Delete'))
            .onClick(() => {
                void actions.onDeleteHighlight();
            })
        );

        const rect = button.getBoundingClientRect();
        menu.showAtPosition({ x: rect.left - 100, y: rect.bottom + 8 });
    }
}
