import { App, TFile } from "obsidian";
import { HighlightSource } from "../types";
import { createId, hashText, normalizeText } from "./Hash";

const CONTEXT_CHARS = 80;

interface MatchPattern {
	id: string;
	regex: RegExp;
	color: string;
	getText(match: RegExpExecArray): string;
}

const DEFAULT_PATTERNS: MatchPattern[] = [
	{
		id: "markdown",
		regex: /==([^=\n](?:[^=\n]|=[^=\n])*?[^=\n])==/g,
		color: "#ffeb3b",
		getText: (match) => match[1]
	},
	{
		id: "mark",
		regex: /<mark(?:\s[^>]*)?>([\s\S]*?)<\/mark>/g,
		color: "#ffeb3b",
		getText: (match) => stripHtml(match[1])
	},
	{
		id: "span",
		regex: /<span(?:\s[^>]*)?>([\s\S]*?)<\/span>/g,
		color: "#ffeb3b",
		getText: (match) => stripHtml(match[1])
	}
];

export class HighlightExtractor {
	constructor(private app: App) {}

	shouldProcess(file: TFile): boolean {
		return file.extension === "md";
	}

	extract(content: string, file: TFile): HighlightSource[] {
		const codeRanges = this.getCodeRanges(file);
		const sources: HighlightSource[] = [];
		const seen = new Set<string>();

		for (const pattern of DEFAULT_PATTERNS) {
			pattern.regex.lastIndex = 0;
			let match: RegExpExecArray | null;
			while ((match = pattern.regex.exec(content)) !== null) {
				const fullMatch = match[0];
				const position = match.index;
				const end = position + fullMatch.length;

				if (intersectsAny(position, end, codeRanges)) continue;
				if (fullMatch.startsWith("==") && hasExtraEquals(content, position, end)) continue;

				const text = pattern.getText(match).trim();
				if (!text) continue;

				const normalizedText = normalizeText(text);
				const contextBefore = content.slice(Math.max(0, position - CONTEXT_CHARS), position);
				const contextAfter = content.slice(end, Math.min(content.length, end + CONTEXT_CHARS));
				const textHash = hashText(normalizedText);
				const contextHash = hashText(`${normalizeText(contextBefore)}|${normalizeText(contextAfter)}`);
				const duplicateKey = `${position}:${textHash}`;

				if (seen.has(duplicateKey)) continue;
				seen.add(duplicateKey);

				sources.push({
					text,
					normalizedText,
					position,
					markerLength: fullMatch.length,
					filePath: file.path,
					contextBefore,
					contextAfter,
					textHash,
					contextHash,
					blockId: getNearbyBlockId(content, end),
					backgroundColor: extractBackgroundColor(fullMatch) ?? pattern.color,
					isCloze: /\{\{[^{}]+\}\}/.test(text)
				});
			}
		}

		return sources.sort((a, b) => a.position - b.position);
	}

	createProvisionalId(source: HighlightSource): string {
		return createId([
			"source",
			source.filePath,
			source.textHash,
			source.contextHash,
			String(source.position)
		]);
	}

	private getCodeRanges(file: TFile): Array<[number, number]> {
		const cache = this.app.metadataCache.getFileCache(file);
		return cache?.sections
			?.filter((section) => section.type === "code")
			.map((section) => [
				section.position.start.offset,
				section.position.end.offset
			]) ?? [];
	}
}

function stripHtml(input: string): string {
	return input.replace(/<[^>]+>/g, "");
}

function intersectsAny(start: number, end: number, ranges: Array<[number, number]>): boolean {
	return ranges.some(([rangeStart, rangeEnd]) => Math.max(start, rangeStart) < Math.min(end, rangeEnd));
}

function hasExtraEquals(content: string, start: number, end: number): boolean {
	return content.charAt(start - 1) === "=" || content.charAt(end) === "=";
}

function extractBackgroundColor(markup: string): string | undefined {
	const style = markup.match(/style=["']([^"']+)["']/i)?.[1];
	if (!style) return undefined;
	return style.match(/background(?:-color)?\s*:\s*([^;]+)/i)?.[1]?.trim();
}

function getNearbyBlockId(content: string, endOffset: number): string | undefined {
	const lineEnd = content.indexOf("\n", endOffset);
	const line = content.slice(endOffset, lineEnd === -1 ? content.length : lineEnd);
	return line.match(/\s\^([A-Za-z0-9-]+)\s*$/)?.[1];
}
