import type { AISettings } from '../../types/ai';
import { AIServiceConfig, AIProviderType, AIModel } from './BaseAIService';
import { OpenAICompatibleService } from './OpenAICompatibleService';

interface SiliconFlowModelsResponse {
    data: Array<{
        id: string;
    }>;
}

/**
 * SiliconFlow AI 서비스
 * OpenAI 호환 API 형식을 사용합니다
 */
export class SiliconFlowService extends OpenAICompatibleService {
    constructor(settings: AISettings) {
        if (!settings.siliconflow?.apiKey) {
            throw new Error('SiliconFlow API key is required');
        }

        const config: AIServiceConfig = {
            apiKey: settings.siliconflow.apiKey,
            model: settings.siliconflow.model || 'deepseek-ai/DeepSeek-V3',
            baseUrl: settings.siliconflow.baseUrl,
            temperature: 0.7,
            maxTokens: 2048
        };
        super(config);
    }

    protected getDefaultBaseUrl(): string {
        return 'https://api.siliconflow.cn/v1';
    }

    protected getChatOptions(): Record<string, unknown> {
        return {
            stream: false
        };
    }

    protected getInvalidResponseMessage(): string {
        return 'Unexpected API response format from SiliconFlow';
    }

    getProviderType(): AIProviderType {
        return AIProviderType.SILICONFLOW;
    }

    /**
     * 사용 가능한 모델 목록 조회
     */
    async listModels(): Promise<AIModel[]> {
        try {
            const response = await this.httpClient.request<SiliconFlowModelsResponse>({
                url: `${this.baseUrl}/models`,
                method: 'GET',
                headers: this.buildHeaders()
            });

            return response.data.map((model: { id: string }) => ({
                id: model.id,
                name: model.id.split('/').pop() || model.id,
                isCustom: false
            }));
        } catch (error) {
            throw this.handleError(error);
        }
    }
}
