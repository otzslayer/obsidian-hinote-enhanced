export interface HighlightSource {
	text: string;
	normalizedText: string;
	position: number;
	markerLength: number;
	filePath: string;
	contextBefore: string;
	contextAfter: string;
	textHash: string;
	contextHash: string;
	blockId?: string;
	backgroundColor?: string;
	isCloze: boolean;
}

export interface HiNoteComment {
	id: string;
	content: string;
	createdAt: number;
	updatedAt: number;
}

export interface HiNoteItem {
	id: string;
	filePath: string;
	text: string;
	normalizedText: string;
	position: number;
	markerLength: number;
	textHash: string;
	contextHash: string;
	contextBefore: string;
	contextAfter: string;
	blockId?: string;
	backgroundColor?: string;
	isCloze: boolean;
	comments: HiNoteComment[];
	createdAt: number;
	updatedAt: number;
}

export type ResolvedStatus = "new" | "matched" | "moved" | "orphaned";

export interface ResolvedHighlight {
	id: string;
	filePath: string;
	text: string;
	position: number;
	markerLength: number;
	source: HighlightSource | null;
	item: HiNoteItem | null;
	comments: HiNoteComment[];
	status: ResolvedStatus;
	backgroundColor?: string;
	isCloze: boolean;
}

export interface FileHighlightData {
	version: 1;
	filePath: string;
	updatedAt: number;
	items: HiNoteItem[];
}

export interface HighlightPattern {
	id: string;
	regex: RegExp;
	color: string;
}
