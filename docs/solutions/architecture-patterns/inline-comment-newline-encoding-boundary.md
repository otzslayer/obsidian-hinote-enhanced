---
title: "인라인 코멘트 개행 인코딩 — 단일 경계 패턴"
date: 2026-06-25
category: docs/solutions/architecture-patterns
module: InlineCommentSerializer
problem_type: architecture_pattern
component: service_object
severity: high
applies_when:
  - 단일 라인 저장 포맷 안에 사용자 자유 텍스트를 임베드할 때
  - CM6 Decoration.replace가 적용되는 텍스트 범위를 계산할 때
  - 저장 포맷과 메모리 표현 사이에 인코딩 변환이 필요한 신규 필드를 추가할 때
related_components:
  - frontend_stimulus
  - documentation
tags:
  - criticmarkup
  - codemirror6
  - encoding
  - inline-comment
  - newline
  - obsidian-plugin
  - serialization
---

# 인라인 코멘트 개행 인코딩 — 단일 경계 패턴

## Context

CriticMarkup 인라인 블록 `{>>...<<}` 은 단일 라인을 전제로 설계된 포맷이다. HiNote 플러그인에서 사용자가 코멘트에 줄바꿈(Shift+Enter)을 입력할 경우, 두 가지 독립적인 장애가 동시에 발생한다.

1. **디스크 파손**: 실제 개행 문자(`\n`)가 블록 내부에 저장되면 파서가 개행을 블록 종료 신호로 해석하여 파일 구조가 깨진다.
2. **에디터 크래시**: CodeMirror 6의 `Decoration.replace`는 실제 개행을 포함하는 범위에 적용할 수 없으며, 적용 시 `RangeError`를 던진다.

두 장애의 공통 원인은 저장 포맷과 메모리 표현 사이의 경계가 정의되지 않은 것이다. 인코딩/디코딩 변환이 여러 계층에 흩어지면, 특정 저장 경로에서만 변환이 누락되는 버그가 반복된다.

## Guidance

### 불변 규칙 (Invariant)

| 레이어 | 표현 |
|--------|------|
| 디스크 (`{>>...<<}` 내부) | 개행 → `\n` 토큰, 백슬래시 → `\\` |
| 메모리 (`CommentItem.content`) | 실제 개행, 실제 백슬래시 |
| 단일 인코딩 지점 | `InlineCommentSerializer.encodeInlineText` |
| 단일 디코딩 지점 | `InlineCommentParser.decodeInlineText` (타임스탬프·AI 접두어 추출 이후) |

이 불변 규칙을 지키면 코드베이스의 나머지 모든 부분은 메모리 표현(실제 개행)만 다루면 된다. 변환 로직이 두 함수에만 집중되어 테스트와 유지보수가 단순해진다.

---

### KTD-A: 인코더

```typescript
// src/services/comment/inline/InlineCommentSerializer.ts
function encodeInlineText(text: string): string {
    return text
        .replace(/\\/g, '\\\\')        // ① \ → \\ (반드시 첫 번째)
        .replace(/\r\n|\r|\n/g, '\\n') // ② 모든 개행 변형 → \n 토큰
        .replace(/<<}/g, '<‌<}');  // ③ ZWNJ: 블록 조기 종료 방지
}
```

**순서가 결정적이다**: ①이 ②보다 반드시 먼저 실행되어야 한다. 순서가 뒤집히면 ②가 출력한 `\n` 토큰이 ①에 의해 `\\n`으로 재인코딩되어 데이터가 손상된다.

**③ ZWNJ 처리**: 코멘트 본문에 `<<}` 시퀀스가 포함되면 CriticMarkup 파서가 블록을 조기 종료한다. `<<}` 앞에 Zero-Width Non-Joiner(U+200C)를 삽입해 파서를 우회한다. 디코더의 unknown escape pass-through 규칙이 ZWNJ를 원래 위치로 복원한다.

---

### KTD-B: 디코더 (정규식 금지, 단일 순차 스캔)

