import { Setting, Notice } from 'obsidian';
import { t } from '../../i18n';
import { RegexRuleEditor } from '../components/RegexRuleEditor';
import type CommentPlugin from '../../../main';

export class GeneralSettingsTab {
    private plugin: CommentPlugin;
    private containerEl: HTMLElement;

    constructor(plugin: CommentPlugin, containerEl: HTMLElement) {
        this.plugin = plugin;
        this.containerEl = containerEl;
    }
    
    /**
     * 스타일 추가
     */
    // 스타일은 전역 styles.css 파일로 이동됨

    /**
     * 고아 데이터 수 업데이트
     */
    private async updateOrphanedDataCount(descEl: HTMLElement) {
        try {
            // 기존 카운트 요소 제거
            const existingCount = descEl.querySelector('.orphaned-data-count, .no-orphaned-data');
            if (existingCount) {
                existingCount.remove();
            }
            
            // 고아 데이터 수 가져오기
            const stats = await this.plugin.highlightManager.checkOrphanedDataCount();
            
            // 새 카운트 요소 생성
            const countEl = activeDocument.createElement('div');
            
            if (stats.orphanedHighlights > 0) {
                countEl.className = 'orphaned-data-count';
                countEl.textContent = `Found ${stats.orphanedHighlights} orphaned highlights in ${stats.affectedFiles} files.`;
            } else {
                countEl.className = 'no-orphaned-data';
                countEl.textContent = 'No orphaned data found.';
            }
            
            // 설명 요소에 추가
            descEl.appendChild(countEl);
        } catch (error) {
            console.error('[HiNote] Error updating orphaned data count:', error);
        }
    }

