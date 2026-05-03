import { Notice } from "obsidian";
import { ExportService } from "../../services/ExportService";
import { HighlightInfo } from "../../types/highlight";
import { t } from "../../i18n";

interface BatchExportOperationsOptions {
    exportService: ExportService;
    getSelectedHighlights: () => Set<HighlightInfo>;
    clearSelection: () => void;
}

export class BatchExportOperations {
    constructor(private options: BatchExportOperationsOptions) {}

    async exportSelectedHighlights(): Promise<void> {
        const selectedHighlights = this.options.getSelectedHighlights();

        if (selectedHighlights.size === 0) {
            new Notice(t("Please select highlights to export"));
            return;
        }

        try {
            const selectedHighlightsArray = Array.from(selectedHighlights);
            const newFile = await this.options.exportService.exportHighlightsAsMarkdown(selectedHighlightsArray);

            new Notice(t("Successfully exported selected highlights to: ") + newFile.path);
            this.options.clearSelection();
        } catch (error) {
            console.error("Failed to export highlights:", error);
            new Notice(t("Failed to export highlights: ") + (error instanceof Error ? error.message : String(error)));
        }
    }
}
