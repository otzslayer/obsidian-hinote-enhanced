import { BaseHTTPClient } from './BaseHTTPClient';
import { AIProviderType } from './BaseAIService';
import type { AIModel } from './BaseAIService';

/**
 * API 类型检测结果
 */
export type APIType = 'openai' | 'anthropic' | 'gemini';
type CustomAIMessage = { role: string; content: string };

/**
 * OpenAI 兼容格式的响应
 */
interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

/**
 * Anthropic 格式的响应
 */
interface AnthropicResponse {
    content: Array<{
        text: string;
    }>;
}

/**
 * Gemini 格式的响应
 */
interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
        };
    }>;
}

/**
 * 自定义 AI 服务
 * 支持自动检测 API 类型，兼容 OpenAI/Anthropic/Gemini 格式
 */
export class CustomAIService {
    private baseUrl: string;
    private model: string;
    private detectedApiType: APIType | null = null;
    private customHeaders?: Record<string, string>;
    private httpClient: BaseHTTPClient;

    constructor(
        private apiKey: string,
        baseUrl: string,
        model: string,
        customHeaders?: Record<string, string>,
        detectedApiType?: APIType
    ) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾的斜杠
        this.model = model;
        this.customHeaders = customHeaders;
        this.httpClient = new BaseHTTPClient();
        this.detectedApiType = detectedApiType || null;
    }

    /**
     * 智能检测 API 类型
     * 通过 URL 模式和测试请求来判断
     */
    async detectAPIType(): Promise<APIType> {
        // 如果已经检测过，直接返回
        if (this.detectedApiType) {
            return this.detectedApiType;
        }

        // 1. 基于 URL 的启发式检测
        const urlLower = this.baseUrl.toLowerCase();
        
        // 检查常见的 API 端点模式
        if (urlLower.includes('openai') || 
            urlLower.includes('/v1/chat/completions') ||
            urlLower.includes('/chat/completions')) {
            this.detectedApiType = 'openai';
            return 'openai';
        }
        
        if (urlLower.includes('anthropic') || 
            urlLower.includes('claude')) {
            this.detectedApiType = 'anthropic';
            return 'anthropic';
        }
        
        if (urlLower.includes('gemini') || 
            urlLower.includes('generativelanguage.googleapis.com')) {
            this.detectedApiType = 'gemini';
            return 'gemini';
        }

        // 2. 如果 URL 检测失败，尝试通过测试请求来检测
        // 优先尝试 OpenAI 格式（最常见）
        try {
            await this.requestOpenAICompatible(this.createTestMessages(), { max_tokens: 5 });
            this.detectedApiType = 'openai';
            return 'openai';
        } catch (error) {
            // OpenAI 格式失败，继续尝试其他格式
        }

        // 尝试 Anthropic 格式
        try {
            await this.requestAnthropicCompatible(this.createTestMessages(), 5);
            this.detectedApiType = 'anthropic';
            return 'anthropic';
        } catch (error) {
            // Anthropic 格式失败
        }

        // 尝试 Gemini 格式
        try {
            await this.requestGeminiCompatible(this.createTestMessages());
            this.detectedApiType = 'gemini';
            return 'gemini';
        } catch (error) {
            // 所有格式都失败
        }

        // 默认使用 OpenAI 格式（最通用）
        this.detectedApiType = 'openai';
        return 'openai';
    }

    /**
     * 测试 OpenAI 格式
     */
    private async testOpenAIFormat(): Promise<boolean> {
        const content = await this.requestOpenAICompatible(this.createTestMessages(), { max_tokens: 5 });
        return !!content;
    }

    /**
     * 测试 Anthropic 格式
     */
    private async testAnthropicFormat(): Promise<boolean> {
        const content = await this.requestAnthropicCompatible(this.createTestMessages(), 5);
        return !!content;
    }

    /**
     * 测试 Gemini 格式
     */
    private async testGeminiFormat(): Promise<boolean> {
        const content = await this.requestGeminiCompatible(this.createTestMessages());
        return !!content;
    }

    /**
     * 生成响应
     */
    async generateResponse(prompt: string): Promise<string> {
        return await this.chat([{ role: 'user', content: prompt }]);
    }

    /**
     * 聊天接口
     */
    async chat(messages: CustomAIMessage[]): Promise<string> {
        // 自动检测 API 类型
        const apiType = await this.detectAPIType();

        // 根据检测到的类型调用相应的方法
        switch (apiType) {
            case 'openai':
                return await this.chatOpenAICompatible(messages);
            case 'anthropic':
                return await this.chatAnthropicCompatible(messages);
            case 'gemini':
                return await this.chatGeminiCompatible(messages);
            default:
                throw new Error('Unsupported API type');
        }
    }

    /**
     * OpenAI 兼容格式的聊天
     */
    private async chatOpenAICompatible(messages: CustomAIMessage[]): Promise<string> {
        try {
            return await this.requestOpenAICompatible(messages);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to generate response from custom AI API');
        }
    }

    /**
     * Anthropic 兼容格式的聊天
     */
    private async chatAnthropicCompatible(messages: CustomAIMessage[]): Promise<string> {
        try {
            return await this.requestAnthropicCompatible(messages, 4096);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to generate response from custom AI API');
        }
    }

    /**
     * Gemini 兼容格式的聊天
     */
    private async chatGeminiCompatible(messages: CustomAIMessage[]): Promise<string> {
        try {
            return await this.requestGeminiCompatible(messages);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Failed to generate response from custom AI API');
        }
    }

    private async requestOpenAICompatible(
        messages: CustomAIMessage[],
        extraBody: Record<string, unknown> = {}
    ): Promise<string> {
        const response = await this.httpClient.request<OpenAIResponse>({
            url: this.getOpenAIEndpoint(),
            method: 'POST',
            headers: this.buildHeaders(),
            body: JSON.stringify({
                model: this.model,
                messages,
                temperature: 0.7,
                ...extraBody
            })
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('Invalid response format from custom AI API');
        }

        return content;
    }

    private async requestAnthropicCompatible(
        messages: CustomAIMessage[],
        maxTokens: number
    ): Promise<string> {
        const response = await this.httpClient.request<AnthropicResponse>({
            url: this.getAnthropicEndpoint(),
            method: 'POST',
            headers: {
                ...this.buildHeaders('ApiKey'),
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                max_tokens: maxTokens
            })
        });

        const content = response.content?.[0]?.text;
        if (!content) {
            throw new Error('Invalid response format from custom AI API');
        }

        return content;
    }

    private async requestGeminiCompatible(messages: CustomAIMessage[]): Promise<string> {
        const response = await this.httpClient.request<GeminiResponse>({
            url: `${this.getGeminiEndpoint()}?key=${this.apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.customHeaders
            },
            body: JSON.stringify({
                contents: messages.map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                }))
            })
        });

        const content = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {
            throw new Error('Invalid response format from custom AI API');
        }

        return content;
    }

    private getOpenAIEndpoint(): string {
        return this.baseUrl.includes('/chat/completions')
            ? this.baseUrl
            : `${this.baseUrl}/chat/completions`;
    }

    private getAnthropicEndpoint(): string {
        return this.baseUrl.includes('/messages')
            ? this.baseUrl
            : `${this.baseUrl}/messages`;
    }

    private getGeminiEndpoint(): string {
        return `${this.baseUrl}/${this.model}:generateContent`;
    }

    private createTestMessages(): CustomAIMessage[] {
        return [{ role: 'user', content: 'test' }];
    }

    /**
     * 更新模型
     */
    updateModel(model: string) {
        this.model = model;
    }

    /**
     * 获取检测到的 API 类型
     */
    getDetectedAPIType(): APIType | null {
        return this.detectedApiType;
    }

    /**
     * 获取提供商类型
     */
    getProviderType(): AIProviderType {
        return AIProviderType.CUSTOM;
    }

    /**
     * 列出可用模型
     */
    async listModels(): Promise<AIModel[]> {
        // Custom 服务通常只有一个配置的模型
        return [{
            id: this.model,
            name: this.model,
            isCustom: true
        }];
    }

    /**
     * 检查是否已配置
     */
    isConfigured(): boolean {
        return !!(this.apiKey && this.baseUrl && this.model);
    }

    /**
     * 测试连接
     */
    async testConnection(): Promise<boolean> {
        try {
            // 先检测 API 类型
            const apiType = await this.detectAPIType();

            // 根据类型进行测试
            switch (apiType) {
                case 'openai':
                    await this.testOpenAIFormat();
                    return true;
                case 'anthropic':
                    await this.testAnthropicFormat();
                    return true;
                case 'gemini':
                    await this.testGeminiFormat();
                    return true;
                default:
                    return false;
            }
        } catch (error) {
            return false;
        }
    }

    /**
     * 构建请求头
     */
    private buildHeaders(authType: 'Bearer' | 'ApiKey' = 'Bearer'): Record<string, string> {
        const headers = BaseHTTPClient.buildAuthHeaders(this.apiKey, authType);
        
        // 合并自定义请求头
        if (this.customHeaders) {
            return { ...headers, ...this.customHeaders };
        }
        
        return headers;
    }
}
