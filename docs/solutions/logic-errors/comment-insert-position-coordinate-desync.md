---
title: "에디터에서 인라인 코멘트가 엉뚱한 위치에 저장되는 문제 (좌표 desync + 오귀속)"
date: 2026-06-18
category: docs/solutions/logic-errors/
module: comment-creation
problem_type: logic_error
component: frontend_stimulus
related_components:
  - service_object
symptoms:
  - "코멘트가 하이라이트 바로 뒤가 아닌 엉뚱한 위치에 저장됨 — 원본 모드·라이브 프리뷰 모두에서 일관되게 재현"
  - "Mod+Shift+S로 막 만든 하이라이트에 즉시 코멘트 작성 시 위치가 어긋나고 하이라이트가 덮어써질 수 있음"
  - "여러 하이라이트가 있는 노트에서, 대상 하이라이트의 코멘트가 뒤쪽 하이라이트의 코멘트 블록 뒤에 삽입됨"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags:
  - obsidian-plugin
  - codemirror
  - editor-offset
  - coordinate-desync
  - inline-comment
  - criticmarkup
---

# 에디터에서 인라인 코멘트가 엉뚱한 위치에 저장되는 문제 (좌표 desync + 오귀속)

## Problem

에디터(원본 모드/라이브 프리뷰)에서 하이라이트의 코멘트 버튼으로 인라인 코멘트(`{>>내용 ^타임스탬프^<<}`)를 작성하면, 코멘트가 해당 하이라이트 바로 뒤가 아니라 엉뚱한 위치에 저장됐다. 두 가지 **독립적인 결정적(deterministic) 근본 원인**이 겹쳐 있었다.

## Symptoms

- 코멘트가 하이라이트 뒤가 아닌 다른 위치에 삽입됨 — **원본 모드·라이브 프리뷰 양쪽에서 일관되게** (간헐적 경합이 아님).
- `Mod+Shift+S`로 방금 만든 하이라이트에 즉시 코멘트를 달면 위치가 어긋나고, 미저장 `==하이라이트==`가 덮어써질 위험.
- 여러 하이라이트가 누적된 노트에서 대상 하이라이트의 코멘트가 **뒤쪽** 하이라이트의 코멘트 블록 뒤로 밀려 들어감.

## What Didn't Work

- **단일 원인(자동저장 경합) 가정으로 멈추는 것.** 처음엔 "에디터/디스크 desync = 자동저장 디바운스 경합"만 의심했다. 하지만 경합이라면 간헐적이어야 하는데 증상이 **양 모드에서 일관**됐다. 이 불일치가 "결정적 로직 버그가 별도로 있다"는 가설로 이어졌고, 다중 하이라이트 회귀 테스트로 두 번째 원인을 확정했다. 좌표 desync만 고쳤다면 다중 하이라이트 노트에서는 여전히 깨졌을 것이다.
- **추출기 좌표 의미론을 의심하는 것.** `extractHighlights`의 `position`(=`==text==` 시작), `originalLength`(=전체 매치 길이)는 정확했다. 즉 "저장된 노트(에디터==디스크)"에서는 기존 로직이 맞게 동작 → 의미론 버그가 아니라 **좌표계/귀속** 문제임을 가렸다.

## Solution

### 근본 원인 ① — 에디터/디스크 좌표 desync

`highlight.position`은 **라이브 에디터**(`view.state.doc`)에서 계산됐는데, 쓰기 경로 `InlineCommentWriter.addComment`는 `vault.read`로 **디스크**를 읽었다. `Mod+Shift+S`로 막 만든 `==하이라이트==`는 아직 디스크에 flush되지 않은 미저장 변경이므로, 에디터 좌표를 stale 디스크 텍스트에 적용 → 잘못된 바이트에 삽입. 이 미저장 상태는 양 모드에서 항상 존재하므로 결정적으로 재현됐다.

**수정**: 에디터 경로는 디스크가 아니라 **에디터를 단일 소스**로 사용. 읽기(`getValue`)와 쓰기(`replaceRange`)를 같은 스냅샷에서 수행한다.

```ts
// Before — 디스크에서 읽어 에디터 좌표를 적용 (desync)
const writer = new InlineCommentWriter(plugin.app);
await writer.addComment(file, highlight, content, formatTimestamp(Date.now()));

// After — 라이브 에디터를 단일 소스로
const editor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
// ...
onSave: async (content: string) => {
    const noteText = editor.getValue();                       // 에디터 스냅샷
    const start = highlight.position ?? 0;
    const end = start + (highlight.originalLength ?? highlight.text.length + 4);
    const insertPos = findInsertPosition(noteText, { text: highlight.text, start, end });
    const block = serializeBlock(content, formatTimestamp(Date.now()));
    editor.replaceRange(block, editor.offsetToPos(insertPos)); // 같은 좌표계에 쓰기
}
```

> 참고: 사이드바 경로는 `vault.read`를 정당하게 사용한다. 사이드바의 하이라이트 위치는 같은 디스크 읽기(파일 `modify` 이벤트 시 재읽기)에서 파생되므로 디스크와 동일 좌표계다. 에디터 경로만 라이브 좌표가 디스크보다 앞서 있어 섞이면 안 됐다.

