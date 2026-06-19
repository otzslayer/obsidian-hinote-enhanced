import { DEFAULT_SETTINGS, PluginSettings } from '../types/settings';
import type { AISettings } from '../types/ai';

type SettingsData = Partial<PluginSettings> | null | undefined;

export function createDefaultSettings(): PluginSettings {
    return cloneSettings(DEFAULT_SETTINGS);
}

export function normalizeSettings(raw: SettingsData, existingData?: SettingsData): PluginSettings {
    const defaults = createDefaultSettings();
    const source = raw ?? {};
    const existing = existingData ?? {};

    const settings: PluginSettings = {
        ...defaults,
        ...source,
        export: {
            ...defaults.export,
            ...(source.export ?? {})
        },
        ai: normalizeAISettings(source.ai, defaults.ai),
        regexRules: Array.isArray(source.regexRules)
            ? source.regexRules
            : defaults.regexRules,
        excludePatterns: source.excludePatterns ?? defaults.excludePatterns,
        useCustomPattern: source.useCustomPattern ?? defaults.useCustomPattern,
        showCommentWidget: source.showCommentWidget ?? defaults.showCommentWidget,
        showInlineCommentSyntax: source.showInlineCommentSyntax ?? defaults.showInlineCommentSyntax
    };

    if (existing['flashcard-license'] ?? source['flashcard-license']) {
        settings['flashcard-license'] = existing['flashcard-license'] ?? source['flashcard-license'];
    }

    return settings;
}

export function migrateSettings(raw: SettingsData, existingData?: SettingsData): PluginSettings {
    return normalizeSettings(raw, existingData);
}

function normalizeAISettings(raw: Partial<AISettings> | undefined, defaults: AISettings): AISettings {
    const source = raw ?? {};

    return {
        ...defaults,
        ...source,
        provider: source.provider ?? defaults.provider,
        openai: {
            ...defaults.openai!,
            ...(source.openai ?? {})
        },
        siliconflow: {
            ...defaults.siliconflow!,
            ...(source.siliconflow ?? {})
        },
        anthropic: {
            ...defaults.anthropic!,
            ...(source.anthropic ?? {})
        },
        ollama: {
            ...defaults.ollama!,
            ...(source.ollama ?? {})
        },
        gemini: {
            ...defaults.gemini!,
            ...(source.gemini ?? {})
        },
        deepseek: {
            ...defaults.deepseek!,
            ...(source.deepseek ?? {})
        },
        custom: source.custom
            ? { ...source.custom }
            : defaults.custom,
        prompts: {
            ...defaults.prompts,
            ...(source.prompts ?? {})
        }
    };
}

function cloneSettings(settings: PluginSettings): PluginSettings {
    return JSON.parse(JSON.stringify(settings)) as PluginSettings;
}
