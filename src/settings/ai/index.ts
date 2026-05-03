import type CommentPlugin from '../../../main';
import type { AIProvider } from '../../types/ai';
import type { AIServiceSettings } from './AIServiceSettings';
import { CustomAISettings } from './CustomAISettings';
import { OllamaSettings } from './OllamaSettings';
import { StandardAIProviderSettings } from './StandardAIProviderSettings';
import { STANDARD_AI_PROVIDER_CONFIGS } from './providerConfigs';

type AISettingsFactory = (plugin: CommentPlugin, containerEl: HTMLElement) => AIServiceSettings;

const AI_SETTINGS_FACTORIES: Record<AIProvider, AISettingsFactory> = {
    openai: (plugin, containerEl) => new StandardAIProviderSettings(plugin, containerEl, STANDARD_AI_PROVIDER_CONFIGS.openai),
    anthropic: (plugin, containerEl) => new StandardAIProviderSettings(plugin, containerEl, STANDARD_AI_PROVIDER_CONFIGS.anthropic),
    gemini: (plugin, containerEl) => new StandardAIProviderSettings(plugin, containerEl, STANDARD_AI_PROVIDER_CONFIGS.gemini),
    deepseek: (plugin, containerEl) => new StandardAIProviderSettings(plugin, containerEl, STANDARD_AI_PROVIDER_CONFIGS.deepseek),
    siliconflow: (plugin, containerEl) => new StandardAIProviderSettings(plugin, containerEl, STANDARD_AI_PROVIDER_CONFIGS.siliconflow),
    ollama: (plugin, containerEl) => new OllamaSettings(plugin, containerEl),
    custom: (plugin, containerEl) => new CustomAISettings(plugin, containerEl)
};

export function createAISettingsRenderer(
    provider: AIProvider,
    plugin: CommentPlugin,
    containerEl: HTMLElement
): AIServiceSettings {
    return AI_SETTINGS_FACTORIES[provider](plugin, containerEl);
}

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
    openai: 'OpenAI',
    gemini: 'Gemini',
    anthropic: 'Anthropic',
    deepseek: 'Deepseek',
    siliconflow: 'SiliconFlow',
    ollama: 'Ollama (Local)',
    custom: 'Custom AI Service'
};