### 근본 원인 ② — `findInsertPosition` 오귀속

`findInsertPosition`이 `parseInlineComments(noteText, [match])`를 **단일 match**로 호출했다. 파서의 귀속 로직(`findPrecedingHighlight`)은 "이 하이라이트 끝 이후의 모든 블록"을 유일한 match에 붙이므로, **뒤쪽 다른 하이라이트의 코멘트 블록**까지 이 하이라이트 것으로 오인 → 그 뒤(마지막 블록 끝)에 삽입했다. 이 버그는 editor·사이드바 **공유 직렬화기**에 있어 양쪽 경로 모두에 영향.

**수정**: 다른 하이라이트 match에 의존하지 않고, 하이라이트 끝에서 **연속된 `{>>...<<}` 블록 체인만** 스캔한다.

```ts
// Before — 단일 match 파싱 → 뒤 하이라이트 블록 오귀속
export function findInsertPosition(noteText: string, match: HighlightMatch): number {
    const { pairedComments } = parseInlineComments(noteText, [match]);
    const entry = pairedComments.find(p => p.highlightStart === match.start);
    if (!entry || entry.comments.length === 0) return match.end;
    return entry.comments[entry.comments.length - 1].endOffset; // ← 뒤 하이라이트 블록일 수 있음
}

// After — 하이라이트 끝에서 연속 블록만 전진 스캔
export function findInsertPosition(noteText: string, match: HighlightMatch): number {
    const CONTIGUOUS_BLOCK_RE = /^\s*\{>>[\s\S]*?<<\}/;
    let pos = match.end;
    let block = CONTIGUOUS_BLOCK_RE.exec(noteText.slice(pos));
    while (block) {
        pos += block[0].length;
        block = CONTIGUOUS_BLOCK_RE.exec(noteText.slice(pos));
    }
    return pos;
}
```

회귀 테스트로 ②를 고정:

```ts
it('inserts on the correct highlight when a LATER highlight already has a comment', () => {
    const note = `==A== mid ==B=={>>onB ^${FIXED_TS}^<<} end`;
    const match = mkMatch('A', note);
    const result = insertComment(note, match, 'onA', FIXED_TS);
    expect(result).toBe(`==A=={>>onA ^${FIXED_TS}^<<} mid ==B=={>>onB ^${FIXED_TS}^<<} end`);
});
```

## Why This Works

- **①**: 위치(offset)와 그 위치에 적용할 텍스트가 **같은 스냅샷(에디터)**에서 나오므로 미저장 편집과 어긋날 여지가 없다. `editor.replaceRange(block, editor.offsetToPos(pos))`는 `slice + block + slice`와 등가이되 좌표계가 보장된다.
- **②**: 하이라이트의 코멘트는 그 끝에 **연속**으로 붙는 블록들이다. 연속 체인만 스캔하면 `==A==` 다음에 일반 텍스트(`mid`)가 오는 순간 멈춰, 뒤쪽 `==B==`의 코멘트를 절대 건드리지 않는다. 직렬화기가 zero-gap으로 쓰므로 정상 데이터에서 항상 정확하다.

## Prevention

- **에디터 컨텍스트 쓰기는 라이브 에디터에서 텍스트·오프셋을 모두 가져온다.** CodeMirror 데코레이션/위젯에서 노트를 쓸 때 `vault.read`(디스크)와 에디터 좌표를 섞지 말 것. 같은 스냅샷(`editor.getValue` + `editor.replaceRange`)을 쓴다. 트레이드오프: `replaceRange`는 자동저장 디바운스(`modify`)를 거치므로 파일 파생 뷰(사이드바)는 약 1~2초 뒤 반영된다.
- **"양 모드/항상 일관되게 깨진다" = 결정적 버그 신호.** 타이밍 경합으로 단정하지 말고 순수 로직 회귀 테스트로 분리 검증한다. 이 케이스에선 다중 하이라이트 단위 테스트가 두 번째 원인을 드러냈다.
- **순수 함수에 "단일 항목만 넘기는" 호출을 경계한다.** `parseInlineComments`처럼 전체 집합으로 올바르게 동작하도록 설계된 함수에 단일 원소만 넘기면 귀속/정렬 전제가 깨질 수 있다.
- 같은 버그 클래스의 자매 경로(`findBlock`의 update/delete)는 **작은 ordinal로 앞에서 인덱싱**하고 자신의 블록이 문서 순서상 앞에 정렬되므로 노출되지 않음을 확인했다(앵커 체크가 백스톱).

## Related Issues

- PR: otzslayer/obsidian-hinote-enhanced#2 (`feat/comment-button-inline-input`)
- 관련 아키텍처 문서: [인라인 CriticMarkup 코멘트 저장 패턴](../architecture-patterns/inline-comment-storage-migration-pattern.md) — `{>>...<<}` 저장 포맷과 직렬화기의 배경.
- 같은 PR의 부수 수정: 읽기 모드 `openCommentPanel`이 하드코딩한 `"hinote-view"`를 `VIEW_TYPE_HINOTE`("hinote-enhanced-view")로 교체해 "뷰 없음" 에러 해결.
