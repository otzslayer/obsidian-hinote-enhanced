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
 * 기본값은 **콜드 스타트**(initialized: false) 다.
 *
 * highlightService 를 던지는 게터로 두어 main.ts 의 requireInitializedServices() 를
 * 그대로 흉내 낸다 — 이 게터가 버그의 전제 조건이므로, 평범한 객체로 두면
 * 스위트가 초록이어도 아무것도 증명하지 못한다.
 */
function makePlugin(
    mode: string,
    hasView = true,
    opts: {
        nativeExecuted?: boolean;
        selection?: string;
        initialized?: boolean;
        initFails?: boolean;
    } = {},
) {
    let initialized = opts.initialized ?? false;
    const executeCommandById = vi.fn().mockReturnValue(opts.nativeExecuted ?? true);
    const addCommand = vi.fn();
    const replaceSelection = vi.fn();

    const ensureInitialized = vi.fn(async () => {
        if (opts.initFails) throw new Error('init failed');
        initialized = true;
    });

    const view = hasView
        ? {
              getMode: () => mode,
              editor: { getSelection: () => opts.selection ?? 'sel', replaceSelection },
          }
        : null;

    const plugin = {
        app: {
            workspace: {
                getActiveViewOfType: () => view,
            },
            commands: { executeCommandById },
        },
        addCommand,
        sectionLineRegistry: {},
        get highlightService() {
            if (!initialized) throw new Error('HiNote services have not been initialized.');
            return {};
        },
    };

    return { plugin, addCommand, executeCommandById, replaceSelection, ensureInitialized };
}

function getCheckCallback(addCommand: ReturnType<typeof vi.fn>) {
    const call = addCommand.mock.calls[0];
    return call[0].checkCallback as (checking: boolean) => boolean | void;
}

