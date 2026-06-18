import { Setting, Notice } from 'obsidian';
import { BaseAIServiceSettings } from './AIServiceSettings';
import { t } from '../../i18n';
import type CommentPlugin from '../../../main';
import type { AISettings } from '../../types/ai';

type CustomApiType = NonNullable<NonNullable<AISettings['custom']>['detectedApiType']>;
type CustomAISettingsState = NonNullable<AISettings['custom']>;

const DEFAULT_CUSTOM_SETTINGS: CustomAISettingsState = {
    name: '',
    apiKey: '',
    baseUrl: '',
    model: ''
};

const CUSTOM_API_TYPE_LABELS: Record<CustomApiType, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Gemini'
};

export class CustomAISettings extends BaseAIServiceSettings {
    private detectedApiType: CustomApiType | null = null;

    constructor(plugin: CommentPlugin, containerEl: HTMLElement) {
        super(plugin, containerEl);
    }

    display(containerEl: HTMLElement): void {
        const settingsContainer = containerEl.createEl('div', {
            cls: 'ai-service-settings'
        });
        const customSettings = this.getCustomSettings();

        // 제목 및 설명 추가
        new Setting(settingsContainer)
            .setName(t('Custom AI Service'))
            .setHeading();

        // 설명 텍스트 추가
        const descEl = settingsContainer.createEl('div', {
            cls: 'setting-item-description custom-ai-description'
        });
        descEl.createEl('p', {
            text: t('Configure your own AI service provider. Supports OpenAI, Anthropic, and Gemini compatible APIs.')
        });
        descEl.createEl('p', {
            text: t('The API type will be automatically detected based on your URL.')
        });

        // 서비스 제공자 이름
        new Setting(settingsContainer)
            .setName(t('Service Name'))
            .setDesc(t('Give your custom AI service a name'))
            .addText(text => text
                .setPlaceholder(t('e.g., My AI Service'))
                .setValue(customSettings.name)
                .onChange((value) => this.updateCustomSettings(settings => {
                    settings.name = value;
                })));

        // API 엔드포인트 URL
        new Setting(settingsContainer)
            .setName(t('API Endpoint URL'))
            .setDesc(t('The base URL of your AI service API'))
            .addText(text => text
                .setPlaceholder('https://api.example.com/v1')
                .setValue(customSettings.baseUrl)
                .onChange(async (value) => {
                    await this.updateCustomSettings(settings => {
                        settings.baseUrl = value;
                        settings.detectedApiType = undefined;
                    });
                    this.detectedApiType = null;
                    this.renderDetectedApiType(settingsContainer);
                }));

        // API Key
        new Setting(settingsContainer)
            .setName(t('API Key'))
            .setDesc(t('Your API key for authentication'))
            .addText(text => {
                text
                    .setPlaceholder('sk-...')
                    .setValue(customSettings.apiKey)
                    .onChange((value) => this.updateCustomSettings(settings => {
                        settings.apiKey = value;
                    }));
                // 비밀번호 입력창으로 설정
                text.inputEl.type = 'password';
                return text;
            })
            .addButton(button => {
                button.setButtonText(t('Check'));
                button.onClick(async () => {
                    if (!this.plugin.settings.ai.custom?.apiKey || 
                        !this.plugin.settings.ai.custom?.baseUrl ||
                        !this.plugin.settings.ai.custom?.model) {
                        this.showButtonStatus(button.buttonEl, 'warning');
                        return;
                    }
                    
                    this.showButtonStatus(button.buttonEl, 'loading');
                    
                    try {
                        const success = await this.testConnection();
                        this.showButtonStatus(button.buttonEl, success ? 'success' : 'error');
                        
                        if (success) {
                            const apiType = this.plugin.settings.ai.custom?.detectedApiType;
                            if (apiType) {
                                this.detectedApiType = apiType;
                                this.renderDetectedApiType(settingsContainer);
                            }
                        }
                    } catch {
                        this.showButtonStatus(button.buttonEl, 'error');
                    }
                });
            });

        // 모델 이름
        new Setting(settingsContainer)
            .setName(t('Model'))
            .setDesc(t('The model identifier to use'))
            .addText(text => text
                .setPlaceholder('gpt-4, claude-3-opus, gemini-pro, etc.')
                .setValue(customSettings.model)
                .onChange((value) => this.updateCustomSettings(settings => {
                    settings.model = value;
                })));

        // 감지된 API 유형 표시 (있는 경우)
        this.renderDetectedApiType(settingsContainer);

        // 고급 옵션 (선택적 커스텀 헤더)
        const advancedSetting = new Setting(settingsContainer)
            .setName(t('Advanced Options'))
            .setDesc(t('Optional custom headers (JSON format)'));

        advancedSetting.descEl.createEl('br');
        advancedSetting.descEl.createEl('small', {
            text: t('Example: {"X-Custom-Header": "value"}')
        });

        advancedSetting.addTextArea(text => {
            text
                .setPlaceholder('{}')
                .setValue(customSettings.headers
                    ? JSON.stringify(customSettings.headers, null, 2)
                    : '')
                .onChange(async (value) => {
                    if (!value.trim()) {
                        await this.updateCustomSettings(settings => {
                            settings.headers = undefined;
                        });
                        return;
                    }

                    try {
                        const headers = JSON.parse(value) as unknown;
                        if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
                            new Notice(t('Invalid JSON format. Headers must be an object.'));
                            return;
                        }

                        await this.updateCustomSettings(settings => {
                            settings.headers = headers as Record<string, string>;
                        });
                    } catch {
                        new Notice(t('Invalid JSON format'));
                    }
                });
            
            text.inputEl.rows = 4;
            text.inputEl.addClass('custom-ai-headers-input');
            return text;
        });
    }

    private getCustomSettings(): CustomAISettingsState {
        if (!this.plugin.settings.ai.custom) {
            this.plugin.settings.ai.custom = { ...DEFAULT_CUSTOM_SETTINGS };
        }

        return this.plugin.settings.ai.custom;
    }

    private async updateCustomSettings(
        update: (settings: CustomAISettingsState) => void
    ): Promise<void> {
        update(this.getCustomSettings());
        await this.plugin.saveSettings();
    }

    private renderDetectedApiType(container: HTMLElement): void {
        const infoEl = container.querySelector('.custom-ai-info');
        const apiType = this.getCustomSettings().detectedApiType || this.detectedApiType;

        if (!apiType) {
            infoEl?.remove();
            return;
        }

        const label = CUSTOM_API_TYPE_LABELS[apiType] || apiType;
        if (infoEl) {
            const span = infoEl.querySelector('span');
            if (span) {
                span.textContent = label;
            }
            return;
        }

        const newInfoEl = container.createEl('div', {
            cls: 'setting-item-description custom-ai-info'
        });
        newInfoEl.createEl('strong', { text: t('Detected API Type: ') });
        newInfoEl.createEl('span', { text: label });
    }

    private async testConnection(): Promise<boolean> {
        try {
            // CustomAIService 동적 임포트
            const { CustomAIService } = await import('../../services/ai/CustomAIService');

            // 테스트용 임시 서비스 인스턴스 생성
            const customSettings = this.getCustomSettings();
            
            const tempService = new CustomAIService(
                customSettings.apiKey,
                customSettings.baseUrl,
                customSettings.model,
                customSettings.headers,
                customSettings.detectedApiType
            );
            
            // 연결 테스트
            const result = await tempService.testConnection();

            // 테스트 성공 시 감지된 API 유형 저장
            if (result) {
                const detectedType = tempService.getDetectedAPIType();
                if (detectedType && customSettings) {
                    customSettings.detectedApiType = detectedType;
                    await this.plugin.saveSettings();
                }
            }
            
            return result;
        } catch (error) {
            console.error('Test connection error:', error);
            return false;
        }
    }
}
