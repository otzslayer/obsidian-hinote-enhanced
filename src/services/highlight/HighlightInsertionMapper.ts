/**
 * 읽기 모드 하이라이트 삽입 매핑 — 순수 함수.
 *
 * (sourceText, lineStart, lineEnd, selectedText, existingHighlights) → 삽입 결과 또는 실패 사유.
 *
 * 줄 의미론: lineStart/lineEnd 는 0-based inclusive.
 * 단일 줄 블록은 lineStart === lineEnd.
 * 슬라이스 시 lineEnd + 1 오프셋을 사용해 inclusive 경계를 처리한다.
 */

export interface ExistingHighlightRange {
    position: number;
    originalLength: number;
}

export type InsertionResult =
    | { ok: true; newText: string; insertedAt: number }
    | { ok: false; reason: 'empty' | 'not-found' | 'ambiguous' | 'overlap' };

/**
 * sourceText 내 lineStart..lineEnd(inclusive) 블록에서
 * selectedText를 찾아 ==...== 로 감싼 newText를 반환한다.
 */
export function mapHighlightInsertion(
    sourceText: string,
    lineStart: number,
    lineEnd: number,
    selectedText: string,
    existingHighlights: ExistingHighlightRange[],
): InsertionResult {
    const sel = selectedText.trim();
    if (!sel) return { ok: false, reason: 'empty' };

    // 개행 포함 선택은 단일 블록 매칭 불가 — graceful 중단
    if (sel.includes('\n')) return { ok: false, reason: 'not-found' };

    // lineStart/lineEnd(inclusive) → 절대 char 오프셋 변환
    const lines = sourceText.split('\n');

    // 범위가 소스 줄 수를 벗어나면 not-found
    if (lineStart >= lines.length || lineEnd >= lines.length) {
        return { ok: false, reason: 'not-found' };
    }

    // blockStart: lineStart 줄의 절대 시작 오프셋
    let blockStart = 0;
    for (let i = 0; i < lineStart; i++) {
        blockStart += lines[i].length + 1; // +1 for '\n'
    }

    // blockEnd: lineEnd 줄의 끝(다음 줄 시작 직전). lineEnd + 1 inclusive 처리.
    let blockEnd = blockStart;
    for (let i = lineStart; i <= lineEnd; i++) {
        blockEnd += lines[i].length;
        if (i < lineEnd) blockEnd += 1; // '\n' between lines
    }

    const blockSource = sourceText.slice(blockStart, blockEnd);

    // selectedText를 블록 내에서 탐색
    let idx = blockSource.indexOf(sel);
    if (idx === -1) return { ok: false, reason: 'not-found' };
    // 두 번째 발생 여부 확인 → 모호
    if (blockSource.indexOf(sel, idx + 1) !== -1) return { ok: false, reason: 'ambiguous' };

    const absStart = blockStart + idx;
    const absEnd = absStart + sel.length;

    // 전역(문서 전체) 유일성 검증 — stale 줄범위로 인한 무음 오삽입 방지.
    // WeakMap 줄범위는 렌더 시점, content 는 fresh read 라 그 사이 파일이 바뀌면
    // 범위가 다른 블록을 가리킬 수 있다. 하지만 선택 텍스트가 문서에 정확히 1회만
    // 존재하면 래핑 위치가 유일하게 결정되어 잘못 감쌀 자리가 없다.
    // 2회 이상이면(블록 내 유일이어도) stale 오삽입 위험이 있으므로 안전하게 중단한다.
    if (
        sourceText.indexOf(sel) !== absStart ||
        sourceText.indexOf(sel, absStart + 1) !== -1
    ) {
        return { ok: false, reason: 'ambiguous' };
    }

    // 기존 하이라이트와 겹침 검사
    for (const h of existingHighlights) {
        const hStart = h.position;
        const hEnd = h.position + h.originalLength;
        if (Math.max(absStart, hStart) < Math.min(absEnd, hEnd)) {
            return { ok: false, reason: 'overlap' };
        }
    }

    const newText =
        sourceText.slice(0, absStart) +
        '==' + sel + '==' +
        sourceText.slice(absEnd);

    return { ok: true, newText, insertedAt: absStart };
}
