import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/i18n', () => ({ t: (k: string) => k }));

// vi.mock 팩토리는 호이스팅되므로 noticeMessages 를 파일 스코프에 선언해 클로저로 캡처한다
const noticeMessages: string[] = [];

vi.mock('obsidian', () => {
    class Notice {
        constructor(msg: string) { noticeMessages.push(msg); }
    }
    class Plugin {}
    return { Notice, Plugin };
});

import { registerToggleInlineCommentSyntaxCommand } from '../../src/commands/toggleInlineCommentSyntax';

/**
 * 기본값은 **콜드 스타트**(initialized: false) 다.
 *
 * getDecorator 를 던지게 두어 main.ts 의 requireInitializedServices() 를 흉내 낸다 —
 * 초기화 전 호출이 곧 이 명령이 죽던 지점이다.
 */
function makePlugin(
    opts: {
        initialized?: boolean;
        initFails?: boolean;
        showInlineCommentSyntax?: boolean;
    } = {},
) {
    let initialized = opts.initialized ?? false;
    const addCommand = vi.fn();
    const refreshAllDecorations = vi.fn();
    const saveSettings = vi.fn(async () => {});

    const ensureInitialized = vi.fn(async () => {
        if (opts.initFails) throw new Error('init failed');
        initialized = true;
    });

    const getDecorator = vi.fn(() => {
        if (!initialized) throw new Error('HiNote services have not been initialized.');
        return { refreshAllDecorations };
    });

    const plugin = {
        addCommand,
        settings: { showInlineCommentSyntax: opts.showInlineCommentSyntax ?? false },
        saveSettings,
    };

    return { plugin, addCommand, getDecorator, ensureInitialized, refreshAllDecorations, saveSettings };
}

function getCallback(addCommand: ReturnType<typeof vi.fn>) {
    return addCommand.mock.calls[0][0].callback as () => Promise<void>;
}

describe('registerToggleInlineCommentSyntaxCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        noticeMessages.length = 0;
    });

    it('명령이 Mod+Shift+C hotkey와 함께 등록된다', () => {
        const { plugin, addCommand, getDecorator, ensureInitialized } = makePlugin();
        registerToggleInlineCommentSyntaxCommand(plugin as never, ensureInitialized, getDecorator as never);

        expect(addCommand).toHaveBeenCalledOnce();
        const cmd = addCommand.mock.calls[0][0];
        expect(cmd.id).toBe('toggle-inline-comment-syntax');
        expect(cmd.hotkeys).toEqual([{ modifiers: ['Mod', 'Shift'], key: 'C' }]);
    });

    it('콜드 스타트: 예외 없이 완료되고 초기화 후 장식을 새로고침한다 (R3)', async () => {
        const { plugin, addCommand, getDecorator, ensureInitialized, refreshAllDecorations } =
            makePlugin();
        registerToggleInlineCommentSyntaxCommand(plugin as never, ensureInitialized, getDecorator as never);

        await expect(getCallback(addCommand)()).resolves.toBeUndefined();

        expect(ensureInitialized).toHaveBeenCalledOnce();
        expect(refreshAllDecorations).toHaveBeenCalledOnce();
    });

    it('ensureInitialized 가 getDecorator 보다 먼저 호출된다', async () => {
        const { plugin, addCommand, getDecorator, ensureInitialized } = makePlugin();
        registerToggleInlineCommentSyntaxCommand(plugin as never, ensureInitialized, getDecorator as never);

        await getCallback(addCommand)();

        expect(ensureInitialized.mock.invocationCallOrder[0]).toBeLessThan(
            getDecorator.mock.invocationCallOrder[0],
        );
    });

    it('설정이 토글되고 저장된다', async () => {
        const { plugin, addCommand, getDecorator, ensureInitialized, saveSettings } = makePlugin({
            showInlineCommentSyntax: false,
        });
        registerToggleInlineCommentSyntaxCommand(plugin as never, ensureInitialized, getDecorator as never);

        await getCallback(addCommand)();

        expect(plugin.settings.showInlineCommentSyntax).toBe(true);
        expect(saveSettings).toHaveBeenCalledOnce();
    });

    it('초기화 실패 → Notice, 장식 새로고침도 설정 저장도 하지 않는다 (R4)', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { plugin, addCommand, getDecorator, ensureInitialized, refreshAllDecorations, saveSettings } =
            makePlugin({ initFails: true, showInlineCommentSyntax: false });
        registerToggleInlineCommentSyntaxCommand(plugin as never, ensureInitialized, getDecorator as never);

        await expect(getCallback(addCommand)()).resolves.toBeUndefined();

        expect(noticeMessages).toContain('Plugin initialization failed');
        expect(refreshAllDecorations).not.toHaveBeenCalled();
        expect(saveSettings).not.toHaveBeenCalled();
        // 초기화가 실패했으면 설정도 건드리지 않아야 한다 — 토글이 await 뒤에 와야 성립한다
        expect(plugin.settings.showInlineCommentSyntax).toBe(false);
        consoleError.mockRestore();
    });
});
