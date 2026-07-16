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
    plugin: CommentPlugin,
    windowManager: WindowManager,
    ensureInitialized: () => Promise<void>,
    getDecorator: () => HighlightDecorator
): void {
    // 댓글 패널 열기 명령 등록 (오른쪽 사이드바)
    registerOpenCommentPanelCommand(plugin, windowManager, ensureInitialized);

    // 메인 창에서 댓글 패널 열기 명령 등록
    registerOpenMainWindowCommand(plugin, windowManager, ensureInitialized);

    // 인라인 코멘트 문법 토글 명령 등록
    registerToggleInlineCommentSyntaxCommand(plugin, ensureInitialized, getDecorator);

    // 통합 하이라이트 토글 명령 등록 (Mod+Shift+S)
    // 필요한 highlightService·sectionLineRegistry 가 둘 다 플러그인 필드라
    // getDecorator 도 ensureInitialized 도 필요 없다 — 이 경로에서 초기화를 돌리면
    // CM6 재구성이 읽기 모드의 DOM Selection 을 지운다(toggleHighlight.ts 주석 참조).
    registerToggleHighlightCommand(plugin);

    // 일회성 마이그레이션 명령 등록
    new InlineMigrationRunner(plugin.app).registerCommand(plugin);

    // 하이라이트 통계 대시보드 명령 등록
    registerOpenStatsDashboardCommand(plugin, ensureInitialized);
}

/**
 * 창 관리자 인스턴스 반환
 * main.ts의 리본 버튼에서 사용
 */
export function createWindowManager(plugin: CommentPlugin): WindowManager {
    return new WindowManager(plugin.app);
}
