/**
 * AI 서비스 관리자
 * 통일된 AI 서비스 접근 인터페이스를 제공하며, 기존 AIService를 대체합니다
 */

import { AIMessage, AIModel, AIProviderType, IAIService } from './BaseAIService';
import type { AISettings } from '../../types/ai';
import { AI_SERVICE_FACTORIES } from './factories';

export class AIServiceManager {
    private instances = new Map<AIProviderType, IAIService>();
    private currentProvider: AIProviderType;
    private settings: AISettings;
    
    constructor(settings: AISettings) {
        this.settings = settings;
        this.currentProvider = this.parseProvider(settings.provider);
    }

    /**
     * 서비스 인스턴스 가져오기 (지연 생성 + 캐싱)
     * 캐시된 인스턴스가 설정 완료 상태일 때만 재사용하고, 그렇지 않으면 새로 생성합니다
     */
    private getService(provider: AIProviderType): IAIService {
        const cached = this.instances.get(provider);
        if (cached?.isConfigured()) {
            return cached;
        }

        const service = AI_SERVICE_FACTORIES[provider](this.settings);
        this.instances.set(provider, service);
        return service;
    }

    /**
     * 캐시 초기화 (설정 업데이트 시 사용)
     */
    private clearCache(provider?: AIProviderType): void {
        if (provider) {
            this.instances.delete(provider);
        } else {
            this.instances.clear();
        }
    }

    /**
     * 현재 서비스 인스턴스 가져오기
     */
    private getCurrentService() {
        return this.getService(this.currentProvider);
    }
    
    /**
     * 응답 생성 (프롬프트 템플릿 처리)
     */
    async generateResponse(prompt: string, highlight: string, comment?: string): Promise<string> {
        const processedPrompt = this.processPrompt(prompt, highlight, comment);
        return await this.getCurrentService().generateResponse(processedPrompt);
    }
    
    /**
     * 다중 대화
     */
    async chat(messages: AIMessage[]): Promise<string> {
        return await this.getCurrentService().chat(messages);
    }
    
    /**
     * 연결 테스트
     */
    async testConnection(provider?: AIProviderType): Promise<boolean> {
        const targetProvider = provider || this.currentProvider;
        try {
            const service = this.getService(targetProvider);
            return await service.testConnection();
        } catch {
            return false;
        }
    }
    
    /**
     * 모델 업데이트
     */
    updateModel(provider: AIProviderType, model: string): void {
        // 캐시를 지우고, 다음 조회 시 새 모델을 사용합니다
        this.clearCache(provider);

        // 설정의 모델 업데이트
        switch (provider) {
            case AIProviderType.OPENAI:
                if (this.settings.openai) this.settings.openai.model = model;
                break;
            case AIProviderType.ANTHROPIC:
                if (this.settings.anthropic) this.settings.anthropic.model = model;
                break;
            case AIProviderType.GEMINI:
                if (this.settings.gemini) this.settings.gemini.model = model;
                break;
            case AIProviderType.DEEPSEEK:
                if (this.settings.deepseek) this.settings.deepseek.model = model;
                break;
            case AIProviderType.SILICONFLOW:
                if (this.settings.siliconflow) this.settings.siliconflow.model = model;
                break;
            case AIProviderType.OLLAMA:
                if (this.settings.ollama) this.settings.ollama.model = model;
                break;
            case AIProviderType.CUSTOM:
                if (this.settings.custom) this.settings.custom.model = model;
                break;
        }
    }
    
    /**
     * 모델 목록 조회
     */
    async listModels(provider?: AIProviderType): Promise<AIModel[]> {
        const targetProvider = provider || this.currentProvider;
        try {
            const service = this.getService(targetProvider);
            return await service.listModels();
        } catch (error) {
            console.error(`Failed to list models for ${targetProvider}:`, error);
            return [];
        }
    }
    
    /**
     * 공급자 전환
     */
    switchProvider(provider: AIProviderType): void {
        this.currentProvider = provider;
        this.settings.provider = provider;
    }
    
    /**
     * 현재 공급자 가져오기
     */
    getCurrentProvider(): AIProviderType {
        return this.currentProvider;
    }
    
    /**
     * 등록된 모든 공급자 가져오기
     */
    getRegisteredProviders(): AIProviderType[] {
        return Object.keys(AI_SERVICE_FACTORIES) as AIProviderType[];
    }
    
    /**
     * 프롬프트 템플릿 처리
     * {{highlight}}와 {{comment}} 플레이스홀더를 교체합니다
     * 프롬프트에 플레이스홀더가 없으면 하이라이트 텍스트를 컨텍스트로 자동 추가합니다
     */
    private processPrompt(prompt: string, highlight: string, comment?: string): string {
        let processed = prompt;

        // {{highlight}} 플레이스홀더 포함 여부 확인
        const hasHighlightPlaceholder = prompt.includes('{{highlight}}');
        const hasCommentPlaceholder = prompt.includes('{{comment}}');

        // 플레이스홀더 교체
        if (hasHighlightPlaceholder) {
            processed = processed.replace(/\{\{highlight\}\}/g, highlight);
        }
        if (hasCommentPlaceholder && comment) {
            processed = processed.replace(/\{\{comment\}\}/g, comment);
        }
        
        // 플레이스홀더가 없으면 하이라이트 텍스트를 컨텍스트로 자동 추가
        if (!hasHighlightPlaceholder && highlight) {
            processed = `${processed}\n\n${highlight}`;
        }
        
        return processed;
    }
    
    /**
     * 공급자 유형 파싱
     */
    private parseProvider(provider: string): AIProviderType {
        const providerMap: Record<string, AIProviderType> = {
            'openai': AIProviderType.OPENAI,
            'anthropic': AIProviderType.ANTHROPIC,
            'gemini': AIProviderType.GEMINI,
            'deepseek': AIProviderType.DEEPSEEK,
            'siliconflow': AIProviderType.SILICONFLOW,
            'ollama': AIProviderType.OLLAMA,
            'custom': AIProviderType.CUSTOM
        };
        return providerMap[provider] || AIProviderType.OPENAI;
    }
    
    /**
     * 설정 업데이트
     * 설정이 변경될 때 호출하며, 모든 캐시를 초기화합니다
     */
    updateSettings(settings: AISettings): void {
        this.settings = settings;
        this.currentProvider = this.parseProvider(settings.provider);
        this.clearCache();
    }
}
