/**
 * Obsidian adapter for the one-shot inline comment migration (R12, R13, KTD8).
 *
 * Flow: scan .hinote → dry-run → user confirmation → batch apply → backup preserved.
 * Old .hinote/highlights files are NEVER auto-deleted (R13).
 */

import { App, Modal, Notice, TFile, Plugin } from 'obsidian';
import { HiNoteDataManager } from '../storage/HiNoteDataManager';
import { migrateNoteComments, type MigrationReportEntry } from './InlineMigration';
import type { StoredHighlightData } from './InlineMigration';
import type { FileLevelComment } from '../services/comment/inline/FrontmatterComments';
import { mergeFileLevelComments, parseFileLevelComments } from '../services/comment/inline/FrontmatterComments';
import { t } from '../i18n';

// ── Types ────────────────────────────────────────────────────

interface NotePreview {
    filePath: string;
    file: TFile;
    migratedText: string;
    report: MigrationReportEntry[];
    frontmatterComments: FileLevelComment[];
    storedHighlights: StoredHighlightData[];
}

interface DryRunSummary {
    previews: NotePreview[];
    totalComments: number;
    migratedCount: number;
    ambiguousCount: number;
    notFoundCount: number;
    alreadyInlinedCount: number;
    skippedFiles: string[];   // vault file not found
}

// ── InlineMigrationRunner ────────────────────────────────────

export class InlineMigrationRunner {
    private dataManager: HiNoteDataManager;

    constructor(private app: App) {
        this.dataManager = new HiNoteDataManager(app);
    }

    /** Build a dry-run preview without touching any files. */
    async buildDryRun(): Promise<DryRunSummary> {
        await this.dataManager.initialize();

        const highlightFiles = await this.dataManager.getAllHighlightFiles();
        const previews: NotePreview[] = [];
        const skippedFiles: string[] = [];

        let totalComments = 0;
        let migratedCount = 0;
        let ambiguousCount = 0;
        let notFoundCount = 0;
        let alreadyInlinedCount = 0;

        for (const filePath of highlightFiles) {
            const storedHighlights = await this.dataManager.getFileHighlights(filePath);
            const withComments = storedHighlights.filter(
                (h) => h.comments && h.comments.length > 0
            );
            if (withComments.length === 0) continue;

            const vaultFile = this.app.vault.getAbstractFileByPath(filePath);
            if (!(vaultFile instanceof TFile)) {
                skippedFiles.push(filePath);
                continue;
            }

            const noteText = await this.app.vault.read(vaultFile);

            // Map HighlightInfo → StoredHighlightData
            const stored: StoredHighlightData[] = withComments.map((h) => ({
                text: h.text,
                comments: (h.comments ?? []).map((c) => ({
                    id: c.id,
                    content: c.content,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                })),
            }));

            const result = migrateNoteComments(noteText, stored);

            for (const entry of result.report) {
                totalComments++;
                if (entry.status === 'migrated') migratedCount++;
                else if (entry.status === 'ambiguous') ambiguousCount++;
                else if (entry.status === 'not_found') notFoundCount++;
                else if (entry.status === 'already_inlined') alreadyInlinedCount++;
            }

            if (result.report.some((r) => r.status === 'migrated')) {
                previews.push({
                    filePath,
                    file: vaultFile,
                    migratedText: result.noteText,
                    report: result.report,
                    frontmatterComments: result.frontmatterComments,
                    storedHighlights: stored,
                });
            }
        }

        return {
            previews,
            totalComments,
            migratedCount,
            ambiguousCount,
            notFoundCount,
            alreadyInlinedCount,
            skippedFiles,
        };
    }

