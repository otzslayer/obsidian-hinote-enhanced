---
status: approved
date: 2026-06-24
topic: comment-newline
---

# 코멘트 줄바꿈 지원 (한 줄 저장) — 설계 스펙

## 1. 배경

코멘트에 줄바꿈을 넣으면 "깨짐" 현상이 발생한다. 사용자 보고: "줄바꿈 인식이
안 되는 문제인 듯". 인라인 코멘트는 노트 본문에 CriticMarkup 형식
`{>>코멘트 ^YYYY-MM-DD HH:mm:ss^<<}`로 저장된다. 줄바꿈이 들어가면 이 블록이
여러 줄에 걸치면서 여러 표면이 동시에 깨진다.

## 2. 진단 (근본 원인)

### 이슈 1 — 에디터 데코레이션 크래시 (핵심, 기본 설정에서 항상 발생)

기본값 `showInlineCommentSyntax: false`(`src/types/settings.ts:89`)에서
`EditorHighlightDecorations.buildDecorations`(`src/editor/EditorHighlightDecorations.ts:64`)는
원시 `{>>...<<}` 블록을 `Decoration.replace({})`로 숨긴다.
**CodeMirror 6에서 ViewPlugin이 제공하는 replace 데코레이션은 줄바꿈을 넘을 수
없다**(`block: true`가 아니면 RangeError 또는 데코레이션 빌드 실패). 멀티라인
블록의 범위가 들어가면 데코레이션 빌드가 깨져 원시 마크업이 노출되거나 위젯이
사라진다. `findInlineCommentRanges`(`src/editor/inlineCommentRanges.ts:4`)는
`[\s\S]*?`로 멀티라인 범위를 그대로 반환한다.

### 이슈 2 — 사이드바 렌더 soft-break (2차)

`CommentList.renderComments`(`src/components/highlight/CommentList.ts:71`)는
`MarkdownRenderer.render`로 코멘트를 렌더한다. 마크다운에서 단일 `\n`은
soft break라 공백으로 병합된다 → 줄바꿈이 "인식 안 됨".

### 이슈 3 — 직렬화가 줄바꿈을 그대로 저장

`sanitizeText`(`src/services/comment/inline/InlineCommentSerializer.ts:87`)는
`<<}`만 ZWNJ로 이스케이프하고 줄바꿈은 그대로 디스크에 저장한다.

### 영향 없는 표면 (확인됨)

- **내보내기**: `ExportContentRenderer.formatComment`(`src/services/export/ExportContentRenderer.ts:63`)는
  이미 `content.split('\n')`으로 줄 단위 콜아웃을 생성 → 인메모리 content가
  실제 줄바꿈이면 그대로 동작.
- **프론트매터 파일 레벨 코멘트**: `processFrontMatter`(`InlineCommentWriter.ts:101`)가
  YAML로 실제 줄바꿈을 안전하게 직렬화 → 저장은 멀쩡, 표시만 이슈 2 공유.

## 3. 설계 결정 (승인됨)

- **D1. 목표 동작**: 줄바꿈을 지원하되 **디스크에는 한 줄로 저장**(인코딩),
  화면에는 여러 줄로 표시(디코딩).
