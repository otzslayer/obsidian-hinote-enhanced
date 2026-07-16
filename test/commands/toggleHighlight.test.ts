import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/i18n', () => ({ t: (k: string) => k }));

// vi.mock 팩토리는 호이스팅되므로 noticeMessages 를 파일 스코프에 선언해 클로저로 캡처한다
const noticeMessages: string[] = [];

vi.mock('obsidian', () => {
    class MarkdownView {
        getMode = () => 'preview' as const;
    }
    class Notice {
        constructor(msg: string) { noticeMessages.push(msg); }
    }
    class Plugin {}
    return { MarkdownView, Notice, Plugin, Platform: { isMobile: false, isDesktop: true } };
});

vi.mock('../../src/services/highlight/ReadingModeHighlighter', () => ({
    ReadingModeHighlighter: vi.fn().mockImplementation(() => ({
        highlightSelection: vi.fn().mockResolvedValue(undefined),
    })),
}));

import { Platform } from 'obsidian';
import { registerToggleHighlightCommand } from '../../src/commands/toggleHighlight';
import { ReadingModeHighlighter } from '../../src/services/highlight/ReadingModeHighlighter';

/**
 * highlightService 와 sectionLineRegistry 는 둘 다 CommentPlugin 이 onload 에서
 * 소유하는 평범한 필드다 — 던지는 게터가 아니므로 초기화 여부와 무관하게 안전하다.
 * 그래서 이 명령은 초기화 트리거가 필요 없고, 목도 초기화 상태를 흉내 낼 필요가 없다.
 */
function makePlugin(
    mode: string,
    hasView = true,
    opts: { nativeExecuted?: boolean; selection?: string } = {},
) {
    const executeCommandById = vi.fn().mockReturnValue(opts.nativeExecuted ?? true);
    const addCommand = vi.fn();
    const replaceSelection = vi.fn();

    const view = hasView
        ? {
              getMode: () => mode,
              editor: { getSelection: () => opts.selection ?? 'sel', replaceSelection },
          }
        : null;

    const plugin = {
        app: {
            workspace: { getActiveViewOfType: () => view },
            commands: { executeCommandById },
        },
        addCommand,
        highlightService: {},
        sectionLineRegistry: {},
    };

    return { plugin, addCommand, executeCommandById, replaceSelection };
}

