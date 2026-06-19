import { describe, it, expect } from 'vitest';
import { normalizeSettings } from '../../src/settings/SettingsMigration';

describe('normalizeSettings — showInlineCommentSyntax', () => {
    it('미지정 입력 → 기본값 false 적용', () => {
        const result = normalizeSettings({});
        expect(result.showInlineCommentSyntax).toBe(false);
    });

    it('showInlineCommentSyntax: true 입력 → 보존', () => {
        const result = normalizeSettings({ showInlineCommentSyntax: true });
        expect(result.showInlineCommentSyntax).toBe(true);
    });

    it('showInlineCommentSyntax: false 입력 → 보존', () => {
        const result = normalizeSettings({ showInlineCommentSyntax: false });
        expect(result.showInlineCommentSyntax).toBe(false);
    });

    it('기존 다른 설정 키와 함께 → 둘 다 보존 (회귀)', () => {
        const result = normalizeSettings({
            showCommentWidget: false,
            showInlineCommentSyntax: true,
        });
        expect(result.showCommentWidget).toBe(false);
        expect(result.showInlineCommentSyntax).toBe(true);
    });

    it('null 입력 → 기본값 false 적용', () => {
        const result = normalizeSettings(null);
        expect(result.showInlineCommentSyntax).toBe(false);
    });
});
