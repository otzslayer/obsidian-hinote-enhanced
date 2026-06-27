import { moment } from 'obsidian';
import en from './en';
import zh from './zh';
import ko from './ko';

const translations: Record<string, Record<string, string>> = {
    en,
    zh,
    ko
};

export function t(key: string): string {
    // Obsidian 현재 언어 가져오기
    const locale = moment.locale();
    // 한국어 환경이면 한국어, 중국어 환경이면 중국어 번역 사용
    const currentTranslations = locale.startsWith('ko') ? translations.ko : locale.startsWith('zh') ? translations.zh : translations.en;

    // 번역 직접 가져오기
    const translation = currentTranslations[key];
    if (translation) {
        return translation;
    }

    return key;
}
