/**
 * Convert newlines to CommonMark hard breaks (two trailing spaces + newline).
 * Applied before MarkdownRenderer.render so multi-line comments display correctly.
 */
export function toHardBreakMarkdown(content: string): string {
    return content.replace(/\n/g, '  \n');
}
