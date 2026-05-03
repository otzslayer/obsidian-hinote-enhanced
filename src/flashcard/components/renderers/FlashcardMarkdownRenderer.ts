import { Component, MarkdownRenderer } from "obsidian";
import type { FlashcardComponentContext } from "../FlashcardComponentContext";

export class FlashcardMarkdownRenderer {
    constructor(private component: FlashcardComponentContext) {}

    public async render(containerEl: HTMLElement, content: string, filePath?: string): Promise<void> {
        containerEl.empty();

        if (!content) {
            console.warn("renderMarkdownContent: content is empty or undefined");
            containerEl.textContent = "Add answer";
            return;
        }

        const isCardFront = containerEl.closest(".flashcard-front") !== null;
        const markdownContent = isCardFront
            ? this.renderFrontContent(content)
            : content.replace(/\{\{([^{}]+)\}\}/g, "$1");

        try {
            await MarkdownRenderer.render(
                this.component.getApp(),
                markdownContent,
                containerEl,
                filePath || "",
                new Component()
            );

            containerEl.querySelectorAll("ul, ol").forEach(list => {
                list.addClass("flashcard-markdown-list");
            });

            if (isCardFront) {
                containerEl.querySelectorAll("p").forEach(p => {
                    if (p.textContent?.includes("______")) {
                        p.addClass("flashcard-cloze");
                    }
                });
            }
        } catch (error) {
            console.error("Error rendering markdown in flashcard:", error);
            containerEl.textContent = markdownContent;
        }
    }

    private renderFrontContent(content: string): string {
        return content.replace(/\{\{([^{}]+)\}\}/g, (_match, clozeText: string) => {
            const originalLength = clozeText.split("").reduce((acc: number, char: string) => {
                const isChinese = /[\u4e00-\u9fa5]/.test(char);
                return acc + (isChinese ? 3 : 1);
            }, 0);

            const adjustedLength = clozeText.length > 5
                ? Math.floor(originalLength * 1.2)
                : originalLength;

            return "_".repeat(Math.max(8, adjustedLength));
        });
    }
}