```typescript
// src/services/comment/inline/InlineCommentParser.ts
function decodeInlineText(encoded: string): string {
    let result = '';
    let i = 0;
    while (i < encoded.length) {
        if (encoded[i] === '\\' && i + 1 < encoded.length) {
            const next = encoded[i + 1];
            if (next === '\\') { result += '\\'; }      // \\ → \
            else if (next === 'n') { result += '\n'; }  // \n → 개행
            else { result += '\\'; result += next; }    // 알 수 없는 이스케이프: 그대로 통과
            i += 2;
        } else {
            result += encoded[i++];
        }
    }
    return result;
}
```

**정규식을 사용하지 않는 이유**: `text.replace(/\\n/g, '\n')`을 `a\\nb`에 적용하면 `a` + 개행 + `b`가 된다(잘못된 결과). 단일 순차 스캔만이 `\\n`(리터럴 백슬래시+n)과 `\n`(개행 토큰)을 올바르게 구분한다. JS의 lookbehind(`(?<!\\)`)도 `\\\\n` 케이스에서 실패한다.

---

### KTD-C: 디코드 호출 위치

`decodeInlineText`는 블록 원시 문자열에서 타임스탬프와 AI 접두어를 추출한 **이후** 마지막으로 호출해야 한다.

```typescript
// WRONG — 메타데이터 추출 전에 디코딩
const decoded = decodeInlineText(rawBlockContent);
const { content, ts } = extractTimestamp(decoded); // ^ 문자 오인식 위험

// CORRECT — 메타데이터 추출 후 마지막에 디코딩
const { content: rawContent, ts } = extractTimestamp(rawBlockContent);
const aiStripped = stripAIPrefix(rawContent);
const content = decodeInlineText(aiStripped); // 반드시 마지막
```

원시 블록을 먼저 디코딩하면, 인코딩된 코멘트 안의 `^` 문자가 타임스탬프 구분자 `^YYYY-MM-DD HH:mm^`로 오인식되어 타임스탬프 파싱이 깨진다.

---

### KTD-D: CM6 크래시 가드

CodeMirror 6의 `Decoration.replace`는 실제 개행을 포함하는 범위를 처리할 수 없다. 인코딩 도입 이전에 저장된 레거시 코멘트(리터럴 개행 포함)를 위해 데코레이션 대상을 필터링해야 한다.

```typescript
// src/editor/inlineCommentRanges.ts
export function selectHideableRanges(
    text: string
): Array<{ from: number; to: number }> {
    return findInlineCommentRanges(text).filter(
        r => !text.slice(r.from, r.to).includes('\n')
    );
}
```

`EditorHighlightDecorations.ts`의 숨김 데코레이션 패스는 `findInlineCommentRanges` 대신 `selectHideableRanges`를 사용한다. 범위 필터링을 선언적으로 분리해 CM6 호출부를 오염시키지 않는다.

---

### KTD-E: 사이드바 렌더링

메모리의 실제 개행(`\n`)을 사이드바 마크다운으로 렌더링할 때 CommonMark 하드 브레이크로 변환한다.

```typescript
// src/components/highlight/commentMarkdown.ts
export function toHardBreakMarkdown(content: string): string {
    return content.replace(/\n/g, '  \n'); // 후행 공백 2개 = CommonMark 하드 브레이크
}
```

## Why This Matters

**따르지 않을 경우 발생하는 문제:**

- 인코딩/디코딩 로직이 여러 파일에 흩어지면 특정 저장 경로(예: 파일 레벨 코멘트 프론트매터 경유)에서 변환이 누락되어 디스크 파손이 발생한다.
- 디코딩을 메타데이터 추출 전에 수행하면 타임스탬프 파싱 오류가 되어 코멘트가 유실된다.
- CM6 크래시 가드를 생략하면 레거시 볼트를 열 때 에디터가 즉시 종료된다.
- 인코더 단계 순서가 바뀌면 백슬래시가 포함된 코멘트(`C:\path`)가 저장될 때마다 데이터가 손상된다.

**따를 경우 얻는 이점:**

- 변환 로직이 두 함수에만 집중되어 단위 테스트 범위가 명확하다.
- 코드베이스 전체가 메모리 표현(실제 개행)만 다루면 되므로 신규 기능 개발 시 인코딩을 신경 쓸 필요가 없다.
- 레거시 호환성 처리(CM6 가드)가 하나의 함수로 격리되어 향후 마이그레이션 도구를 추가하기 쉽다.

