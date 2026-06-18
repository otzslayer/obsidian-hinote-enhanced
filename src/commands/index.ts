import { Plugin } from 'obsidian';
import { WindowManager } from '../plugin/WindowManager';
import { registerOpenCommentPanelCommand } from './openCommentPanel';
import { registerOpenMainWindowCommand } from './openMainWindow';
import { registerAddCommentCommand } from './addComment';
import { InlineMigrationRunner } from '../migration/InlineMigrationRunner';

/**
 * 注册所有命令
 * 这是命令注册的统一入口
 */
export function registerCommands(
    plugin: Plugin,
    windowManager: WindowManager,
    ensureInitialized: () => Promise<void>
): void {
    // 注册打开评论面板命令（右侧边栏）
    registerOpenCommentPanelCommand(plugin, windowManager, ensureInitialized);

    // 注册在主窗口打开评论面板命令
    registerOpenMainWindowCommand(plugin, windowManager, ensureInitialized);

    // 注册添加内联评论命令 (Mod+Shift+C)
    registerAddCommentCommand(plugin);

    // 注册一次性迁移命令
    new InlineMigrationRunner(plugin.app).registerCommand(plugin);
}

/**
 * 获取窗口管理器实例
 * 用于 main.ts 中的 ribbon 按钮
 */
export function createWindowManager(plugin: Plugin): WindowManager {
    return new WindowManager(plugin.app);
}
