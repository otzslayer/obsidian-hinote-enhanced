import { App, TFile } from "obsidian";
import { HighlightEngine } from "../../core/HighlightEngine";
import { createId } from "../../core/Hash";
import { HiNoteRepository } from "../../storage/HiNoteRepository";
import { HiNoteComment, ResolvedHighlight } from "../../types";

export class CommentService {
	constructor(
		private app: App,
		private repository: HiNoteRepository,
		private engine: HighlightEngine
	) {}

	async addComment(file: TFile, highlight: ResolvedHighlight, content: string): Promise<void> {
		const trimmed = content.trim();
		if (!trimmed) return;

		const item = this.engine.createItemFromResolved(highlight);
		const now = Date.now();
		const comment: HiNoteComment = {
			id: createId(["comment", item.id, String(now), trimmed]),
			content: trimmed,
			createdAt: now,
			updatedAt: now
		};

		item.comments = [...item.comments, comment];
		item.updatedAt = now;

		await this.repository.upsertItems(file.path, [item]);
		this.engine.invalidate(file.path);
	}

	async updateComment(file: TFile, highlight: ResolvedHighlight, commentId: string, content: string): Promise<void> {
		const item = highlight.item;
		if (!item) return;

		const now = Date.now();
		item.comments = item.comments.map((comment) => comment.id === commentId
			? { ...comment, content: content.trim(), updatedAt: now }
			: comment
		).filter((comment) => comment.content.length > 0);
		item.updatedAt = now;

		await this.repository.upsertItems(file.path, [item]);
		this.engine.invalidate(file.path);
	}

	async deleteComment(file: TFile, highlight: ResolvedHighlight, commentId: string): Promise<void> {
		const item = highlight.item;
		if (!item) return;

		item.comments = item.comments.filter((comment) => comment.id !== commentId);
		item.updatedAt = Date.now();

		await this.repository.upsertItems(file.path, [item]);
		this.engine.invalidate(file.path);
	}
}
