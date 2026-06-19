// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarkdownRenderer, App } from 'obsidian';
import { PreviewWidgetRenderer } from '../../../src/views/highlight/preview/PreviewWidgetRenderer';
import type { HiNotePluginContext } from '../../../src/types/plugin';

// renderPlainText 는 private 이지만 캐시는 인스턴스 필드에 살아 있으므로,
// 해당 단위를 직접 호출해 "같은 입력은 렌더를 재실행하지 않는다"를 검증한다.
// MarkdownRenderer.render 호출 횟수가 캐싱의 유일한 관찰 가능한 증거다
// (반환값은 캐시 유무와 무관하게 동일하기 때문).
function makeRenderer(): PreviewWidgetRenderer {
    const plugin = { app: new App() } as unknown as HiNotePluginContext;
    return new PreviewWidgetRenderer(plugin, {} as never, {} as never);
}

describe('PreviewWidgetRenderer plainText 캐싱', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('같은 마크다운 텍스트를 두 번 변환하면 렌더는 한 번만 호출된다', async () => {
        const renderSpy = vi.spyOn(MarkdownRenderer, 'render');
        const renderer = makeRenderer();

        const first = await (renderer as unknown as {
            renderPlainText(md: string, path: string): Promise<string>;
        }).renderPlainText('**중요**', 'note.md');
        const second = await (renderer as unknown as {
            renderPlainText(md: string, path: string): Promise<string>;
        }).renderPlainText('**중요**', 'note.md');

        expect(first).toBe('중요');
        expect(second).toBe('중요');
        expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('마크다운 메타문자가 없으면 렌더를 호출하지 않는다 (fast-path 가드)', async () => {
        const renderSpy = vi.spyOn(MarkdownRenderer, 'render');
        const renderer = makeRenderer();

        const result = await (renderer as unknown as {
            renderPlainText(md: string, path: string): Promise<string>;
        }).renderPlainText('일반 텍스트', 'note.md');

        expect(result).toBe('일반 텍스트');
        expect(renderSpy).not.toHaveBeenCalled();
    });
});
