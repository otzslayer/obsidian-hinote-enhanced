import { TFile, Notice } from 'obsidian';
import { HighlightInfo } from '../../../types/highlight';
import { HighlightRegexUtils } from '../../../utils/HighlightRegexUtils';
import CommentPlugin from '../../../../main';
import { t } from '../../../i18n';
import type { PluginSettings } from '../../../types/settings';
import { showConfirmModal } from '../../../utils/ConfirmModal';

type LegacyHighlightSettings = PluginSettings & {
    customHighlightRegex?: string;
};

/**
 * 하이라이트 삭제 매니저
 * 파일 조작 및 형식 제거를 포함한 하이라이트 삭제 로직 담당
 */
export class HighlightDeletionManager {
    private plugin: CommentPlugin;
    
    constructor(plugin: CommentPlugin) {
        this.plugin = plugin;
    }
    
    /**
     * 하이라이트 삭제 (파일의 형식 및 저장된 데이터 포함)
     * @param highlight 하이라이트 정보
     * @param skipConfirmation 확인 다이얼로그 건너뛰기 여부
     * @param skipNotice 성공 알림 건너뛰기 여부
     * @returns 삭제 성공 여부
     */
    async deleteHighlight(
        highlight: HighlightInfo,
        skipConfirmation: boolean = false,
        skipNotice: boolean = false
    ): Promise<boolean> {
        try {
            // 확인 다이얼로그 표시
            if (!skipConfirmation) {
                const confirmDelete = await showConfirmModal(this.plugin.app, {
                    title: t('Delete highlight'),
                    message: t('Delete this highlight and all its data, including Comments and HiCards? Can\'t undo.')
                });
                if (!confirmDelete) {
                    return false;
                }
            }
            
            // 파일의 하이라이트 형식 삭제
            if (highlight.filePath) {
                await this.removeHighlightFromFile(highlight);

                // HighlightManager에서 하이라이트 삭제
                const file = this.plugin.app.vault.getAbstractFileByPath(highlight.filePath);
                if (file instanceof TFile) {
                    await this.plugin.highlightManager.removeHighlight(file, highlight);
                }

                // 하이라이트 삭제 이벤트 발생
                this.plugin.eventManager.emitHighlightDelete(
                    highlight.filePath,
                    highlight.text || '',
                    highlight.id || ''
                );
            }
            
            if (!skipNotice) {
                new Notice(t('Highlight deleted successfully'));
            }
            
            return true;
        } catch (error) {
            console.error('하이라이트 삭제 중 오류:', error);
            if (!skipNotice) {
                new Notice(t(`Failed to delete highlight: ${error.message}`));
            }
            return false;
        }
    }
    
    /**
     * 파일에서 하이라이트 형식 제거
     * @param highlight 하이라이트 정보
     */
    private async removeHighlightFromFile(highlight: HighlightInfo): Promise<void> {
        if (!highlight.filePath) return;

        const file = this.plugin.app.vault.getAbstractFileByPath(highlight.filePath);
        if (!(file instanceof TFile)) return;

        const highlightText = highlight.text;

        // 커스텀 정규식 가져오기 (있는 경우)
        const customRegex = (this.plugin.settings as LegacyHighlightSettings).customHighlightRegex;

        // vault.process()로 파일 내용을 원자적으로 수정
        // 열린 에디터 뷰를 올바르게 동기화하며 에디터 상태 리셋 또는 포커스 손실을 방지
        await this.plugin.app.vault.process(file, (fileContent) => {
            if (typeof highlight.position === 'number') {
                const endPos = highlight.position + (highlight.originalLength || highlightText.length);
                return HighlightRegexUtils.removeHighlightFormatInRange(
                    fileContent,
                    highlightText,
                    highlight.position,
                    endPos,
                    customRegex
                );
            } else {
                return HighlightRegexUtils.removeHighlightFormat(
                    fileContent,
                    highlightText,
                    customRegex
                );
            }
        });
    }
    
    /**
     * 하이라이트 완전 삭제 (주석이 없을 때 사용)
     * @param highlight 하이라이트 정보
     */
    async deleteHighlightCompletely(highlight: HighlightInfo): Promise<void> {
        try {
            if (highlight.filePath) {
                const file = this.plugin.app.vault.getAbstractFileByPath(highlight.filePath);
                if (file instanceof TFile) {
                    // HighlightManager에서 하이라이트 삭제
                    await this.plugin.highlightManager.removeHighlight(file, highlight);

                    // 하이라이트 삭제 이벤트 발생
                    this.plugin.eventManager.emitHighlightDelete(
                        highlight.filePath,
                        highlight.text || '',
                        highlight.id || ''
                    );
                }
            }
        } catch (error) {
            console.error('하이라이트 완전 삭제 중 오류:', error);
            throw error;
        }
    }
}
