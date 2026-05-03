interface CommentInputSaveControllerOptions {
    getTextarea: () => HTMLTextAreaElement;
    onSave: (content: string) => Promise<void>;
    onSaved: () => void;
}

export class CommentInputSaveController {
    private processing = false;

    constructor(private options: CommentInputSaveControllerOptions) {}

    isProcessing(): boolean {
        return this.processing;
    }

    startProcessing(): boolean {
        if (this.processing) return false;

        this.processing = true;
        return true;
    }

    reset(): void {
        this.processing = false;
        const textarea = this.options.getTextarea();
        if (textarea) {
            textarea.disabled = false;
        }
    }

    async saveCurrentContent(): Promise<boolean> {
        if (!this.startProcessing()) {
            return false;
        }

        const textarea = this.options.getTextarea();
        const content = textarea.value.trim();

        if (!content) {
            this.reset();
            return false;
        }

        textarea.disabled = true;

        try {
            await this.options.onSave(content);
            this.options.onSaved();
            return true;
        } catch (error) {
            this.reset();
            return false;
        }
    }
}
