import { App, EventRef, TFile } from "obsidian";
import { HighlightExtractor } from "./HighlightExtractor";

interface HighlightIndexFileWatcherOptions {
    app: App;
    extractor: HighlightExtractor;
    updateFileInIndex: (file: TFile) => void;
    removeFileFromIndex: (filePath: string) => void;
}

export class HighlightIndexFileWatcher {
    private fileCreateEventRef: EventRef | null = null;
    private fileModifyEventRef: EventRef | null = null;
    private fileDeleteEventRef: EventRef | null = null;
    private fileRenameEventRef: EventRef | null = null;

    constructor(private options: HighlightIndexFileWatcherOptions) {}

    register(): void {
        this.unregister();

        this.fileCreateEventRef = this.options.app.vault.on("create", (file) => {
            if (file instanceof TFile && file.extension === "md") {
                this.options.updateFileInIndex(file);
            }
        });

        this.fileModifyEventRef = this.options.app.vault.on("modify", (file) => {
            if (file instanceof TFile && file.extension === "md") {
                this.options.extractor.invalidateContentCache(file.path);
                this.options.updateFileInIndex(file);
            }
        });

        this.fileDeleteEventRef = this.options.app.vault.on("delete", (file) => {
            if (file instanceof TFile && file.extension === "md") {
                this.options.extractor.invalidateContentCache(file.path);
                this.options.removeFileFromIndex(file.path);
            }
        });

        this.fileRenameEventRef = this.options.app.vault.on("rename", (file, oldPath) => {
            if (file instanceof TFile && file.extension === "md") {
                this.options.extractor.invalidateContentCache(oldPath);
                this.options.removeFileFromIndex(oldPath);
                this.options.updateFileInIndex(file);
            }
        });
    }

    unregister(): void {
        this.offref(this.fileCreateEventRef);
        this.offref(this.fileModifyEventRef);
        this.offref(this.fileDeleteEventRef);
        this.offref(this.fileRenameEventRef);

        this.fileCreateEventRef = null;
        this.fileModifyEventRef = null;
        this.fileDeleteEventRef = null;
        this.fileRenameEventRef = null;
    }

    private offref(eventRef: EventRef | null): void {
        if (eventRef) {
            this.options.app.vault.offref(eventRef);
        }
    }
}
