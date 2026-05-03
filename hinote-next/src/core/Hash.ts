export function hashText(input: string): string {
	let hash = 2166136261;
	for (let index = 0; index < input.length; index++) {
		hash ^= input.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

export function normalizeText(input: string): string {
	return input.replace(/\s+/g, " ").trim().toLowerCase();
}

export function createId(parts: string[]): string {
	return hashText(parts.join("\u001f"));
}
