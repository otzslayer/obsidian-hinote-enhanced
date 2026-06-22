/**
 * AI 서비스 생성자 맵
 * 각 공급자 유형을 해당 IAIService 인스턴스 생성 함수로 매핑합니다
 */

import { IAIService, AIProviderType, AIServiceError } from './BaseAIService';
import type { AIMessage, AIModel } from './BaseAIService';
import type { AISettings } from '../../types/ai';
import { OpenAIService } from './OpenAIService';
import { AnthropicService } from './AnthropicService';
import { GeminiService } from './GeminiService';
import { DeepseekService } from './DeepseekService';
import { SiliconFlowService } from './SiliconFlowService';
import { OllamaService } from './OllamaService';
import { CustomAIService } from './CustomAIService';

/**
 * 공급자 유형별 서비스 인스턴스 생성 함수 맵
 * 각 엔트리는 설정을 검증한 뒤 해당 IAIService 인스턴스를 생성합니다
 */
export const AI_SERVICE_FACTORIES: Record<AIProviderType, (settings: AISettings) => IAIService> = {
    [AIProviderType.OPENAI]: (settings) => {
        if (!settings.openai?.apiKey) {
            throw AIServiceError.notConfigured(AIProviderType.OPENAI, 'API key not configured');
        }
        return new OpenAIService(
            settings.openai.apiKey,
            settings.openai.model || 'gpt-4o',
            settings.openai.baseUrl
        );
    },

    [AIProviderType.ANTHROPIC]: (settings) => {
        if (!settings.anthropic?.apiKey) {
            throw AIServiceError.notConfigured(AIProviderType.ANTHROPIC, 'API key not configured');
        }
        return new AnthropicService(
            settings.anthropic.apiKey,
            settings.anthropic.apiAddress,
            settings.anthropic.model
        );
    },

    [AIProviderType.GEMINI]: (settings) => {
        if (!settings.gemini?.apiKey) {
            throw AIServiceError.notConfigured(AIProviderType.GEMINI, 'API key not configured');
        }
        return new GeminiService(
            settings.gemini.apiKey,
            settings.gemini.model || 'gemini-2.5-flash',
            settings.gemini.baseUrl
        );
    },

    [AIProviderType.DEEPSEEK]: (settings) => {
        if (!settings.deepseek?.apiKey) {
            throw AIServiceError.notConfigured(AIProviderType.DEEPSEEK, 'API key not configured');
        }
        return new DeepseekService(
            settings.deepseek.apiKey,
            settings.deepseek.model || 'deepseek-chat',
            settings.deepseek.baseUrl
        );
    },

    [AIProviderType.SILICONFLOW]: (settings) => {
        if (!settings.siliconflow?.apiKey) {
            throw AIServiceError.notConfigured(AIProviderType.SILICONFLOW, 'API key not configured');
        }
        return new SiliconFlowService(settings);
    },

    [AIProviderType.OLLAMA]: (settings) => {
        if (!settings.ollama?.host) {
            throw AIServiceError.notConfigured(AIProviderType.OLLAMA, 'Host not configured');
        }
        // Ollama는 인터페이스가 다르기 때문에 어댑터가 필요합니다
        return new OllamaServiceAdapter(
            settings.ollama.host,
            settings.ollama.model || ''
        );
    },

    [AIProviderType.CUSTOM]: (settings) => {
        if (!settings.custom?.apiKey || !settings.custom?.baseUrl || !settings.custom?.model) {
            throw AIServiceError.notConfigured(
                AIProviderType.CUSTOM,
                'API key, base URL, or model not configured'
            );
        }
        return new CustomAIService(
            settings.custom.apiKey,
            settings.custom.baseUrl,
            settings.custom.model,
            settings.custom.headers,
            settings.custom.detectedApiType
        );
    },
};

/**
 * Ollama 서비스 어댑터
 * OllamaService를 IAIService 인터페이스에 맞게 어댑터합니다
 */
class OllamaServiceAdapter implements IAIService {
    private service: OllamaService;
    private model: string;

    constructor(host: string, model: string) {
        this.service = new OllamaService(host);
        this.model = model;
    }

    async chat(messages: AIMessage[]): Promise<string> {
        if (!this.model) {
            throw AIServiceError.notConfigured(AIProviderType.OLLAMA, 'Model not configured');
        }
        return await this.service.chat(this.model, messages);
    }

    async generateResponse(prompt: string): Promise<string> {
        if (!this.model) {
            throw AIServiceError.notConfigured(AIProviderType.OLLAMA, 'Model not configured');
        }
        return await this.service.generateCompletion(this.model, prompt);
    }

    async testConnection(): Promise<boolean> {
        return await this.service.testConnection();
    }

    updateModel(model: string): void {
        this.model = model;
    }

    async listModels(): Promise<AIModel[]> {
        const models = await this.service.listModels();
        return models.map(name => ({ id: name, name }));
    }

    getProviderType(): AIProviderType {
        return AIProviderType.OLLAMA;
    }

    isConfigured(): boolean {
        return !!this.model;
    }
}
