import type { AIModel as AIModelBase, AIProviderType, AIMessage } from '../services/ai';

export type { AIModelBase as AIModel, AIProviderType, AIMessage };

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'deepseek' | 'siliconflow' | 'custom';
export type OpenAIModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-o1';
export type AnthropicModel =
    | 'claude-opus-4-1-20250805'
    | 'claude-opus-4-20250514'
    | 'claude-sonnet-4-20250514'
    | 'claude-3-7-sonnet-20250219'
    | 'claude-3-5-haiku-20241022'
    | 'claude-3-haiku-20240307';

export type DeepseekModel = AIModelBase;

export interface DeepseekModelState {
    selectedModel: DeepseekModel;
    apiKey: string;
}

export const DEFAULT_DEEPSEEK_MODELS: DeepseekModel[] = [
    { id: 'deepseek-chat', name: 'Deepseek Chat' },
    { id: 'deepseek-reasoner', name: 'Deepseek Reasoner' }
];

export type SiliconFlowModel = AIModelBase;

export type GeminiModel = AIModelBase;

export interface GeminiModelState {
    selectedModel: GeminiModel;
    apiKey: string;
}

export const DEFAULT_GEMINI_MODELS: GeminiModel[] = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Legacy)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Legacy)' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Legacy)' }
];

export const DEFAULT_SILICONFLOW_MODELS: AIModelBase[] = [
    { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', isCustom: false },
    { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5 7B', isCustom: false },
    { id: 'Qwen/Qwen2.5-14B-Instruct', name: 'Qwen2.5 14B', isCustom: false },
    { id: 'Pro/Qwen/Qwen2-7B-Instruct', name: 'Qwen2 7B', isCustom: false },
    { id: 'Pro/THUDM/glm-4-9b-chat', name: 'GLM-4 9B', isCustom: false },
    { id: 'google/gemma-2-9b-it', name: 'Gemma2 9B', isCustom: false },
];

export interface AISettings {
    provider: AIProvider;
    openai?: {
        apiKey: string;
        model: string;
        baseUrl?: string;
        isCustomModel?: boolean;
        lastCustomModel?: string;
    };
    siliconflow?: {
        apiKey: string;
        model: string;
        baseUrl?: string;
        isCustomModel?: boolean;
        lastCustomModel?: string;
    };
    anthropic?: {
        apiKey: string;
        model: string;
        availableModels?: string[];
        apiAddress?: string;
        isCustomModel?: boolean;
        lastCustomModel?: string;
    };
    ollama?: {
        host: string;
        model: string;
        availableModels?: string[];
    };
    gemini?: {
        apiKey: string;
        model: string;
        baseUrl?: string;
        isCustomModel?: boolean;
    };
    deepseek?: {
        apiKey: string;
        model: string;
        baseUrl?: string;
        isCustomModel?: boolean;
        lastCustomModel?: string;
    };
    custom?: {
        name: string;
        apiKey: string;
        baseUrl: string;
        model: string;
        detectedApiType?: 'openai' | 'anthropic' | 'gemini';
        headers?: Record<string, string>;
        isCustomModel?: boolean;
        lastCustomModel?: string;
    };
    prompts: Record<string, string>;
}
