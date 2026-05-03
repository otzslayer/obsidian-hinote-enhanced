import type CommentPlugin from '../../../main';
import {
    AnthropicService,
    DeepseekService,
    GeminiService,
    IAIService,
    OpenAIService,
    SiliconFlowService
} from '../../services/ai';
import type { AIProvider } from '../../types/ai';
import {
    DEFAULT_DEEPSEEK_MODELS,
    DEFAULT_GEMINI_MODELS,
    DEFAULT_SILICONFLOW_MODELS
} from '../../types/ai';
import type { AIModel, AIProviderConfig } from './AIServiceSettings';

const DEFAULT_OPENAI_MODELS: AIModel[] = [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-o1', name: 'GPT-o1' },
    { id: 'gpt-4', name: 'GPT-4' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
];

const DEFAULT_ANTHROPIC_MODELS: AIModel[] = [
    { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1' },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude Sonnet 3.7' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5' },
    { id: 'claude-3-haiku-20240307', name: 'Claude Haiku 3' }
];

export interface StandardAIProviderConfig extends AIProviderConfig {
    provider: Exclude<AIProvider, 'ollama' | 'custom'>;
    heading: string;
    defaultBaseUrl: string;
    createService: (options: {
        apiKey: string;
        model: string;
        baseUrl: string;
        plugin: CommentPlugin;
    }) => IAIService;
}

export const STANDARD_AI_PROVIDER_CONFIGS: Record<StandardAIProviderConfig['provider'], StandardAIProviderConfig> = {
    openai: {
        provider: 'openai',
        settingsKey: 'openai',
        heading: 'OpenAI service',
        serviceName: 'OpenAI',
        defaultModels: DEFAULT_OPENAI_MODELS,
        apiKeyPlaceholder: 'sk-...',
        providerUrlPlaceholder: 'https://api.openai.com/v1',
        providerUrlKey: 'baseUrl',
        defaultBaseUrl: 'https://api.openai.com/v1',
        defaultSettings: {
            apiKey: '',
            model: DEFAULT_OPENAI_MODELS[0].id,
            baseUrl: '',
            isCustomModel: false,
            lastCustomModel: ''
        },
        createService: ({ apiKey, model, baseUrl }) => new OpenAIService(apiKey, model, baseUrl)
    },
    anthropic: {
        provider: 'anthropic',
        settingsKey: 'anthropic',
        heading: 'Anthropic service',
        serviceName: 'Anthropic',
        defaultModels: DEFAULT_ANTHROPIC_MODELS,
        apiKeyPlaceholder: 'sk-ant-...',
        providerUrlPlaceholder: 'https://api.anthropic.com',
        providerUrlKey: 'apiAddress',
        defaultBaseUrl: 'https://api.anthropic.com',
        defaultSettings: {
            apiKey: '',
            model: DEFAULT_ANTHROPIC_MODELS[0].id,
            apiAddress: '',
            isCustomModel: false,
            lastCustomModel: ''
        },
        createService: ({ apiKey, model, baseUrl }) => new AnthropicService(apiKey, baseUrl, model)
    },
    gemini: {
        provider: 'gemini',
        settingsKey: 'gemini',
        heading: 'Gemini service',
        serviceName: 'Gemini',
        defaultModels: DEFAULT_GEMINI_MODELS,
        apiKeyPlaceholder: 'Enter your API key',
        providerUrlPlaceholder: 'https://generativelanguage.googleapis.com',
        providerUrlKey: 'baseUrl',
        defaultBaseUrl: 'https://generativelanguage.googleapis.com',
        defaultSettings: {
            apiKey: '',
            model: DEFAULT_GEMINI_MODELS[0].id,
            baseUrl: '',
            isCustomModel: false,
            lastCustomModel: ''
        },
        createService: ({ apiKey, model, baseUrl }) => new GeminiService(apiKey, model, baseUrl)
    },
    deepseek: {
        provider: 'deepseek',
        settingsKey: 'deepseek',
        heading: 'Deepseek service',
        serviceName: 'Deepseek',
        defaultModels: DEFAULT_DEEPSEEK_MODELS,
        apiKeyPlaceholder: 'dsk-...',
        providerUrlPlaceholder: 'https://api.deepseek.com',
        providerUrlKey: 'baseUrl',
        defaultBaseUrl: 'https://api.deepseek.com',
        defaultSettings: {
            apiKey: '',
            model: DEFAULT_DEEPSEEK_MODELS[0].id,
            baseUrl: '',
            isCustomModel: false,
            lastCustomModel: ''
        },
        createService: ({ apiKey, model, baseUrl }) => new DeepseekService(apiKey, model, baseUrl)
    },
    siliconflow: {
        provider: 'siliconflow',
        settingsKey: 'siliconflow',
        heading: 'SiliconFlow service',
        serviceName: 'SiliconFlow',
        defaultModels: DEFAULT_SILICONFLOW_MODELS,
        apiKeyPlaceholder: 'sk-...',
        providerUrlPlaceholder: 'https://api.siliconflow.cn/v1',
        providerUrlKey: 'baseUrl',
        defaultBaseUrl: 'https://api.siliconflow.cn/v1',
        defaultSettings: {
            apiKey: '',
            model: DEFAULT_SILICONFLOW_MODELS[0].id,
            baseUrl: '',
            isCustomModel: false,
            lastCustomModel: ''
        },
        createService: ({ plugin }) => new SiliconFlowService(plugin.settings.ai)
    }
};
