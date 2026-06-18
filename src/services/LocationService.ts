import { App, MarkdownView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { HighlightInfo } from "../types/highlight";

export class LocationService {
    constructor(private app: App) {}

    /**
     * 지정된 하이라이트 위치로 이동합니다
     */
    public async jumpToHighlight(highlight: HighlightInfo, currentFilePath: string) {
        // 1. 파일을 열거나 활성화합니다
        const targetLeaf = await this.openOrActivateFile(currentFilePath);
        if (!targetLeaf) return;

        // 2. 하이라이트 내용을 찾아 이동합니다 (position 매개변수 전달)
        await this.locateAndHighlightText(targetLeaf, highlight.text, highlight.position);
    }

    /**
     * 지정된 파일을 열거나 활성화하되 포커스는 주지 않습니다
     */
    private async openOrActivateFile(filePath: string): Promise<WorkspaceLeaf | null> {
        // 이미 열려 있는 파일을 먼저 찾습니다
        const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");
        let targetLeaf = markdownLeaves.find((leaf: WorkspaceLeaf) => {
            const view = leaf.view as MarkdownView;
            return view.file?.path === filePath;
        });
        
        // 파일이 열려 있지 않으면 엽니다
        if (!targetLeaf) {
            try {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (!(file instanceof TFile)) {
                    new Notice("파일을 찾을 수 없습니다");
                    return null;
                }
                
                targetLeaf = this.app.workspace.getLeaf('tab');
                await targetLeaf.openFile(file);
            } catch {
                new Notice("파일 열기에 실패했습니다");
                return null;
            }
        }
        
        // 에디터 뷰를 활성화하되 포커스는 주지 않습니다
        this.app.workspace.setActiveLeaf(targetLeaf, { focus: false });
        return targetLeaf;
    }

    /**
     * 에디터에서 텍스트를 찾아 하이라이트합니다
     */
    private async locateAndHighlightText(leaf: WorkspaceLeaf, text: string, position?: number) {
        // 에디터가 준비될 때까지 대기합니다
        await new Promise(resolve => window.setTimeout(resolve, 300));
        
        const markdownView = leaf.view as MarkdownView;
        const editor = markdownView.editor;
        const content = editor.getValue();
        
        let textPosition = -1;
        let allMatches: number[] = [];
        let matchedText = text; // 기본값으로 원본 텍스트를 사용합니다
        
        // 모든 정확한 일치 항목을 찾습니다
        let searchPos = 0;
        let foundPos = -1;
        while ((foundPos = content.indexOf(text, searchPos)) !== -1) {
            allMatches.push(foundPos);
            searchPos = foundPos + 1;
        }
        
        // position이 제공된 경우 우선적으로 사용합니다
        if (position !== undefined && position >= 0) {
            // 먼저 정확한 일치를 확인합니다
            if (content.substring(position, position + text.length) === text) {
                textPosition = position;
            } else {
                // 정확한 일치가 없으면 가장 가까운 일치 항목을 찾습니다
                if (allMatches.length > 0) {
                    // 지정된 위치에 가장 가까운 일치 항목을 찾습니다
                    let closestMatch = allMatches[0];
                    let minDistance = Math.abs(position - closestMatch);
                    
                    for (const match of allMatches) {
                        const distance = Math.abs(position - match);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestMatch = match;
                        }
                    }
                    
                    textPosition = closestMatch;
                }
            }
        }
        
        // 정확한 일치 항목을 찾지 못한 경우
        if (textPosition === -1) {
            if (allMatches.length > 0) {
                textPosition = allMatches[0];
            } else {
                new Notice("하이라이트 내용을 찾을 수 없습니다");
                return;
            }
        }
        
        // 텍스트 위치를 에디터 위치로 변환합니다
        const start = editor.offsetToPos(textPosition);
        const end = editor.offsetToPos(textPosition + matchedText.length);
        
        // 뷰 모드를 확인합니다
        const mode = markdownView.getMode(); // 'source' | 'preview'

        if (mode === 'preview') {
            // 읽기 모드 처리
            // setEphemeralState를 사용하여 지정된 줄로 스크롤합니다
            // startLoc 및 endLoc은 위치 정보를 전달하는 데 사용됩니다
            leaf.setEphemeralState({
                line: start.line,
                startLoc: { line: start.line, col: start.ch },
                endLoc: { line: end.line, col: end.ch },
                scroll: start.line
            });
        } else {
            // 편집/실시간 미리보기 모드 처리
            // 1. 텍스트를 선택합니다
            editor.setSelection(start, end);
            
            // 2. 대상 위치로 스크롤하여 선택된 내용이 에디터 중앙에 표시되도록 합니다
            editor.scrollIntoView({from: start, to: end}, true);
            
            // 3. 에디터에 포커스를 주어 사용자가 선택된 내용을 볼 수 있게 합니다
            this.app.workspace.setActiveLeaf(leaf, { focus: true });
        }
    }

} 
