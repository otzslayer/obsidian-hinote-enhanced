import { AIServiceConfig, AIProviderType, AIModel } from './BaseAIService';
import { OpenAICompatibleService } from './OpenAICompatibleService';

/**
 * OpenAI AI 服务
 * 支持 GPT-4o, GPT-4o-mini, GPT-o1 等模型
 */
export class OpenAIService extends OpenAICompatibleService {
    constructor(
        apiKey: string,
        model: string = 'gpt-4o',
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
        return 'https://api.openai.com/v1';
    }

    getProviderType(): AIProviderType {
        return AIProviderType.OPENAI;
    }

    async listModels(): Promise<AIModel[]> {
        return [
            { id: 'gpt-4o', name: 'GPT-4o' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'gpt-o1', name: 'GPT-o1' },
            { id: 'gpt-4', name: 'GPT-4' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
        ];
    }
}