    /** Apply the previewed migration to the vault. Old .hinote data is preserved. */
    async applyMigration(summary: DryRunSummary): Promise<void> {
        let applied = 0;
        let failed = 0;

        for (const preview of summary.previews) {
            try {
                // Write migrated note text
                await this.app.vault.modify(preview.file, preview.migratedText);

                // Write frontmatter file-level comments
                if (preview.frontmatterComments.length > 0) {
                    await this.app.fileManager.processFrontMatter(preview.file, (fm) => {
                        const existing = Array.isArray(fm.comments) ? fm.comments : [];
                        const current = parseFileLevelComments(fm);
                        fm.comments = mergeFileLevelComments(existing, [
                            ...current,
                            ...preview.frontmatterComments,
                        ]);
                    });
                }

                applied++;
            } catch (err) {
                console.error(`[HiNote Migration] Failed to apply to ${preview.filePath}:`, err);
                failed++;
            }
        }

        // Old .hinote/highlights is preserved — NOT deleted (R13).
        const msg = failed > 0
            ? `${t('Migration complete')}: ${applied} ${t('notes updated')}, ${failed} ${t('failed')}`
            : `${t('Migration complete')}: ${applied} ${t('notes updated')}. ${t('Old .hinote/highlights preserved as backup.')}`;

        new Notice(msg, 8000);
    }

    /** Register the migration command on the plugin. */
    registerCommand(plugin: Plugin): void {
        plugin.addCommand({
            id: 'run-inline-migration',
            name: t('Migrate comments to inline storage'),
            callback: () => {
                new MigrationModal(this.app, this).open();
            },
        });
    }
}

// ── MigrationModal ───────────────────────────────────────────

class MigrationModal extends Modal {
    constructor(
        app: App,
        private runner: InlineMigrationRunner
    ) {
        super(app);
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: t('Migrate Comments to Inline Storage') });
        contentEl.createEl('p', { text: t('Scanning .hinote/highlights…') });

        let summary: DryRunSummary;
        try {
            summary = await this.runner.buildDryRun();
        } catch (err) {
            contentEl.empty();
            contentEl.createEl('p', { text: `${t('Error scanning data')}: ${String(err)}` });
            return;
        }

        contentEl.empty();
        contentEl.createEl('h2', { text: t('Migrate Comments to Inline Storage') });

        // Summary stats
        const stats = contentEl.createEl('div', { cls: 'hi-note-migration-stats' });
        stats.createEl('p', {
            text: `${t('Notes to update')}: ${summary.previews.length}`,
        });
        stats.createEl('p', {
            text: `${t('Comments ready')}: ${summary.migratedCount}`,
        });
        if (summary.ambiguousCount > 0) {
            stats.createEl('p', {
                text: `⚠ ${t('Ambiguous (will be skipped)')}: ${summary.ambiguousCount}`,
            });
        }
        if (summary.notFoundCount > 0) {
            stats.createEl('p', {
                text: `⚠ ${t('Not found (will be skipped)')}: ${summary.notFoundCount}`,
            });
        }
        if (summary.alreadyInlinedCount > 0) {
            stats.createEl('p', {
                text: `✓ ${t('Already inlined (no action)')}: ${summary.alreadyInlinedCount}`,
            });
        }
        if (summary.skippedFiles.length > 0) {
            stats.createEl('p', {
                text: `✗ ${t('Note files not found in vault')}: ${summary.skippedFiles.length}`,
            });
        }

        contentEl.createEl('p', {
            text: t('Old .hinote/highlights will NOT be deleted — it is preserved as backup.'),
            attr: { style: 'font-style: italic; font-size: 0.9em;' },
        });

        if (summary.previews.length === 0) {
            contentEl.createEl('p', { text: t('Nothing to migrate.') });
            contentEl.createEl('button', { text: t('Close') }).addEventListener('click', () => this.close());
            return;
        }

        // Action buttons
        const btnRow = contentEl.createEl('div', { attr: { style: 'display:flex;gap:8px;margin-top:16px;' } });

        const cancelBtn = btnRow.createEl('button', { text: t('Cancel') });
        cancelBtn.addEventListener('click', () => this.close());

        const applyBtn = btnRow.createEl('button', {
            text: t('Apply Migration'),
            attr: { style: 'font-weight:bold;' },
        });
        applyBtn.addEventListener('click', async () => {
            applyBtn.disabled = true;
            cancelBtn.disabled = true;
            applyBtn.textContent = t('Applying…');
            await this.runner.applyMigration(summary);
            this.close();
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
