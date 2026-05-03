import { ItemView, Notice, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import HiNoteNextPlugin from "../../main";
import { MarkdownExportService } from "../features/export/MarkdownExportService";
import { ResolvedHighlight } from "../types";

export const VIEW_TYPE_HINOTE_NEXT = "hinote-next-view";

type ViewMode = "current" | "vault";

export class HiNoteNextView extends ItemView {
	private mode: ViewMode = "current";
	private highlights: ResolvedHighlight[] = [];
	private exportService: MarkdownExportService;
	private contentElRef: HTMLElement;
	private listEl: HTMLElement;
	private searchInput: HTMLInputElement;

	constructor(leaf: WorkspaceLeaf, private plugin: HiNoteNextPlugin) {
		super(leaf);
		this.exportService = new MarkdownExportService(this.app);
	}

	getViewType(): string {
		return VIEW_TYPE_HINOTE_NEXT;
	}

	getDisplayText(): string {
		return "HiNote Next";
	}

	getIcon(): string {
		return "highlighter";
	}

	async onOpen(): Promise<void> {
		this.renderShell();
		await this.refresh();
	}

	async refresh(): Promise<void> {
		if (!this.listEl) return;

		this.listEl.empty();
		this.listEl.createDiv({ cls: "hinote-next-loading", text: "Loading highlights..." });

		try {
			if (this.mode === "vault") {
				this.highlights = await this.plugin.engine.resolveVault();
			} else {
				const activeFile = this.app.workspace.getActiveFile();
				this.highlights = activeFile ? await this.plugin.engine.resolveFile(activeFile) : [];
			}
			this.renderList();
		} catch (error) {
			this.listEl.empty();
			this.listEl.createDiv({
				cls: "hinote-next-empty",
				text: error instanceof Error ? error.message : "Failed to load highlights."
			});
		}
	}

	private renderShell(): void {
		this.containerEl.empty();
		this.contentElRef = this.containerEl.createDiv({ cls: "hinote-next" });

		const toolbar = this.contentElRef.createDiv({ cls: "hinote-next-toolbar" });
		this.createModeButton(toolbar, "Current file", "current");
		this.createModeButton(toolbar, "Vault", "vault");

		const exportButton = toolbar.createEl("button", { cls: "hinote-next-icon-button" });
		setIcon(exportButton, "file-input");
		exportButton.setAttribute("aria-label", "Export current file highlights");
		this.registerDomEvent(exportButton, "click", async () => {
			await this.exportCurrentFile();
		});

		this.searchInput = this.contentElRef.createEl("input", {
			cls: "hinote-next-search",
			type: "search",
			placeholder: "Search highlights and comments"
		});
		this.registerDomEvent(this.searchInput, "input", () => this.renderList());

		this.listEl = this.contentElRef.createDiv({ cls: "hinote-next-list" });
	}

	private createModeButton(toolbar: HTMLElement, label: string, mode: ViewMode): void {
		const button = toolbar.createEl("button", {
			cls: `hinote-next-mode-button ${this.mode === mode ? "is-active" : ""}`,
			text: label
		});

		this.registerDomEvent(button, "click", async () => {
			this.mode = mode;
			this.renderShell();
			await this.refresh();
		});
	}

	private renderList(): void {
		this.listEl.empty();
		const query = this.searchInput.value.trim().toLowerCase();
		const visibleHighlights = query
			? this.highlights.filter((highlight) => this.matchesQuery(highlight, query))
			: this.highlights;

		if (visibleHighlights.length === 0) {
			this.listEl.createDiv({
				cls: "hinote-next-empty",
				text: this.mode === "current" ? "No highlights in the current file." : "No highlights found in the vault."
			});
			return;
		}

		for (const highlight of visibleHighlights) {
			this.renderHighlightCard(highlight);
		}
	}

	private renderHighlightCard(highlight: ResolvedHighlight): void {
		const card = this.listEl.createDiv({ cls: `hinote-next-card is-${highlight.status}` });

		const header = card.createDiv({ cls: "hinote-next-card-header" });
		header.createDiv({ cls: "hinote-next-file", text: highlight.filePath });
		header.createDiv({ cls: "hinote-next-status", text: highlight.status });

		const text = card.createDiv({ cls: "hinote-next-highlight-text" });
		text.setText(highlight.text);

		const comments = card.createDiv({ cls: "hinote-next-comments" });
		for (const comment of highlight.comments) {
			this.renderComment(comments, highlight, comment.id, comment.content);
		}

		const textarea = card.createEl("textarea", {
			cls: "hinote-next-comment-input",
			placeholder: "Add a comment"
		});

		const actions = card.createDiv({ cls: "hinote-next-card-actions" });
		const addButton = actions.createEl("button", { text: "Add comment" });
		this.registerDomEvent(addButton, "click", async () => {
			const file = this.app.vault.getAbstractFileByPath(highlight.filePath);
			if (!(file instanceof TFile)) {
				new Notice("Source file not found.");
				return;
			}

			await this.plugin.comments.addComment(file, highlight, textarea.value);
			textarea.value = "";
			await this.refresh();
		});
	}

	private renderComment(parent: HTMLElement, highlight: ResolvedHighlight, commentId: string, content: string): void {
		const row = parent.createDiv({ cls: "hinote-next-comment" });
		const body = row.createDiv({ cls: "hinote-next-comment-body" });
		body.setText(content);

		const actions = row.createDiv({ cls: "hinote-next-comment-actions" });
		const editButton = actions.createEl("button", { text: "Edit" });
		const deleteButton = actions.createEl("button", { text: "Delete" });

		this.registerDomEvent(editButton, "click", async () => {
			const next = window.prompt("Edit comment", content);
			if (next === null) return;

			const file = this.app.vault.getAbstractFileByPath(highlight.filePath);
			if (file instanceof TFile) {
				await this.plugin.comments.updateComment(file, highlight, commentId, next);
				await this.refresh();
			}
		});

		this.registerDomEvent(deleteButton, "click", async () => {
			const file = this.app.vault.getAbstractFileByPath(highlight.filePath);
			if (file instanceof TFile) {
				await this.plugin.comments.deleteComment(file, highlight, commentId);
				await this.refresh();
			}
		});
	}

	private matchesQuery(highlight: ResolvedHighlight, query: string): boolean {
		return highlight.text.toLowerCase().includes(query)
			|| highlight.filePath.toLowerCase().includes(query)
			|| highlight.comments.some((comment) => comment.content.toLowerCase().includes(query));
	}

	private async exportCurrentFile(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("Please open a Markdown file first.");
			return;
		}

		const highlights = await this.plugin.engine.resolveFile(file);
		if (highlights.length === 0) {
			new Notice("No highlights to export.");
			return;
		}

		const exported = await this.exportService.exportHighlights(file, highlights);
		new Notice(`Exported to ${exported.path}`);
	}
}