function getCheckCallback(addCommand: ReturnType<typeof vi.fn>) {
    return addCommand.mock.calls[0][0].checkCallback as (checking: boolean) => boolean | void;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('registerToggleHighlightCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        noticeMessages.length = 0;
    });

    it('명령이 Mod+Shift+S hotkey와 함께 등록된다', () => {
        const { plugin, addCommand } = makePlugin('preview');
        registerToggleHighlightCommand(plugin as never);

        expect(addCommand).toHaveBeenCalledOnce();
        const cmd = addCommand.mock.calls[0][0];
        expect(cmd.id).toBe('toggle-highlight');
        expect(cmd.hotkeys).toEqual([{ modifiers: ['Mod', 'Shift'], key: 'S' }]);
    });

    it('모바일에서는 명령을 등록하지 않는다 (데스크톱 전용)', () => {
        const { plugin, addCommand } = makePlugin('preview');
        (Platform as { isMobile: boolean }).isMobile = true;
        try {
            registerToggleHighlightCommand(plugin as never);
            expect(addCommand).not.toHaveBeenCalled();
        } finally {
            (Platform as { isMobile: boolean }).isMobile = false;
        }
    });

    it('활성 MarkdownView 없음 → checkCallback false', () => {
        const { plugin, addCommand } = makePlugin('preview', false);
        registerToggleHighlightCommand(plugin as never);
        expect(getCheckCallback(addCommand)(true)).toBe(false);
    });

    it('checking=true 이면 true 반환', () => {
        const { plugin, addCommand } = makePlugin('preview');
        registerToggleHighlightCommand(plugin as never);
        expect(getCheckCallback(addCommand)(true)).toBe(true);
    });

    /**
     * 이 명령의 콜드 스타트 계약: 서비스 초기화를 **절대** 트리거하지 않는다.
     *
     * InitializationManager.initialize() 는 registerEditorExtension 으로 CM6 를
     * 재구성하며, 그 과정이 읽기 모드의 DOM Selection 을 지운다. 그래서 초기화를
     * 기다린 뒤 activeWindow.getSelection() 을 읽으면 콜드 스타트 첫 입력이
     * "No text selected" 로 끝난다 — 실제 볼트에서 재현된 결함이다.
     *
     * 아래 두 테스트는 그 재발을 막는 구조적 가드다: 하이라이터가 checkCallback 과
     * 같은 틱에 만들어져야 하므로, await 를 다시 넣으면 즉시 깨진다.
     */
    describe('콜드 스타트 계약 — 초기화를 기다리지 않는다', () => {
        it('preview 모드에서 하이라이터가 같은 틱에 동기로 만들어진다', () => {
            const { plugin, addCommand } = makePlugin('preview');
            registerToggleHighlightCommand(plugin as never);

            getCheckCallback(addCommand)(false);

            // flush 하지 않는다 — await 가 끼어 있으면 여기서 아직 0회다
            expect(ReadingModeHighlighter).toHaveBeenCalledOnce();
        });

        it('preview 모드 첫 입력이 예외 없이 하이라이트를 삽입한다 (R1)', async () => {
            const { plugin, addCommand } = makePlugin('preview');
            registerToggleHighlightCommand(plugin as never);

            expect(() => getCheckCallback(addCommand)(false)).not.toThrow();
            await flush();

            const instance = (ReadingModeHighlighter as ReturnType<typeof vi.fn>).mock.results[0]
                .value;
            expect(instance.highlightSelection).toHaveBeenCalled();
        });

        it('source 모드는 네이티브 명령에 위임한다 (R5)', () => {
            const { plugin, addCommand, executeCommandById } = makePlugin('source');
            registerToggleHighlightCommand(plugin as never);

            expect(() => getCheckCallback(addCommand)(false)).not.toThrow();
            expect(executeCommandById).toHaveBeenCalledWith('editor:toggle-highlight');
        });
    });

    it('하이라이트 삽입 실패 → Notice, 예외는 밖으로 새지 않는다', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { plugin, addCommand } = makePlugin('preview');
        (ReadingModeHighlighter as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
            highlightSelection: vi.fn().mockRejectedValue(new Error('vault write failed')),
        }));
        registerToggleHighlightCommand(plugin as never);

        expect(() => getCheckCallback(addCommand)(false)).not.toThrow();
        await flush();

        expect(noticeMessages).toContain('Reading-mode highlight failed');
        expect(consoleError).toHaveBeenCalled();
        consoleError.mockRestore();
    });

    it('source 모드 + 네이티브 부재 + 평문 선택 → ==sel== 폴백 래핑', () => {
        const { plugin, addCommand, replaceSelection } = makePlugin('source', true, {
            nativeExecuted: false,
            selection: 'hello',
        });
        registerToggleHighlightCommand(plugin as never);
        getCheckCallback(addCommand)(false);
        expect(replaceSelection).toHaveBeenCalledWith('==hello==');
    });

    it('source 모드 + 네이티브 부재 + 이미 하이라이트된 선택 → 토글오프(마커 제거)', () => {
        const { plugin, addCommand, replaceSelection } = makePlugin('source', true, {
            nativeExecuted: false,
            selection: '==hello==',
        });
        registerToggleHighlightCommand(plugin as never);
        getCheckCallback(addCommand)(false);
        expect(replaceSelection).toHaveBeenCalledWith('hello');
    });

    it('source 모드 + 네이티브 부재 + 빈 선택 → 무동작(==== 삽입 안 함)', () => {
        const { plugin, addCommand, replaceSelection } = makePlugin('source', true, {
            nativeExecuted: false,
            selection: '',
        });
        registerToggleHighlightCommand(plugin as never);
        getCheckCallback(addCommand)(false);
        expect(replaceSelection).not.toHaveBeenCalled();
    });
});
