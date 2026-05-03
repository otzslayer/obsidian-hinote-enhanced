import { HighlightSource, HiNoteItem, ResolvedHighlight } from "../types";
import { createId } from "./Hash";

const NEAR_POSITION = 120;
const FAR_POSITION = 900;

export class HighlightResolver {
	resolve(filePath: string, sources: HighlightSource[], storedItems: HiNoteItem[]): ResolvedHighlight[] {
		const usedItemIds = new Set<string>();
		const resolved: ResolvedHighlight[] = [];

		for (const source of sources) {
			const match = this.findBestMatch(source, storedItems, usedItemIds);
			if (!match) {
				resolved.push(this.fromNewSource(source));
				continue;
			}

			usedItemIds.add(match.id);
			const moved = match.position !== source.position || match.textHash !== source.textHash;
			resolved.push({
				id: match.id,
				filePath,
				text: source.text,
				position: source.position,
				markerLength: source.markerLength,
				source,
				item: match,
				comments: match.comments,
				status: moved ? "moved" : "matched",
				backgroundColor: source.backgroundColor ?? match.backgroundColor,
				isCloze: source.isCloze
			});
		}

		for (const item of storedItems) {
			if (!usedItemIds.has(item.id) && item.comments.length > 0) {
				resolved.unshift({
					id: item.id,
					filePath,
					text: item.text,
					position: item.position,
					markerLength: item.markerLength,
					source: null,
					item,
					comments: item.comments,
					status: "orphaned",
					backgroundColor: item.backgroundColor,
					isCloze: item.isCloze
				});
			}
		}

		return resolved;
	}

	createItemFromSource(source: HighlightSource, existingId?: string): HiNoteItem {
		const now = Date.now();
		return {
			id: existingId ?? createId([
				"item",
				source.filePath,
				source.textHash,
				source.contextHash,
				String(source.position)
			]),
			filePath: source.filePath,
			text: source.text,
			normalizedText: source.normalizedText,
			position: source.position,
			markerLength: source.markerLength,
			textHash: source.textHash,
			contextHash: source.contextHash,
			contextBefore: source.contextBefore,
			contextAfter: source.contextAfter,
			blockId: source.blockId,
			backgroundColor: source.backgroundColor,
			isCloze: source.isCloze,
			comments: [],
			createdAt: now,
			updatedAt: now
		};
	}

	syncItemToSource(item: HiNoteItem, source: HighlightSource): HiNoteItem {
		return {
			...item,
			text: source.text,
			normalizedText: source.normalizedText,
			position: source.position,
			markerLength: source.markerLength,
			textHash: source.textHash,
			contextHash: source.contextHash,
			contextBefore: source.contextBefore,
			contextAfter: source.contextAfter,
			blockId: source.blockId,
			backgroundColor: source.backgroundColor,
			isCloze: source.isCloze,
			updatedAt: Date.now()
		};
	}

	private findBestMatch(
		source: HighlightSource,
		items: HiNoteItem[],
		usedItemIds: Set<string>
	): HiNoteItem | null {
		const candidates = items.filter((item) => !usedItemIds.has(item.id));

		return this.byBlockId(source, candidates)
			?? this.byTextAndContext(source, candidates)
			?? this.byNearText(source, candidates)
			?? this.byUniqueText(source, candidates)
			?? this.byNearPosition(source, candidates);
	}

	private byBlockId(source: HighlightSource, items: HiNoteItem[]): HiNoteItem | null {
		if (!source.blockId) return null;
		return items.find((item) => item.blockId === source.blockId) ?? null;
	}

	private byTextAndContext(source: HighlightSource, items: HiNoteItem[]): HiNoteItem | null {
		return items.find((item) => item.textHash === source.textHash && item.contextHash === source.contextHash) ?? null;
	}

	private byNearText(source: HighlightSource, items: HiNoteItem[]): HiNoteItem | null {
		const matches = items
			.filter((item) => item.textHash === source.textHash)
			.sort((a, b) => Math.abs(a.position - source.position) - Math.abs(b.position - source.position));

		return matches.length > 0 && Math.abs(matches[0].position - source.position) <= FAR_POSITION
			? matches[0]
			: null;
	}

	private byUniqueText(source: HighlightSource, items: HiNoteItem[]): HiNoteItem | null {
		const matches = items.filter((item) => item.textHash === source.textHash);
		return matches.length === 1 ? matches[0] : null;
	}

	private byNearPosition(source: HighlightSource, items: HiNoteItem[]): HiNoteItem | null {
		const matches = items
			.filter((item) => Math.abs(item.position - source.position) <= NEAR_POSITION)
			.sort((a, b) => Math.abs(a.position - source.position) - Math.abs(b.position - source.position));

		return matches[0] ?? null;
	}

	private fromNewSource(source: HighlightSource): ResolvedHighlight {
		return {
			id: createId([
				"source",
				source.filePath,
				source.textHash,
				source.contextHash,
				String(source.position)
			]),
			filePath: source.filePath,
			text: source.text,
			position: source.position,
			markerLength: source.markerLength,
			source,
			item: null,
			comments: [],
			status: "new",
			backgroundColor: source.backgroundColor,
			isCloze: source.isCloze
		};
	}
}
