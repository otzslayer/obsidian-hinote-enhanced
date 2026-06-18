import { AIServiceConfig, AIProviderType, AIModel } from './BaseAIService';
import { OpenAICompatibleService } from './OpenAICompatibleService';

/**
 * Deepseek AI 서비스
 * OpenAI 호환 API 형식을 사용합니다
 */
export class DeepseekService extends OpenAICompatibleService {
    constructor(
        apiKey: string,
        model: string = 'deepseek-chat',
        baseUrl?: string
    ) {
        const config: AIServiceConfig = {
            apiKey,
            model,
            baseUrl,
            temperature: 0.7,
            maxTokens: 4096
        };
        super(config);
    }

    protected getDefaultBaseUrl(): string {
        return 'https://api.deepseek.com/v1';
    }

    protected getChatOptions(): Record<string, unknown> {
        return {
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            frequency_penalty: 0,
            presence_penalty: 0
        };
    }

    getProviderType(): AIProviderType {
        return AIProviderType.DEEPSEEK;
    }

    async listModels(): Promise<AIModel[]> {
        return [
            { id: 'deepseek-chat', name: 'Deepseek Chat' },
            { id: 'deepseek-reasoner', name: 'Deepseek Reasoner' }
        ];
    }
}
