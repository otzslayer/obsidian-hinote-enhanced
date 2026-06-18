import { BaseAIService, AIMessage, AIServiceConfig, AIProviderType, AIModel } from './BaseAIService';

export interface GenerationConfig {
    maxOutputTokens?: number;
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: object;
}

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
 * Google Gemini AI 서비스
 * Gemini 전용 API 형식을 사용합니다
 */
export class GeminiService extends BaseAIService {
    private generationConfig?: GenerationConfig;

    constructor(apiKey: string, model: string = 'gemini-2.5-flash', baseUrl?: string) {
        const config: AIServiceConfig = {
            apiKey,
            model,
            baseUrl,
            temperature: 0.7,
            maxTokens: 2048
        };
        super(config);
    }

    protected getDefaultBaseUrl(): string {
        return 'https://generativelanguage.googleapis.com';
    }

    protected getEndpoint(): string {
        return `/v1/models/${this.model}:generateContent?key=${this.apiKey}`;
    }

    protected buildHeaders(): Record<string, string> {
        // Gemini는 API key를 URL 파라미터로 사용하므로 Authorization 헤더가 필요하지 않습니다
        return {
            'Content-Type': 'application/json'
        };
    }

    protected formatRequestBody(messages: AIMessage[]): Record<string, unknown> {
        // 통일된 AIMessage 형식을 Gemini 형식으로 변환
        const contents = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        return {
            contents,
            generationConfig: {
                maxOutputTokens: this.generationConfig?.maxOutputTokens || this.maxTokens,
                temperature: this.generationConfig?.temperature || this.temperature,
                ...(this.generationConfig?.responseMimeType && { 
                    responseMimeType: this.generationConfig.responseMimeType 
                }),
                ...(this.generationConfig?.responseSchema && { 
                    responseSchema: this.generationConfig.responseSchema 
                })
            }
        };
    }

    protected parseResponse(response: unknown): string {
        const data = response as GeminiResponse;
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response format from Gemini API');
        }
        return data.candidates[0].content.parts[0].text;
    }

    getProviderType(): AIProviderType {
        return AIProviderType.GEMINI;
    }

    async listModels(): Promise<AIModel[]> {
        return [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Legacy)' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Legacy)' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Legacy)' }
        ];
    }

    /**
     * 생성 설정 지정 (JSON 출력 등 특수 요구사항에 사용)
     */
    setGenerationConfig(config: GenerationConfig): void {
        this.generationConfig = config;
    }

    /**
     * 응답 생성 (커스텀 설정 지원)
     */
    async generateResponse(prompt: string, config?: GenerationConfig): Promise<string> {
        if (config) {
            this.setGenerationConfig(config);
        }
        return super.generateResponse(prompt);
    }

    /**
     * 다중 대화 (커스텀 설정 지원)
     */
    async chat(messages: AIMessage[], config?: GenerationConfig): Promise<string> {
        if (config) {
            this.setGenerationConfig(config);
        }
        return super.chat(messages);
    }

    /**
     * JSON 출력을 위한 편의 메서드
     */
    async generateJSONResponse(prompt: string, schema?: object): Promise<string> {
        return this.generateResponse(prompt, {
            responseMimeType: "application/json",
            responseSchema: schema
        });
    }

    /**
     * JSON 대화를 위한 편의 메서드
     */
    async chatJSON(messages: AIMessage[], schema?: object): Promise<string> {
        return this.chat(messages, {
            responseMimeType: "application/json",
            responseSchema: schema
        });
    }

    /**
     * 연결 테스트 (기본 클래스 메서드 재정의, Gemini 전용 테스트 엔드포인트 사용)
     */
    async testConnection(): Promise<boolean> {
        const url = `${this.baseUrl}/v1/models/${this.model}?key=${this.apiKey}`;
        return await this.httpClient.testConnection({
            url,
            method: 'GET',
            headers: this.buildHeaders()
        });
    }
}
