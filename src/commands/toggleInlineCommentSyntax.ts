import { Plugin } from 'obsidian';
import { t } from '../i18n';
import type { HighlightDecorator } from '../editor/HighlightDecorator';
import type { HiNotePluginContext } from '../types/plugin';

/**
 * 인라인 코멘트 문법({>>...<<}) 표시 토글 명령 등록
 *
 * OFF(기본): 문법 숨김 + 코멘트 버튼 표시
 * ON: 문법 노출 + 코멘트 버튼 숨김
 *
 * getDecorator는 서비스 초기화 후에 호출되므로 lazy getter로 전달.
 */
export function registerToggleInlineCommentSyntaxCommand(
    plugin: Plugin,
    getDecorator: () => HighlightDecorator
): void {
    const ctx = plugin as unknown as HiNotePluginContext;

    plugin.addCommand({
        id: 'toggle-inline-comment-syntax',
        name: t('Toggle inline comment syntax'),
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'C' }],
        callback: async () => {
            ctx.settings.showInlineCommentSyntax = !ctx.settings.showInlineCommentSyntax;
            await ctx.saveSettings();
            getDecorator().refreshAllDecorations();
        }
    });
}
