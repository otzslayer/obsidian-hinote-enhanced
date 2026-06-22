import { BaseHTTPClient } from './BaseHTTPClient';
import {
    IAIService,
    AIMessage,
    AIServiceConfig,
    AIProviderType,
    AIModel,
    AIServiceError,
    AIErrorCode
} from './types';

// 다른 서비스에서 사용할 수 있도록 타입 재내보내기
export type {
    IAIService,
    AIMessage,
    AIServiceConfig,
    AIModel
};

export { 
    AIProviderType, 
    AIServiceError,
    AIErrorCode
};

/**
 * AI 서비스 추상 기본 클래스
 * 모든 AI 서비스에 통일된 인터페이스와 공통 기능을 제공합니다
 */
export abstract class BaseAIService implements IAIService {
    protected httpClient: BaseHTTPClient;
    protected apiKey: string;
    protected model: string;
    protected baseUrl: string;
    protected temperature: number;
    protected maxTokens: number;

    constructor(config: AIServiceConfig) {
        this.httpClient = new BaseHTTPClient();
        this.apiKey = config.apiKey;
        this.model = config.model;
        this.baseUrl = config.baseUrl || this.getDefaultBaseUrl();
        this.temperature = config.temperature ?? 0.7;
        this.maxTokens = config.maxTokens ?? 2048;
    }

    /**
     * 기본 API 엔드포인트 URL 가져오기
     * 하위 클래스에서 반드시 구현해야 합니다
     */
    protected abstract getDefaultBaseUrl(): string;

    /**
     * API 엔드포인트 경로 가져오기
     * 하위 클래스에서 반드시 구현해야 합니다
     */
    protected abstract getEndpoint(): string;

    /**
     * 요청 본문 형식화
     * 하위 클래스에서 반드시 구현해야 하며, 통일된 메시지 형식을 특정 API 형식으로 변환합니다
     */
    protected abstract formatRequestBody(messages: AIMessage[]): Record<string, unknown>;

    /**
     * 응답 파싱
     * 하위 클래스에서 반드시 구현해야 하며, API 응답에서 텍스트 내용을 추출합니다
     */
    protected abstract parseResponse(response: unknown): string;

    /**
     * 공급자 유형 가져오기
     * 하위 클래스에서 반드시 구현해야 합니다
     */
    abstract getProviderType(): AIProviderType;

    /**
     * 사용 가능한 모델 목록 조회
     * 하위 클래스에서 반드시 구현해야 합니다
     */
    abstract listModels(): Promise<AIModel[]>;

    /**
     * 요청 헤더 생성
     * 하위 클래스에서 재정의하여 요청 헤더를 커스터마이징할 수 있습니다
     */
    protected buildHeaders(): Record<string, string> {
        return BaseHTTPClient.buildAuthHeaders(this.apiKey);
    }

    /**
     * 모델 업데이트
     */
    updateModel(model: string): void {
        this.model = model;
    }

    /**
     * 설정 완료 여부 확인
     */
    isConfigured(): boolean {
        return !!(this.apiKey && this.model);
    }

    /**
     * 응답 생성 (단일 대화)
     */
    async generateResponse(prompt: string): Promise<string> {
        const messages: AIMessage[] = [
            { role: 'user', content: prompt }
        ];
        return await this.chat(messages);
    }

    /**
     * 다중 대화
     * 핵심 메서드로, 모든 AI 서비스가 동일한 흐름을 사용합니다
     */
    async chat(messages: AIMessage[]): Promise<string> {
        try {
            const url = this.buildUrl();
            const requestBody = this.formatRequestBody(messages);
            
            const response = await this.httpClient.request({
                url,
                method: 'POST',
                headers: this.buildHeaders(),
                body: JSON.stringify(requestBody)
            });

            return this.parseResponse(response);
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * 연결 테스트
     */
    async testConnection(): Promise<boolean> {
        try {
            const url = this.buildUrl();
            const testMessages: AIMessage[] = [
                { role: 'user', content: 'test' }
            ];
            const requestBody = this.formatRequestBody(testMessages);

            return await this.httpClient.testConnection({
                url,
                method: 'POST',
                headers: this.buildHeaders(),
                body: JSON.stringify(requestBody)
            });
        } catch {
            return false;
        }
    }

    /**
     * 전체 URL 생성
     * 하위 클래스에서 재정의하여 URL 생성 로직을 커스터마이징할 수 있습니다
     */
    protected buildUrl(): string {
        return `${this.baseUrl}${this.getEndpoint()}`;
    }

    /**
     * 오류 처리
     * 원시 오류를 AIServiceError로 래핑합니다
     */
    protected handleError(error: unknown): AIServiceError {
        // 이미 AIServiceError인 경우 그대로 반환
        if (error instanceof AIServiceError) {
            return error;
        }

        // 오류 유형 판별
        let code = AIErrorCode.API_ERROR;
        const message = error instanceof Error ? error.message : 'Unknown error';

        if (message.includes('connect') || message.includes('ECONNREFUSED')) {
            code = AIErrorCode.CONNECTION_FAILED;
        } else if (message.includes('rate limit') || message.includes('429')) {
            code = AIErrorCode.RATE_LIMIT;
        } else if (message.includes('401') || message.includes('403') || message.includes('API key')) {
            code = AIErrorCode.INVALID_API_KEY;
        } else if (message.includes('404') || message.includes('model')) {
            code = AIErrorCode.MODEL_NOT_FOUND;
        }

        return new AIServiceError(
            message,
            this.getProviderType(),
            code,
            error instanceof Error ? error : undefined
        );
    }

    /**
     * 응답 형식 검증
     * 범용 응답 검증 보조 메서드
     */
    protected validateResponse(response: unknown, path: string[]): boolean {
        let current: unknown = response;
        for (const key of path) {
            if (!current || typeof current !== 'object' || !(key in current)) {
                return false;
            }
            current = (current as Record<string, unknown>)[key];
        }
        return true;
    }
}
