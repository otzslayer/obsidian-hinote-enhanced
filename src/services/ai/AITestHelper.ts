import { Notice } from 'obsidian';
import { t } from '../../i18n';
import type { IAIService } from './types';

/**
 * AI 서비스 테스트 보조 도구
 * 통일된 테스트 피드백 및 오류 처리를 제공합니다
 */
export class AITestHelper {
    /**
     * 통합 연결 테스트 (사용자 피드백 포함)
     */
    static async testConnection(
        service: IAIService,
        providerName: string
    ): Promise<boolean> {
        // 테스트 중 안내 메시지 표시
        const loadingNotice = new Notice(
            `⏳ ${t('Testing')} ${providerName} ${t('connection')}...`, 
            0  // 자동으로 닫히지 않음
        );

        try {
            const result = await service.testConnection();
            loadingNotice.hide();

            if (result) {
                new Notice(
                    `✓ ${providerName} ${t('connection successful!')}`,
                    3000
                );
            } else {
                new Notice(
                    `✗ ${providerName} ${t('connection failed. Please check your configuration.')}`,
                    5000
                );
            }

            return result;
        } catch (error) {
            loadingNotice.hide();
            
            const errorMessage = this.getErrorMessage(error);
            new Notice(
                `✗ ${providerName} ${t('test failed')}: ${errorMessage}`,
                5000
            );
            
            console.error(`${providerName} connection test error:`, error);
            return false;
        }
    }

    /**
     * API Key 입력 여부 확인
     */
    static checkApiKey(apiKey: string | undefined, providerName: string): boolean {
        if (!apiKey || apiKey.trim() === '') {
            new Notice(
                `⚠️ ${t('Please enter your')} ${providerName} ${t('API Key first.')}`,
                4000
            );
            return false;
        }
        return true;
    }

    /**
     * 호스트 주소 입력 여부 확인 (Ollama 등에 사용)
     */
    static checkHost(host: string | undefined, providerName: string): boolean {
        if (!host || host.trim() === '') {
            new Notice(
                `⚠️ ${t('Please enter your')} ${providerName} ${t('host address first.')}`,
                4000
            );
            return false;
        }
        return true;
    }

    /**
     * 사용자 친화적인 오류 메시지 가져오기
     */
    private static getErrorMessage(error: unknown): string {
        const message = error instanceof Error ? error.message : String(error);

        // 오류 유형에 따라 사용자 친화적인 메시지 반환
        if (message.includes('401') || message.includes('Unauthorized')) {
            return t('Invalid API Key');
        } else if (message.includes('403') || message.includes('Forbidden')) {
            return t('Access denied');
        } else if (message.includes('429') || message.includes('rate limit')) {
            return t('Rate limit exceeded');
        } else if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
            return t('Connection timeout');
        } else if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
            return t('Service unavailable');
        } else if (message.includes('404') || message.includes('Not Found')) {
            return t('Service not found');
        } else if (message.includes('500') || message.includes('Internal Server Error')) {
            return t('Server error');
        }

        // 원본 오류 메시지 반환 (너무 긴 메시지는 잘라냅니다)
        return message.length > 100 ? message.substring(0, 100) + '...' : message;
    }

    /**
     * 성공 메시지 표시
     */
    static showSuccess(message: string): void {
        new Notice(`✓ ${message}`, 3000);
    }

    /**
     * 오류 메시지 표시
     */
    static showError(message: string): void {
        new Notice(`✗ ${message}`, 5000);
    }

    /**
     * 경고 메시지 표시
     */
    static showWarning(message: string): void {
        new Notice(`⚠️ ${message}`, 4000);
    }
}
