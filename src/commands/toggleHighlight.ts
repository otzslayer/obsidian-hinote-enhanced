import { Plugin, MarkdownView, Notice, Platform } from 'obsidian';
import { t } from '../i18n';
import { ReadingModeHighlighter } from '../services/highlight/ReadingModeHighlighter';
import type { HiNotePluginContext } from '../types/plugin';

/** Obsidian 내부 명령 API — 공개 타입에 없어 명시적으로 좁혀 쓴다. */
interface AppWithCommands {
    commands?: { executeCommandById?: (id: string) => boolean };
}

/**
 * Mod+Shift+S 통합 하이라이트 토글 명령.
 *
 * - source 모드: 네이티브 editor:toggle-highlight 에 위임 (토글 온/오프 포함).
 * - preview 모드: ReadingModeHighlighter 로 선택 텍스트를 ==...== 로 삽입.
 *
 * **이 명령은 서비스 지연 초기화를 트리거하지 않는다** — 다른 다섯 명령과 다른 유일한
 * 지점이고, 의도적이다. 필요한 것은 plugin 이 소유한 highlightService 와
 * sectionLineRegistry 둘뿐인데, 둘 다 초기화와 무관한 평범한 필드다.
 *
 * 여기서 초기화를 돌리면 안 된다: InitializationManager.initialize() 가
 * registerEditorExtension 으로 CM6 를 재구성하면서 읽기 모드의 DOM Selection 을
 * 지우고, 그러면 선택을 읽는 시점엔 이미 비어 있어 콜드 스타트 첫 입력이 항상
 * "No text selected" 로 끝난다. 실제 볼트에서 재현된 결함이다.
 */
export function registerToggleHighlightCommand(
    plugin: Plugin,
): void {
    // 읽기 모드 하이라이트는 Mod+Shift+S 단축키 기반 데스크톱 기능이다.
    // 모바일/터치 트리거는 plan 의 Scope Boundaries 에서 후속 작업으로 보류했으므로,
    // manifest 의 isDesktopOnly 는 false 로 두고(플러그인 전체는 모바일 호환) 이 명령만 데스크톱에 한정한다.
    if (Platform.isMobile) return;

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
                const commands = (ctx.app as unknown as AppWithCommands).commands;
                const executed = commands?.executeCommandById?.(nativeId);
                if (!executed) {
                    // 네이티브 명령 부재 시 수동 폴백 — 네이티브 토글 동작을 흉내 낸다.
                    const editor = view.editor;
                    if (editor) {
                        const sel = editor.getSelection();
                        if (!sel) return; // 빈 선택 → 무동작 (==== 삽입 방지)
                        const isHighlighted =
                            sel.length >= 4 && sel.startsWith('==') && sel.endsWith('==');
                        // 이미 ==…== 면 토글오프(마커 제거), 아니면 래핑
                        editor.replaceSelection(isHighlighted ? sel.slice(2, -2) : `==${sel}==`);
                    }
                }
            } else {
                // preview 모드 — 초기화를 기다리지 않는다(위 주석 참조).
                // 하이라이터를 같은 틱에 만들어 DOM Selection 이 살아 있는 동안 읽는다.
                const highlighter = new ReadingModeHighlighter(
                    ctx.app,
                    ctx.highlightService,
                    ctx.sectionLineRegistry,
                );
                void highlighter.highlightSelection().catch((e) => {
                    // ReadingModeHighlighter 는 예상 실패 모드마다 스스로 Notice 후
                    // return 하므로 여기까지 오는 것은 예상 밖 예외(주로 vault.process
                    // 거부)뿐이다 — 이중 알림이 아니다. 알리지 않으면 이 수정이
                    // 없애려던 '단축키가 죽은 것처럼 보임' 증상이 그대로 재현된다.
                    new Notice(t('Reading-mode highlight failed'));
                    console.error('[HiNote] reading-mode highlight failed', e);
                });
            }
        },
    });
}
