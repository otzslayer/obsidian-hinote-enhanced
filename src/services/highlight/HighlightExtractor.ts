import { App, TFile } from "obsidian";
import type { HighlightInfo, CommentItem } from '../../types/highlight';
import type { PluginSettings } from '../../types/settings';
import { ExcludePatternMatcher } from '../ExcludePatternMatcher';
import { BlockIdService } from '../BlockIdService';
import { IdGenerator } from '../../utils/IdGenerator';
import { parseInlineComments, type HighlightMatch, type InlineCommentBlock } from '../comment/inline/InlineCommentParser';
import { parseFileLevelComments, type FileLevelComment } from '../comment/inline/FrontmatterComments';

/**
 * 하이라이트 추출기
 * 역할:
 * 1. 파일 내용에서 하이라이트 텍스트 추출
 * 2. 정규식 매칭 및 중복 제거 처리
 * 3. 파일 제외 판단
 * 4. 색상 추출
 * 5. 파일 내용 캐싱
 */
export class HighlightExtractor {
    // 상수 정의
    private static readonly DUPLICATE_POSITION_THRESHOLD = 10; // 위치 차이 임계값
    private static readonly CONTEXT_LENGTH = 80;

    // 기본 텍스트 추출 정규식 (사용자 정의로 대체 가능)
    // 더 엄격한 패턴 사용: == 앞뒤에 = 또는 줄바꿈이 올 수 없어 URL의 ==가 매칭되지 않습니다
    private static readonly DEFAULT_HIGHLIGHT_PATTERN = 
        /==([^=\n](?:[^=\n]|=[^=\n])*?[^=\n])==|<mark[^>]*>([\s\S]*?)<\/mark>|<span[^>]*>([\s\S]*?)<\/span>/g;

    private blockIdService: BlockIdService;
    // 파일 내용 캐시
    private contentCache = new Map<string, {content: string, mtime: number}>();

    constructor(private app: App, private getSettings?: () => PluginSettings | undefined) {
        this.blockIdService = new BlockIdService(app);
    }

    /**
     * 파일을 처리해야 하는지 확인합니다 (제외 목록에 없는지)
     * @param file 확인할 파일
     * @returns 파일을 처리해야 하면 true
     */
    shouldProcessFile(file: TFile): boolean {
        // Markdown 파일만 처리하고 PDF 등 비텍스트 파일은 건너뜁니다
        if (file.extension !== 'md') {
            return false;
        }
        return !ExcludePatternMatcher.shouldExclude(file, this.getSettings?.()?.excludePatterns || '');
    }

    /**
     * 텍스트에서 모든 하이라이트를 추출합니다
     * @param content 텍스트 내용
     * @param file 파일 객체
     * @returns 하이라이트 정보 배열
     */
    extractHighlights(content: string, file: TFile): HighlightInfo[] {
        const highlights: HighlightInfo[] = [];
        
        // 사용자 정의 규칙을 사용하고 규칙이 설정된 경우
        const settings = this.getSettings?.();
        if (settings?.useCustomPattern && settings.regexRules?.length > 0) {
            // 활성화된 모든 규칙을 순회합니다
            for (const rule of settings.regexRules.filter(r => r.enabled)) {
                try {
                    const pattern = new RegExp(rule.pattern, 'g');
                    this.processRegexMatches(content, pattern, highlights, file, rule.color);
                } catch {
                    // 정규식 규칙 오류를 무시합니다
                }
            }
        } else {
            // 기본 규칙을 사용합니다
            this.processRegexMatches(
                content, 
                HighlightExtractor.DEFAULT_HIGHLIGHT_PATTERN, 
                highlights, 
                file, 
                '#ffeb3b' // 고정 기본 노란색을 사용합니다
            );
        }
        
        // Sort by position before inline-comment pairing so match indices are stable.
        highlights.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        // Attach inline {>>...<<} comments (replaces sidecar join). Also surfaces orphans.
        this.attachInlineComments(content, highlights);

        // Attach frontmatter file-level comments as a virtual highlight entry (R5).
        const fileLevelComments = this.extractFileLevelComments(file);
        if (fileLevelComments.length > 0) {
            highlights.push({
                id: IdGenerator.generateHighlightId(file.path, -1, ''),
                text: '',
                position: -1,
                isVirtual: true,
                filePath: file.path,
                fileName: file.basename,
                comments: fileLevelComments.map((c, i) => ({
                    id: IdGenerator.generateCommentId(),
                    content: c.text,
                    createdAt: this.parseTimestampToMs(c.ts),
                    updatedAt: this.parseTimestampToMs(c.ts),
                    fileCommentIndex: i,
                })),
            });
        }

        return highlights;
    }
    
