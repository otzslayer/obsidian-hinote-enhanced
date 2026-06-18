import { BaseHTTPClient } from './BaseHTTPClient';
import { AIProviderType } from './BaseAIService';
import type { AIModel } from './BaseAIService';

/**
 * API 유형 감지 결과
 */
export type APIType = 'openai' | 'anthropic' | 'gemini';
type CustomAIMessage = { role: string; content: string };

/**
 * OpenAI 호환 형식의 응답
 */
interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

/**
 * Anthropic 형식의 응답
 */
interface AnthropicResponse {
    content: Array<{
        text: string;
    }>;
}

/**
 * Gemini 형식의 응답
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
 * 커스텀 AI 서비스
 * API 유형 자동 감지를 지원하며, OpenAI/Anthropic/Gemini 형식과 호환됩니다
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
        this.baseUrl = baseUrl.replace(/\/$/, ''); // 말미의 슬래시 제거
        this.model = model;
        this.customHeaders = customHeaders;
        this.httpClient = new BaseHTTPClient();
        this.detectedApiType = detectedApiType || null;
    }

    /**
     * API 유형 지능형 감지
     * URL 패턴 및 테스트 요청으로 판별합니다
     */
    async detectAPIType(): Promise<APIType> {
        // 이미 감지된 경우 바로 반환
        if (this.detectedApiType) {
            return this.detectedApiType;
        }

        // 1. URL 기반 휴리스틱 감지
        const urlLower = this.baseUrl.toLowerCase();

        // 일반적인 API 엔드포인트 패턴 확인
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

        // 2. URL 감지 실패 시 테스트 요청으로 감지 시도
        // OpenAI 형식 우선 시도 (가장 일반적)
        try {
            await this.requestOpenAICompatible(this.createTestMessages(), { max_tokens: 5 });
            this.detectedApiType = 'openai';
            return 'openai';
        } catch {
            // OpenAI 형식 실패, 다른 형식 시도 계속
        }

        // Anthropic 형식 시도
        try {
            await this.requestAnthropicCompatible(this.createTestMessages(), 5);
            this.detectedApiType = 'anthropic';
            return 'anthropic';
        } catch {
            // Anthropic 형식 실패
        }

        // Gemini 형식 시도
        try {
            await this.requestGeminiCompatible(this.createTestMessages());
            this.detectedApiType = 'gemini';
            return 'gemini';
        } catch {
            // 모든 형식 실패
        }

        // 기본값으로 OpenAI 형식 사용 (가장 범용적)
        this.detectedApiType = 'openai';
        return 'openai';
    }

    /**
     * OpenAI 형식 테스트
     */
    private async testOpenAIFormat(): Promise<boolean> {
        const content = await this.requestOpenAICompatible(this.createTestMessages(), { max_tokens: 5 });
        return !!content;
    }

    /**
     * Anthropic 형식 테스트
     */
    private async testAnthropicFormat(): Promise<boolean> {
        const content = await this.requestAnthropicCompatible(this.createTestMessages(), 5);
        return !!content;
    }

    /**
     * Gemini 형식 테스트
     */
    private async testGeminiFormat(): Promise<boolean> {
        const content = await this.requestGeminiCompatible(this.createTestMessages());
        return !!content;
    }

    /**
     * 응답 생성
     */
    async generateResponse(prompt: string): Promise<string> {
        return await this.chat([{ role: 'user', content: prompt }]);
    }

    /**
     * 채팅 인터페이스
     */
    async chat(messages: CustomAIMessage[]): Promise<string> {
        // API 유형 자동 감지
        const apiType = await this.detectAPIType();

        // 감지된 유형에 따라 해당 메서드 호출
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
     * OpenAI 호환 형식의 채팅
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
     * Anthropic 호환 형식의 채팅
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
     * Gemini 호환 형식의 채팅
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
     * 모델 업데이트
     */
    updateModel(model: string) {
        this.model = model;
    }

    /**
     * 감지된 API 유형 가져오기
     */
    getDetectedAPIType(): APIType | null {
        return this.detectedApiType;
    }

    /**
     * 공급자 유형 가져오기
     */
    getProviderType(): AIProviderType {
        return AIProviderType.CUSTOM;
    }

    /**
     * 사용 가능한 모델 목록 조회
     */
    async listModels(): Promise<AIModel[]> {
        // 커스텀 서비스는 일반적으로 설정된 모델이 하나뿐입니다
        return [{
            id: this.model,
            name: this.model,
            isCustom: true
        }];
    }

    /**
     * 설정 완료 여부 확인
     */
    isConfigured(): boolean {
        return !!(this.apiKey && this.baseUrl && this.model);
    }

    /**
     * 연결 테스트
     */
    async testConnection(): Promise<boolean> {
        try {
            // 먼저 API 유형 감지
            const apiType = await this.detectAPIType();

            // 유형에 따라 테스트 수행
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
        } catch {
            return false;
        }
    }

    /**
     * 요청 헤더 생성
     */
    private buildHeaders(authType: 'Bearer' | 'ApiKey' = 'Bearer'): Record<string, string> {
        const headers = BaseHTTPClient.buildAuthHeaders(this.apiKey, authType);
        
        // 커스텀 요청 헤더 병합
        if (this.customHeaders) {
            return { ...headers, ...this.customHeaders };
        }
        
        return headers;
    }
}
