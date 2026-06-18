import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import { MarkdownView } from "obsidian";
import { CommentWidget, CommentWidgetHelper } from "../components/comment";
import { HighlightService } from "../services/HighlightService";
import { HighlightInfo as HiNote } from "../types/highlight";
import type { HiNotePluginContext } from "../types/plugin";

interface EditorHighlightDecorationOptions {
    plugin: HiNotePluginContext;
    highlightService: HighlightService;
}

export function createEditorHighlightDecorations(options: EditorHighlightDecorationOptions) {
    const { plugin, highlightService } = options;

    return ViewPlugin.fromClass(class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate): void {
            if (update.docChanged || update.viewportChanged || update.transactions.length > 0) {
                this.decorations = this.buildDecorations(update.view);
            }
        }

        private buildDecorations(view: EditorView): DecorationSet {
            const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
            const file = activeView?.file;

            if (!file || !highlightService.shouldProcessFile(file)) {
                return Decoration.none;
            }

            const decorations: Range<Decoration>[] = [];
            // Comments are now parsed inline by extractHighlights — no sidecar join needed.
            const highlights = highlightService.extractHighlights(view.state.doc.toString(), file);

            for (const highlight of highlights) {
                if (highlight.position === undefined) continue;

                const commentHighlight: HiNote = {
                    ...highlight,
                    comments: highlight.comments ?? [],
                };

                const highlightEndPos = highlight.position + (highlight.originalLength ?? highlight.text.length + 4);

                if (shouldShowCommentWidget(plugin)) {
                    decorations.push(createCommentWidget(plugin, commentHighlight).range(highlightEndPos));
                }
            }

            return Decoration.set(decorations.sort((a, b) => a.from - b.from));
        }
    }, {
        decorations: value => value.decorations
    });
}

function createCommentWidget(plugin: HiNotePluginContext, highlight: HiNote): Decoration {
    return Decoration.widget({
        widget: new CommentWidget(
            plugin,
            highlight,
            () => {
                void CommentWidgetHelper.openCommentPanel(plugin.app, highlight, plugin.eventManager);
            }
        ),
        side: 2,
        stopEvent: (event: Event) => event.type === 'mousedown' || event.type === 'mouseup'
    });
}

function shouldShowCommentWidget(plugin: HiNotePluginContext): boolean {
    return plugin.settings.showCommentWidget !== false;
}
