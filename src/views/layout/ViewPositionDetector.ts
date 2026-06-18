import { WorkspaceLeaf, App } from 'obsidian';

interface WorkspaceSplitLike {
    children: Array<WorkspaceSplitLike | WorkspaceLeaf>;
}

/**
 * 뷰 위치 감지기
 * 뷰가 메인 영역에 있는지 감지하고 위치 변경을 처리 담당
 */
export class ViewPositionDetector {
    private app: App;
    private leaf: WorkspaceLeaf;

    // 콜백 함수
    private onPositionChange: ((isInMainView: boolean, wasInAllHighlightsView: boolean) => Promise<void>) | null = null;

    // 상태
    private isDraggedToMainView: boolean = false;
    
    constructor(app: App, leaf: WorkspaceLeaf) {
        this.app = app;
        this.leaf = leaf;
    }
    
    /**
     * 콜백 함수 설정
     */
    setCallbacks(callbacks: {
        onPositionChange?: (isInMainView: boolean, wasInAllHighlightsView: boolean) => Promise<void>;
    }) {
        if (callbacks.onPositionChange) {
            this.onPositionChange = callbacks.onPositionChange;
        }
    }
    
    /**
     * 상태 업데이트
     */
    updateState(state: {
        isDraggedToMainView?: boolean;
    }) {
        if (state.isDraggedToMainView !== undefined) {
            this.isDraggedToMainView = state.isDraggedToMainView;
        }
    }
    
    /**
     * 뷰 위치 확인
     */
    async checkViewPosition(wasInAllHighlightsView: boolean): Promise<void> {
        // 루트 레이아웃 가져오기
        const root = this.app.workspace.rootSplit;
        if (!root) return;

        // 현재 뷰가 메인 영역에 있는지 확인
        const isInMainView = this.isViewInMainArea(this.leaf, root);

        // 위치가 변경된 경우
        if (this.isDraggedToMainView !== isInMainView) {
            this.isDraggedToMainView = isInMainView;

            // 위치 변경 콜백 호출
            if (this.onPositionChange) {
                await this.onPositionChange(isInMainView, wasInAllHighlightsView);
            }
        }
    }
    
    /**
     * 재귀적으로 뷰가 메인 영역에 있는지 확인
     */
    private isViewInMainArea(leaf: WorkspaceLeaf, parent: unknown): boolean {
        if (!parent) return false;
        if (this.hasChildren(parent)) {
            return parent.children.some((child: WorkspaceSplitLike | WorkspaceLeaf) => {
                if (child === leaf) {
                    return true;
                }
                return this.isViewInMainArea(leaf, child);
            });
        }
        return false;
    }

    private hasChildren(value: unknown): value is WorkspaceSplitLike {
        return typeof value === 'object'
            && value !== null
            && 'children' in value
            && Array.isArray((value as WorkspaceSplitLike).children);
    }
    
    /**
     * 현재 위치 상태 가져오기
     */
    isDraggedToMain(): boolean {
        return this.isDraggedToMainView;
    }
}
