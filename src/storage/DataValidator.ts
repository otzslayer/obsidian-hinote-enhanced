import { HighlightInfo as HiNote, CommentItem } from '../types/highlight';

type JsonRecord = Record<string, unknown>;
type SanitizedHighlight = Partial<HiNote> & {
    created?: number;
    updated?: number;
};
type SanitizedComment = Partial<CommentItem> & {
    created?: number;
    updated?: number;
};

/**
 * 데이터 유효성 검사기
 */
export class DataValidator {
    private static isRecord(value: unknown): value is JsonRecord {
        return typeof value === 'object' && value !== null;
    }

    /**
     * 하이라이트 데이터 구조 유효성 검사
     * @param data 하이라이트 데이터
     * @returns 유효성 검사 결과
     */
    static validateHighlightData(data: unknown): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!this.isRecord(data)) {
            errors.push('데이터는 객체여야 합니다');
            return { valid: false, errors };
        }

        // 버전 검증
        if (!data.version || typeof data.version !== 'string') {
            errors.push('유효한 버전 정보가 없습니다');
        }

        // lastModified 검증
        if (data.lastModified && typeof data.lastModified !== 'number') {
            errors.push('lastModified는 숫자여야 합니다');
        }

        // highlights 객체 검증
        if (!this.isRecord(data.highlights)) {
            errors.push('highlights 객체가 없습니다');
            return { valid: false, errors };
        }

        // 각 하이라이트 검증
        for (const [id, highlight] of Object.entries(data.highlights)) {
            const highlightErrors = this.validateHighlight(id, highlight);
            errors.push(...highlightErrors);
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * 단일 하이라이트 유효성 검사
     * @param id 하이라이트 ID
     * @param highlight 하이라이트 데이터
     * @returns 오류 목록
     */
    static validateHighlight(id: string, highlight: unknown): string[] {
        const errors: string[] = [];

        if (!this.isRecord(highlight)) {
            errors.push(`하이라이트 ${id}: 데이터는 객체여야 합니다`);
            return errors;
        }

        // 필수 필드 검증
        if (!highlight.text || typeof highlight.text !== 'string') {
            errors.push(`하이라이트 ${id}: 유효한 text 필드가 없습니다`);
        }

        if (typeof highlight.position !== 'number') {
            errors.push(`하이라이트 ${id}: position은 숫자여야 합니다`);
        }

        if (typeof highlight.created !== 'number') {
            errors.push(`하이라이트 ${id}: created는 숫자여야 합니다`);
        }

        if (typeof highlight.updated !== 'number') {
            errors.push(`하이라이트 ${id}: updated는 숫자여야 합니다`);
        }

        // 선택적 필드 검증
        if (highlight.backgroundColor && typeof highlight.backgroundColor !== 'string') {
            errors.push(`하이라이트 ${id}: backgroundColor는 문자열이어야 합니다`);
        }

        if (highlight.blockId && typeof highlight.blockId !== 'string') {
            errors.push(`하이라이트 ${id}: blockId는 문자열이어야 합니다`);
        }

        if (highlight.contextBefore && typeof highlight.contextBefore !== 'string') {
            errors.push(`하이라이트 ${id}: contextBefore는 문자열이어야 합니다`);
        }

        if (highlight.contextAfter && typeof highlight.contextAfter !== 'string') {
            errors.push(`하이라이트 ${id}: contextAfter는 문자열이어야 합니다`);
        }

        if (highlight.textFingerprint && typeof highlight.textFingerprint !== 'string') {
            errors.push(`하이라이트 ${id}: textFingerprint는 문자열이어야 합니다`);
        }

        if (highlight.isCloze && typeof highlight.isCloze !== 'boolean') {
            errors.push(`하이라이트 ${id}: isCloze는 불리언이어야 합니다`);
        }

        // 댓글 배열 검증
        if (highlight.comments) {
            if (!Array.isArray(highlight.comments)) {
                errors.push(`하이라이트 ${id}: comments는 배열이어야 합니다`);
            } else {
                highlight.comments.forEach((comment: unknown, index: number) => {
                    const commentErrors = this.validateComment(comment, `${id}.comments[${index}]`);
                    errors.push(...commentErrors);
                });
            }
        }

        return errors;
    }

    /**
     * 댓글 데이터 유효성 검사
     * @param comment 댓글 데이터
     * @param path 경로 (오류 메시지용)
     * @returns 오류 목록
     */
    static validateComment(comment: unknown, path: string): string[] {
        const errors: string[] = [];

        if (!this.isRecord(comment)) {
            errors.push(`${path}: 댓글 데이터는 객체여야 합니다`);
            return errors;
        }

        if (!comment.id || typeof comment.id !== 'string') {
            errors.push(`${path}: 유효한 id 필드가 없습니다`);
        }

        if (!comment.content || typeof comment.content !== 'string') {
            errors.push(`${path}: 유효한 content 필드가 없습니다`);
        }

        if (typeof comment.created !== 'number') {
            errors.push(`${path}: created는 숫자여야 합니다`);
        }

        if (typeof comment.updated !== 'number') {
            errors.push(`${path}: updated는 숫자여야 합니다`);
        }

        return errors;
    }

    /**
     * 플래시카드 데이터 구조 유효성 검사
     * @param data 플래시카드 데이터
     * @returns 유효성 검사 결과
     */
    static validateFlashcardData(data: unknown): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!this.isRecord(data)) {
            errors.push('플래시카드 데이터는 객체여야 합니다');
            return { valid: false, errors };
        }

        // 버전 검증
        if (!data.version || typeof data.version !== 'string') {
            errors.push('유효한 버전 정보가 없습니다');
        }

        // cards 객체 검증
        if (data.cards && typeof data.cards !== 'object') {
            errors.push('cards는 객체여야 합니다');
        }

        // globalStats 검증
        if (data.globalStats && typeof data.globalStats !== 'object') {
            errors.push('globalStats는 객체여야 합니다');
        }

        // cardGroups 검증
        if (data.cardGroups && !Array.isArray(data.cardGroups)) {
            errors.push('cardGroups는 배열이어야 합니다');
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * 파일 매핑 데이터 유효성 검사
     * @param data 매핑 데이터
     * @returns 유효성 검사 결과
     */
    static validateFileMappingData(data: unknown): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!this.isRecord(data)) {
            errors.push('매핑 데이터는 객체여야 합니다');
            return { valid: false, errors };
        }

        if (!data.version || typeof data.version !== 'string') {
            errors.push('유효한 버전 정보가 없습니다');
        }

        if (!data.mapping || typeof data.mapping !== 'object') {
            errors.push('mapping 객체가 없습니다');
        }

        if (typeof data.lastUpdated !== 'number') {
            errors.push('lastUpdated는 숫자여야 합니다');
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * 하이라이트 데이터 정리 및 정규화
     * @param highlight 원본 하이라이트 데이터
     * @returns 정리된 하이라이트 데이터
     */
    static sanitizeHighlight(highlight: unknown): SanitizedHighlight {
        const sanitized: SanitizedHighlight = {};

        if (!this.isRecord(highlight)) {
            return sanitized;
        }

        // 필수 필드
        if (highlight.text && typeof highlight.text === 'string') {
            sanitized.text = highlight.text;
        }

        if (typeof highlight.position === 'number') {
            sanitized.position = highlight.position;
        }

        if (typeof highlight.created === 'number') {
            sanitized.created = highlight.created;
        } else if (typeof highlight.createdAt === 'number') {
            sanitized.created = highlight.createdAt;
        }

        if (typeof highlight.updated === 'number') {
            sanitized.updated = highlight.updated;
        } else if (typeof highlight.updatedAt === 'number') {
            sanitized.updated = highlight.updatedAt;
        }

        // 선택적 필드
        if (highlight.backgroundColor && typeof highlight.backgroundColor === 'string') {
            sanitized.backgroundColor = highlight.backgroundColor;
        }

        if (highlight.blockId && typeof highlight.blockId === 'string') {
            sanitized.blockId = highlight.blockId;
        }

        if (highlight.contextBefore && typeof highlight.contextBefore === 'string') {
            sanitized.contextBefore = highlight.contextBefore;
        }

        if (highlight.contextAfter && typeof highlight.contextAfter === 'string') {
            sanitized.contextAfter = highlight.contextAfter;
        }

        if (highlight.textFingerprint && typeof highlight.textFingerprint === 'string') {
            sanitized.textFingerprint = highlight.textFingerprint;
        }

        if (typeof highlight.isCloze === 'boolean') {
            sanitized.isCloze = highlight.isCloze;
        }

        if (typeof highlight.paragraphOffset === 'number') {
            sanitized.paragraphOffset = highlight.paragraphOffset;
        }

        // 댓글 배열 처리
        if (Array.isArray(highlight.comments)) {
            sanitized.comments = highlight.comments
                .filter((comment: unknown) => this.isRecord(comment))
                .map((comment: unknown) => this.sanitizeComment(comment))
                .filter((comment: SanitizedComment): comment is CommentItem => Boolean(comment.id && comment.content));
        }

        return sanitized;
    }

    /**
     * 댓글 데이터 정리 및 정규화
     * @param comment 원본 댓글 데이터
     * @returns 정리된 댓글 데이터
     */
    static sanitizeComment(comment: unknown): SanitizedComment {
        const sanitized: SanitizedComment = {};

        if (!this.isRecord(comment)) {
            return sanitized;
        }

        if (comment.id && typeof comment.id === 'string') {
            sanitized.id = comment.id;
        }

        if (comment.content && typeof comment.content === 'string') {
            sanitized.content = comment.content;
        }

        if (typeof comment.created === 'number') {
            sanitized.created = comment.created;
        } else if (typeof comment.createdAt === 'number') {
            sanitized.created = comment.createdAt;
        }

        if (typeof comment.updated === 'number') {
            sanitized.updated = comment.updated;
        } else if (typeof comment.updatedAt === 'number') {
            sanitized.updated = comment.updatedAt;
        }

        return sanitized;
    }
}
