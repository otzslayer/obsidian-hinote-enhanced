import type CommentPlugin from '../../main';
import { Notice } from 'obsidian';
import { HighlightStatsModal } from '../views/stats/HighlightStatsModal';
import { t } from '../i18n';

export function registerOpenStatsDashboardCommand(
    plugin: CommentPlugin,
    ensureInitialized: () => Promise<void>
): void {
    plugin.addCommand({
        id: 'open-highlight-dashboard',
        name: t('Open highlight dashboard'),
        callback: async () => {
            try {
                await ensureInitialized();
            } catch (err) {
                new Notice(t('Plugin initialization failed'));
                console.error('[HiNote] Failed to initialize for stats dashboard', err);
                return;
            }
            new HighlightStatsModal(plugin).open();
        },
    });
}
