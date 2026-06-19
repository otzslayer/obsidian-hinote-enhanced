const INLINE_COMMENT_RE = /\{>>[\s\S]*?<<\}/;

/**
 * Hide every {>>...<<} block inside `el` so reading-view users only see the
 * comment marker, not the raw CriticMarkup syntax (R7).
 *
 * A comment body may contain inline markdown (e.g. `**bold**`), which Obsidian
 * renders into child elements (<strong>, <code>, <a>…). That splits the
 * `{>>...<<}` block across sibling text nodes, so a per-text-node regex match
 * fails. We therefore flatten the block's text nodes into one string, match
 * across the whole string, and remove each match via a DOM Range — which spans
 * the intervening child elements too. Each removed block is replaced by an
 * empty hidden span (content discarded, matching the prior single-node policy).
 */
export function hideInlineCommentBlocks(el: HTMLElement): void {
    // Re-scan after each removal: a single pass would invalidate the offset map
    // as soon as the DOM changes. Empty replacement spans contribute no text,
    // so each pass strictly reduces the match count → guaranteed termination.
    while (hideFirstInlineComment(el)) {
        /* keep going until no {>>...<<} remains */
    }
}

function hideFirstInlineComment(el: HTMLElement): boolean {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const offsets: Array<{ node: Text; start: number }> = [];
    let full = '';

    let node: Node | null;
    while ((node = walker.nextNode()) !== null) {
        const textNode = node as Text;
        offsets.push({ node: textNode, start: full.length });
        full += textNode.textContent ?? '';
    }

    const match = INLINE_COMMENT_RE.exec(full);
    if (!match) return false;

    const start = match.index;
    const end = match.index + match[0].length;
    const startPos = locate(offsets, start);
    const endPos = locate(offsets, end);
    if (!startPos || !endPos) return false;

    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
    range.deleteContents();

    const span = document.createElement('span');
    span.className = 'hi-note-inline-comment-raw';
    span.style.display = 'none';
    range.insertNode(span);
    return true;
}

/** Map a global character offset onto a (text node, local offset) position. */
function locate(
    offsets: Array<{ node: Text; start: number }>,
    pos: number
): { node: Text; offset: number } | null {
    for (const { node, start } of offsets) {
        const len = node.textContent?.length ?? 0;
        if (pos <= start + len) return { node, offset: pos - start };
    }
    return null;
}
