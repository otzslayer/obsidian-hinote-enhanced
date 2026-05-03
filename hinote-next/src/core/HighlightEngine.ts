import { App, TFile } from "obsidian";
import { HiNoteRepository } from "../storage/HiNoteRepository";
import { ResolvedHighlight } from "../types";
import { HighlightExtractor } from "./HighlightExtractor";
import { HighlightResolver } from "./HighlightResolver";

export class HighlightEngine {
	private extractor: HighlightExtractor;
	private resolver = new HighlightResolver();
	private fileCache = new Map<string, { mtime: number; highlights: ResolvedHighlight[] }>();

	constructor(
		private app: App,
		private repository: HiNoteRepository
	) {
		this.extractor = new HighlightExtractor(app);
	}

	async resolveFile(file: TFile): Promise<ResolvedHighlight[]> {
		if (!this.extractor.shouldProcess(file)) return [];

		const cached = this.fileCache.get(file.path);
		if (cached && cached.mtime === file.stat.mtime) {
			return cached.highlights;
		}

		const content = await this.app.vault.read(file);
		const sources = this.extractor.extract(content, file);
		const storedItems = await this.repository.getFileItems(file.path);
		const highlights = this.resolver.resolve(file.path, sources, storedItems);

		const movedItems = highlights
			.filter((highlight) => highlight.status === "moved" && highlight.item && highlight.source)
			.map((highlight) => this.resolver.syncItemToSource(highlight.item!, highlight.source!));

		if (movedItems.length > 0) {
			await this.repository.upsertItems(file.path, movedItems);
		}

		this.fileCache.set(file.path, {
			mtime: file.stat.mtime,
			highlights
		});

		return highlights;
	}

	async resolveVault(): Promise<ResolvedHighlight[]> {
		const files = this.app.vault.getMarkdownFiles();
		const batches = await Promise.all(files.map((file) => this.resolveFile(file)));
		return batches.flat().sort((a, b) => a.filePath.localeCompare(b.filePath) || a.position - b.position);
	}

	createItemFromResolved(highlight: ResolvedHighlight) {
		if (highlight.item) return highlight.item;
		if (!highlight.source) {
			throw new Error("Cannot create an item without a live highlight source.");
		}
		return this.resolver.createItemFromSource(highlight.source, highlight.id);
	}

	invalidate(filePath: string): void {
		this.fileCache.delete(filePath);
	}
}
