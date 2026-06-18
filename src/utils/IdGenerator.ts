/**
 * 통합 ID 생성 유틸리티 클래스
 * 동일한 내용에 대해 항상 동일한 ID가 생성되도록 하여 중복 및 불일치를 방지
 */
export class IdGenerator {
    /**
     * 하이라이트 ID 생성
     * 파일 경로, 위치, 텍스트 내용을 기반으로 안정적인 ID 생성
     * @param filePath 파일 경로
     * @param position 위치
     * @param text 하이라이트 텍스트
     * @returns 안정적인 하이라이트 ID
     */
    static generateHighlightId(filePath: string, position: number, text: string): string {
        // 파일 경로, 위치, 텍스트 내용을 사용하여 안정적인 해시 생성
        const content = `${filePath}:${position}:${text}`;
        const hash = this.hashCode(content);
        return `highlight-${Math.abs(hash)}-${position}`;
    }

    /**
     * 댓글 ID 생성
     * @returns 고유한 댓글 ID
     */
    static generateCommentId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2, 11);
        return `comment-${timestamp}-${random}`;
    }

    /**
     * 플래시카드 ID 생성
     * @returns 고유한 플래시카드 ID
     */
    static generateCardId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2, 11);
        return `card-${timestamp}-${random}`;
    }

    /**
     * 그룹 ID 생성
     * @returns 고유한 그룹 ID
     */
    static generateGroupId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2, 9);
        return `group-${timestamp}-${random}`;
    }

    /**
     * 간단한 문자열 해시 함수
     * @param str 해시할 문자열
     * @returns 해시값
     */
    private static hashCode(str: string): number {
        let hash = 0;
        if (str.length === 0) return hash;
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32비트 정수로 변환
        }
        
        return hash;
    }

    /**
     * 유효한 하이라이트 ID 형식인지 확인
     * @param id 확인할 ID
     * @returns 유효한 형식 여부
     */
    static isValidHighlightId(id: string): boolean {
        return /^highlight-\d+-\d+$/.test(id);
    }

    /**
     * 유효한 댓글 ID 형식인지 확인
     * @param id 확인할 ID
     * @returns 유효한 형식 여부
     */
    static isValidCommentId(id: string): boolean {
        return /^comment-\d+-[a-z0-9]+$/.test(id);
    }

    /**
     * 유효한 플래시카드 ID 형식인지 확인
     * @param id 확인할 ID
     * @returns 유효한 형식 여부
     */
    static isValidCardId(id: string): boolean {
        return /^card-\d+-[a-z0-9]+$/.test(id);
    }

    /**
     * 하이라이트 ID에서 위치 정보 추출
     * @param highlightId 하이라이트 ID
     * @returns 위치 정보, 추출 불가 시 null 반환
     */
    static extractPositionFromHighlightId(highlightId: string): number | null {
        const match = highlightId.match(/^highlight-\d+-(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
    }
}
