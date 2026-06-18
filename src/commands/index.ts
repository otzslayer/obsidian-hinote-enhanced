import { Plugin } from 'obsidian';
import { WindowManager } from '../plugin/WindowManager';
import { registerOpenCommentPanelCommand } from './openCommentPanel';
import { registerOpenMainWindowCommand } from './openMainWindow';
import { InlineMigrationRunner } from '../migration/InlineMigrationRunner';

/**
 * 모든 명령 등록
 * 명령 등록의 통합 진입점
 */
export function registerCommands(
    plugin: Plugin,
    windowManager: WindowManager,
    ensureInitialized: () => Promise<void>
): void {
    // 댓글 패널 열기 명령 등록 (오른쪽 사이드바)
    registerOpenCommentPanelCommand(plugin, windowManager, ensureInitialized);

    // 메인 창에서 댓글 패널 열기 명령 등록
    registerOpenMainWindowCommand(plugin, windowManager, ensureInitialized);

    // 일회성 마이그레이션 명령 등록
    new InlineMigrationRunner(plugin.app).registerCommand(plugin);
}

/**
 * 창 관리자 인스턴스 반환
 * main.ts의 리본 버튼에서 사용
 */
export function createWindowManager(plugin: Plugin): WindowManager {
    return new WindowManager(plugin.app);
}
