import { Setting, Notice, setIcon } from 'obsidian';
import { t } from '../../i18n';
import type CommentPlugin from '../../../main';
import type { AISettings } from '../../types/ai';

export interface AIModel {
    id: string;
    name: string;
    isCustom?: boolean;
}

export interface AIServiceSettings {
    display(containerEl: HTMLElement): void;
}

/**
 * AI 서비스 제공자 설정
 * 서브클래스는 이 인터페이스를 구현하여 자체 특수 파라미터를 정의
 */
export interface AIProviderConfig {
    /** 설정 키 이름, 예: 'openai', 'anthropic' 등 */
    settingsKey: Exclude<keyof AISettings, 'provider' | 'prompts'>;
    /** 서비스 표시 이름, 예: 'OpenAI service' */
    serviceName: string;
    /** 기본 모델 목록 */
    defaultModels: AIModel[];
    /** API Key 플레이스홀더, 예: 'sk-...' */
    apiKeyPlaceholder: string;
    /** Provider URL 플레이스홀더, 예: 'https://api.openai.com/v1' */
    providerUrlPlaceholder: string;
    /** Provider URL 설정 키 이름 (일부는 apiAddress, 일부는 baseUrl 사용) */
    providerUrlKey?: string;
    /** 기본 설정 객체 (초기화용) */
    defaultSettings: ProviderSettingsRecord;
}

/**
 * 표준 모델 상태
 */
export interface StandardModelState {
    selectedModel: AIModel;
    apiKey: string;
}

type ProviderSettingValue = string | number | boolean | undefined;
type ProviderSettingsRecord = Record<string, ProviderSettingValue>;

export abstract class BaseAIServiceSettings implements AIServiceSettings {
    protected plugin: CommentPlugin;
    protected containerEl: HTMLElement;

    constructor(plugin: CommentPlugin, containerEl: HTMLElement) {
        this.plugin = plugin;
        this.containerEl = containerEl;
    }

    abstract display(containerEl: HTMLElement): void;

    // ==================== 표준 AI 설정 공통 메서드 ====================

    /**
     * 지정된 제공자의 설정 객체 가져오기, 없으면 기본값으로 초기화
     */
    protected getProviderSettings(config: AIProviderConfig): ProviderSettingsRecord {
        const aiSettings = this.plugin.settings.ai as unknown as Record<string, ProviderSettingsRecord | undefined>;
        if (!aiSettings[config.settingsKey]) {
            aiSettings[config.settingsKey] = { ...config.defaultSettings };
        }
        return aiSettings[config.settingsKey]!;
    }

    protected getProviderSettingString(
        config: AIProviderConfig,
        key: string,
        fallback = ''
    ): string {
        const value = this.getProviderSettings(config)[key];
        return typeof value === 'string' ? value : fallback;
    }

    /**
     * 표준 모델 상태 초기화 로직
     * 기본 모델 및 커스텀 모델 복원 처리
     */
    protected initializeStandardModelState(config: AIProviderConfig): StandardModelState {
        const settings = this.getProviderSettings(config);
        const savedModelId = this.getProviderSettingString(config, 'model', config.defaultModels[0]?.id || '');
        let selectedModel: AIModel;

        if (settings.isCustomModel) {
            selectedModel = {
                id: savedModelId,
                name: savedModelId,
                isCustom: true
            };
        } else {
            const savedModel = config.defaultModels.find(m => m.id === savedModelId);
            selectedModel = savedModel || config.defaultModels[0];
            if (!savedModel) {
                settings.model = selectedModel.id;
            }
        }

        return {
            selectedModel,
            apiKey: this.getProviderSettingString(config, 'apiKey')
        };
    }

    /**
     * 표준 모델 상태 저장 로직
     */
    protected async saveStandardModelState(config: AIProviderConfig, modelState: StandardModelState): Promise<void> {
        const settings = this.getProviderSettings(config);
        const model = modelState.selectedModel;

        settings.model = model.id;
        settings.isCustomModel = !!model.isCustom;
        settings.apiKey = modelState.apiKey || '';

        if (model.isCustom && model.id) {
            settings.lastCustomModel = model.id;
        }

        await this.plugin.saveSettings();
    }