## When to Apply

이 패턴은 다음 조건을 동시에 만족할 때 적용한다.

- 저장 포맷이 특정 문자를 허용하지 않는다 (예: 단일 라인 포맷, 구분자 문자 충돌)
- 메모리 표현과 디스크 표현이 달라야 한다 (실제 개행 vs 인코딩된 토큰)
- 변환 경로가 두 개 이상 존재한다 (저장 경로가 여러 개이거나, 로드 경로가 여러 계층을 거친다)

Obsidian 플러그인에서 구체적으로 적용되는 상황:

- CriticMarkup, YAML 프론트매터 등 구조화 마크업 안에 사용자 자유 텍스트를 임베드할 때
- CM6 데코레이션(`Decoration.replace`, `Decoration.mark`)이 적용되는 텍스트 범위를 계산할 때
- 인라인 직렬화기와 프론트매터 직렬화기가 별도로 존재하는 경우 (두 경로 모두 동일한 인코더를 호출하도록 강제)

## Examples

### Before: 인코딩 없이 저장

```
{>>사용자가 입력한 코멘트
두 번째 줄 ^2026-06-25 10:00^<<}
```

결과: 파서가 첫 번째 라인에서 블록을 종료하고, 두 번째 라인을 일반 텍스트로 처리함 → 파일 구조 파손.

### After: 단일 경계 인코딩 적용

**저장 시 (encodeInlineText 통과)**:

```
{>>사용자가 입력한 코멘트\n두 번째 줄 ^2026-06-25 10:00^<<}
```

**로드 시 (decodeInlineText 통과, 타임스탬프 추출 후)**:

```typescript
// CommentItem.content 값 (실제 개행 포함)
"사용자가 입력한 코멘트\n두 번째 줄"
```

---

### Before: 정규식 디코더의 잘못된 동작

```typescript
// 입력: "경로는 C:\\nginx\\n입니다" (디스크에서 읽은 값)
const decoded = text.replace(/\\n/g, '\n');
// 결과: "경로는 C:\\nginx\n입니다" — \nginx의 \n이 개행으로 변환됨 (버그)
```

### After: 순차 스캔 디코더

```typescript
// 동일 입력에 순차 스캔 적용
// \\n → 두 문자('\' + 'n') 그대로, \n 토큰(개행)은 별개로 처리
// 결과: "경로는 C:\nginx\n입니다" — 올바른 디코딩
```

---

### CM6 크래시 가드 Before/After

```typescript
// BEFORE: 모든 범위를 CM6에 전달
const ranges = findInlineCommentRanges(text);
ranges.forEach(r => builder.add(r.from, r.to, Decoration.replace({})));
// 레거시 코멘트에 실제 \n이 있으면 RangeError → 에디터 크래시

// AFTER: 개행 포함 범위를 사전 필터링
const ranges = selectHideableRanges(text); // \n 포함 범위 제외
ranges.forEach(r => builder.add(r.from, r.to, Decoration.replace({})));
// 레거시 코멘트는 그대로 표시됨 (숨김 데코레이션 미적용)
```

## Related

- `docs/solutions/architecture-patterns/inline-comment-storage-migration-pattern.md` — `{>>...<<}` 저장 포맷의 기원 및 Live Preview 숨김 메커니즘. 본 문서는 블록 내부 콘텐츠 인코딩 계층을 다룬다.
- `docs/solutions/ui-bugs/reading-mode-markdown-highlight-comment-mismatch.md` — Reading View에서 `{>>...<<}` 블록 숨김 파이프라인. 멀티라인 코멘트 지원 이후 `hideFirstInlineComment`의 정규식이 실제 `\n`을 포함한 블록을 올바르게 처리하는지 검증 필요.
- `docs/solutions/logic-errors/comment-insert-position-coordinate-desync.md` — 쓰기 경로 단일 스냅샷 원칙. 디코드 위치(타임스탬프 추출 이후)와 같은 순서 의존성 패턴의 선례.
