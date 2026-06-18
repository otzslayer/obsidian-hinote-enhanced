import { Notice, TFile } from 'obsidian';
import { HighlightInfo } from '../../../types/highlight';
import { HighlightInfo as HiNote } from '../../../types/highlight';
import CommentPlugin from '../../../../main';
import { t } from '../../../i18n';

/**
 * 하이라이트 플래시카드 매니저
 * 하이라이트 관련 플래시카드 생성, 삭제 및 상태 확인 담당
 */
export class HighlightFlashcardManager {
    private plugin: CommentPlugin;
    
    constructor(plugin: CommentPlugin) {
        this.plugin = plugin;
    }
    
    /**
     * 하이라이트에 플래시카드가 생성되었는지 확인
     */
    checkHasFlashcard(highlightId: string): boolean {
        const fsrsManager = this.plugin.fsrsManager;
        if (!fsrsManager || !highlightId) return false;

        // sourceId로 플래시카드 검색
        const cards = fsrsManager.findCardsBySourceId(highlightId, 'highlight');
        return cards && cards.length > 0;
    }
    
    /**
     * 하이라이트에 플래시카드 생성
     * @param highlight 하이라이트 정보
     * @param fileName 파일명 (선택)
     * @param silent 무음 모드 여부 (알림 표시 안 함)
     * @returns 생성 성공 여부
     */
    async createFlashcard(
        highlight: HighlightInfo,
        _fileName?: string,
        silent: boolean = false
    ): Promise<boolean> {
        try {
            const fsrsManager = this.plugin.fsrsManager;
            if (!fsrsManager) {
                if (!silent) new Notice(t('FSRS 관리자가 초기화되지 않았습니다'));
                return false;
            }

            // 하이라이트 ID 확인
            if (!highlight.id) {
                console.warn('하이라이트에 ID가 없습니다. 생성 중...');
                // IdGenerator로 안정적인 ID 생성
                const IdGenerator = (await import('../../../utils/IdGenerator')).IdGenerator;
                highlight.id = IdGenerator.generateHighlightId(
                    highlight.filePath || '',
                    highlight.position || 0,
                    highlight.text
                );
            }
            
            // 하이라이트에 파일 경로가 있으면 먼저 저장소에 저장
            if (highlight.filePath) {
                const file = this.plugin.app.vault.getAbstractFileByPath(highlight.filePath);
                if (file instanceof TFile) {
                    // HiNote 객체 생성
                    const hiNote: HiNote = {
                        id: highlight.id,
                        text: highlight.text,
                        position: highlight.position || 0,
                        paragraphOffset: highlight.paragraphOffset,
                        blockId: highlight.blockId,
                        comments: highlight.comments || [],
                        createdAt: highlight.createdAt || Date.now(),
                        updatedAt: highlight.updatedAt || Date.now(),
                        filePath: highlight.filePath,
                        fileName: highlight.fileName,
                        fileIcon: highlight.fileIcon,
                        backgroundColor: highlight.backgroundColor,
                        originalLength: highlight.originalLength,
                        isVirtual: highlight.isVirtual,
                        isCloze: highlight.isCloze
                    };
                    
                    // HighlightManager에 저장
                    await this.plugin.highlightManager.addHighlight(file, hiNote);
                }
            }
            
            // 플래시카드 내용 구성
            const text = highlight.text;
            const answer = this.buildFlashcardAnswer(highlight);

            // 플래시카드 생성
            const card = fsrsManager.addCard(
                text, 
                answer, 
                highlight.filePath || _fileName,
                highlight.id, 
                'highlight'
            );
            
            if (!card) {
                if (!silent) new Notice(t('Failed to create flashcard, please check highlight content'));
                return false;
            }
            
            // 이벤트 발생, FSRSManager가 저장 처리
            this.plugin.eventManager.emitFlashcardChanged();

            // 무음 모드가 아닌 경우에만 성공 메시지 표시
            if (!silent) {
                new Notice(t('Flashcard created successfully!'));
            }
            
            return true;
        } catch (error) {
            console.error('플래시카드 생성 중 오류:', error);
            if (!silent) new Notice(t(`Failed to create flashcard: ${error.message}`));
            return false;
        }
    }

    private buildFlashcardAnswer(highlight: HighlightInfo): string {
        const answerParts: string[] = [];
        const clozeAnswers = this.extractClozeAnswers(highlight.text);
        const commentContents = (highlight.comments || [])
            .map(comment => comment.content || '')
            .filter(content => content.trim() !== '');

        if (clozeAnswers.length > 0) {
            answerParts.push(clozeAnswers.join('\n'));
        }

        if (commentContents.length > 0) {
            answerParts.push(commentContents.join('\n\n'));
        }

        return answerParts.join('\n\n');
    }

    private extractClozeAnswers(text: string): string[] {
        const answers: string[] = [];
        const clozeRegex = /\{\{([^{}]+)\}\}/g;
        let match: RegExpExecArray | null;

        while ((match = clozeRegex.exec(text)) !== null) {
            answers.push(match[1]);
        }

        return answers;
    }
    
    /**
     * 하이라이트의 플래시카드 삭제
     * @param highlight 하이라이트 정보
     * @param silent 무음 모드 여부 (알림 표시 안 함, 이벤트 미발생)
     * @returns 삭제 결과 { success: boolean, shouldDeleteHighlight: boolean }
     */
    async deleteFlashcard(
        highlight: HighlightInfo,
        silent: boolean = false
    ): Promise<{ success: boolean; shouldDeleteHighlight: boolean }> {
        try {
            const fsrsManager = this.plugin.fsrsManager;
            if (!fsrsManager) {
                if (!silent) new Notice(t('FSRS 관리자가 초기화되지 않았습니다'));
                return { success: false, shouldDeleteHighlight: false };
            }

            // sourceId로 플래시카드 삭제
            const deletedCount = fsrsManager.deleteCardsBySourceId(highlight.id || '', 'highlight');

            if (deletedCount > 0) {
                // 남아있을 수 있는 유효하지 않은 카드 참조 정리
                fsrsManager.cleanupInvalidCardReferences();

                // 댓글 존재 여부 확인 후 하이라이트 삭제 결정
                const hasComments = highlight.comments && highlight.comments.length > 0;
                const shouldDeleteHighlight = !hasComments;

                if (!silent) {
                    if (shouldDeleteHighlight) {
                        new Notice(t('Flashcard and highlight deleted'));
                    } else {
                        new Notice(t('Flashcard deleted, highlight and comments preserved'));
                    }
                }

                // 플래시카드 변경 이벤트 발생 (일괄 삭제 시에는 미발생)
                if (!silent) {
                    this.plugin.eventManager.emitFlashcardChanged();
                }
                
                return { success: true, shouldDeleteHighlight };
            } else {
                if (!silent) new Notice(t('Flashcard not found'));
                return { success: false, shouldDeleteHighlight: false };
            }
        } catch (error) {
            console.error('플래시카드 삭제 중 오류:', error);
            if (!silent) new Notice(t(`Failed to delete flashcard: ${error.message}`));
            return { success: false, shouldDeleteHighlight: false };
        }
    }
}
