import { Notice, Plugin } from 'obsidian';
import { t } from '../i18n';
import type { HighlightDecorator } from '../editor/HighlightDecorator';
import type { HiNotePluginContext } from '../types/plugin';

/**
 * 인라인 코멘트 문법({>>...<<}) 표시 토글 명령 등록
 *
 * OFF(기본): 문법 숨김 + 코멘트 버튼 표시
 * ON: 문법 노출 + 코멘트 버튼 숨김
 *
 * 이 명령은 서비스 초기화 트리거가 아니므로 실행 시점에 직접 초기화한다 —
 * getDecorator 는 초기화 전에 던지는 게터다.
 */
export function registerToggleInlineCommentSyntaxCommand(
    plugin: Plugin,
    ensureInitialized: () => Promise<void>,
    getDecorator: () => HighlightDecorator
): void {
    const ctx = plugin as unknown as HiNotePluginContext;

    plugin.addCommand({
        id: 'toggle-inline-comment-syntax',
        name: t('Toggle inline comment syntax'),
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'C' }],
        callback: async () => {
            // 초기화가 먼저다 — 실패 시 설정을 뒤집지 않아야 상태가 새지 않는다.
            try {
                await ensureInitialized();
            } catch (err) {
                new Notice(t('Plugin initialization failed'));
                console.error('[HiNote] Failed to initialize for inline comment syntax toggle', err);
                return;
            }

            ctx.settings.showInlineCommentSyntax = !ctx.settings.showInlineCommentSyntax;
            await ctx.saveSettings();
            getDecorator().refreshAllDecorations();
        }
    });
}
