import { moment } from 'obsidian';
import en from './en';
import zh from './zh';

const translations: Record<string, Record<string, string>> = {
    en,
    zh
};

export function t(key: string): string {
    // Obsidian 현재 언어 가져오기
    const locale = moment.locale();
    // 중국어 환경이면 중국어 번역 사용
    const currentTranslations = locale.startsWith('zh') ? translations.zh : translations.en;

    // 번역 직접 가져오기
    const translation = currentTranslations[key];
    if (translation) {
        return translation;
    }

    return key;
}
