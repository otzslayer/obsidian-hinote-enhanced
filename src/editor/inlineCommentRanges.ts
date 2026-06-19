/** Return all {>>...<<} block ranges in `text` for live-preview hiding. */
export function findInlineCommentRanges(text: string): Array<{ from: number; to: number }> {
    const ranges: Array<{ from: number; to: number }> = [];
    const re = /\{>>([\s\S]*?)<<\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        ranges.push({ from: m.index, to: m.index + m[0].length });
    }
    return ranges;
}
