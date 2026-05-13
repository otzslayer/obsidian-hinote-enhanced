import { App, TFile } from "obsidian";
import { t } from "../../i18n";

export class ExportFileWriter {
    constructor(private app: App) {}

    async createMarkdownFile(fileName: string, content: string, exportPath: string): Promise<TFile> {
        const fullPath = await this.getExportPath(fileName, exportPath);

        try {
            return await this.app.vault.create(`${fullPath}.md`, content);
        } catch (error) {
            if (error.message && error.message.includes("already exists")) {
                throw new Error(t("Export file already exists. Please try again in a moment."));
            }

            throw new Error(t("Failed to create export file: ") + error.message);
        }
    }

    private async getExportPath(fileName: string, exportPath: string): Promise<string> {
        if (!exportPath) {
            return fileName;
        }

        const folderPath = this.app.vault.getAbstractFileByPath(exportPath);
        if (!folderPath) {
            await this.app.vault.createFolder(exportPath);
        }

        return `${exportPath}/${fileName}`;
    }
}
