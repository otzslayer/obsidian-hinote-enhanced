/**
 * Obsidian adapter for inline comment writes.
 * All write operations: re-parse → anchor-check → patch → vault.modify (KTD3).
 */

import { App, TFile } from 'obsidian';
import type { HighlightInfo } from '../../../types/highlight';
import type { FileLevelComment } from './FrontmatterComments';
import { mergeFileLevelComments, parseFileLevelComments } from './FrontmatterComments';
import {
    insertComment,
    updateComment,
    deleteComment,
    type SerializeTarget,
} from './InlineCommentSerializer';
import type { HighlightMatch } from './InlineCommentParser';

// ── Types ────────────────────────────────────────────────────

export interface WriteResult {
    success: boolean;
    reason?: string;
}

// ── Constants ────────────────────────────────────────────────

const AI_PREFIX = '🤖 ';

// ── InlineCommentWriter ──────────────────────────────────────

export class InlineCommentWriter {
    constructor(private app: App) {}

    // ── Inline comment operations ────────────────────────────

    async addComment(
        file: TFile,
        highlight: HighlightInfo,
        content: string,
        timestamp: string
    ): Promise<WriteResult> {
        const noteText = await this.app.vault.read(file);
        const match = this.toHighlightMatch(highlight);
        const patched = insertComment(noteText, match, content, timestamp);
        await this.app.vault.modify(file, patched);
        return { success: true };
    }

    async updateComment(
        file: TFile,
        highlight: HighlightInfo,
        commentId: string,
        newContent: string,
        timestamp: string
    ): Promise<WriteResult> {
        const noteText = await this.app.vault.read(file);
        const match = this.toHighlightMatch(highlight);

        const target = this.buildTarget(highlight, commentId);
        if (!target) {
            return { success: false, reason: 'anchor: comment id not found in cached highlight' };
        }

        const patched = updateComment(noteText, match, target, newContent, timestamp);

        if (patched === noteText) {
            return { success: false, reason: 'anchor mismatch: note was modified externally' };
        }

        await this.app.vault.modify(file, patched);
        return { success: true };
    }

    async deleteComment(
        file: TFile,
        highlight: HighlightInfo,
        commentId: string
    ): Promise<WriteResult> {
        const noteText = await this.app.vault.read(file);
        const match = this.toHighlightMatch(highlight);

        const target = this.buildTarget(highlight, commentId);
        if (!target) {
            return { success: false, reason: 'anchor: comment id not found in cached highlight' };
        }

        const patched = deleteComment(noteText, match, target);

        if (patched === noteText) {
            return { success: false, reason: 'anchor mismatch: note was modified externally' };
        }

        await this.app.vault.modify(file, patched);
        return { success: true };
    }

    // ── File-level (frontmatter) operations ──────────────────

    async addFileLevelComment(file: TFile, comment: FileLevelComment): Promise<WriteResult> {
        try {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                const existing = Array.isArray(fm.comments) ? fm.comments : [];
                const current = parseFileLevelComments(fm);
                fm.comments = mergeFileLevelComments(existing, [...current, comment]);
            });
            return { success: true };
        } catch (e) {
            return { success: false, reason: e instanceof Error ? e.message : 'write failed' };
        }
    }

    async updateFileLevelCommentAt(
        file: TFile,
        index: number,
        expectedText: string,
        newComment: FileLevelComment
    ): Promise<WriteResult> {
        let ok = false;
        await this.app.fileManager.processFrontMatter(file, (fm) => {
            const existing = Array.isArray(fm.comments) ? fm.comments : [];
            const current = parseFileLevelComments(fm);
            if (current[index]?.text !== expectedText) return;
            const updated = current.map((c, i) => (i === index ? newComment : c));
            fm.comments = mergeFileLevelComments(existing, updated);
            ok = true;
        });
        return ok ? { success: true } : { success: false, reason: 'anchor mismatch' };
    }

    async deleteAllFileLevelComments(file: TFile): Promise<WriteResult> {
        try {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                const existing = Array.isArray(fm.comments) ? fm.comments : [];
                fm.comments = mergeFileLevelComments(existing, []);
            });
            return { success: true };
        } catch (e) {
            return { success: false, reason: e instanceof Error ? e.message : 'write failed' };
        }
    }

    async deleteFileLevelCommentAt(
        file: TFile,
        index: number,
        expectedText: string
    ): Promise<WriteResult> {
        let ok = false;
        await this.app.fileManager.processFrontMatter(file, (fm) => {
            const existing = Array.isArray(fm.comments) ? fm.comments : [];
            const current = parseFileLevelComments(fm);
            if (current[index]?.text !== expectedText) return;
            const filtered = current.filter((_, i) => i !== index);
            fm.comments = mergeFileLevelComments(existing, filtered);
            ok = true;
        });
        return ok ? { success: true } : { success: false, reason: 'anchor mismatch' };
    }

    // ── Helpers ──────────────────────────────────────────────

    private toHighlightMatch(highlight: HighlightInfo): HighlightMatch {
        const start = highlight.position ?? 0;
        const end = start + (highlight.originalLength ?? highlight.text.length + 4);
        return { text: highlight.text, start, end };
    }

    /**
     * Build a SerializeTarget for an existing comment identified by `commentId`.
     * `currentText` is the raw parsed text (AI prefix stripped) so it matches
     * what InlineCommentParser returns for anchor verification.
     */
    private buildTarget(
        highlight: HighlightInfo,
        commentId: string
    ): SerializeTarget | null {
        const comments = highlight.comments ?? [];
        const ordinal = comments.findIndex((c) => c.id === commentId);
        if (ordinal === -1) return null;

        const content = comments[ordinal].content;
        const currentText = content.startsWith(AI_PREFIX)
            ? content.slice(AI_PREFIX.length)
            : content;

        return { highlightText: highlight.text, ordinal, currentText };
    }
}
