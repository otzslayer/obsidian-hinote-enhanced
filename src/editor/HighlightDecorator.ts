import { Plugin, MarkdownView } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { HighlightRepository } from "../repositories/HighlightRepository";
import { HighlightService } from '../services/HighlightService';
import { PreviewWidgetRenderer } from '../views/highlight';
import { createEditorHighlightDecorations } from "./EditorHighlightDecorations";
import type { HighlightEvents } from "../services/EventManager";
import type { EventManager } from "../services/EventManager";
import type { HiNotePluginContext } from "../types/plugin";

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
        private eventManager: EventManager
    ) {
        this.plugin = plugin as HiNotePluginContext;
        this.highlightRepository = highlightRepository;
        this.highlightService = highlightService;
        this.previewRenderer = new PreviewWidgetRenderer(
            this.plugin,
            this.highlightService
        );
    }

    /**
     * 强制刷新装饰器
     * 当评论数据发生变化时调用此方法来更新 CommentWidget 的显示
     */
    public refreshDecorations() {
        const view = this.getActiveMarkdownView();
        if (!view?.editor) return;
        
        const editorView = (view.editor as unknown as EditorWithCodeMirror).cm;
        if (!editorView) return;
        
        // 通过触发一个空的文档更新来强制重新构建装饰器
        // 这会导致 ViewPlugin 的 update 方法被调用，进而重新构建装饰器
        editorView.dispatch({
            changes: [],
            effects: []
        });
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
        // 移除编辑器扩展
        if (this.highlightPlugin) {
            const view = this.getActiveMarkdownView();
            if (view?.editor) {
                // 刷新编辑器以移除所有装饰器
                view.editor.refresh();
            }
        }

        // 移除所有高亮评论按钮
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
