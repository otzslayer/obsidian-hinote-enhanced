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

/**
 * Return only the single-line {>>...<<} ranges safe to pass to Decoration.replace.
 * CodeMirror 6 throws a RangeError when a replace decoration spans multiple lines.
 * Legacy blocks with real newlines on disk are excluded; encoded blocks (storing
 * newlines as the two-char `\n` token) pass through because they contain no literal `\n`.
 */
export function selectHideableRanges(text: string): Array<{ from: number; to: number }> {
    return findInlineCommentRanges(text).filter(
        r => !text.slice(r.from, r.to).includes('\n')
    );
}
