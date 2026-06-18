/**
 * 파일 경로 처리 유틸리티 클래스
 */
export class FilePathUtils {
    /**
     * 파일 경로를 안전한 파일명으로 변환
     * @param filePath 원본 파일 경로
     * @returns 안전한 파일명
     */
    static toSafeFileName(filePath: string): string {
        return filePath
            .replace(/[/\\:*?"<>|]/g, '_')  // 특수 문자 대체
            .replace(/\s+/g, '_')           // 공백 대체
            .toLowerCase()                  // 소문자로 변환
            + '.json';
    }

    /**
     * 안전한 파일명에서 원본 경로 복원 (매핑 파일과 함께 사용 필요)
     * @param safeFileName 안전한 파일명
     * @returns 복원된 원본 경로 (근사치)
     */
    static fromSafeFileName(safeFileName: string): string {
        // .json 접미사 제거 후 언더스코어를 공백으로 되돌림
        // 참고: 이는 근사 복원이며 특수 문자를 완전히 복원할 수 없음
        return safeFileName
            .replace(/\.json$/, '')
            .replace(/_/g, ' ');
    }

    /**
     * 파일 경로의 해시값 생성 (대안 방법)
     * @param filePath 파일 경로
     * @returns MD5 해시값
     */
    static generateHash(filePath: string): string {
        let hash = 0;
        for (let i = 0; i < filePath.length; i++) {
            hash = ((hash << 5) - hash) + filePath.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * 파일 경로가 안전한지 검증
     * @param filePath 파일 경로
     * @returns 안전 여부
     */
    static isSafePath(filePath: string): boolean {
        // 위험한 문자 포함 여부 확인
        const dangerousChars = /[/\\:*?"<>|]/;
        return !dangerousChars.test(filePath);
    }

    /**
     * .hinote 디렉토리 경로 반환
     * @param vaultPath Vault 루트 디렉토리 경로
     * @returns .hinote 디렉토리 경로
     */
    static getHiNoteDir(vaultPath: string): string {
        return `${vaultPath}/.hinote`;
    }

    /**
     * 하이라이트 데이터 디렉토리 경로 반환
     * @param vaultPath Vault 루트 디렉토리 경로
     * @returns 하이라이트 데이터 디렉토리 경로
     */
    static getHighlightsDir(vaultPath: string): string {
        return `${this.getHiNoteDir(vaultPath)}/highlights`;
    }

    /**
     * 플래시카드 데이터 디렉토리 경로 반환
     * @param vaultPath Vault 루트 디렉토리 경로
     * @returns 플래시카드 데이터 디렉토리 경로
     */
    static getFlashcardsDir(vaultPath: string): string {
        return `${this.getHiNoteDir(vaultPath)}/flashcards`;
    }

    /**
     * 메타데이터 디렉토리 경로 반환
     * @param vaultPath Vault 루트 디렉토리 경로
     * @returns 메타데이터 디렉토리 경로
     */
    static getMetadataDir(vaultPath: string): string {
        return `${this.getHiNoteDir(vaultPath)}/metadata`;
    }
}
