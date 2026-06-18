import { Plugin } from 'obsidian';
import { t } from '../i18n';
import { WindowManager } from '../plugin/WindowManager';

/**
 * 오른쪽 사이드바에서 댓글 패널을 여는 명령
 */
export async function openCommentPanel(
    plugin: Plugin,
    windowManager: WindowManager,
    ensureInitialized: () => Promise<void>
): Promise<void> {
    await ensureInitialized();
    await windowManager.openCommentPanelInSidebar();
}

/**
 * 명령 등록
 */
export function registerOpenCommentPanelCommand(
    plugin: Plugin,
    windowManager: WindowManager,
    ensureInitialized: () => Promise<void>
): void {
    plugin.addCommand({
        id: 'open-comment-window',
        name: t('Open in right sidebar'),
        callback: () => openCommentPanel(plugin, windowManager, ensureInitialized)
    });
}
