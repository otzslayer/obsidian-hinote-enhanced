import type { WorkspaceLeaf } from 'obsidian';
import type CommentPlugin from '../../main';
import { createWindowManager, registerCommands } from '../commands';
import { WindowManager } from './WindowManager';
import { HiNoteView, VIEW_TYPE_HINOTE } from '../views/hinote/HiNoteView';

export function createPluginWindowManager(plugin: CommentPlugin): WindowManager {
    return createWindowManager(plugin);
}

export function registerPluginViews(plugin: CommentPlugin): void {
    plugin.registerView(
        VIEW_TYPE_HINOTE,
        (leaf: WorkspaceLeaf) => {
            void plugin.ensureServicesInitialized();
            const services = plugin.requireInitializedServices();
            return new HiNoteView(leaf, plugin, services);
        }
    );
}

export function registerPluginRibbon(plugin: CommentPlugin, windowManager: WindowManager): void {
    plugin.addRibbonIcon(
        'highlighter',
        'HiNote Enhanced',
        async () => {
            await plugin.ensureServicesInitialized();
            await windowManager.openCommentPanelInSidebar();
        }
    );
}

/**
 * 모든 렌더 블록의 소스 줄범위를 레지스트리에 기록한다.
 *
 * onload 에서 등록해야 한다 — registerMarkdownPostProcessor 는 등록 이후의 렌더에만
 * 적용되므로, 서비스 지연 초기화까지 미루면 이미 렌더된 문서가 레지스트리에서 누락된다.
 * 서비스에 의존하지 않으므로 초기화 이전에도 안전하다.
 */
export function registerPluginMarkdownPostProcessors(plugin: CommentPlugin): void {
    plugin.registerMarkdownPostProcessor((element, context) => {
        const info = context.getSectionInfo(element);
        if (info) {
            plugin.sectionLineRegistry.set(element, {
                lineStart: info.lineStart,
                lineEnd: info.lineEnd,
            });
        }
    });
}

export function registerPluginCommands(plugin: CommentPlugin, windowManager: WindowManager): void {
    registerCommands(
        plugin,
        windowManager,
        async () => { await plugin.ensureServicesInitialized(); },
        () => plugin.highlightDecorator
    );
}

export function registerPluginVaultEvents(plugin: CommentPlugin): void {
    plugin.registerEvent(
        plugin.app.vault.on('rename', async (file, oldPath) => {
            const services = plugin.services;
            if (services) {
                await services.highlightManager.handleFileRename(oldPath, file.path);
            }
        })
    );
}
