import { Modal } from 'obsidian';
import type CommentPlugin from '../../../main';
import { t } from '../../i18n';
import { computeHighlightStats, HighlightStats, NoteRankEntry } from '../../services/stats/HighlightStatsService';

export class HighlightStatsModal extends Modal {
    constructor(private plugin: CommentPlugin) {
        super(plugin.app);
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText(t('Highlight dashboard'));

        const loading = contentEl.createEl('p', { text: t('Loading...') });

        let stats: HighlightStats;
        try {
            const raw = await this.plugin.highlightService.getAllHighlights();
            const files = raw.map(({ file, highlights }) => ({
                filePath: file.path,
                fileName: file.basename,
                highlights,
            }));
            stats = computeHighlightStats(files);
        } catch (err) {
            contentEl.createEl('p', { text: t('Failed to load stats'), cls: 'hinote-stats-error' });
            console.error('[HiNote] Stats load failed', err);
            return;
        } finally {
            loading.remove();
        }

        if (stats.totalHighlights === 0 && stats.totalComments === 0) {
            contentEl.createEl('p', { text: t('No data to display'), cls: 'hinote-stats-empty' });
            return;
        }

        this.renderSummaryCards(contentEl, stats);
        this.renderRankingSection(contentEl, t('Top notes by highlights'), stats.topByHighlights);
        this.renderRankingSection(contentEl, t('Top notes by comments'), stats.topByComments);
    }

    private renderSummaryCards(container: HTMLElement, stats: HighlightStats): void {
        const grid = container.createEl('div', { cls: 'hinote-stats-grid' });
        this.renderCard(grid, t('Total highlights'), String(stats.totalHighlights));
        this.renderCard(grid, t('Total comments'), String(stats.totalComments));
        this.renderCard(grid, t('Notes with highlights'), String(stats.notesWithHighlights));
    }

    private renderCard(container: HTMLElement, label: string, value: string): void {
        const card = container.createEl('div', { cls: 'hinote-stats-card' });
        card.createEl('div', { cls: 'hinote-stats-card-value', text: value });
        card.createEl('div', { cls: 'hinote-stats-card-label', text: label });
    }

    private renderRankingSection(container: HTMLElement, title: string, entries: NoteRankEntry[]): void {
        container.createEl('h4', { text: title, cls: 'hinote-stats-section-title' });

        if (entries.length === 0) {
            container.createEl('p', { text: t('No data to display'), cls: 'hinote-stats-empty' });
            return;
        }

        const list = container.createEl('ol', { cls: 'hinote-stats-ranking' });
        for (const entry of entries) {
            const item = list.createEl('li', { cls: 'hinote-stats-ranking-item' });
            const nameEl = item.createEl('span', { text: entry.fileName, cls: 'hinote-stats-ranking-name' });
            item.createEl('span', { text: String(entry.count), cls: 'hinote-stats-ranking-count' });
            nameEl.addEventListener('click', () => {
                const file = this.app.vault.getFileByPath(entry.filePath);
                if (file) {
                    void this.app.workspace.getLeaf(false).openFile(file);
                }
                this.close();
            });
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
