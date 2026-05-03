import { App } from "obsidian";
import { FileHighlightData, HiNoteItem } from "../types";

const DATA_DIR = ".hinote-next";
const HIGHLIGHTS_DIR = `${DATA_DIR}/highlights`;

export class HiNoteRepository {
	constructor(private app: App) {}

	async initialize(): Promise<void> {
		await this.ensureDir(DATA_DIR);
		await this.ensureDir(HIGHLIGHTS_DIR);
	}

	async getFileItems(filePath: string): Promise<HiNoteItem[]> {
		try {
			const raw = await this.app.vault.adapter.read(this.getStoragePath(filePath));
			const data = JSON.parse(raw) as FileHighlightData;
			if (!Array.isArray(data.items)) return [];
			return data.items;
		} catch {
			return [];
		}
	}

	async saveFileItems(filePath: string, items: HiNoteItem[]): Promise<void> {
		const data: FileHighlightData = {
			version: 1,
			filePath,
			updatedAt: Date.now(),
			items: items.filter((item) => item.comments.length > 0)
		};

		if (data.items.length === 0) {
			await this.deleteFile(filePath);
			return;
		}

		await this.app.vault.adapter.write(this.getStoragePath(filePath), JSON.stringify(data, null, 2));
	}

	async upsertItems(filePath: string, updates: HiNoteItem[]): Promise<void> {
		const current = await this.getFileItems(filePath);
		const byId = new Map(current.map((item) => [item.id, item]));

		for (const item of updates) {
			byId.set(item.id, item);
		}

		await this.saveFileItems(filePath, Array.from(byId.values()));
	}

	async renameFile(oldPath: string, newPath: string): Promise<void> {
		const items = await this.getFileItems(oldPath);
		if (items.length === 0) return;

		await this.saveFileItems(newPath, items.map((item) => ({
			...item,
			filePath: newPath,
			updatedAt: Date.now()
		})));
		await this.deleteFile(oldPath);
	}

	async getKnownFilePaths(): Promise<string[]> {
		try {
			const listed = await this.app.vault.adapter.list(HIGHLIGHTS_DIR);
			return listed.files
				.filter((path) => path.endsWith(".json"))
				.map((path) => decodeFilePath(path.split("/").pop()!.replace(/\.json$/, "")));
		} catch {
			return [];
		}
	}

	private async deleteFile(filePath: string): Promise<void> {
		try {
			await this.app.vault.adapter.remove(this.getStoragePath(filePath));
		} catch {
			// Missing data files are fine.
		}
	}

	private async ensureDir(path: string): Promise<void> {
		try {
			await this.app.vault.adapter.mkdir(path);
		} catch {
			// Directory already exists.
		}
	}

	private getStoragePath(filePath: string): string {
		return `${HIGHLIGHTS_DIR}/${encodeFilePath(filePath)}.json`;
	}
}

function encodeFilePath(filePath: string): string {
	return encodeURIComponent(filePath).replace(/[!'()*]/g, (char) =>
		`%${char.charCodeAt(0).toString(16).toUpperCase()}`
	);
}

function decodeFilePath(fileName: string): string {
	return decodeURIComponent(fileName);
}
