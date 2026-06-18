import type { AISettings } from '../../types/ai';

/**
 * AI 서비스 타입 정의
 * 통일된 AI 서비스 인터페이스 및 타입
 */

/**
 * AI 서비스 공급자 열거형
 */
export enum AIProviderType {
    OPENAI = 'openai',
    ANTHROPIC = 'anthropic',
    GEMINI = 'gemini',
    DEEPSEEK = 'deepseek',
    SILICONFLOW = 'siliconflow',
    OLLAMA = 'ollama',
    CUSTOM = 'custom'
}

/**
 * AI 메시지 인터페이스
 */
export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/**
 * AI 모델 인터페이스
 */
export interface AIModel {
    id: string;
    name: string;
    isCustom?: boolean;
}

/**
 * AI 서비스 설정
 */
export interface AIServiceConfig {
    apiKey: string;
    model: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
    customHeaders?: Record<string, string>;
}

/**
 * AI 오류 코드
 */
export enum AIErrorCode {
    NOT_CONFIGURED = 'NOT_CONFIGURED',
    CONNECTION_FAILED = 'CONNECTION_FAILED',
    INVALID_RESPONSE = 'INVALID_RESPONSE',
    API_ERROR = 'API_ERROR',
    RATE_LIMIT = 'RATE_LIMIT',
    INVALID_API_KEY = 'INVALID_API_KEY',
    MODEL_NOT_FOUND = 'MODEL_NOT_FOUND'
}

/**
 * AI 서비스 오류 클래스
 */
export class AIServiceError extends Error {
    constructor(
        message: string,
        public provider: AIProviderType,
        public code: AIErrorCode,
        public originalError?: Error
    ) {
        super(message);
        this.name = 'AIServiceError';
        
        // 오류 스택 유지
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AIServiceError);
        }
    }

    /**
     * 미설정 오류 생성
     */
    static notConfigured(provider: AIProviderType, detail?: string): AIServiceError {
        const message = detail 
            ? `${provider} service not configured: ${detail}`
            : `${provider} service not configured`;
        return new AIServiceError(message, provider, AIErrorCode.NOT_CONFIGURED);
    }

    /**
     * 연결 실패 오류 생성
     */
    static connectionFailed(provider: AIProviderType, originalError?: Error): AIServiceError {
        return new AIServiceError(
            `Failed to connect to ${provider} service`,
            provider,
            AIErrorCode.CONNECTION_FAILED,
            originalError
        );
    }

    /**
     * 잘못된 응답 오류 생성
     */
    static invalidResponse(provider: AIProviderType, detail?: string): AIServiceError {
        const message = detail
            ? `Invalid response from ${provider}: ${detail}`
            : `Invalid response from ${provider}`;
        return new AIServiceError(message, provider, AIErrorCode.INVALID_RESPONSE);
    }

    /**
     * API 오류 생성
     */
    static apiError(provider: AIProviderType, message: string, originalError?: Error): AIServiceError {
        return new AIServiceError(message, provider, AIErrorCode.API_ERROR, originalError);
    }
}

/**
 * AI 서비스 인터페이스
 * 모든 AI 서비스는 이 인터페이스를 구현해야 합니다
 */
export interface IAIService {
    /**
     * 다중 대화
     */
    chat(messages: AIMessage[]): Promise<string>;

    /**
     * 단일 생성
     */
    generateResponse(prompt: string): Promise<string>;

    /**
     * 연결 테스트
     */
    testConnection(): Promise<boolean>;

    /**
     * 모델 업데이트
     */
    updateModel(model: string): void;

    /**
     * 사용 가능한 모델 목록 조회
     */
    listModels(): Promise<AIModel[]>;

    /**
     * 공급자 유형 가져오기
     */
    getProviderType(): AIProviderType;

    /**
     * 설정 완료 여부 확인
     */
    isConfigured(): boolean;
}

/**
 * AI 서비스 팩토리 인터페이스
 */
export interface IAIServiceFactory {
    /**
     * 서비스 인스턴스 생성
     */
    create(settings: AISettings): IAIService;

    /**
     * 해당 공급자 지원 여부 확인
     */
    supports(provider: AIProviderType): boolean;

    /**
     * 공급자 유형 가져오기
     */
    getProviderType(): AIProviderType;
}
