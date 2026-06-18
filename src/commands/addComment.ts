import { Plugin, Editor, MarkdownView, Notice, TFile } from 'obsidian';
import { t } from '../i18n';
import type { HiNotePluginContext } from '../types/plugin';
import { InlineCommentWriter } from '../services/comment/inline/InlineCommentWriter';

/**
 * Register the "Add comment to selection/highlight" command with default hotkey Mod+Shift+C (R15, KTD10).
 * Command ID must never change after release.
 */
export function registerAddCommentCommand(plugin: Plugin): void {
    plugin.addCommand({
        id: 'add-inline-comment',
        name: t('Add comment to selection'),
        editorCallback: (editor: Editor, view: MarkdownView) => {
            void addCommentToSelection(plugin as unknown as HiNotePluginContext, editor, view);
        },
        hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'c' }],
    });
}

async function addCommentToSelection(
    plugin: HiNotePluginContext,
    editor: Editor,
    view: MarkdownView
): Promise<void> {
    const file = view.file;
    if (!file) {
        new Notice(t('No active file'));
        return;
    }

    const selected = editor.getSelection().trim();
    if (!selected) {
        new Notice(t('Select text or place cursor in a highlight first'));
        return;
    }

    // Find the highlight match for the selected text in the current note.
    const content = editor.getValue();
    const highlight = findHighlightForSelection(content, selected, editor.getCursor('from').ch);
    if (!highlight) {
        new Notice(t('No matching highlight found for the selection'));
        return;
    }

    // Prompt for comment text using a simple modal (fallback: prompt()).
    // A proper modal would be wired via CommentInput — this provides a minimal
    // keyboard-accessible entry point (R15).
    const commentText = await promptForComment(plugin);
    if (commentText === null) return; // cancelled

    const writer = new InlineCommentWriter(plugin.app);
    const now = Date.now();
    const timestamp = formatTimestamp(now);
    const result = await writer.addComment(file, highlight, commentText, timestamp);

    if (!result.success) {
        new Notice(t('Failed to add comment: ') + (result.reason ?? ''));
        return;
    }

    new Notice(t('Comment added'));
}

function findHighlightForSelection(
    content: string,
    selectedText: string,
    _cursorOffset: number
): { text: string; position: number; originalLength: number } | null {
    // Match ==selectedText==, <mark>selectedText</mark>, or <span>selectedText</span>
    const escaped = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
        new RegExp(`==(${escaped})==`),
        new RegExp(`<mark[^>]*>(${escaped})<\/mark>`),
        new RegExp(`<span[^>]*>(${escaped})<\/span>`),
    ];

    for (const pattern of patterns) {
        const m = content.match(pattern);
        if (m && m.index !== undefined) {
            return {
                text: selectedText,
                position: m.index,
                originalLength: m[0].length,
            };
        }
    }
    return null;
}

async function promptForComment(_plugin: HiNotePluginContext): Promise<string | null> {
    // Native browser prompt as a lightweight fallback.
    // A full CommentInput modal integration can replace this in a follow-up.
    const result = window.prompt(t('Enter comment text'));
    if (result === null) return null;
    return result.trim() || null;
}

function formatTimestamp(ms: number): string {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
