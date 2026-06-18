import { App, TFile } from "obsidian";
import { HighlightExtractor } from './HighlightExtractor';

/**
 * 하이라이트 일괄 작업
 * 역할:
 * 1. 하이라이트 마크 일괄 삭제 (파일에서 하이라이트 형식 제거)
 * 2. 내용에서 단일 하이라이트 마크 제거
 */
export class HighlightBatchOps {
    // 일괄 삭제 관련 상수
    private static readonly POSITION_SEARCH_OFFSET_BEFORE = 10; // 위치 검색 앞 오프셋
    private static readonly POSITION_SEARCH_OFFSET_AFTER = 50; // 위치 검색 뒤 오프셋

    constructor(
        private app: App,
        private extractor: HighlightExtractor
    ) {}

    /**
     * 하이라이트 마크를 일괄 삭제합니다 (파일에서 하이라이트 형식 제거)
     * 이 메서드는 여러 하이라이트 삭제를 한 번에 처리하여 파일 읽기/쓰기를 줄입니다
     *
     * @param highlights 삭제할 하이라이트 배열
     * @returns Promise<{ success: number, failed: number }> 성공 및 실패 수
     */
    public async batchRemoveHighlightMarks(highlights: Array<{ text: string; position?: number; filePath: string; originalLength?: number }>): Promise<{ success: number; failed: number }> {
        let successCount = 0;
        let failedCount = 0;
        
        // 파일별로 그룹화합니다
        const highlightsByFile = new Map<string, typeof highlights>();
        for (const highlight of highlights) {
            if (!highlightsByFile.has(highlight.filePath)) {
                highlightsByFile.set(highlight.filePath, []);
            }
            highlightsByFile.get(highlight.filePath)!.push(highlight);
        }
        
        // 각 파일의 모든 하이라이트를 처리합니다
        for (const [filePath, fileHighlights] of highlightsByFile) {
            try {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (!file || !(file instanceof TFile)) {
                    failedCount += fileHighlights.length;
                    continue;
                }
                
                // 위치 기준으로 뒤에서 앞 순서로 정렬하여 삭제 시 앞쪽 하이라이트 위치에 영향을 주지 않습니다
                const sortedHighlights = [...fileHighlights].sort((a, b) => {
                    const posA = a.position ?? Infinity;
                    const posB = b.position ?? Infinity;
                    return posB - posA; // 내림차순
                });
                
                // vault.process()를 사용하여 파일 내용을 원자적으로 수정합니다
                // 이미 열려 있는 에디터 뷰를 올바르게 동기화하여 에디터 상태 초기화나 포커스 손실이 발생하지 않습니다
                await this.app.vault.process(file, (content) => {
                    // 각 하이라이트를 순서대로 삭제합니다 (뒤에서 앞으로)
                    for (const highlight of sortedHighlights) {
                        try {
                            content = this.removeHighlightMarkFromContent(content, highlight);
                            successCount++;
                        } catch {
                            failedCount++;
                        }
                    }
                    return content;
                });
                
            } catch {
                failedCount += fileHighlights.length;
            }
        }
        
        return { success: successCount, failed: failedCount };
    }
    
    /**
     * 내용에서 단일 하이라이트 마크를 제거합니다
     *
     * @param content 파일 내용
     * @param highlight 하이라이트 정보
     * @returns 하이라이트가 제거된 내용
     */
    private removeHighlightMarkFromContent(
        content: string, 
        highlight: { text: string; position?: number; originalLength?: number }
    ): string {
        const escapedText = this.extractor.escapeRegExp(highlight.text);
        
        // 위치 정보가 있으면 정확한 위치를 찾으려 시도합니다
        if (typeof highlight.position === 'number') {
            const position = highlight.position;
            const highlightText = highlight.text;
            
            // 여러 하이라이트 형식을 시도합니다
            const possibleFormats = [
                `==${highlightText}==`,
                `== ${highlightText} ==`,
                `<mark>${highlightText}</mark>`,
                `<span class="highlight">${highlightText}</span>`
            ];
            
            // 위치 근처에서 일치 항목을 찾습니다
            for (const format of possibleFormats) {
                const startPos = Math.max(0, position - HighlightBatchOps.POSITION_SEARCH_OFFSET_BEFORE);
                const endPos = Math.min(content.length, position + highlightText.length + HighlightBatchOps.POSITION_SEARCH_OFFSET_AFTER);
                const searchRange = content.substring(startPos, endPos);
                
                if (searchRange.includes(format)) {
                    // 일치 항목을 찾아 순수 텍스트로 대체합니다
                    const beforeMatch = content.substring(0, startPos);
                    const afterMatch = content.substring(endPos);
                    const replacedRange = searchRange.replace(format, highlightText);
                    return beforeMatch + replacedRange + afterMatch;
                }
            }
        }
        
        // 위치 정보가 없거나 정확한 위치 찾기에 실패하면 정규식으로 전체 검색합니다
        // 주의: 다른 동일 텍스트를 잘못 삭제하지 않도록 첫 번째 일치만 대체합니다
        const patterns = [
            new RegExp(`==\\s*(${escapedText})\\s*==`),
            new RegExp(`<mark[^>]*>(${escapedText})</mark>`),
            new RegExp(`<span[^>]*class="highlight"[^>]*>(${escapedText})</span>`)
        ];
        
        for (const pattern of patterns) {
            if (pattern.test(content)) {
                return content.replace(pattern, highlight.text);
            }
        }
        
        // 아무것도 찾지 못하면 원본 내용을 반환합니다 (하이라이트가 수동으로 이미 삭제되었을 수 있습니다)
        return content;
    }
}
