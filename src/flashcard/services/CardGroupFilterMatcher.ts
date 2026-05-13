import type { FlashcardState } from '../types/FSRSTypes';

export class CardGroupFilterMatcher {
    private static readonly WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/;

    static matches(card: FlashcardState, filter: string): boolean {
        if (!card || !card.filePath || !filter || filter.trim().length === 0) {
            return false;
        }

        const filterConditions = filter
            .split(',')
            .map(condition => condition.trim())
            .filter(condition => condition.length > 0);

        if (filterConditions.length === 0) {
            return false;
        }

        const filePath = card.filePath.toLowerCase();
        const fileName = filePath.split('/').pop() || '';
        const fileNameWithoutExt = fileName.replace(/\.md$/i, '');
        const cardText = card.text?.toLowerCase() || '';
        const cardAnswer = card.answer?.toLowerCase() || '';

        return filterConditions.some(condition => {
            const conditionLower = condition.toLowerCase();
            const wikiMatch = conditionLower.match(CardGroupFilterMatcher.WIKI_LINK_REGEX);

            if (wikiMatch) {
                const linkText = wikiMatch[1].toLowerCase();
                return fileNameWithoutExt === linkText || fileName === linkText;
            }

            return filePath.includes(conditionLower)
                || cardText.includes(conditionLower)
                || cardAnswer.includes(conditionLower);
        });
    }
}
