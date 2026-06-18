import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';

/**
 * HTTP 요청 설정 인터페이스
 */
export interface HTTPRequestConfig {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
}

interface HTTPErrorBody {
    error?: string | { message?: string };
}

/**
 * 기본 HTTP 클라이언트
 * 모든 AI 서비스에 통일된 HTTP 요청 처리를 제공합니다
 */
export class BaseHTTPClient {
    /**
     * HTTP 요청 전송
     */
    async request<T = unknown>(config: HTTPRequestConfig): Promise<T> {
        try {
            const requestConfig: RequestUrlParam = {
                url: config.url,
                method: config.method,
                headers: config.headers || {},
                body: config.body,
                throw: false
            };

            const response: RequestUrlResponse = await requestUrl(requestConfig);

            // 응답 상태 확인
            if (response.status < 200 || response.status >= 300) {
                throw this.createHTTPError(response);
            }

            // JSON 응답 파싱
            return response.json as T;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * 연결 테스트
     */
    async testConnection(config: HTTPRequestConfig): Promise<boolean> {
        try {
            const response = await requestUrl({
                url: config.url,
                method: config.method,
                headers: config.headers || {},
                body: config.body,
                throw: false
            });

            return response.status >= 200 && response.status < 300;
        } catch {
            return false;
        }
    }

    /**
     * HTTP 오류 생성
     */
    private createHTTPError(response: RequestUrlResponse): Error {
        let errorMessage = `HTTP ${response.status}`;
        
        try {
            // 오류 응답 파싱 시도
            const errorData = response.json as HTTPErrorBody | undefined;
            if (errorData?.error) {
                if (typeof errorData.error === 'string') {
                    errorMessage = errorData.error;
                } else if (errorData.error.message) {
                    errorMessage = errorData.error.message;
                }
            } else if (response.text) {
                errorMessage = response.text;
            }
        } catch {
            // JSON을 파싱할 수 없는 경우 원본 텍스트 사용
            if (response.text) {
                errorMessage = response.text;
            }
        }

        return new Error(errorMessage);
    }

    /**
     * 통합 오류 처리
     */
    private handleError(error: unknown): Error {
        if (error instanceof Error) {
            return error;
        }
        
        if (typeof error === 'string') {
            return new Error(error);
        }
        
        return new Error('Unknown error occurred');
    }

    /**
     * 표준 JSON 요청 헤더 생성
     */
    static buildJSONHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            ...additionalHeaders
        };
    }

    /**
     * 인증이 포함된 요청 헤더 생성
     */
    static buildAuthHeaders(apiKey: string, authType: 'Bearer' | 'ApiKey' = 'Bearer'): Record<string, string> {
        if (authType === 'Bearer') {
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
        } else {
            return {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            };
        }
    }
}
