import { Plugin } from 'obsidian';
import { t } from '../i18n';
import { WindowManager } from '../plugin/WindowManager';

/**
 * 메인 창에서 댓글 패널을 여는 명령
 */
export async function openMainWindow(
    plugin: Plugin,
    windowManager: WindowManager,
    ensureInitialized: () => Promise<void>
): Promise<void> {
    await ensureInitialized();
    await windowManager.openCommentPanelInMainWindow();
}

/**
 * 명령 등록
 */
export function registerOpenMainWindowCommand(
    plugin: Plugin,
    windowManager: WindowManager,
    ensureInitialized: () => Promise<void>
): void {
    plugin.addCommand({
        id: 'open-comment-main-window',
        name: t('Open in main window'),
        callback: () => openMainWindow(plugin, windowManager, ensureInitialized)
    });
}
