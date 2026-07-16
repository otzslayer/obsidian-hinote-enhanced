// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SectionLineRegistry } from '../../src/editor/SectionLineRegistry';
import { registerPluginMarkdownPostProcessors } from '../../src/plugin/PluginBootstrap';

type SectionInfo = { lineStart: number; lineEnd: number } | null;
type PostProcessor = (
    el: Element,
    ctx: { getSectionInfo: (el: Element) => SectionInfo }
) => void;

/**
 * 서비스 초기화 **이전** 상태의 플러그인을 흉내 낸다.
 *
 * 초기화 전 접근자는 실제 main.ts 의 requireInitializedServices() 처럼 던진다 —
 * 후처리기가 서비스에 손대면 테스트가 터지므로, 통과 자체가 독립성의 증거다.
 */
function makeUninitializedPlugin() {
    const registered: PostProcessor[] = [];
    const registerMarkdownPostProcessor = vi.fn((fn: PostProcessor) => {
        registered.push(fn);
        return fn;
    });

    const plugin = {
        sectionLineRegistry: new SectionLineRegistry(),
        services: null,
        registerMarkdownPostProcessor,
        get highlightDecorator(): never {
            throw new Error('HiNote services have not been initialized.');
        },
        get highlightService(): never {
            throw new Error('HiNote services have not been initialized.');
        },
    };

    return { plugin, registered, registerMarkdownPostProcessor };
}

function makeContext(info: SectionInfo) {
    return { getSectionInfo: () => info };
}

describe('registerPluginMarkdownPostProcessors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('후처리기를 한 번 등록한다', () => {
        const { plugin, registerMarkdownPostProcessor } = makeUninitializedPlugin();
        registerPluginMarkdownPostProcessors(plugin as never);

        expect(registerMarkdownPostProcessor).toHaveBeenCalledOnce();
    });

    it('초기화 전에도 getSectionInfo 결과를 레지스트리에 기록한다', () => {
        const { plugin, registered } = makeUninitializedPlugin();
        registerPluginMarkdownPostProcessors(plugin as never);

        const el = document.createElement('p');
        registered[0](el, makeContext({ lineStart: 3, lineEnd: 5 }));

        expect(plugin.sectionLineRegistry.findBlockRange(el)).toEqual({
            lineStart: 3,
            lineEnd: 5,
        });
    });

    it('자식 텍스트 노드에서도 기록된 블록 범위를 찾는다', () => {
        const { plugin, registered } = makeUninitializedPlugin();
        registerPluginMarkdownPostProcessors(plugin as never);

        const block = document.createElement('p');
        const text = document.createTextNode('hello');
        block.appendChild(text);
        registered[0](block, makeContext({ lineStart: 10, lineEnd: 12 }));

        expect(plugin.sectionLineRegistry.findBlockRange(text)).toEqual({
            lineStart: 10,
            lineEnd: 12,
        });
    });

    it('getSectionInfo 가 null → 기록도 예외도 없다', () => {
        const { plugin, registered } = makeUninitializedPlugin();
        registerPluginMarkdownPostProcessors(plugin as never);

        const el = document.createElement('p');
        expect(() => registered[0](el, makeContext(null))).not.toThrow();
        expect(plugin.sectionLineRegistry.findBlockRange(el)).toBeNull();
    });

    it('등록도 실행도 초기화된 서비스를 건드리지 않는다 (services === null)', () => {
        const { plugin, registered } = makeUninitializedPlugin();

        expect(() => registerPluginMarkdownPostProcessors(plugin as never)).not.toThrow();

        const el = document.createElement('p');
        expect(() => registered[0](el, makeContext({ lineStart: 1, lineEnd: 1 }))).not.toThrow();
        expect(plugin.services).toBeNull();
    });
});
