import { Plugin } from 'obsidian';
import type CommentPlugin from '../../main';
import { WindowManager } from '../plugin/WindowManager';
import type { HighlightDecorator } from '../editor/HighlightDecorator';
import { registerOpenCommentPanelCommand } from './openCommentPanel';
import { registerOpenMainWindowCommand } from './openMainWindow';
import { registerToggleInlineCommentSyntaxCommand } from './toggleInlineCommentSyntax';
import { registerToggleHighlightCommand } from './toggleHighlight';
import { InlineMigrationRunner } from '../migration/InlineMigrationRunner';
import { registerOpenStatsDashboardCommand } from './openStatsDashboard';

/**
 * 모든 명령 등록
 * 명령 등록의 통합 진입점
 */
export function registerCommands(
    plugin: Plugin,
    windowManager: WindowManager,
    ensureInitialized: () => Promise<void>,
    getDecorator: () => HighlightDecorator
): void {
    // 댓글 패널 열기 명령 등록 (오른쪽 사이드바)
    registerOpenCommentPanelCommand(plugin, windowManager, ensureInitialized);

    // 메인 창에서 댓글 패널 열기 명령 등록
    registerOpenMainWindowCommand(plugin, windowManager, ensureInitialized);

    // 인라인 코멘트 문법 토글 명령 등록
    registerToggleInlineCommentSyntaxCommand(plugin, getDecorator);

    // 통합 하이라이트 토글 명령 등록 (Mod+Shift+S)
    registerToggleHighlightCommand(plugin, getDecorator);

    // 일회성 마이그레이션 명령 등록
    new InlineMigrationRunner(plugin.app).registerCommand(plugin);

    // 하이라이트 통계 대시보드 명령 등록
    registerOpenStatsDashboardCommand(plugin as CommentPlugin, ensureInitialized);
}

/**
 * 창 관리자 인스턴스 반환
 * main.ts의 리본 버튼에서 사용
 */
export function createWindowManager(plugin: Plugin): WindowManager {
    return new WindowManager(plugin.app);
}
