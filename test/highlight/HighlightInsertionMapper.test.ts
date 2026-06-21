import { describe, it, expect } from 'vitest';
import { mapHighlightInsertion } from '../../src/services/highlight/HighlightInsertionMapper';

// 픽스처: 실제 Obsidian getSectionInfo 덤프 기반 (단일 줄 블록 포함)
// 파일 내용:
//   line0: "Introduction"
//   line1: "Some plain text here."
//   line2: "Another paragraph."
const MULTI_LINE_SOURCE = 'Introduction\nSome plain text here.\nAnother paragraph.';

describe('mapHighlightInsertion', () => {
    it('happy: 블록 내 유일 plain 텍스트 → 정확히 ==…==로 감싼 newText, insertedAt 정확', () => {
        const source = 'Hello world. This is a test.';
        // lineStart=0, lineEnd=0 (단일 줄)
        const result = mapHighlightInsertion(source, 0, 0, 'Hello world', []);
        expect(result).toMatchObject({ ok: true });
        if (!result.ok) return;
        expect(result.newText).toBe('==Hello world==. This is a test.');
        expect(result.insertedAt).toBe(0);
    });

    it('단일 줄 블록(lineStart === lineEnd): 문단 마지막(=유일) 줄 텍스트가 정상 매칭/래핑 (inclusive off-by-one 회귀 고정)', () => {
        // 픽스처: 실제 getSectionInfo 덤프 — 세 번째 문단(line2)만 대상
        // lineStart=2, lineEnd=2 (inclusive)
        const result = mapHighlightInsertion(MULTI_LINE_SOURCE, 2, 2, 'Another paragraph', []);
        expect(result).toMatchObject({ ok: true });
        if (!result.ok) return;
        expect(result.newText).toBe('Introduction\nSome plain text here.\n==Another paragraph==.');
    });

    it('다중 라인 문서: 0이 아닌 줄 오프셋에서 절대 오프셋 정확', () => {
        const result = mapHighlightInsertion(MULTI_LINE_SOURCE, 1, 1, 'plain text', []);
        expect(result).toMatchObject({ ok: true });
        if (!result.ok) return;
        // "Introduction\n" = 13자, "Some " = 5자 → absStart = 18
        expect(result.insertedAt).toBe(18);
        expect(result.newText).toBe('Introduction\nSome ==plain text== here.\nAnother paragraph.');
    });

    it('not-found: 블록에 없는 텍스트 → not-found', () => {
        const source = 'Hello world.';
        const result = mapHighlightInsertion(source, 0, 0, 'nonexistent text', []);
        expect(result).toEqual({ ok: false, reason: 'not-found' });
    });

    it('not-found: inline 마크다운으로 마커가 사라진 케이스 모사 → not-found', () => {
        // 소스에는 **bold** 가 있지만 선택 textContent는 bold (마커 제거됨)
        const source = 'This is **bold** text.';
        // 렌더된 'bold'는 소스에 존재하지만 '**bold**' 마커가 없는 경우는 not-found 아님.
        // inline 마크다운 케이스: 소스에 없는 렌더 텍스트 선택
        const source2 = 'This is *italic* text.';
        const result = mapHighlightInsertion(source2, 0, 0, 'italic text', []);
        // "italic text"는 소스에 없다 ("*italic* text"가 소스)
        expect(result).toEqual({ ok: false, reason: 'not-found' });
    });

    it('ambiguous: 블록에 동일 텍스트 2회 → ambiguous', () => {
        const source = 'foo bar foo baz';
        const result = mapHighlightInsertion(source, 0, 0, 'foo', []);
        expect(result).toEqual({ ok: false, reason: 'ambiguous' });
    });

    it('전역 중복: 블록 내 유일하지만 문서 다른 블록에도 등장 → ambiguous (stale 무음 오삽입 방지)', () => {
        // line0 블록 'foo bar' 안에서 'foo'는 1회지만, line1 'baz foo' 에도 등장.
        // stale 줄범위가 엉뚱한 블록을 가리켜도 전역 2회면 안전하게 중단되어야 한다.
        const source = 'foo bar\nbaz foo';
        const result = mapHighlightInsertion(source, 0, 0, 'foo', []);
        expect(result).toEqual({ ok: false, reason: 'ambiguous' });
    });

    it('전역 유일: 다중 블록 문서에서 문서 전체 1회 → ok (정상 래핑 유지, 무회귀 확인)', () => {
        // 'plain text' 는 MULTI_LINE_SOURCE 전체에서 1회만 등장 → 게이트 통과.
        const result = mapHighlightInsertion(MULTI_LINE_SOURCE, 1, 1, 'plain text', []);
        expect(result).toMatchObject({ ok: true });
    });

    it('overlap: 기존 ==A== 범위와 겹치는 선택 → overlap', () => {
        // source: "==hello== world"
        // existing: position=0, originalLength=9 (== h e l l o ==)
        const source = '==hello== world';
        const result = mapHighlightInsertion(source, 0, 0, 'hello', [
            { position: 0, originalLength: 9 },
        ]);
        expect(result).toEqual({ ok: false, reason: 'overlap' });
    });

    it('인접하지만 비겹침: 기존 하이라이트 바로 뒤 텍스트 → ok', () => {
        // source: "==hello== world"
        // existing: position=0, originalLength=9
        // 선택: "world" (index 10..15)
        const source = '==hello== world';
        const result = mapHighlightInsertion(source, 0, 0, 'world', [
            { position: 0, originalLength: 9 },
        ]);
        expect(result).toMatchObject({ ok: true });
        if (!result.ok) return;
        expect(result.newText).toBe('==hello== ==world==');
    });

    it('empty: 공백만/빈 선택 → empty', () => {
        const source = 'Hello world.';
        expect(mapHighlightInsertion(source, 0, 0, '   ', [])).toEqual({ ok: false, reason: 'empty' });
        expect(mapHighlightInsertion(source, 0, 0, '', [])).toEqual({ ok: false, reason: 'empty' });
    });

    it('개행 포함 선택(하드랩) → not-found (graceful)', () => {
        const source = 'line one\nline two';
        const result = mapHighlightInsertion(source, 0, 1, 'line one\nline two', []);
        expect(result).toEqual({ ok: false, reason: 'not-found' });
    });

    it('lineStart/lineEnd가 소스 줄 범위를 벗어남 → not-found', () => {
        const source = 'only one line';
        const result = mapHighlightInsertion(source, 0, 5, 'one', []);
        expect(result).toEqual({ ok: false, reason: 'not-found' });
    });
});
