import { Plugin, MarkdownView } from "obsidian";
import type { EditorView } from "@codemirror/view";
import { HighlightRepository } from "../repositories/HighlightRepository";
import { HighlightService } from '../services/HighlightService';
import { HighlightManager } from '../services/HighlightManager';
import { CommentService } from '../services/comment/CommentService';
import { PreviewWidgetRenderer } from '../views/highlight';
import { createEditorHighlightDecorations } from "./EditorHighlightDecorations";
import { hideInlineCommentBlocks } from "./inlineCommentHider";
import { SectionLineRegistry } from "./SectionLineRegistry";
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
    readonly sectionLineRegistry = new SectionLineRegistry();

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

        // 모든 렌더 블록의 소스 줄범위를 기록한다.
        // processPreview의 marks.length===0 조기 반환과 무관하게 동작하도록 별도 등록.
        this.plugin.registerMarkdownPostProcessor((element, context) => {
            const info = context.getSectionInfo(element);
            if (info) {
                this.sectionLineRegistry.set(element, {
                    lineStart: info.lineStart,
                    lineEnd: info.lineEnd,
                });
            }
        });

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
