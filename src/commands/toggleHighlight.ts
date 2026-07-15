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
 * 이 명령은 서비스 초기화 트리거가 아니므로(사이드바·리본·설정 탭만 트리거) 콜드
 * 스타트 첫 입력에서 실행 시점에 직접 초기화한다.
 */
export function registerToggleHighlightCommand(
    plugin: Plugin,
    ensureInitialized: () => Promise<void>,
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
                // preview 모드 — ctx.highlightService 는 초기화 전에 던지는 게터이므로
                // 반드시 await ensureInitialized() 뒤에서 읽는다.
                // checkCallback 은 동기 시그니처라 비동기 작업은 fire-and-forget 으로 띄운다.
                void (async () => {
                    try {
                        await ensureInitialized();
                    } catch (err) {
                        new Notice(t('Plugin initialization failed'));
                        console.error('[HiNote] Failed to initialize for reading-mode highlight', err);
                        return;
                    }

                    const highlighter = new ReadingModeHighlighter(
                        ctx.app,
                        ctx.highlightService,
                        ctx.sectionLineRegistry,
                    );
                    await highlighter.highlightSelection();
                })().catch((e) => {
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
