import { FlashcardProgress, FlashcardState } from "../../types/FSRSTypes";
import { t } from "../../../i18n";
import { setIcon } from "obsidian";
import type { FlashcardComponentContext } from "../FlashcardComponentContext";
import {
    calculateFlashcardProgress,
    calculateIndexProgress,
    calculateProgressPercent,
    calculateRetention,
    getCardsForProgress
} from "./FlashcardProgressStats";

/**
 * 플래시카드 진도 매니저, 진도 통계 및 표시 처리 담당
 */
export class FlashcardProgressManager {
    private component: FlashcardComponentContext;
    
    constructor(component: FlashcardComponentContext) {
        this.component = component;
    }
    
    /**
     * 그룹 진도 가져오기
     * @returns 그룹 진도 정보
     */
    public getGroupProgress(): FlashcardProgress {
        const groupId = this.component.getCurrentGroupId();
        const fsrsManager = this.component.getFsrsManager();
        const cards = getCardsForProgress(fsrsManager, groupId);

        return calculateFlashcardProgress(cards, fsrsManager);
    }
    
    /**
     * 기억 유지율 계산
     * @param cards 카드 목록
     * @returns 기억 유지율
     */
    public calculateRetention(cards: FlashcardState[]) {
        return calculateRetention(cards);
    }
    
    /**
     * 진도 표시 업데이트
     */
    public updateProgress() {
        const progressContainer = this.component.getProgressContainer();
        if (!progressContainer) return;

        progressContainer.empty();

        // 진도 데이터 가져오기
        const progress = this.getGroupProgress();

        // 진도 텍스트 컨테이너 생성
        const progressText = progressContainer.createEl("div", { cls: "flashcard-progress-text" });

        // 그룹 이름 추가
        progressText.createSpan({
            text: this.component.getCurrentGroupName() || t('Groups'),
            cls: "group-name"
        });

        // 구분자 추가
        progressText.createSpan({
            text: "|",
            cls: "separator"
        });

        // 통계 정보 추가
        const stats = [
            { label: t('Due'), value: progress.due },
            { label: t('New'), value: progress.newCards },
            { label: t('Learned'), value: progress.learned },
            { label: t('Retention'), value: `${(progress.retention * 100).toFixed(1)}%` }
        ];

        stats.forEach((stat, index) => {
            // 구분자 추가
            if (index > 0) {
                progressText.createSpan({
                    text: "|",
                    cls: "separator"
                });
            }

            const statEl = progressText.createEl("div", { cls: "stat" });
            statEl.createSpan({ text: stat.label + ": " });
            statEl.createSpan({ 
                text: stat.value.toString(),
                cls: "stat-value"
            });
            
            // Retention에 물음표 아이콘 및 툴팁 추가
            if (stat.label === t('Retention')) {
                const helpIcon = statEl.createSpan({ cls: "help-icon" });
                setIcon(helpIcon, "help-circle");
                helpIcon.setAttribute("aria-label", 
                    t('Retention = (Total Reviews - Forget Count) / Total Reviews\n' +
                    'This metric reflects your learning effectiveness, higher means better memory retention')
                );
            }
        });
        
        // 진도 바 컨테이너 생성
        const progressBarContainer = progressContainer.createEl('div', { cls: 'flashcard-progress-bar-container' });

        // 진도 바 생성
        const progressBar = progressBarContainer.createEl('div', { cls: 'flashcard-progress-bar' });
        
        const percent = calculateProgressPercent(progress, this.component.getCards().length);
        
        // 진도 바 너비 설정
        progressBar.setCssProps({ width: `${percent}%` });

        // 현재 카드 인덱스 정보 추가
        const indexContainer = progressContainer.createEl('div', { cls: 'flashcard-index-container' });

        // 현재 그룹 ID 가져오기
        const groupId = this.component.getCurrentGroupId();
        
        const remainingCards = this.component.getCards().length;
        const indexProgress = calculateIndexProgress(
            this.component.getFsrsManager(),
            groupId,
            remainingCards
        );
        indexContainer.textContent = `${indexProgress.current}/${indexProgress.total}`;
    }
    
}