- **D2. 인코딩 방식**: **백슬래시 이스케이프**. 인코딩 시 `\`→`\\` 먼저,
  그다음 줄바꿈→`\n`. 디코딩은 1회 좌→우 스캔. 전단사(bijection)라 신규
  코멘트에는 충돌 없음.
- **D3. 하위 호환(백슬래시)**: **그대로 수용 + 문서화**. 마이그레이션 없음.
- **D4. 에디터 견고성**: **A2 방식** — 줄바꿈을 포함한 숨김 범위는 replace를
  건너뜀(crash 방지, 위젯은 표시). 마이그레이션 없이, 편집·저장 시 새 직렬화기가
  한 줄로 자연 정규화.
- **D5. `<<}` ZWNJ 라운드트립**: **이번 범위 제외**(줄바꿈과 무관한 기존 잠재 버그).

### 핵심 원리 — 단일 인코딩 경계

> 디스크의 인라인 `{>>...<<}` 블록만 `\n` 토큰을 가진다. 인메모리
> `CommentItem.content`는 항상 실제 줄바꿈을 가진다. 인코딩은 `serializeBlock`
> (쓰기) 한 곳, 디코딩은 `parseBlockContent`(읽기) 한 곳에서만.

## 4. 아키텍처 / 컴포넌트 변경

### 4-1. 인코딩 (쓰기) — `InlineCommentSerializer.ts`

`sanitizeText`(또는 신규 `encodeInlineText`)를 다음 순서로 구성:

1. `\` → `\\` (백슬래시 먼저)
2. `\r\n` / `\r` / `\n` → `\n` (줄바꿈 토큰)
3. 기존 `<<}` → `<‌<}` (ZWNJ, 유지)

`serializeBlock(text, ts)` = `{>>${encode(text)} ^${ts}^<<}` → 항상 한 줄.

### 4-2. 디코딩 (읽기) — `InlineCommentParser.ts`

`parseBlockContent`에서 **타임스탬프 추출·AI 접두 strip 후** 디코딩 추가:

- 1회 좌→우 스캔: `\\` → `\`, `\n` → 줄바꿈. 그 외 `\x`는 리터럴 유지.
- ZWNJ(`<<}`) 복원은 D5에 따라 제외.

타임스탬프 정규식 `TIMESTAMP_SUFFIX_RE`는 인코딩된(한 줄) content의 말미
` ^ts^`에 그대로 매치되므로 변경 불필요.

### 4-3. 사이드바 렌더 — `CommentList.ts`

`MarkdownRenderer.render` 호출 전, content의 단일 줄바꿈을 CommonMark
hard break로 변환: `content.replace(/\n/g, '  \n')`. 단일 라인 코멘트는
`\n`이 없어 무영향(surgical). 렌더 실패 폴백(`textContent`)은 기존 유지.

### 4-4. 에디터 가드 (A2) — `EditorHighlightDecorations.ts`

숨김 replace 루프에서, 범위 텍스트가 줄바꿈을 포함하면 `Decoration.replace`를
**추가하지 않음**. (예: `if (docText.slice(from, to).includes('\n')) continue;`
또는 `findInlineCommentRanges`에서 멀티라인 범위를 표시/제외.) 코멘트 위젯
생성 루프는 별개로 영향 없음 → 레거시 멀티라인 블록은 원시 노출되지만 크래시
없음, 편집·저장 시 정규화.

### 4-5. 문서 — `README.md` (+ 필요 시 설정 설명)

하위 호환 주의 명시: 기존 코멘트에 리터럴 `\n`/`\\`가 있으면 새 디코더가
줄바꿈으로 해석할 수 있음(희귀, 수용).

## 5. 데이터 흐름

- **쓰기**: textarea(Shift+Enter로 실제 줄바꿈 입력) → `serializeBlock` 인코딩
  → 디스크 한 줄 블록(`vault.modify` / `editor.replaceRange`)
- **읽기**: 디스크 한 줄 블록 → `INLINE_COMMENT_RE` 매치 → `parseBlockContent`
  디코딩 → `CommentItem.content`(실제 줄바꿈)
- **표시**: 사이드바(hard break 변환 후 렌더) / 내보내기(`split('\n')`,
  무변경) / 에디터(한 줄이라 위젯 정상)

## 6. 에러 처리 / 엣지 케이스

- 기존 **실제 줄바꿈** 블록: 디코딩해도 줄바꿈 유지 → 안전.
- 기존 **리터럴 백슬래시**(`C:\nginx` 등): 오해석 가능 → 수용·문서화(D3).
- 레거시 멀티라인 블록(에디터): A2 가드로 크래시 없음, 편집 시 정규화(D4).
- 프론트매터 파일 레벨 코멘트: YAML 실제 줄바꿈 유지, 표시는 4-3으로 커버.

## 7. 테스트 (RED 먼저)

- `InlineCommentSerializer.test`: 줄바꿈→`\n`, `\`→`\\`, 윈도우 경로/리터럴
  `\n` 인코딩, 한 줄 블록 생성 확인.
- `InlineCommentParser.test`: 한 줄 블록 디코딩→실제 줄바꿈, 레거시 실제
  줄바꿈 블록 파싱, 타임스탬프/AI 접두 동시 처리.
- 라운드트립: `decode(encode(x)) === x` (백슬래시·줄바꿈 조합 케이스).
- `EditorHighlightDecorations`: 멀티라인 블록 포함 문서 → 실제 `EditorView`
  마운트 시 빌드 크래시 없음, 멀티라인 범위는 미숨김.
- `CommentList`(또는 순수 헬퍼): 멀티라인 content → hard break 변환 확인.

## 8. 범위 / 비범위

**범위**: 인라인 코멘트 인코딩/디코딩, 사이드바 hard-break 렌더, 에디터 A2 가드,
README 문서화.

**비범위**: 백슬래시 하위 호환 마이그레이션(D3), `<<}` ZWNJ 라운드트립 수정(D5),
에디터 StateField 이전(B안), 프론트매터·내보내기 코드 변경(무변경 확인됨).

## 9. 영향 파일 (예상)

- `src/services/comment/inline/InlineCommentSerializer.ts` (인코딩)
- `src/services/comment/inline/InlineCommentParser.ts` (디코딩)
- `src/components/highlight/CommentList.ts` (hard-break 렌더)
- `src/editor/EditorHighlightDecorations.ts` (A2 가드)
- `README.md` (하위 호환 주의)
- `test/inline/InlineCommentSerializer.test.ts`,
  `test/inline/InlineCommentParser.test.ts`,
  `test/editor/EditorHighlightDecorations.test.ts` (테스트)
