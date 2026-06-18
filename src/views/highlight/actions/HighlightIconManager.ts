import { setIcon } from 'obsidian';

/**
 * 하이라이트 아이콘 매니저
 * 하이라이트 카드의 아이콘 상태 관리 담당
 */
export class HighlightIconManager {
    // 아이콘 상수
    private static readonly ICONS = {
        FLASHCARD: 'book-heart',
        FILE: 'file-text',
        HIGHLIGHT: 'highlighter',
        MESSAGE: 'message-circle'
    } as const;
    
    /**
     * 카드 아이콘 상태 업데이트
     * @param cardElement 카드 요소
     * @param hasFlashcard 플래시카드 보유 여부
     */
    static updateCardIcons(cardElement: HTMLElement, hasFlashcard: boolean): void {
        const fileIcons = cardElement.querySelectorAll('.highlight-card-icon');
        const iconName = hasFlashcard ? this.ICONS.FLASHCARD : this.ICONS.FILE;
        
        fileIcons.forEach(icon => {
            setIcon(icon as HTMLElement, iconName);
            if (hasFlashcard) {
                (icon as HTMLElement).addClass('has-flashcard');
            } else {
                (icon as HTMLElement).removeClass('has-flashcard');
            }
        });
    }
    
    /**
     * 파일 아이콘 설정
     * @param iconElement 아이콘 요소
     * @param hasFlashcard 플래시카드 보유 여부
     */
    static setFileIcon(iconElement: HTMLElement, hasFlashcard: boolean): void {
        const iconName = hasFlashcard ? this.ICONS.FLASHCARD : this.ICONS.FILE;
        setIcon(iconElement, iconName);
        
        if (hasFlashcard) {
            iconElement.addClass('has-flashcard');
        } else {
            iconElement.removeClass('has-flashcard');
        }
    }
    
    /**
     * 하이라이트 아이콘 설정
     * @param iconElement 아이콘 요소
     * @param hasFlashcard 플래시카드 보유 여부
     */
    static setHighlightIcon(iconElement: HTMLElement, hasFlashcard: boolean): void {
        const iconName = hasFlashcard ? this.ICONS.FLASHCARD : this.ICONS.HIGHLIGHT;
        setIcon(iconElement, iconName);
        
        if (hasFlashcard) {
            iconElement.addClass('has-flashcard');
        } else {
            iconElement.removeClass('has-flashcard');
        }
    }
    
    /**
     * 아이콘 이름 가져오기
     */
    static getIconName(type: 'flashcard' | 'file' | 'highlight' | 'message'): string {
        switch (type) {
            case 'flashcard':
                return this.ICONS.FLASHCARD;
            case 'file':
                return this.ICONS.FILE;
            case 'highlight':
                return this.ICONS.HIGHLIGHT;
            case 'message':
                return this.ICONS.MESSAGE;
            default:
                return this.ICONS.FILE;
        }
    }
}
