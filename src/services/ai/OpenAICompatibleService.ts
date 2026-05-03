import { BaseAIService, AIMessage } from './BaseAIService';

interface OpenAICompatibleResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

/**
 * Base class for providers that implement the OpenAI chat completions shape.
 */
export abstract class OpenAICompatibleService extends BaseAIService {
    protected getEndpoint(): string {
        return '/chat/completions';
    }

    protected formatRequestBody(messages: AIMessage[]): Record<string, unknown> {
        return {
            model: this.model,
            messages,
            ...this.getChatOptions()
        };
    }

    protected parseResponse(response: unknown): string {
        const data = response as OpenAICompatibleResponse;
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error(this.getInvalidResponseMessage());
        }

        return content;
    }

    protected getChatOptions(): Record<string, unknown> {
        return {
            temperature: this.temperature,
            max_tokens: this.maxTokens
        };
    }

    protected getInvalidResponseMessage(): string {
        return `Invalid response format from ${this.getProviderType()} API`;
    }
}
