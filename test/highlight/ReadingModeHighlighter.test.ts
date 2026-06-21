// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/i18n', () => ({ t: (k: string) => k }));

// vi.mock 팩토리는 호이스팅되므로 noticeMessages 를 파일 스코프에 선언해 클로저로 캡처한다
const noticeMessages: string[] = [];

vi.mock('obsidian', () => {
    class TFile {
        path: string;
        extension = 'md';
        constructor(p: string) { this.path = p; }
    }
    class MarkdownView {
        file: unknown = null;
        getMode = () => 'preview' as const;
    }
    class Notice {
        constructor(msg: string) { noticeMessages.push(msg); }
    }
    return { TFile, MarkdownView, Notice };
});

// vi.mock 이 호이스팅된 후 import 되므로 mocked 버전을 받는다
import { TFile, MarkdownView } from 'obsidian';
import { ReadingModeHighlighter } from '../../src/services/highlight/ReadingModeHighlighter';
import { SectionLineRegistry } from '../../src/editor/SectionLineRegistry';

function buildHighlighter(overrides: {
    file?: InstanceType<typeof TFile> | null;
    processFile?: boolean;
    selText?: string | null;
    anchorEl?: Element;
    focusEl?: Element;
    sourceContent?: string;
}) {
    const anchorEl = overrides.anchorEl ?? document.createElement('p');
    const focusEl = overrides.focusEl ?? anchorEl;

    const file = overrides.file === undefined ? new TFile('test.md') : overrides.file;
    const source = overrides.sourceContent ?? 'Hello world. Nice day.';

    const processStub = vi.fn().mockImplementation(async (_f: unknown, fn: (c: string) => string) => {
        fn(source);
    });

    const app = {
        workspace: {
            getActiveViewOfType: (_cls: typeof MarkdownView) => {
                const view = new MarkdownView();
                view.file = file;
                return view;
            },
        },
        vault: { process: processStub },
    };

    const highlightService = {
        shouldProcessFile: () => overrides.processFile ?? true,
        extractHighlights: () => [],
    };

    const registry = new SectionLineRegistry();
    registry.set(anchorEl, { lineStart: 0, lineEnd: 0 });

    const selText = overrides.selText === undefined ? 'Hello world' : overrides.selText;

    Object.defineProperty(globalThis, 'activeWindow', {
        value: {
            getSelection: () =>
                selText === null
                    ? null
                    : {
                          toString: () => selText ?? '',
                          anchorNode: anchorEl.firstChild ?? anchorEl,
                          focusNode: focusEl.firstChild ?? focusEl,
                      },
        },
        configurable: true,
        writable: true,
    });

    const highlighter = new ReadingModeHighlighter(
        app as never,
        highlightService as never,
        registry,
    );

    return { highlighter, processStub, registry };
}

describe('ReadingModeHighlighter', () => {
    beforeEach(() => {
        noticeMessages.length = 0;
    });

    it('성공 경로: 단일 블록 평문 선택 → vault.process 호출됨', async () => {
        const { highlighter, processStub } = buildHighlighter({});
        await highlighter.highlightSelection();
        expect(processStub).toHaveBeenCalledOnce();
        expect(noticeMessages).toHaveLength(0);
    });

    it('빈 선택 → "No text selected" Notice, process 미호출', async () => {
        const { highlighter, processStub } = buildHighlighter({ selText: '' });
        await highlighter.highlightSelection();
        expect(processStub).not.toHaveBeenCalled();
        expect(noticeMessages).toContain('No text selected');
    });

    it('null 선택(getSelection()=null) → 빈 선택과 동일하게 Notice, process 미호출', async () => {
        const { highlighter, processStub } = buildHighlighter({ selText: null });
        await highlighter.highlightSelection();
        expect(processStub).not.toHaveBeenCalled();
        // sel?.toString() 은 optional chaining 단락으로 undefined → '' 처리 → 빈 선택 경로
        expect(noticeMessages).toContain('No text selected');
    });

    it('다중 블록(anchor≠focus 블록) → Notice 발생, process 미호출', async () => {
        const anchorEl = document.createElement('p');
        const focusEl = document.createElement('p');
        document.body.appendChild(anchorEl);
        document.body.appendChild(focusEl);

        const { highlighter, processStub, registry } = buildHighlighter({
            anchorEl,
            focusEl,
            selText: 'some text',
        });

        registry.set(anchorEl, { lineStart: 0, lineEnd: 0 });
        registry.set(focusEl, { lineStart: 5, lineEnd: 5 });

        Object.defineProperty(globalThis, 'activeWindow', {
            value: {
                getSelection: () => ({
                    toString: () => 'some text',
                    anchorNode: anchorEl,
                    focusNode: focusEl,
                }),
            },
            configurable: true,
            writable: true,
        });

        await highlighter.highlightSelection();
        expect(processStub).not.toHaveBeenCalled();
        expect(noticeMessages).toContain('Multi-block selection is not supported');
    });

    it('매퍼 실패(not-found) → vault.process는 호출되나 not-found Notice 발생', async () => {
        const { highlighter, processStub } = buildHighlighter({ selText: 'nonexistent xyz' });
        await highlighter.highlightSelection();
        expect(processStub).toHaveBeenCalledOnce();
        expect(noticeMessages).toContain(
            'Selected text not found in source (may contain inline markdown)',
        );
    });

    it('활성 파일 없음 → 조기 반환, process 미호출', async () => {
        const { highlighter, processStub } = buildHighlighter({ file: null });
        await highlighter.highlightSelection();
        expect(processStub).not.toHaveBeenCalled();
    });

    it('블록 범위 조회 실패(등록 없음) → "Cannot determine block range" Notice, process 미호출', async () => {
        const unregisteredEl = document.createElement('div');
        document.body.appendChild(unregisteredEl);

        const { highlighter, processStub } = buildHighlighter({ anchorEl: unregisteredEl });
        // registry 에 unregisteredEl 이 등록되지 않도록 새 registry 를 사용하는 highlighter 재구성
        const registry = new SectionLineRegistry(); // 빈 레지스트리

        const processStub2 = vi.fn();
        const file = new TFile('test.md');
        const app = {
            workspace: {
                getActiveViewOfType: () => ({ file, getMode: () => 'preview' as const }),
            },
            vault: { process: processStub2 },
        };
        const svc = { shouldProcessFile: () => true, extractHighlights: () => [] };

        Object.defineProperty(globalThis, 'activeWindow', {
            value: {
                getSelection: () => ({
                    toString: () => 'hello',
                    anchorNode: unregisteredEl,
                    focusNode: unregisteredEl,
                }),
            },
            configurable: true,
            writable: true,
        });

        const h2 = new ReadingModeHighlighter(app as never, svc as never, registry);
        await h2.highlightSelection();
        expect(processStub2).not.toHaveBeenCalled();
        expect(noticeMessages).toContain('Cannot determine block range');
        void processStub;
    });
});
