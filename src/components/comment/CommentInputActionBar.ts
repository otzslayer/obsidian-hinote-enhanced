import { Platform } from "obsidian";
import { t } from "../../i18n";

interface CommentInputActionBarOptions {
    onSave: () => Promise<void>;
    onDelete?: () => Promise<void>;
}

export class CommentInputActionBar {
    constructor(
        private container: HTMLElement,
        private options: CommentInputActionBarOptions
    ) {}

    render(): HTMLElement {
        const actionHint = this.container.createEl("div", {
            cls: "hi-note-actions-hint"
        });

        actionHint.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        this.renderSaveHint(actionHint);
        this.renderDeleteAction(actionHint);

        return actionHint;
    }

    private renderSaveHint(actionHint: HTMLElement): void {
        if (!Platform.isMobile) {
            actionHint.createEl("span", {
                cls: "hi-note-hint",
                text: t("Tab AI, Shift + Enter Wrap, Enter Save")
            });
            return;
        }

        const saveButton = actionHint.createEl("button", {
            cls: "hi-note-save-button",
            text: t("Submit")
        });

        saveButton.addEventListener("click", async (e) => {
            e.stopPropagation();
            await this.options.onSave();
        });
    }

    private renderDeleteAction(actionHint: HTMLElement): void {
        if (!this.options.onDelete) return;

        const deleteLink = actionHint.createEl("div", {
            cls: "hi-note-delete-link",
            text: t("Delete comment")
        });

        deleteLink.addEventListener("click", async (e) => {
            e.stopPropagation();
            await this.options.onDelete?.();
        });
    }
}