    /**
     * 정규식 매칭을 처리합니다
     * @param content 텍스트 내용
     * @param pattern 정규식
     * @param highlights 하이라이트 배열
     * @param file 파일 객체
     * @param backgroundColor 배경 색상
     */
    private processRegexMatches(
        content: string, 
        pattern: RegExp, 
        highlights: HighlightInfo[], 
        file: TFile, 
        backgroundColor: string
    ): void {
        // Obsidian의 metadataCache.sections를 우선 사용하여 코드 블록 범위를 가져옵니다
        let codeBlockRanges: Array<[number, number]> = [];
        if (file) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.sections) {
                const codeSections = cache.sections.filter(sec =>
                    ["code", "codeblock", "fenced_code", "pre"].includes(sec.type)
                );
                codeBlockRanges = codeSections.map(sec => [
                    sec.position.start.offset,
                    sec.position.end.offset
                ]);
            }
        }
        
        // 인라인 코멘트 {>>...<<} 범위를 가져옵니다. 코멘트 본문에 포함된
        // ==text==, <mark>, <span> 같은 마크다운이 별도 하이라이트로 잘못 추출되지
        // 않도록 코드 블록과 동일하게 제외 대상으로 둡니다.
        const commentRanges: Array<[number, number]> = [];
        const commentRe = /\{>>[\s\S]*?<<\}/g;
        let commentMatch: RegExpExecArray | null;
        while ((commentMatch = commentRe.exec(content)) !== null) {
            commentRanges.push([commentMatch.index, commentMatch.index + commentMatch[0].length]);
        }

        // 제외 범위(코드 블록 + 인라인 코멘트)
        const excludedRanges: Array<[number, number]> = [...codeBlockRanges, ...commentRanges];

        // 하이라이트 범위가 제외 범위와 겹치는지 판단합니다
        function overlapsExcludedRange(start: number, end: number, ranges: Array<[number, number]>): boolean {
            return ranges.some(([blockStart, blockEnd]) =>
                Math.max(start, blockStart) < Math.min(end, blockEnd)
            );
        }

        // 인라인 코드(백틱) 내부의 == , <mark> 등은 하이라이트 구분자가 아니라
        // 리터럴 텍스트다. 하지만 블록 코드/코멘트와 달리 인라인 코드는 하이라이트
        // 안에 포함될 수 있으므로(예: ==foo `bar` baz==) 단순 제외로는 실제
        // 하이라이트까지 사라진다. 코드 구간을 동일 길이의 공백으로 마스킹한 사본에서
        // 매칭해 코드 내부의 == 가 구분자로 참여하지 못하게 하고, 실제 텍스트는
        // 원본 content 에서 다시 잘라내 보존한다.
        const maskedContent = HighlightExtractor.maskInlineCode(content);
        // 마스킹된 사본에서 얻은 매치 인덱스로 원본을 재파싱하기 위한 비전역 패턴
        const groupPattern = new RegExp(pattern.source, pattern.flags.replace('g', ''));

        let match: RegExpExecArray | null;
        while ((match = pattern.exec(maskedContent)) !== null) {
            const safeMatch = match;
            const matchStart = safeMatch.index;
            const matchEnd = matchStart + safeMatch[0].length;
            // 실제 텍스트는 원본에서 잘라낸다 (마스킹된 사본은 공백이므로).
            const fullMatch = content.slice(matchStart, matchEnd);

            // 코드 블록 또는 인라인 코멘트 안에 있는 매칭은 건너뜁니다
            if (overlapsExcludedRange(matchStart, matchEnd, excludedRanges)) {
                continue;
            }

            // 추가 확인: == 형식으로 매칭된 경우 앞뒤에 추가 = 기호가 없는지 확인합니다
            // ===text=== 또는 URL의 ==가 잘못 매칭되는 것을 방지합니다
            if (fullMatch.startsWith('==') && fullMatch.endsWith('==')) {
                const beforeMatch = matchStart > 0 ? content.charAt(matchStart - 1) : '';
                const afterMatch = matchEnd < content.length ? content.charAt(matchEnd) : '';
                if (beforeMatch === '=' || afterMatch === '=') {
                    continue; // 추가 = 기호로 둘러싸인 매칭은 건너뜁니다
                }
            }

            // 첫 번째 비어 있지 않은 캡처 그룹을 텍스트 내용으로 사용합니다.
            // 캡처 그룹은 원본 fullMatch 에서 다시 추출해야 마스킹된 공백이 아닌
            // 실제 텍스트가 담긴다. 캡처 그룹이 없으면 전체 매칭 내용을 사용합니다.
            const groupMatch = groupPattern.exec(fullMatch);
            let text = groupMatch?.slice(1).find(group => group !== undefined);
            if (!text) {
                text = fullMatch; // 캡처 그룹이 없으면 전체 매칭 내용을 사용합니다
            }
            
            // 색상 추출을 시도합니다 (인라인 로직)
            let extractedColor = null;
            if (fullMatch.includes('style=')) {
                extractedColor = this.extractColorFromElement(fullMatch);
            }

            // 동일한 위치에 이미 하이라이트가 있는지 확인합니다
            const isDuplicate = highlights.some(h => 
                typeof h.position === 'number' && 
                Math.abs(h.position - safeMatch.index) < HighlightExtractor.DUPLICATE_POSITION_THRESHOLD && 
                h.text === text
            );

            if (!isDuplicate && text) {
                // 빈칸 채우기 형식 {{}}이 포함되어 있는지 확인합니다
                const isCloze = /\{\{([^{}]+)\}\}/.test(text);

                // 하이라이트 객체를 생성합니다 (추출 단계에서 필요한 필드만 포함)
                const context = this.createContextAnchors(content, matchStart, matchEnd, text);
                const highlight = {
                    id: IdGenerator.generateHighlightId(file.path, safeMatch.index, text),
                    text,
                    position: safeMatch.index,
                    backgroundColor: extractedColor || backgroundColor,
                    isCloze: isCloze,
                    filePath: file.path,
                    originalLength: fullMatch.length,
                    contextBefore: context.before,
                    contextAfter: context.after,
                    textFingerprint: context.fingerprint
                };
                
                highlights.push(highlight);
            }
        }
    }

    /**
     * 인라인 코드(백틱) 구간을 동일 길이의 공백으로 치환합니다.
     * 길이를 보존하므로 매치 인덱스가 원본과 그대로 정렬됩니다. 코드 스팬은
     * 줄바꿈을 넘지 않으므로(단일 백틱 규칙) 내용에서 개행을 제외해, 짝이
     * 맞지 않는 백틱이 문단을 넘어 실제 하이라이트를 가리는 것을 방지합니다.
     */
    private static maskInlineCode(content: string): string {
        const inlineCodeRe = /(`+)(?:[^`\r\n]|(?!\1)`)+?\1(?!`)/g;
        return content.replace(inlineCodeRe, match => ' '.repeat(match.length));
    }

    private createContextAnchors(
        content: string,
        matchStart: number,
        matchEnd: number,
        text: string
    ): { before: string; after: string; fingerprint: string } {
        const beforeStart = Math.max(0, matchStart - HighlightExtractor.CONTEXT_LENGTH);
        const afterEnd = Math.min(content.length, matchEnd + HighlightExtractor.CONTEXT_LENGTH);

        return {
            before: this.normalizeContext(content.slice(beforeStart, matchStart)),
            after: this.normalizeContext(content.slice(matchEnd, afterEnd)),
            fingerprint: this.normalizeContext(text)
        };
    }

    private normalizeContext(value: string): string {
        return value.replace(/\s+/g, ' ').trim();
    }
    
    /**
     * 단락 오프셋을 가져옵니다
     * @param content 전체 텍스트 내용
     * @param position 하이라이트 위치
     * @returns 단락 오프셋
     */
    getParagraphOffset(content: string, position: number): number {
        const beforeText = content.substring(0, position);
        
        // 정규식으로 마지막 단락 구분자(하나 이상의 빈 줄)를 찾습니다
        const paragraphs = beforeText.split(/\n\s*\n/);
        const currentParagraphStart = beforeText.length - paragraphs[paragraphs.length - 1].length;
        
        // 단락의 시작 위치를 오프셋으로 반환합니다
        return currentParagraphStart;
    }

    /**
     * 하이라이트가 포함된 모든 파일을 가져옵니다
     * @returns 하이라이트가 포함된 파일 배열
     */
    async getFilesWithHighlights(): Promise<TFile[]> {
        const files = this.app.vault.getMarkdownFiles();
        const filesWithHighlights: TFile[] = [];

        for (const file of files) {
            // 파일을 제외해야 하는지 확인합니다
            if (!this.shouldProcessFile(file)) {
                continue;
            }

            // 캐시를 사용하여 파일 내용을 읽습니다
            const content = await this.getCachedFileContent(file);
            const highlights = this.extractHighlights(content, file);
            if (highlights.length > 0) {
                filesWithHighlights.push(file);
            }
        }

        return filesWithHighlights;
    }

    /**
     * 하이라이트가 포함된 모든 파일과 해당 하이라이트 내용을 가져옵니다
     */
    async getAllHighlights(): Promise<{ file: TFile, highlights: HighlightInfo[] }[]> {
        const files = this.app.vault.getMarkdownFiles();
        const result: { file: TFile, highlights: HighlightInfo[] }[] = [];
        for (const file of files) {
            if (!this.shouldProcessFile(file)) continue;
            // 캐시를 사용하여 파일 내용을 읽습니다
            const content = await this.getCachedFileContent(file);
            const highlights = this.extractHighlights(content, file);
            if (highlights.length > 0) {
                result.push({ file, highlights });
            }
        }
        return result;
    }

    /**
     * 하이라이트에 대한 Block ID를 생성합니다 (드래그 앤 드롭 및 내보내기 시나리오에 사용)
     *
     * @param file 파일
     * @param position 하이라이트 시작 위치
     * @param length 하이라이트 길이 (선택)
     * @returns Promise<string> 생성된 Block ID 참조 (파일명#^BlockID)
     */
    public async createBlockIdForHighlight(file: TFile, position: number, length?: number): Promise<string> {
        // 이미 Block ID가 있는지 확인합니다
        const existingId = this.blockIdService.getParagraphBlockId(file, position);
        if (existingId) {
            return existingId;
        }

        // 하이라이트 종료 위치를 계산합니다 (길이가 제공된 경우)
        const endPosition = length ? position + length : position;

        // Block ID 참조를 강제로 생성하고 반환합니다. 시작 및 종료 위치를 전달합니다
        return await this.blockIdService.createParagraphBlockId(file, position, endPosition);
    }

    /**
     * HTML 요소에서 색상을 추출합니다 (인라인 메서드)
     */
    private extractColorFromElement(element: string): string | null {
        const styleMatch = element.match(/style=["']([^"']*)["']/);
        if (!styleMatch) return null;
        
        const bgColorMatch = styleMatch[1].match(
            /background(?:-color)?:\s*((?:rgba?\(.*?\)|#[0-9a-fA-F]{3,8}|var\(--[^)]+\)))/
        );
        
        return bgColorMatch ? bgColorMatch[1] : null;
    }
    
    /**
     * 캐시된 파일 내용을 가져옵니다
     */
    async getCachedFileContent(file: TFile): Promise<string> {
        const cached = this.contentCache.get(file.path);
        if (cached && cached.mtime === file.stat.mtime) {
            return cached.content;
        }
        
        const content = await this.app.vault.read(file);
        this.contentCache.set(file.path, {content, mtime: file.stat.mtime});
        return content;
    }

    /**
     * 파일 내용 캐시를 무효화합니다
     */
    invalidateContentCache(filePath: string): void {
        this.contentCache.delete(filePath);
    }

    /**
     * 모든 파일 내용 캐시를 지웁니다
     */
    clearContentCache(): void {
        this.contentCache.clear();
    }

    /**
     * Parse inline {>>...<<} comment blocks from `content` and attach them to the
     * corresponding `HighlightInfo` entries (replaces the sidecar HighlightCommentResolver join).
     * Orphan blocks are added to `highlights` as virtual entries (KTD5 — isOrphan, never auto-deleted).
     */
    private attachInlineComments(content: string, highlights: HighlightInfo[]): void {
        const highlightMatches: HighlightMatch[] = highlights.map(h => ({
            text: h.text,
            start: h.position ?? 0,
            end: (h.position ?? 0) + (h.originalLength ?? h.text.length + 4),
        }));

        const { pairedComments, orphanComments } = parseInlineComments(content, highlightMatches);

        for (const paired of pairedComments) {
            const highlight = highlights.find(h => h.position === paired.highlightStart);
            if (highlight) {
                highlight.comments = paired.comments.map(b => this.blockToCommentItem(b));
            }
        }

        // Surface orphan comment blocks in the in-memory model so the sidebar can show them
        // as a separate group (KTD5). The plugin never auto-deletes orphans.
        for (const orphan of orphanComments) {
            highlights.push({
                text: '',
                position: orphan.startOffset,
                isVirtual: true,
                isOrphan: true,
                comments: [this.blockToCommentItem(orphan)],
            });
        }
    }

    private blockToCommentItem(block: InlineCommentBlock): CommentItem {
        const ms = block.timestamp ? this.parseTimestampToMs(block.timestamp) : Date.now();
        return {
            id: IdGenerator.generateCommentId(),
            content: block.isAI ? `🤖 ${block.text}` : block.text,
            createdAt: ms,
            updatedAt: ms,
        };
    }

    private parseTimestampToMs(ts: string): number {
        // "YYYY-MM-DD HH:mm[:ss]" → ISO 8601 for reliable Date parsing.
        // Legacy minute-precision timestamps need seconds appended; second-precision
        // ones are already complete.
        const iso = ts.replace(' ', 'T');
        const normalized = /T\d{2}:\d{2}$/.test(iso) ? `${iso}:00` : iso;
        return new Date(normalized).getTime();
    }

    /**
     * Extract file-level comments from frontmatter (R5, KTD4).
     * Returns an empty array when no {text, ts}-shaped comments are present.
     */
    public extractFileLevelComments(file: TFile): FileLevelComment[] {
        const cache = this.app.metadataCache.getFileCache(file);
        return parseFileLevelComments(cache?.frontmatter ?? null);
    }

    /**
     * 정규식 특수 문자를 이스케이프합니다
     */
    escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
