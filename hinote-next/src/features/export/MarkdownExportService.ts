import { App, TFile } from "obsidian";
import { ResolvedHighlight } from "../../types";

export class MarkdownExportService {
	constructor(private app: App) {}

	async exportHighlights(sourceFile: TFile, highlights: ResolvedHighlight[]): Promise<TFile> {
		const content = this.render(sourceFile, highlights);
		const fileName = `${sourceFile.basename} - HiNote Next ${window.moment().format("YYYYMMDDHHmmss")}.md`;
		return this.app.vault.create(fileName, content);
	}

	render(sourceFile: TFile, highlights: ResolvedHighlight[]): string {
		const lines: string[] = [
			`# ${sourceFile.basename} - HiNote Next`,
			"",
			`Source: [[${sourceFile.basename}]]`,
			""
		];

		for (const highlight of highlights) {
			if (highlight.status === "orphaned") {
				lines.push("> [!warning] Orphaned HiNote");
			} else {
				lines.push("> [!quote] HiNote");
			}
			lines.push(`> ${highlight.text}`);
			lines.push(">");

			for (const comment of highlight.comments) {
				lines.push(`>> [!note]+ ${window.moment(comment.updatedAt).format("YYYY-MM-DD HH:mm:ss")}`);
				for (const line of comment.content.split("\n")) {
					lines.push(`>> ${line}`);
				}
				lines.push(">");
			}

			lines.push("");
		}

		return lines.join("\n");
	}
}
