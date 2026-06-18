import { TFile, Vault } from 'obsidian';

/**
 * Canvas 파일 서비스: Canvas 파일을 파싱하고 파일 노드를 추출합니다
 */
export class CanvasService {
    private vault: Vault;

    constructor(vault: Vault) {
        this.vault = vault;
    }

    /**
     * Canvas 파일을 파싱하여 모든 파일 노드의 경로를 추출합니다
     * @param file Canvas 파일
     * @returns 파일 경로 배열
     */
    async parseCanvasFile(file: TFile): Promise<string[]> {
        try {
            // Canvas 파일 내용을 읽습니다
            const content = await this.vault.read(file);
            
            // JSON 내용을 파싱합니다
            const canvasData = JSON.parse(content);
            
            // 모든 파일 노드를 추출합니다
            const filePaths: string[] = [];
            
            if (canvasData && canvasData.nodes) {
                for (const node of canvasData.nodes) {
                    // 파일 노드인지 확인합니다
                    if (node.type === 'file' && node.file) {
                        filePaths.push(node.file);
                    }
                }
            }
            
            return filePaths;
        } catch (error) {
            console.error('Canvas 파일 파싱 실패:', error);
            return [];
        }
    }
}