    /**
     * 표준 API Key 입력 + Check 버튼 렌더링
     * onCheck 콜백은 boolean 반환: true는 성공, false는 실패
     */
    protected renderApiKeySetting(
        container: HTMLElement,
        config: AIProviderConfig,
        modelState: StandardModelState,
        onCheck: () => Promise<boolean>
    ): void {
        new Setting(container)
            .setName(t('API Key'))
            .setDesc(t('Please enter your API Key.'))
            .addText(text => text
                .setPlaceholder(config.apiKeyPlaceholder)
                .setValue(modelState.apiKey)
                .onChange(async (value) => {
                    modelState.apiKey = value;
                    await this.saveStandardModelState(config, modelState);
                }))
            .addButton(button => {
                button.setButtonText(t('Check'));
                button.onClick(async () => {
                    if (!modelState.apiKey || modelState.apiKey.trim() === '') {
                        this.showButtonStatus(button.buttonEl, 'warning');
                        return;
                    }
                    this.showButtonStatus(button.buttonEl, 'loading');
                    try {
                        const success = await onCheck();
                        this.showButtonStatus(button.buttonEl, success ? 'success' : 'error');
                    } catch {
                        this.showButtonStatus(button.buttonEl, 'error');
                    }
                });
            });
    }

    /**
     * 버튼에 상태 아이콘 표시
     * @param buttonEl 버튼 DOM 요소
     * @param status 상태 유형
     */
    protected showButtonStatus(
        buttonEl: HTMLButtonElement,
        status: 'loading' | 'success' | 'error' | 'warning'
    ): void {
        const originalText = buttonEl.textContent || t('Check');
        buttonEl.empty();
        buttonEl.disabled = status === 'loading';
        buttonEl.removeClass('check-btn-loading', 'check-btn-success', 'check-btn-error', 'check-btn-warning');

        switch (status) {
            case 'loading':
                setIcon(buttonEl, 'loader-2');
                buttonEl.addClass('check-btn-loading');
                break;
            case 'success':
                setIcon(buttonEl, 'check');
                buttonEl.addClass('check-btn-success');
                this.resetButtonAfterDelay(buttonEl, originalText, 2000);
                break;
            case 'error':
                setIcon(buttonEl, 'x');
                buttonEl.addClass('check-btn-error');
                this.resetButtonAfterDelay(buttonEl, originalText, 2000);
                break;
            case 'warning':
                setIcon(buttonEl, 'alert-triangle');
                buttonEl.addClass('check-btn-warning');
                this.resetButtonAfterDelay(buttonEl, originalText, 2000);
                break;
        }
    }

    /**
     * 지연 후 버튼을 기본 상태로 복원
     */
    protected resetButtonAfterDelay(buttonEl: HTMLButtonElement, text: string, delayMs: number): void {
        window.setTimeout(() => {
            buttonEl.empty();
            buttonEl.textContent = text;
            buttonEl.disabled = false;
            buttonEl.removeClass('check-btn-loading', 'check-btn-success', 'check-btn-error', 'check-btn-warning');
        }, delayMs);
    }

