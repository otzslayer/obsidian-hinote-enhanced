import { App } from 'obsidian';
import { VIEW_TYPE_HINOTE } from '../views/hinote/HiNoteView';
import { HiNoteView } from '../views/hinote/HiNoteView';

/**
 * 창 관리 서비스
 * 댓글 패널의 열기, 닫기, 이동 등의 작업 관리 담당
 */
export class WindowManager {
    constructor(private app: App) {}

    /**
     * 오른쪽 사이드바에 댓글 패널 열기
     * 패널이 이미 메인 뷰에 열려 있으면 사이드바로 이동
     */
    async openCommentPanelInSidebar(): Promise<void> {
        const { workspace } = this.app;

        // 댓글 패널이 이미 열려 있는지 확인
        const existing = workspace.getLeavesOfType(VIEW_TYPE_HINOTE);
        if (existing.length) {
            // 이미 열려 있으면 현재 뷰가 메인 뷰 영역에 있는지 확인
            const existingLeaf = existing[0];
            const view = existingLeaf.view;

            // 메인 뷰 영역에 있으면 오른쪽 사이드바로 이동
            if (view && view instanceof HiNoteView && view.isInMainWindowMode()) {
                // 현재 leaf 분리
                workspace.detachLeavesOfType(VIEW_TYPE_HINOTE);

                // 오른쪽 사이드바에 새 leaf 생성
                const newLeaf = workspace.getRightLeaf(false);
                if (newLeaf) {
                    await newLeaf.setViewState({
                        type: VIEW_TYPE_HINOTE,
                        active: true,
                    });

                    // 뷰를 사이드바 모드로 표시
                    const newView = newLeaf.view;
                    if (newView && newView instanceof HiNoteView) {
                        await newView.setMainWindowMode(false, true);
                    }
                }
            } else {
                // 이미 사이드바에 있으면 직접 활성화
                await workspace.revealLeaf(existingLeaf);
            }
            return;
        }

        // 댓글 패널이 열려 있지 않으면 오른쪽에 열기
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({
                type: VIEW_TYPE_HINOTE,
                active: true,
            });

            // 뷰가 사이드바 모드로 표시되었는지 확인
            const view = leaf.view;
            if (view && view instanceof HiNoteView) {
                await view.setMainWindowMode(false);
            }
        }
    }

    /**
     * 메인 창에 댓글 패널 열기
     * 패널이 이미 사이드바에 열려 있으면 메인 창으로 이동
     */
    async openCommentPanelInMainWindow(): Promise<void> {
        const { workspace } = this.app;

        // 댓글 패널이 이미 열려 있는지 확인
        const existing = workspace.getLeavesOfType(VIEW_TYPE_HINOTE);
        if (existing.length) {
            // 이미 열려 있으면 메인 뷰 영역으로 이동 시도
            const existingLeaf = existing[0];

            // 기존 뷰 먼저 활성화
            workspace.setActiveLeaf(existingLeaf, { focus: true });

            // 다른 방법으로 뷰를 메인 뷰 영역으로 이동
            // 현재 leaf 분리
            workspace.detachLeavesOfType(VIEW_TYPE_HINOTE);

            // 메인 뷰 영역에 새 leaf 생성 (분할 화면 방지를 위해 split 대신 tab 사용)
            const newLeaf = workspace.getLeaf('tab');
            await newLeaf.setViewState({
                type: VIEW_TYPE_HINOTE,
                active: true,
            });

            // 뷰를 메인 창 모드로 표시
            const view = newLeaf.view;
            if (view && view instanceof HiNoteView) {
                await this.updateViewToMainMode(view);
            }
            return;
        }

        // 댓글 패널이 열려 있지 않으면 메인 뷰 영역에 새 탭 생성
        const leaf = workspace.getLeaf('tab');
        if (leaf) {
            await leaf.setViewState({
                type: VIEW_TYPE_HINOTE,
                active: true,
            });

            // 새로 생성된 뷰를 메인 창 모드로 표시
            window.setTimeout(() => {
                const view = leaf.view;
                if (view && view instanceof HiNoteView) {
                    void this.updateViewToMainMode(view);
                }
            }, 100);
        }
    }

    /**
     * 뷰를 메인 창 모드로 업데이트
     * @param view 댓글 뷰
     */
    private async updateViewToMainMode(view: HiNoteView): Promise<void> {
        await view.setMainWindowMode(true, true);
    }
}
