import { TFile } from "obsidian";
import CommentPlugin from "../../../main";
import { HighlightService } from "../../services/HighlightService";

export class FileListDataSource {
    private cachedFiles: TFile[] | null = null;
    private cachedFileCounts: Map<string, number> | null = null;
    private cacheTimestamp = 0;
    private readonly cacheExpiry = 60000;

    constructor(
        private plugin: CommentPlugin,
        private highlightService: HighlightService
    ) {}

    invalidateCache(): void {
        this.cachedFiles = null;
        this.cachedFileCounts = null;
        this.cacheTimestamp = 0;
    }

    async getFilesWithHighlights(): Promise<TFile[]> {
        const now = Date.now();
        if (this.cachedFiles && (now - this.cacheTimestamp) < this.cacheExpiry) {
            return this.cachedFiles;
        }

        const cachedHighlights = this.highlightService.getAllHighlightsFromCache();
        if (cachedHighlights && cachedHighlights.length > 0) {
            const filePathsSet = new Set<string>();
            const countsMap = new Map<string, number>();

            for (const highlight of cachedHighlights) {
                if (!highlight.filePath) continue;

                filePathsSet.add(highlight.filePath);
                countsMap.set(
                    highlight.filePath,
                    (countsMap.get(highlight.filePath) || 0) + 1
                );
            }

            const files: TFile[] = [];
            for (const filePath of filePathsSet) {
                const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    files.push(file);
                }
            }

            this.cachedFiles = files;
            this.cachedFileCounts = countsMap;
            this.cacheTimestamp = now;
            return files;
        }

        const files = await this.getFilesWithHighlightsLegacy();
        this.cachedFiles = files;
        this.cacheTimestamp = now;
        return files;
    }

    async getFileHighlightsCount(file: TFile): Promise<number> {
        if (this.cachedFileCounts && this.cachedFileCounts.has(file.path)) {
            return this.cachedFileCounts.get(file.path)!;
        }

        const content = await this.plugin.app.vault.read(file);
        const count = this.highlightService.extractHighlights(content, file).length;

        if (!this.cachedFileCounts) {
            this.cachedFileCounts = new Map();
        }
        this.cachedFileCounts.set(file.path, count);

        return count;
    }

    getTotalHighlightsCount(): number {
        const cachedHighlights = this.highlightService.getAllHighlightsFromCache();
        if (cachedHighlights) {
            return cachedHighlights.length;
        }

        if (this.cachedFileCounts) {
            let total = 0;
            for (const count of this.cachedFileCounts.values()) {
                total += count;
            }
            return total;
        }

        return 0;
    }

    private async getFilesWithHighlightsLegacy(): Promise<TFile[]> {
        const allFiles = this.plugin.app.vault.getMarkdownFiles();
        const files = allFiles.filter(file => this.highlightService.shouldProcessFile(file));
        const filesWithHighlights: TFile[] = [];
        const countsMap = new Map<string, number>();

        for (const file of files) {
            const content = await this.plugin.app.vault.read(file);
            const highlights = this.highlightService.extractHighlights(content, file);
            if (highlights.length > 0) {
                filesWithHighlights.push(file);
                countsMap.set(file.path, highlights.length);
            }
        }

        this.cachedFileCounts = countsMap;
        return filesWithHighlights;
    }
}
