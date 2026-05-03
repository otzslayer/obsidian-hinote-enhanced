import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { HighlightEngine } from "./src/core/HighlightEngine";
import { HiNoteRepository } from "./src/storage/HiNoteRepository";
import { CommentService } from "./src/features/comments/CommentService";
import { HiNoteNextView, VIEW_TYPE_HINOTE_NEXT } from "./src/ui/HiNoteNextView";
import { createEditorHighlightWidgets } from "./src/ui/editor/EditorHighlightWidgets";

export default class HiNoteNextPlugin extends Plugin {
	repository: HiNoteRepository;
	engine: HighlightEngine;
	comments: CommentService;

	async onload(): Promise<void> {
		this.repository = new HiNoteRepository(this.app);
		await this.repository.initialize();

		this.engine = new HighlightEngine(this.app, this.repository);
		this.comments = new CommentService(this.app, this.repository, this.engine);

		this.registerView(
			VIEW_TYPE_HINOTE_NEXT,
			(leaf: WorkspaceLeaf) => new HiNoteNextView(leaf, this)
		);
		this.registerEditorExtension(createEditorHighlightWidgets(this));

		this.addRibbonIcon("highlighter", "HiNote Next", async () => {
			await this.activateView();
		});

		this.addCommand({
			id: "open-hinote-next",
			name: "Open HiNote Next",
			callback: async () => {
				await this.activateView();
			}
		});

		this.registerEvent(this.app.workspace.on("file-open", async (file) => {
			if (file instanceof TFile) {
				await this.refreshViews();
			}
		}));

		this.registerEvent(this.app.vault.on("modify", async (file) => {
			if (file instanceof TFile && file.extension === "md") {
				this.engine.invalidate(file.path);
				await this.refreshViews();
			}
		}));

		this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
			if (file instanceof TFile) {
				await this.repository.renameFile(oldPath, file.path);
				this.engine.invalidate(oldPath);
				this.engine.invalidate(file.path);
				await this.refreshViews();
			}
		}));
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_HINOTE_NEXT);
	}

	async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_HINOTE_NEXT)[0];
		if (existing) {
			this.app.workspace.revealLeaf(existing);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;

		await leaf.setViewState({
			type: VIEW_TYPE_HINOTE_NEXT,
			active: true
		});
		this.app.workspace.revealLeaf(leaf);
	}

	async refreshViews(): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_HINOTE_NEXT)) {
			const view = leaf.view;
			if (view instanceof HiNoteNextView) {
				await view.refresh();
			}
		}
	}
}
