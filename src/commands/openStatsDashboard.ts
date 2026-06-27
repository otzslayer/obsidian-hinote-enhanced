import type CommentPlugin from '../../main';
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
            await ensureInitialized();
            new HighlightStatsModal(plugin).open();
        },
    });
}
