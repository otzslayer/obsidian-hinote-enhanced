import type CommentPlugin from '../../main';
import { HighlightStatsModal } from '../views/stats/HighlightStatsModal';

export function registerOpenStatsDashboardCommand(
    plugin: CommentPlugin,
    ensureInitialized: () => Promise<void>
): void {
    plugin.addCommand({
        id: 'open-highlight-dashboard',
        name: 'Open highlight dashboard',
        callback: async () => {
            await ensureInitialized();
            new HighlightStatsModal(plugin).open();
        },
    });
}
