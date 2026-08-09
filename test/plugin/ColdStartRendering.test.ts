// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
// 확장자를 명시한다 — 생략하면 빌드 산출물 main.js 가 먼저 잡힌다.
import CommentPlugin from '../../main.ts';

/**
 * 콜드 스타트 재현 하네스.
 *
 * 사이드바를 한 번도 열지 않은 상태 — 즉 리본·명령·뷰 생성 중 어느 것도 거치지 않고
 * onload 만 끝난 직후를 흉내 낸다. 이 시점에 하이라이트 노트를 열면 어떻게 렌더되는지가
 * 이 파일이 검증하는 전부다.
 */
type PostProcessor = (
    el: Element,
    ctx: { getSectionInfo: () => null }
) => unknown;

async function loadPluginColdStart() {
    const postProcessors: PostProcessor[] = [];
    const editorExtensions: unknown[] = [];

    const plugin = new (CommentPlugin as unknown as new () => CommentPlugin)();

    Object.assign(plugin, {
        registerMarkdownPostProcessor: vi.fn((fn: PostProcessor) => {
            postProcessors.push(fn);
            return fn;
        }),
        registerEditorExtension: vi.fn((ext: unknown) => {
            editorExtensions.push(ext);
        }),
        registerView: vi.fn(),
        addRibbonIcon: vi.fn(),
        addSettingTab: vi.fn(),
        registerInterval: vi.fn(),
    });

    Object.assign(plugin.app, {
        workspace: {
            on: () => ({ unload: () => {} }),
            getLeavesOfType: () => [],
            getActiveViewOfType: () => null,
            onLayoutReady: (cb: () => void) => cb(),
        },
    });

    await plugin.onload();

    return { plugin, postProcessors, editorExtensions };
}

/** onload 직후 등록된 모든 후처리기를 읽기 모드 렌더 블록에 순서대로 적용한다. */
async function renderReadingView(html: string) {
    const { plugin, postProcessors, editorExtensions } = await loadPluginColdStart();

    const el = document.createElement('div');
    el.innerHTML = html;
    for (const process of postProcessors) {
        process(el, { getSectionInfo: () => null });
    }

    return { el, plugin, postProcessors, editorExtensions };
}

describe('콜드 스타트 렌더링', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('사이드바를 열지 않아도 읽기 모드에서 {>>...<<} 원문이 노출되지 않는다', async () => {
        // 구분자를 엔티티로 넣는다 — `<<}` 를 날것으로 두면 HTML 파서가 태그로 먹는다.
        const { el } = await renderReadingView(
            '<p><mark>강조한 문장</mark>{&gt;&gt;내 코멘트&lt;&lt;}</p>'
        );

        expect(el.textContent).not.toContain('{>>');
        expect(el.textContent).not.toContain('<<}');
    });

    it('코멘트 본문에 마크다운이 섞여 자식 요소로 쪼개져도 노출되지 않는다', async () => {
        const { el } = await renderReadingView(
            '<p><mark>강조</mark>{&gt;&gt;앞 <strong>굵게</strong> 뒤&lt;&lt;}</p>'
        );

        expect(el.textContent).not.toContain('{>>');
    });

    it('사이드바를 열지 않아도 라이브 프리뷰 에디터 확장이 등록된다', async () => {
        const { editorExtensions } = await loadPluginColdStart();

        expect(editorExtensions.length).toBeGreaterThan(0);
    });
});