    /**
     * 표준 모델 드롭다운 + 커스텀 모델 입력 렌더링
     * 서브클래스가 참조를 저장하도록 { modelSelectEl, customModelContainer } 반환
     */
    protected renderModelSelector(
        container: HTMLElement,
        config: AIProviderConfig,
        modelState: StandardModelState,
        refs: { modelSelectEl: HTMLSelectElement | null; customModelContainer: HTMLDivElement | null }
    ): void {
        const modelSetting = new Setting(container)
            .setName(t('Model'))
            .setDesc(t('Select a model or enter a custom one.'))
            .addDropdown(dropdown => {
                config.defaultModels.forEach(model => {
                    dropdown.addOption(model.id, model.name);
                });
                dropdown.addOption('custom', t('Custom Model'));

                const currentValue = modelState.selectedModel.isCustom ? 'custom' : modelState.selectedModel.id;
                dropdown.setValue(currentValue);

                refs.modelSelectEl = dropdown.selectEl;

                dropdown.onChange(async (value) => {
                    if (value === 'custom') {
                        await this.showStandardCustomModelInput(config, modelState, refs);
                    } else {
                        const selectedModel = config.defaultModels.find(m => m.id === value);
                        if (selectedModel) {
                            if (modelState.selectedModel.isCustom) {
                                const settings = this.getProviderSettings(config);
                                settings.lastCustomModel = modelState.selectedModel.id;
                                await this.plugin.saveSettings();
                            }
                            modelState.selectedModel = selectedModel;
                            await this.saveStandardModelState(config, modelState);
                            this.hideStandardCustomModelInput(refs);
                        }
                    }
                });

                return dropdown;
            });

        // 커스텀 모델 입력 컨테이너 생성
        refs.customModelContainer = modelSetting.settingEl.createDiv('custom-model-container');
        refs.customModelContainer.addClass('custom-model-container');

        const dropdownEl = modelSetting.settingEl.querySelector('.setting-item-control');
        if (dropdownEl) {
            dropdownEl.addClass('openai-dropdown-container');
            dropdownEl.insertBefore(refs.customModelContainer, dropdownEl.firstChild);
        }

        // 커스텀 모델 입력창 추가
        const textComponent = new Setting(refs.customModelContainer)
            .addText(text => text
                .setPlaceholder('model-id')
                .setValue(modelState.selectedModel.isCustom ? modelState.selectedModel.id : '')
                .onChange(async (value) => {
                    const trimmedValue = value.trim();
                    if (!trimmedValue) return;

                    if (!/^[a-zA-Z0-9-_./:]+$/.test(trimmedValue)) {
                        new Notice(t('Model ID can only contain letters, numbers, underscores, dots and hyphens.'));
                        text.setValue(modelState.selectedModel.id);
                        return;
                    }

                    modelState.selectedModel = {
                        id: trimmedValue,
                        name: trimmedValue,
                        isCustom: true
                    };
                    await this.saveStandardModelState(config, modelState);
                }));

        const settingItem = textComponent.settingEl;
        settingItem.addClass('openai-setting-no-border');
        const controlEl = settingItem.querySelector('.setting-item-control');
        if (controlEl) {
            controlEl.addClass('openai-setting-no-margin');
        }

        if (modelState.selectedModel.isCustom) {
            void this.showStandardCustomModelInput(config, modelState, refs);
        }
    }

    /**
     * 커스텀 모델 입력창 표시
     */
    protected async showStandardCustomModelInput(
        config: AIProviderConfig,
        modelState: StandardModelState,
        refs: { modelSelectEl: HTMLSelectElement | null; customModelContainer: HTMLDivElement | null }
    ): Promise<void> {
        if (refs.customModelContainer && refs.modelSelectEl) {
            refs.customModelContainer.addClass('visible');
            refs.modelSelectEl.value = 'custom';

            const settings = this.getProviderSettings(config);
            const currentModel = modelState.selectedModel;

            if (!currentModel.isCustom) {
                const modelId = this.getProviderSettingString(config, 'lastCustomModel');
                modelState.selectedModel = {
                    id: modelId,
                    name: modelId,
                    isCustom: true
                };
                settings.model = modelId;
                settings.isCustomModel = true;
                await this.plugin.saveSettings();

                const inputEl = refs.customModelContainer.querySelector('input');
                if (inputEl) {
                    inputEl.value = modelId;
                }
            }
        }
    }

    /**
     * 커스텀 모델 입력창 숨김
     */
    protected hideStandardCustomModelInput(
        refs: { customModelContainer: HTMLDivElement | null }
    ): void {
        if (refs.customModelContainer) {
            refs.customModelContainer.removeClass('visible');
        }
    }

    /**
     * 표준 Provider URL 입력 렌더링
     */
    protected renderProviderUrlSetting(
        container: HTMLElement,
        config: AIProviderConfig
    ): void {
        const urlKey = config.providerUrlKey || 'apiAddress';
        new Setting(container)
            .setName(t('Provider URL'))
            .setDesc(t('Leave it blank, unless you are using a proxy.'))
            .addText(text => text
                .setPlaceholder(config.providerUrlPlaceholder)
                .setValue(this.getProviderSettingString(config, urlKey))
                .onChange(async (value) => {
                    const settings = this.getProviderSettings(config);
                    settings[urlKey] = value;
                    await this.plugin.saveSettings();
                }));
    }
}
