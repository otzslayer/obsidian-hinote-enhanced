/**
 * 하이라이트 정규식 유틸리티 클래스
 * 하이라이트 형식의 정규식 매칭 및 대체 기능 제공
 */
export class HighlightRegexUtils {
    /**
     * 정규식의 특수 문자 이스케이프
     */
    static escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    /**
     * 텍스트에서 하이라이트 형식을 제거하고 순수 텍스트만 남김
     * @param content 파일 내용
     * @param highlightText 형식을 제거할 하이라이트 텍스트
     * @param customRegex 사용자 정의 정규식 (선택 사항)
     * @returns 형식이 제거된 내용
     */
    static removeHighlightFormat(
        content: string,
        highlightText: string,
        customRegex?: string
    ): string {
        const escapedText = this.escapeRegExp(highlightText);
        let newContent = content;
        let replaced = false;
        
        // 1. 표준 Markdown 하이라이트 형식 ==text== 시도
        const markdownHighlightRegex = new RegExp(`==\\s*(${escapedText})\\s*==`, 'g');
        const mdResult = newContent.replace(markdownHighlightRegex, highlightText);
        if (mdResult !== newContent) {
            newContent = mdResult;
            replaced = true;
        }
        
        // 2. <mark>text</mark> 형식 시도
        if (!replaced) {
            const markTagRegex = new RegExp(`<mark[^>]*>(${escapedText})</mark>`, 'g');
            const markResult = newContent.replace(markTagRegex, highlightText);
            if (markResult !== newContent) {
                newContent = markResult;
                replaced = true;
            }
        }
        
        // 3. <span>text</span> 형식 시도
        if (!replaced) {
            const spanTagRegex = new RegExp(`<span[^>]*>(${escapedText})</span>`, 'g');
            const spanResult = newContent.replace(spanTagRegex, highlightText);
            if (spanResult !== newContent) {
                newContent = spanResult;
                replaced = true;
            }
        }
        
        // 4. 사용자 정의 정규식이 제공된 경우 시도
        if (!replaced && customRegex) {
            try {
                const customRegexObj = new RegExp(customRegex, 'g');
                const customResult = newContent.replace(customRegexObj, (match, ...groups) => {
                    // 매칭된 텍스트가 찾으려는 하이라이트 텍스트를 포함하는지 확인
                    for (const group of groups) {
                        if (typeof group === 'string' && group.includes(highlightText)) {
                            return highlightText;
                        }
                    }
                    return match; // 매칭되는 그룹이 없으면 원본 유지
                });
                
                if (customResult !== newContent) {
                    newContent = customResult;
                    replaced = true;
                }
            } catch (error) {
                console.error('사용자 정의 정규식 오류:', error);
            }
        }
        
        return newContent;
    }
    
    /**
     * 지정된 범위 내에서 하이라이트 형식 제거
     * @param content 파일 내용
     * @param highlightText 형식을 제거할 하이라이트 텍스트
     * @param startPos 시작 위치
     * @param endPos 종료 위치
     * @param customRegex 사용자 정의 정규식 (선택 사항)
     * @returns 형식이 제거된 내용
     */
    static removeHighlightFormatInRange(
        content: string,
        highlightText: string,
        startPos: number,
        endPos: number,
        customRegex?: string
    ): string {
        // 검색 범위 정의 (앞뒤로 각 100자 확장)
        const searchStart = Math.max(0, startPos - 100);
        const searchEnd = Math.min(content.length, endPos + 100);
        const searchRange = content.substring(searchStart, searchEnd);
        
        // 검색 범위 내에서 하이라이트 형식 제거
        const processedRange = this.removeHighlightFormat(searchRange, highlightText, customRegex);
        
        // 변경사항이 있으면 원본 내용 대체
        if (processedRange !== searchRange) {
            return content.substring(0, searchStart) + processedRange + content.substring(searchEnd);
        }
        
        return content;
    }
    
    /**
     * 자주 사용되는 하이라이트 형식 정규식 목록 반환
     */
    static getCommonHighlightPatterns(text: string): RegExp[] {
        const escapedText = this.escapeRegExp(text);
        return [
            new RegExp(`==\\s*(${escapedText})\\s*==`, 'g'),      // ==text==
            new RegExp(`<mark[^>]*>(${escapedText})</mark>`, 'g'), // <mark>text</mark>
            new RegExp(`<span[^>]*>(${escapedText})</span>`, 'g')  // <span>text</span>
        ];
    }
}
