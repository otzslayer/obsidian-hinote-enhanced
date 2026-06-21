import { Plugin, MarkdownView } from 'obsidian';
import { t } from '../i18n';
import { ReadingModeHighlighter } from '../services/highlight/ReadingModeHighlighter';
import type { HighlightDecorator } from '../editor/HighlightDecorator';
import type { HiNotePluginContext } from '../types/plugin';

/**
 * Mod+Shift+S 통합 하이라이트 토글 명령.
 *
 * - source 모드: 네이티브 editor:toggle-highlight 에 위임 (토글 온/오프 포함).
 * - preview 모드: ReadingModeHighlighter 로 선택 텍스트를 ==...== 로 삽입.
 *
 * getDecorator 는 lazy getter — 서비스 초기화 후 호출되므로 직접 참조하지 않는다.
 */
export function registerToggleHighlightCommand(
    plugin: Plugin,
    getDecorator: () => HighlightDecorator,
): void {
    const ctx = plugin as unknown as HiNotePluginContext;

    plugin.addCommand({
        id: 'toggle-highlight',
        name: t('Toggle highlight'),
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'S' }],
        checkCallback: (checking: boolean) => {
            const view = ctx.app.workspace.getActiveViewOfType(MarkdownView);
            if (!view) return false;
            if (checking) return true;

            const mode = view.getMode();
            if (mode === 'source') {
                // 네이티브 Toggle highlight 에 위임
                const nativeId = 'editor:toggle-highlight';
                const commands = (ctx.app as unknown as { commands?: { executeCommandById?: (id: string) => boolean } }).commands;
                const executed = commands?.executeCommandById?.(nativeId);
                if (!executed) {
                    // 네이티브 명령 부재 시 수동 폴백
                    const editor = view.editor;
                    if (editor) {
                        const sel = editor.getSelection();
                        editor.replaceSelection(`==${sel}==`);
                    }
                }
            } else {
                // preview 모드
                const decorator = getDecorator();
                const highlighter = new ReadingModeHighlighter(
                    ctx.app,
                    ctx.highlightService,
                    decorator.sectionLineRegistry,
                );
                void highlighter.highlightSelection().catch((e) => {
                    console.error('[HiNote] reading-mode highlight failed', e);
                });
            }
        },
    });
}
