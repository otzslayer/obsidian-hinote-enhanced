import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarkdownView } from 'obsidian';

vi.mock('../../src/i18n', () => ({ t: (k: string) => k }));
vi.mock('../../src/services/highlight/ReadingModeHighlighter', () => ({
    ReadingModeHighlighter: vi.fn().mockImplementation(() => ({
        highlightSelection: vi.fn().mockResolvedValue(undefined),
    })),
}));

import { registerToggleHighlightCommand } from '../../src/commands/toggleHighlight';
import { ReadingModeHighlighter } from '../../src/services/highlight/ReadingModeHighlighter';

function makePlugin(mode: string, hasView = true) {
    const executeCommandById = vi.fn().mockReturnValue(true);
    const addCommand = vi.fn();

    const view = hasView
        ? {
              getMode: () => mode,
              editor: { getSelection: () => 'sel', replaceSelection: vi.fn() },
          }
        : null;

    const plugin = {
        app: {
            workspace: {
                getActiveViewOfType: (_cls: typeof MarkdownView) => view,
            },
            commands: { executeCommandById },
        },
        addCommand,
        highlightService: {},
    };

    const mockDecorator = { sectionLineRegistry: {} };
    const getDecorator = () => mockDecorator as never;

    return { plugin, addCommand, executeCommandById, getDecorator };
}

function getCheckCallback(addCommand: ReturnType<typeof vi.fn>) {
    const call = addCommand.mock.calls[0];
    return call[0].checkCallback as (checking: boolean) => boolean | void;
}

describe('registerToggleHighlightCommand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('명령이 Mod+Shift+S hotkey와 함께 등록된다', () => {
        const { plugin, addCommand, getDecorator } = makePlugin('preview');
        registerToggleHighlightCommand(plugin as never, getDecorator);

        expect(addCommand).toHaveBeenCalledOnce();
        const cmd = addCommand.mock.calls[0][0];
        expect(cmd.id).toBe('toggle-highlight');
        expect(cmd.hotkeys).toEqual([{ modifiers: ['Mod', 'Shift'], key: 'S' }]);
    });

    it('활성 MarkdownView 없음 → checkCallback false', () => {
        const { plugin, addCommand, getDecorator } = makePlugin('preview', false);
        registerToggleHighlightCommand(plugin as never, getDecorator);
        const cb = getCheckCallback(addCommand);
        expect(cb(true)).toBe(false);
    });

    it('checking=true 이면 true 반환', () => {
        const { plugin, addCommand, getDecorator } = makePlugin('preview');
        registerToggleHighlightCommand(plugin as never, getDecorator);
        const cb = getCheckCallback(addCommand);
        expect(cb(true)).toBe(true);
    });

    it('source 모드 → executeCommandById("editor:toggle-highlight") 호출', () => {
        const { plugin, addCommand, executeCommandById, getDecorator } = makePlugin('source');
        registerToggleHighlightCommand(plugin as never, getDecorator);
        const cb = getCheckCallback(addCommand);
        cb(false);
        expect(executeCommandById).toHaveBeenCalledWith('editor:toggle-highlight');
    });

    it('preview 모드 → ReadingModeHighlighter.highlightSelection 호출', () => {
        const { plugin, addCommand, getDecorator } = makePlugin('preview');
        registerToggleHighlightCommand(plugin as never, getDecorator);
        const cb = getCheckCallback(addCommand);
        cb(false);
        expect(ReadingModeHighlighter).toHaveBeenCalledOnce();
        const instance = (ReadingModeHighlighter as ReturnType<typeof vi.fn>).mock.results[0].value;
        expect(instance.highlightSelection).toHaveBeenCalled();
    });
});
