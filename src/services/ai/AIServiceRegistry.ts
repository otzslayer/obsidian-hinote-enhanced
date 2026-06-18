/**
 * AI 서비스 레지스트리
 * 모든 AI 서비스의 등록 및 생성을 관리합니다
 */

import { IAIService, IAIServiceFactory, AIProviderType, AIServiceError } from './BaseAIService';
import type { AISettings } from '../../types/ai';

export class AIServiceRegistry {
    private factories = new Map<AIProviderType, IAIServiceFactory>();
    private instances = new Map<AIProviderType, IAIService>();
    
    /**
     * 서비스 팩토리 등록
     */
    register(factory: IAIServiceFactory): void {
        const provider = factory.getProviderType();
        this.factories.set(provider, factory);
    }
    
    /**
     * 서비스 팩토리 일괄 등록
     */
    registerAll(factories: IAIServiceFactory[]): void {
        factories.forEach(factory => this.register(factory));
    }
    
    /**
     * 서비스 인스턴스 가져오기 (지연 로딩)
     */
    getService(provider: AIProviderType, config: AISettings): IAIService {
        // 캐시 확인
        if (this.instances.has(provider)) {
            const instance = this.instances.get(provider)!;
            // 이미 설정된 경우 바로 반환
            if (instance.isConfigured()) {
                return instance;
            }
        }

        // 팩토리 가져오기
        const factory = this.factories.get(provider);
        if (!factory) {
            throw AIServiceError.notConfigured(
                provider,
                `Provider ${provider} not registered`
            );
        }
        
        // 인스턴스 생성 및 캐싱
        const service = factory.create(config);
        this.instances.set(provider, service);
        return service;
    }
    
    /**
     * 서비스 등록 여부 확인
     */
    isRegistered(provider: AIProviderType): boolean {
        return this.factories.has(provider);
    }
    
    /**
     * 캐시 초기화 (설정 업데이트 시 사용)
     */
    clearCache(provider?: AIProviderType): void {
        if (provider) {
            this.instances.delete(provider);
        } else {
            this.instances.clear();
        }
    }
    
    /**
     * 등록된 모든 공급자 가져오기
     */
    getRegisteredProviders(): AIProviderType[] {
        return Array.from(this.factories.keys());
    }
    
    /**
     * 생성된 모든 서비스 인스턴스 가져오기
     */
    getActiveServices(): AIProviderType[] {
        return Array.from(this.instances.keys());
    }
}
