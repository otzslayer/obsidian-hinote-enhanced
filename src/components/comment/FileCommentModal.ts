import { App, Modal } from "obsidian";
import { t } from "../../i18n";

export function showFileCommentModal(app: App): Promise<string | null> {
    return new Promise(resolve => {
        const modal = new FileCommentModal(app, resolve);
        modal.open();
    });
}

class FileCommentModal extends Modal {
    private textarea!: HTMLTextAreaElement;

    constructor(
        app: App,
        private resolve: (text: string | null) => void
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        this.titleEl.setText(t("Add File Comment"));

        this.textarea = contentEl.createEl("textarea", {
            cls: "file-comment-modal-textarea",
            attr: { placeholder: t("Add file comment placeholder"), rows: "4" }
        }) as HTMLTextAreaElement;
        this.textarea.focus();

        const buttonContainer = contentEl.createEl("div", { cls: "modal-button-container" });
        const cancelButton = buttonContainer.createEl("button", { text: t("Cancel") });
        const saveButton = buttonContainer.createEl("button", {
            cls: "mod-cta",
            text: t("Save")
        });

        cancelButton.addEventListener("click", () => {
            this.resolve(null);
            this.close();
        });
        saveButton.addEventListener("click", () => {
            const text = this.textarea.value.trim();
            this.resolve(text || null);
            this.close();
        });

        this.textarea.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const text = this.textarea.value.trim();
                this.resolve(text || null);
                this.close();
            }
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