    display(): void {
        const container = this.containerEl.createEl('div', {
            cls: 'general-settings-container'
        });
        
        // 스타일은 전역 styles.css 파일로 이동됨

        // 내보내기 경로 설정
        new Setting(container)
            .setName(t('Export Path'))
            .setDesc(t('Set the path for exported highlight notes. Leave empty to use vault root. The path should be relative to your vault root.'))
            .addText(text => text
                .setPlaceholder('Example: folder 1/folder 2')
                .setValue(this.plugin.settings.export.exportPath || '')
                .onChange(async (value) => {
                    // 앞부분 슬래시 제거
                    value = value.replace(/^\/+/, '');
                    // 끝부분 슬래시 제거
                    value = value.replace(/\/+$/, '');
                    
                    this.plugin.settings.export.exportPath = value;
                    await this.plugin.saveSettings();
                }));
                
        // 제외 설정
        new Setting(container)
            .setName(t('Exclusions'))
            .setDesc(t('Comma separated list of paths, tags, note titles or file extensions that will be excluded from highlighting. e.g. folder1, folder1/folder2, [[note1]], [[note2]], *.excalidraw.md'))
            .addTextArea(text => {
                text
                    .setPlaceholder('folder1, folder1/folder2, [[note1]], [[note2]], *.excalidraw.md')
                    .setValue(this.plugin.settings.excludePatterns || '')
                    .onChange(async (value) => {
                        this.plugin.settings.excludePatterns = value;
                        await this.plugin.saveSettings();
                    });
                    
                text.inputEl.rows = 4;
                text.inputEl.cols = 40;
            });

        // 내보내기 템플릿 설정
        new Setting(container)
            .setName(t('Export template'))
            .setDesc(t('Customize the format of exported highlights and comments using variables. Available variables: {{highlightText}}, {{highlightBlockRef}}, {{commentContent}}, {{commentDate}}. Leave empty to use default template.'))
            .addTextArea(text => {
                const defaultTemplate = 
`> [!quote] HiNote
> {{highlightText}}
> 
>> [!note]+ {{commentDate}}
>> {{commentContent}}`;
                
                text
                    .setPlaceholder(defaultTemplate)
                    .setValue(this.plugin.settings.export.exportTemplate || '')
                    .onChange(async (value) => {
                        // 사용자가 모든 내용을 삭제하면 빈 문자열 저장 (기본 템플릿 사용을 의미)
                        this.plugin.settings.export.exportTemplate = value;
                        await this.plugin.saveSettings();
                    });
                    
                text.inputEl.rows = 5;
                text.inputEl.cols = 40;
            });

        // 위젯 표시 설정
        new Setting(container)
            .setName(t('Show Comment Widget'))
            .setDesc(t('Show or hide the comment widget next to highlights. Disabling this can reduce visual clutter while reading.'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showCommentWidget ?? true)
                .onChange(async (value) => {
                    this.plugin.settings.showCommentWidget = value;
                    await this.plugin.saveSettings();
                    // 하이라이트 데코레이터 새로고침하여 변경 사항 즉시 적용
                    if (this.plugin.highlightDecorator) {
                        this.plugin.highlightDecorator.refreshDecorations();
                    }
                }));

        // 하이라이트 추출 설정 그룹
        new Setting(container)
            .setName(t('Custom text extraction'))
            .setHeading();

        // 커스텀 정규식 활성화 토글
        new Setting(container)
            .setName(t('Use custom rules'))
            .setDesc(t('Enable to use custom regex rules to extract highlight text.'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useCustomPattern)
                .onChange(async (value) => {
                    this.plugin.settings.useCustomPattern = value;
                    await this.plugin.saveSettings();
                }));

        // 정규식 규칙 편집기 추가
        const regexEditorContainer = container.createDiv({ cls: 'regex-editor-container' });
        new RegexRuleEditor(regexEditorContainer, this.plugin);
                
        // 데이터 관리 설정 그룹
        new Setting(container)
            .setName(t('Data management'))
            .setHeading();
            
        // 고아 데이터 확인/정리 버튼
        const orphanedDataSetting = new Setting(container)
            .setName(t('Clean orphaned data'))
            .setDesc(t('Remove highlights and comments that no longer exist in your documents. This is useful if you have deleted highlights but their comments are still stored in the data file.'));

        let orphanedCount = 0;
        let affectedFiles = 0;
        orphanedDataSetting.addButton(button => {
            button.setButtonText(t('Check'));
            button.onClick(async () => {
                button.setButtonText(t('Checking...'));
                button.setDisabled(true);
                try {
                    // 고아 데이터 수 확인
                    const stats = await this.plugin.highlightManager.checkOrphanedDataCount();
                    orphanedCount = stats.orphanedHighlights;
                    affectedFiles = stats.affectedFiles;
                    // 설명 업데이트
                    const descEl = orphanedDataSetting.descEl;
                    // 기존 카운트 요소 제거
                    const existingCount = descEl.querySelector('.orphaned-data-count, .no-orphaned-data');
                    if (existingCount) existingCount.remove();
                    const countEl = activeDocument.createElement('div');
                    if (orphanedCount > 0) {
                        countEl.className = 'orphaned-data-count';
                        countEl.textContent = `Found ${orphanedCount} orphaned highlights in ${affectedFiles} files.`;
                        button.setButtonText(t('Clean data'));
                        button.setDisabled(false);
                        // 정리 모드로 전환
                        button.onClick(async () => {
                            button.setButtonText(t('Cleaning...'));
                            button.setDisabled(true);
                            try {
                                const result = await this.plugin.highlightManager.cleanOrphanedData();
                                if (result.removedHighlights > 0) {
                                    new Notice(`Cleaned ${result.removedHighlights} orphaned highlights from ${result.affectedFiles} files.`);
                                } else {
                                    new Notice('No orphaned data found.');
                                }
                                // 정리 후 버튼 및 설명 초기화
                                button.setButtonText(t('Check'));
                                // 카운트 요소 제거
                                if (countEl && countEl.parentElement) countEl.parentElement.removeChild(countEl);
                            } catch (error) {
                                console.error('[HiNote] Error cleaning orphaned data:', error);
                                new Notice('Error cleaning orphaned data. Check console for details.');
                                button.setButtonText(t('Check'));
                            } finally {
                                button.setDisabled(false);
                            }
                        });
                    } else {
                        countEl.className = 'no-orphaned-data';
                        countEl.textContent = 'No orphaned data found.';
                        button.setButtonText(t('Check'));
                        button.setDisabled(false);
                    }
                    descEl.appendChild(countEl);
                } catch (error) {
                    console.error('[HiNote] Error checking orphaned data:', error);
                    new Notice('Error checking orphaned data. Check console for details.');
                    button.setButtonText(t('Check'));
                    button.setDisabled(false);
                }
            });
        });

    }
}