/** checkCallback 은 동기 fire-and-forget 이므로 단언 전에 비동기 꼬리를 흘려보낸다. */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('registerToggleHighlightCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        noticeMessages.length = 0;
    });

    it('명령이 Mod+Shift+S hotkey와 함께 등록된다', () => {
        const { plugin, addCommand, ensureInitialized } = makePlugin('preview');
        registerToggleHighlightCommand(plugin as never, ensureInitialized);

        expect(addCommand).toHaveBeenCalledOnce();
        const cmd = addCommand.mock.calls[0][0];
        expect(cmd.id).toBe('toggle-highlight');
        expect(cmd.hotkeys).toEqual([{ modifiers: ['Mod', 'Shift'], key: 'S' }]);
    });

    it('모바일에서는 명령을 등록하지 않는다 (데스크톱 전용)', () => {
        const { plugin, addCommand, ensureInitialized } = makePlugin('preview');
        (Platform as { isMobile: boolean }).isMobile = true;
        try {
            registerToggleHighlightCommand(plugin as never, ensureInitialized);
            expect(addCommand).not.toHaveBeenCalled();
        } finally {
            (Platform as { isMobile: boolean }).isMobile = false;
        }
    });

    it('활성 MarkdownView 없음 → checkCallback false (초기화 여부와 무관)', () => {
        const { plugin, addCommand, ensureInitialized } = makePlugin('preview', false);
        registerToggleHighlightCommand(plugin as never, ensureInitialized);
        const cb = getCheckCallback(addCommand);
        expect(cb(true)).toBe(false);
        expect(ensureInitialized).not.toHaveBeenCalled();
    });

    it('checking=true 이면 서비스 초기화 없이 true 반환', () => {
        const { plugin, addCommand, ensureInitialized } = makePlugin('preview');
        registerToggleHighlightCommand(plugin as never, ensureInitialized);
        const cb = getCheckCallback(addCommand);
        expect(cb(true)).toBe(true);
        expect(ensureInitialized).not.toHaveBeenCalled();
    });

    describe('콜드 스타트 (서비스 초기화 이전)', () => {
        it('preview 모드 첫 입력이 예외 없이 하이라이트를 삽입한다 (R1)', async () => {
            const { plugin, addCommand, ensureInitialized } = makePlugin('preview');
            registerToggleHighlightCommand(plugin as never, ensureInitialized);
            const cb = getCheckCallback(addCommand);

            expect(() => cb(false)).not.toThrow();
            await flush();

            expect(ensureInitialized).toHaveBeenCalledOnce();
            expect(ReadingModeHighlighter).toHaveBeenCalledOnce();
            const instance = (ReadingModeHighlighter as ReturnType<typeof vi.fn>).mock.results[0]
                .value;
            expect(instance.highlightSelection).toHaveBeenCalled();
        });

        it('ensureInitialized 가 ReadingModeHighlighter 생성보다 먼저 호출된다', async () => {
            const { plugin, addCommand, ensureInitialized } = makePlugin('preview');
            registerToggleHighlightCommand(plugin as never, ensureInitialized);
            getCheckCallback(addCommand)(false);
            await flush();

            const initOrder = ensureInitialized.mock.invocationCallOrder[0];
            const ctorOrder = (ReadingModeHighlighter as ReturnType<typeof vi.fn>).mock
                .invocationCallOrder[0];
            expect(initOrder).toBeLessThan(ctorOrder);
        });

        it('source 모드는 초기화 없이 네이티브 명령에 위임한다 (R5)', async () => {
            const { plugin, addCommand, executeCommandById, ensureInitialized } =
                makePlugin('source');
            registerToggleHighlightCommand(plugin as never, ensureInitialized);

            expect(() => getCheckCallback(addCommand)(false)).not.toThrow();
            await flush();

            expect(executeCommandById).toHaveBeenCalledWith('editor:toggle-highlight');
            expect(ensureInitialized).not.toHaveBeenCalled();
        });

        it('초기화 실패 → Notice 후 중단, 예외는 밖으로 새지 않는다 (R4)', async () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
            const { plugin, addCommand, ensureInitialized } = makePlugin('preview', true, {
                initFails: true,
            });
            registerToggleHighlightCommand(plugin as never, ensureInitialized);

            expect(() => getCheckCallback(addCommand)(false)).not.toThrow();
            await flush();

            expect(ensureInitialized).toHaveBeenCalledOnce();
            expect(noticeMessages).toContain('Plugin initialization failed');
            expect(ReadingModeHighlighter).not.toHaveBeenCalled();
            consoleError.mockRestore();
        });
    });

    it('초기화 이후 두 번째 입력도 동일하게 동작한다', async () => {
        const { plugin, addCommand, ensureInitialized } = makePlugin('preview', true, {
            initialized: true,
        });
        registerToggleHighlightCommand(plugin as never, ensureInitialized);
        const cb = getCheckCallback(addCommand);

        cb(false);
        await flush();
        cb(false);
        await flush();

        expect(ensureInitialized).toHaveBeenCalledTimes(2);
        expect(ReadingModeHighlighter).toHaveBeenCalledTimes(2);
    });

    it('source 모드 + 네이티브 부재 + 평문 선택 → ==sel== 폴백 래핑', () => {
        const { plugin, addCommand, replaceSelection, ensureInitialized } = makePlugin(
            'source',
            true,
            { nativeExecuted: false, selection: 'hello' },
        );
        registerToggleHighlightCommand(plugin as never, ensureInitialized);
        getCheckCallback(addCommand)(false);
        expect(replaceSelection).toHaveBeenCalledWith('==hello==');
    });

    it('source 모드 + 네이티브 부재 + 이미 하이라이트된 선택 → 토글오프(마커 제거)', () => {
        const { plugin, addCommand, replaceSelection, ensureInitialized } = makePlugin(
            'source',
            true,
            { nativeExecuted: false, selection: '==hello==' },
        );
        registerToggleHighlightCommand(plugin as never, ensureInitialized);
        getCheckCallback(addCommand)(false);
        expect(replaceSelection).toHaveBeenCalledWith('hello');
    });

    it('source 모드 + 네이티브 부재 + 빈 선택 → 무동작(==== 삽입 안 함)', () => {
        const { plugin, addCommand, replaceSelection, ensureInitialized } = makePlugin(
            'source',
            true,
            { nativeExecuted: false, selection: '' },
        );
        registerToggleHighlightCommand(plugin as never, ensureInitialized);
        getCheckCallback(addCommand)(false);
        expect(replaceSelection).not.toHaveBeenCalled();
    });
});
