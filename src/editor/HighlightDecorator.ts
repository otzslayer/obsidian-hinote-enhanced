import { Plugin, MarkdownView } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { HighlightRepository } from "../repositories/HighlightRepository";
import { HighlightService } from '../services/HighlightService';
import { HighlightManager } from '../services/HighlightManager';
import { CommentService } from '../services/comment/CommentService';
import { PreviewWidgetRenderer } from '../views/highlight';
import { createEditorHighlightDecorations } from "./EditorHighlightDecorations";
import type { HighlightEvents } from "../services/EventManager";
import type { EventManager } from "../services/EventManager";
import type { HiNotePluginContext } from "../types/plugin";
import type CommentPlugin from "../../main";

interface EditorWithCodeMirror {
    cm?: EditorView;
}

export class HighlightDecorator {
    private plugin: HiNotePluginContext;
    private highlightRepository: HighlightRepository;
    private highlightPlugin: ReturnType<typeof createEditorHighlightDecorations> | null = null;
    private highlightService: HighlightService;
    private previewRenderer: PreviewWidgetRenderer;

    constructor(
        plugin: Plugin,
        highlightRepository: HighlightRepository,
        highlightService: HighlightService,
        private eventManager: EventManager,
        highlightManager: HighlightManager
    ) {
        this.plugin = plugin as HiNotePluginContext;
        this.highlightRepository = highlightRepository;
        this.highlightService = highlightService;
        const commentService = new CommentService(
            plugin.app,
            plugin as unknown as CommentPlugin,
            highlightManager
        );
        this.previewRenderer = new PreviewWidgetRenderer(
            this.plugin,
            this.highlightService,
            commentService
        );
    }

    /**
     * 장식 강제 새로고침
     * 댓글 데이터 변경 시 CommentWidget 표시를 업데이트하기 위해 호출
     */
    public refreshDecorations() {
        const view = this.getActiveMarkdownView();
        if (!view?.editor) return;

        const editorView = (view.editor as unknown as EditorWithCodeMirror).cm;
        if (!editorView) return;

        // 빈 문서 업데이트를 트리거하여 장식 강제 재구성
        // ViewPlugin의 update 메서드가 호출되어 장식을 재구성
        editorView.dispatch({
            changes: [],
            effects: []
        });
    }

    /**
     * 열린 모든 마크다운 에디터 장식 새로고침
     * 토글 명령처럼 전역 상태 변경 후 호출
     */
    public refreshAllDecorations() {
        const leaves = this.plugin.app.workspace.getLeavesOfType('markdown');
        for (const leaf of leaves) {
            const view = leaf.view as { editor?: { cm?: EditorView } };
            const editorView = view.editor?.cm;
            if (!editorView) continue;
            editorView.dispatch({ changes: [], effects: [] });
        }
    }


    

    private getActiveMarkdownView() {
        return this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    }

    enable() {
        // Hide raw {>>...<<} blocks in reading view (R7).
        // Runs before the preview widget processor so comments are hidden before widgets attach.
        this.plugin.registerMarkdownPostProcessor((element) => {
            hideInlineCommentBlocks(element);
        }, 1); // priority 1 = run before default processors

        this.plugin.registerMarkdownPostProcessor((element, context) => {
            void this.previewRenderer.processPreview(element, context);
        });

        this.registerRefreshEvents();

        const highlightPlugin = createEditorHighlightDecorations({
            plugin: this.plugin,
            highlightService: this.highlightService,
        });

        this.highlightPlugin = highlightPlugin;
        this.plugin.registerEditorExtension([highlightPlugin]);
    }

    private registerRefreshEvents(): void {
        const refreshEvents: (keyof HighlightEvents)[] = [
            'comment:update',
            'comment:delete',
            'highlight:update',
            'highlight:delete'
        ];

        refreshEvents.forEach(eventName => {
            this.plugin.registerEvent(
                this.eventManager.on(eventName, () => {
                    this.refreshDecorations();
                })
            );
        });
    }

    disable() {
        // 에디터 확장 제거
        if (this.highlightPlugin) {
            const view = this.getActiveMarkdownView();
            if (view?.editor) {
                // 모든 장식을 제거하기 위해 에디터 새로고침
                view.editor.refresh();
            }
        }

        // 모든 하이라이트 댓글 버튼 제거
        activeDocument.querySelectorAll('.hi-note-widget').forEach(el => el.remove());
    }
}

const INLINE_COMMENT_RE = /\{>>([\s\S]*?)<<\}/g;

/**
 * Traverse text nodes inside `el` and wrap every {>>...<<} occurrence in a
 * visually-hidden <span> so reading-view users only see the comment marker,
 * not the raw CriticMarkup syntax (R7).
 */
function hideInlineCommentBlocks(el: HTMLElement): void {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const replacements: Array<{ node: Text; parts: Array<string | 'HIDE'> }> = [];

    let node: Node | null;
    while ((node = walker.nextNode()) !== null) {
        const text = (node as Text).textContent ?? '';
        INLINE_COMMENT_RE.lastIndex = 0;
        if (!INLINE_COMMENT_RE.test(text)) continue;

        // Build replacement parts
        const parts: Array<string | 'HIDE'> = [];
        let last = 0;
        INLINE_COMMENT_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = INLINE_COMMENT_RE.exec(text)) !== null) {
            if (m.index > last) parts.push(text.slice(last, m.index));
            parts.push('HIDE');
            last = m.index + m[0].length;
        }
        if (last < text.length) parts.push(text.slice(last));
        replacements.push({ node: node as Text, parts });
    }

    for (const { node, parts } of replacements) {
        const parent = node.parentNode;
        if (!parent) continue;
        const fragment = document.createDocumentFragment();
        for (const part of parts) {
            if (part === 'HIDE') {
                const span = document.createElement('span');
                span.className = 'hi-note-inline-comment-raw';
                span.style.display = 'none';
                fragment.appendChild(span);
            } else {
                fragment.appendChild(document.createTextNode(part));
            }
        }
        parent.replaceChild(fragment, node);
    }
}
