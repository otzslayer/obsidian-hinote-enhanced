import { Range } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { MarkdownView, TFile, setIcon } from "obsidian";
import HiNoteNextPlugin from "../../../main";
import { HighlightExtractor } from "../../core/HighlightExtractor";
import { HighlightSource, ResolvedHighlight } from "../../types";

export function createEditorHighlightWidgets(plugin: HiNoteNextPlugin) {
	const extractor = new HighlightExtractor(plugin.app);

	return ViewPlugin.fromClass(class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = this.buildDecorations(view);
		}

		update(update: ViewUpdate): void {
			if (update.docChanged || update.viewportChanged || update.selectionSet) {
				this.decorations = this.buildDecorations(update.view);
			}
		}

		private buildDecorations(view: EditorView): DecorationSet {
			const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
			const file = activeView?.file;
			if (!file || !extractor.shouldProcess(file)) {
				return Decoration.none;
			}

			const content = view.state.doc.toString();
			const sources = extractor.extract(content, file);
			const decorations: Range<Decoration>[] = [];

			for (const source of sources) {
				const end = source.position + source.markerLength;
				decorations.push(
					Decoration.widget({
						widget: new HighlightCommentWidget(plugin, file, source),
						side: 1
					}).range(end)
				);
			}

			return Decoration.set(decorations, true);
		}
	}, {
		decorations: (value) => value.decorations
	});
}

class HighlightCommentWidget extends WidgetType {
	constructor(
		private plugin: HiNoteNextPlugin,
		private file: TFile,
		private source: HighlightSource
	) {
		super();
	}

	toDOM(): HTMLElement {
		const button = document.createElement("button");
		button.className = "hinote-next-editor-widget";
		button.type = "button";
		button.setAttribute("aria-label", "Add HiNote comment");
		setIcon(button, "message-square-plus");

		button.addEventListener("mousedown", (event) => {
			event.preventDefault();
			event.stopPropagation();
		});

		button.addEventListener("click", async (event) => {
			event.preventDefault();
			event.stopPropagation();
			await this.addComment();
		});

		return button;
	}

	eq(other: HighlightCommentWidget): boolean {
		return this.file.path === other.file.path
			&& this.source.position === other.source.position
			&& this.source.textHash === other.source.textHash
			&& this.source.contextHash === other.source.contextHash;
	}

	ignoreEvent(): boolean {
		return false;
	}

	private async addComment(): Promise<void> {
		const content = window.prompt("Add HiNote comment");
		if (!content?.trim()) return;

		const resolved = await this.findResolvedHighlight();
		if (!resolved) return;

		await this.plugin.comments.addComment(this.file, resolved, content);
		await this.plugin.activateView();
		await this.plugin.refreshViews();
	}

	private async findResolvedHighlight(): Promise<ResolvedHighlight | null> {
		const highlights = await this.plugin.engine.resolveFile(this.file);

		return highlights.find((highlight) =>
			highlight.source?.position === this.source.position
			&& highlight.source.textHash === this.source.textHash
			&& highlight.source.contextHash === this.source.contextHash
		) ?? highlights.find((highlight) =>
			highlight.position === this.source.position
			&& highlight.text === this.source.text
		) ?? null;
	}
}
