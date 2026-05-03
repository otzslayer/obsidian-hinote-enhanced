import { App, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_HINOTE } from '../core/HiNoteView';
import { HiNoteView } from '../core/HiNoteView';

/**
 * 窗口管理服务
 * 负责管理评论面板的打开、关闭、移动等操作
 */
export class WindowManager {
    constructor(private app: App) {}

    /**
     * 在右侧侧边栏打开评论面板
     * 如果面板已在主视图中打开，则移动到侧边栏
     */
    async openCommentPanelInSidebar(): Promise<void> {
        const { workspace } = this.app;
        
        // 检查评论面板是否已经打开
        const existing = workspace.getLeavesOfType(VIEW_TYPE_HINOTE);
        if (existing.length) {
            // 如果已经打开，先检查当前视图是否在主视图区域
            const existingLeaf = existing[0];
            const view = existingLeaf.view;
            
            // 如果在主视图区域，则移动到右侧侧边栏
            if (view && view instanceof HiNoteView && view.isInMainWindowMode()) {
                // 先分离当前叶子
                workspace.detachLeavesOfType(VIEW_TYPE_HINOTE);
                
                // 然后在右侧侧边栏创建新的叶子
                const newLeaf = workspace.getRightLeaf(false);
                if (newLeaf) {
                    await newLeaf.setViewState({
                        type: VIEW_TYPE_HINOTE,
                        active: true,
                    });
                    
                    // 将视图标记为侧边栏模式
                    const newView = newLeaf.view;
                    if (newView && newView instanceof HiNoteView) {
                        await newView.setMainWindowMode(false, true);
                    }
                }
            } else {
                // 如果已经在侧边栏，则直接激活它
                workspace.revealLeaf(existingLeaf);
            }
            return;
        }

        // 如果评论面板未打开，则在右侧打开评论面板
        const leaf = workspace.getRightLeaf(false);
        if (leaf) {
            await leaf.setViewState({
                type: VIEW_TYPE_HINOTE,
                active: true,
            });
            
            // 确保视图标记为侧边栏模式
            const view = leaf.view;
            if (view && view instanceof HiNoteView) {
                await view.setMainWindowMode(false);
            }
        }
    }

    /**
     * 在主窗口打开评论面板
     * 如果面板已在侧边栏打开，则移动到主窗口
     */
    async openCommentPanelInMainWindow(): Promise<void> {
        const { workspace } = this.app;
        
        // 检查评论面板是否已经打开
        const existing = workspace.getLeavesOfType(VIEW_TYPE_HINOTE);
        if (existing.length) {
            // 如果已经打开，尝试将其移动到主视图区域
            const existingLeaf = existing[0];
            
            // 先激活现有视图
            workspace.setActiveLeaf(existingLeaf, { focus: true });
            
            // 使用另一种方式将视图移动到主视图区域
            // 先分离当前叶子
            workspace.detachLeavesOfType(VIEW_TYPE_HINOTE);
            
            // 然后在主视图区域创建新的叶子（使用tab而不是split避免分屏）
            const newLeaf = workspace.getLeaf('tab');
            await newLeaf.setViewState({
                type: VIEW_TYPE_HINOTE,
                active: true,
            });
            
            // 将视图标记为主窗口模式
            const view = newLeaf.view;
            if (view && view instanceof HiNoteView) {
                await this.updateViewToMainMode(view);
            }
            return;
        }

        // 如果评论面板未打开，在主视图区域创建新标签页
        const leaf = workspace.getLeaf('tab');
        if (leaf) {
            await leaf.setViewState({
                type: VIEW_TYPE_HINOTE,
                active: true,
            });
            
            // 将新创建的视图标记为主窗口模式
            setTimeout(() => {
                const view = leaf.view;
                if (view && view instanceof HiNoteView) {
                    void this.updateViewToMainMode(view);
                }
            }, 100);
        }
    }

    /**
     * 更新视图为主窗口模式
     * @param view 评论视图
     */
    private async updateViewToMainMode(view: HiNoteView): Promise<void> {
        await view.setMainWindowMode(true, true);
    }
}
