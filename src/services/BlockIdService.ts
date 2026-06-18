import { Editor, TFile, App, MarkdownView } from 'obsidian';

/**
 * Block ID 관련 작업을 처리하는 서비스
 */
export class BlockIdService {
    // Block ID 정규식
    private static readonly BLOCK_ID_REGEX = /\^([a-zA-Z0-9-]+)$/;
    // Block ID 문자셋
    private static readonly BLOCK_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
    constructor(private app: App) {}

    /**
     * Block ID를 가져오거나 생성합니다
     * 줄 끝에 Block ID가 이미 있으면 기존 값을 반환하고,
     * 없으면 새로 생성하여 줄 끝에 추가합니다
     *
     * @param editor 에디터 인스턴스
     * @param line 줄 번호
     * @returns 블록 ID 문자열
     */
    public getOrCreateBlockId(editor: Editor, line: number): string {
        const lineText = editor.getLine(line);
        const blockIdMatch = lineText.match(BlockIdService.BLOCK_ID_REGEX);
        
        if (blockIdMatch) {
            return blockIdMatch[1];
        }
        
        // Block ID가 없으면 새로 생성하여 줄 끝에 추가합니다
        // Obsidian 공식 방식과 유사하게 7자리 무작위 문자 사용
        let newBlockId = '';
        for (let i = 0; i < 7; i++) {
            newBlockId += BlockIdService.BLOCK_ID_CHARS.charAt(
                Math.floor(Math.random() * BlockIdService.BLOCK_ID_CHARS.length)
            );
        }
        
        // 줄 끝 공백 처리: 모든 줄 끝 공백을 제거한 뒤 공백 하나만 추가합니다
        const trimmedLineText = lineText.trimEnd();
        editor.setLine(line, `${trimmedLineText} ^${newBlockId}`);
        return newBlockId;
    }

    /**
     * 텍스트에서 Block ID를 추출합니다
     *
     * @param text Block ID가 포함된 텍스트
     * @returns Block ID 또는 undefined
     */
    public extractBlockId(text: string): string | undefined {
        const blockIdMatch = text.match(BlockIdService.BLOCK_ID_REGEX);
        return blockIdMatch ? blockIdMatch[1] : undefined;
    }

    /**
     * 위치를 기준으로 단락의 Block ID를 가져옵니다
     *
     * @param file 파일
     * @param position 텍스트 위치
     * @returns 전체 단락 참조 (filePath#^blockId) 또는 undefined
     */
    public getParagraphBlockId(file: TFile, position: number): string | undefined {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.sections) return undefined;
        
        // 해당 위치를 포함하는 단락을 찾습니다
        const section = cache.sections.find(section => 
            section.position.start.offset <= position &&
            section.position.end.offset >= position
        );
        
        // 단락을 찾았고 ID가 있으면 전체 참조를 반환합니다
        return section?.id ? `${file.path}#^${section.id}` : undefined;
    }

    /**
     * 지정된 위치의 단락에 Block ID가 없으면 새로 생성합니다
     *
     * @param file 파일
     * @param startPosition 하이라이트 시작 위치
     * @param endPosition 하이라이트 종료 위치 (선택)
     * @returns 전체 단락 참조 (filePath#^blockId)
     */
    public async createParagraphBlockId(file: TFile, startPosition: number, endPosition?: number): Promise<string> {
        // 먼저 이미 Block ID가 있는지 확인합니다
        const existingId = this.getParagraphBlockId(file, startPosition);
        if (existingId) return existingId;
        
        // 파일을 열고 에디터를 가져옵니다
        const leaf = this.app.workspace.getLeaf();
        await leaf.openFile(file, { active: false });
        const view = leaf.view as MarkdownView;
        const editor = view.editor;
        
        // 위치에 해당하는 줄 번호를 가져옵니다
        const startPos = editor.offsetToPos(startPosition);
        
        // 하이라이트를 포함하는 단락의 끝 줄을 찾습니다
        let endLine = startPos.line;
        const cache = this.app.metadataCache.getFileCache(file);
        
        if (cache?.sections) {
            // 종료 위치가 제공된 경우 전체 하이라이트를 포함하는 단락을 찾습니다
            const position = endPosition || startPosition;
            
            // 먼저 종료 위치를 포함하는 단락을 찾습니다
            const section = cache.sections.find(section => 
                section.position.start.offset <= position &&
                section.position.end.offset >= position
            );
            
            if (section) {
                // 단락의 종료 위치를 사용합니다
                const endPos = editor.offsetToPos(section.position.end.offset);
                endLine = endPos.line;
                
                // 디버그 정보 기록
                console.debug(`[BlockIdService] 하이라이트를 포함하는 단락을 찾았습니다. 끝 줄: ${endLine}`);
            }
        }
        
        // 단락의 끝 줄에 Block ID를 생성합니다
        const blockId = this.getOrCreateBlockId(editor, endLine);
        
        // 파일을 저장합니다
        await this.app.vault.modify(file, editor.getValue());
        
        return `${file.path}#^${blockId}`;
    }

    /**
     * 텍스트에 유효한 Block ID가 포함되어 있는지 확인합니다
     *
     * @param text 확인할 텍스트
     * @returns 유효한 Block ID 포함 여부
     */
    public hasValidBlockId(text: string): boolean {
        return BlockIdService.BLOCK_ID_REGEX.test(text);
    }
}
