---
title: "읽기 모드에서 마크다운이 포함된 하이라이트/코멘트가 깨지는 문제 (렌더된 DOM textContent vs raw 소스 불일치)"
date: 2026-06-19
category: docs/solutions/ui-bugs/
module: highlight-preview-rendering
problem_type: ui_bug
component: frontend_stimulus
related_components:
  - service_object
symptoms:
  - "하이라이트에 `**굵게**` 등 인라인 마크다운이 있으면 읽기 모드에서 코멘트 버튼이 보이지 않음 (마크다운 없는 하이라이트는 정상)"
  - "코멘트(`{>>...<<}`) 본문에 `**굵게**` 등 마크다운이 있으면 읽기 모드 본문에 raw `{>>...<<}` 구문이 그대로 노출됨"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags:
  - obsidian-plugin
  - reading-mode
  - dom-textcontent
  - markdown
  - inline-comment
  - highlight
  - criticmarkup
---

# 읽기 모드에서 마크다운이 포함된 하이라이트/코멘트가 깨지는 문제 (렌더된 DOM textContent vs raw 소스 불일치)

## Problem

읽기 모드(Reading view / Markdown post processor)에서 하이라이트·인라인 코멘트를 처리하는 코드가 **"raw 소스 구조가 렌더된 DOM에 그대로 남는다"** 고 가정했다. 그러나 Obsidian은 인라인 마크다운(`**bold**`, `*italic*`, `` `code` ``, `[link]`, `[[wikilink]]`, `~~strike~~` 등)을 `<strong>`/`<code>`/`<a>` 같은 **자식 요소로 변환**하고 `textContent`에서 마커를 지운다. 이 단일 가정에서 겉보기엔 다른 두 버그가 동시에 파생됐다.

## Symptoms

- 하이라이트에 마크다운이 포함되면(`==**중요**==`) 읽기 모드에서 **코멘트 버튼이 생성되지 않음**. 마크다운이 없는 하이라이트는 정상 동작 — 이 비대칭이 진단의 핵심 단서였다.
- 코멘트 본문에 마크다운이 포함되면(`{>>**중요**<<}`) 읽기 모드 본문에 **raw `{>>...<<}` 가 그대로 보임**. 마크다운 없는 코멘트는 정상적으로 숨겨짐.

## What Didn't Work

실제로 코드를 고치진 않았지만, 이 문제는 "빠지기 쉬운 함정"이 명확해서 기록해 둔다. 아래 셋은 모두 **틀린 접근**이다.

- **버그(버튼 누락)를 `**` 전용으로 stripping**: 사용자가 `**`로 예를 들었다고 `**`만 벗기면 그 예시는 통과하지만, `*italic*`·`` `code` ``·`[link]`·`[[wikilink]]`·`~~strike~~`에서 그대로 재현된다. 대상은 "인라인 마크다운 일반"이다.
- **저장 단계(`extractHighlights`)에서 마크다운을 벗겨 저장**: 추출된 `highlight.text`(raw 마크다운 보존)는 **에디터 모드 디코레이션과 공유**된다. 에디터 모드는 CodeMirror raw 소스에서 직접 매칭하므로 raw가 맞다. 저장을 바꾸면 blast radius가 크고 에디터 모드가 깨진다. → **매칭 시점에서만** 고쳐야 한다.
- **코멘트 숨김을 정규식 한 줄로 수정**: `{>>...<<}`가 `<strong>` 같은 자식 요소 때문에 **형제 텍스트 노드로 쪼개지면**(`{>>` / `중요` / `<<}`) 단일 텍스트 노드 정규식은 구조적으로 매칭 불가능하다. 노드 경계를 넘는 처리가 필요하다.

## Solution

### 버그 1 — 코멘트 숨김: 형제 노드를 가로지르는 DOM Range

`hideInlineCommentBlocks`를 `src/editor/inlineCommentHider.ts`로 분리하고, 텍스트 노드를 이어붙여 전체 문자열에서 매칭한 뒤 글로벌 오프셋을 DOM Range로 변환해 제거한다. Range는 사이의 자식 요소(`<strong>` 등)까지 함께 걸친다.

```ts
// Before: 단일 텍스트 노드 안에서만 정규식 — 쪼개지면 실패
const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
while ((node = walker.nextNode())) {
  if (!INLINE_COMMENT_RE.test(node.textContent ?? '')) continue; // 형제 노드 케이스 미매칭
  // ...
}

// After: 블록의 텍스트를 이어붙여 매칭 → 글로벌 오프셋을 Range로
function hideFirstInlineComment(el: HTMLElement): boolean {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const offsets: Array<{ node: Text; start: number }> = [];
  let full = '';
  let n: Node | null;
  while ((n = walker.nextNode()) !== null) {
    offsets.push({ node: n as Text, start: full.length });
    full += (n as Text).textContent ?? '';
  }
  const match = INLINE_COMMENT_RE.exec(full);
  if (!match) return false;

  const startPos = locate(offsets, match.index);
  const endPos = locate(offsets, match.index + match[0].length);
  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  range.deleteContents(); // 자식 요소까지 통째로 제거

  const span = document.createElement('span');
  span.className = 'hi-note-inline-comment-raw';
  span.style.display = 'none';
  range.insertNode(span);
  return true;
}
```

매칭마다 재스캔(`while (hideFirstInlineComment(el)) {}`)해 DOM 변경으로 인한 오프셋 무효화를 피한다. 빈 span(내용 제거)을 삽입하므로 재스캔 시 매칭이 strictly 감소 → 종료 보장.

### 버그 2 — 버튼 매칭: 렌더된 plain text로 비교

`extractHighlights`의 raw 저장은 그대로 두고(에디터 모드와 공유), **매칭 시점**에서 `highlight.text`를 `MarkdownRenderer`로 렌더해 plain text를 얻어 `mark.textContent`와 비교한다.

```ts
// PreviewHighlightResolver: 비교 기준을 text → plainText 로
export type PreviewHighlight = HiNote & { line: number; plainText: string };
// findMatchingHighlight 내부
return highlightsWithComments.find(h => h.plainText === text) || null;

// PreviewWidgetRenderer: plainText 를 렌더러로 채움 (메타문자 없으면 렌더 생략)
private async renderPlainText(markdown: string, sourcePath: string): Promise<string> {
  if (!markdown || !/[*`[\]~<>$_=]/.test(markdown)) return markdown.trim();
  const tmp = document.createElement('div');
  const component = new Component();
  component.load();
  try {
    await MarkdownRenderer.render(this.plugin.app, markdown, tmp, sourcePath, component);
    return (tmp.textContent ?? markdown).trim();
  } catch {
    return markdown.trim();
  } finally {
    component.unload();   // 자식 컴포넌트를 plugin 수명에 매달지 않도록 즉시 unload
    tmp.remove();
  }
}
```

## Why This Works

두 버그의 근본 원인은 하나다: **렌더된 DOM의 `textContent`는 raw 마크다운 소스가 아니다.** Obsidian이 인라인 마크다운을 자식 요소로 변환하면서 (a) 마커를 지우고(`**중요**` → `중요`), (b) 블록을 여러 텍스트 노드로 쪼갠다.

- 버그 2: `mark.textContent`(마커 제거됨)를 raw `highlight.text`(마커 포함)와 `===`로 비교했기에 불일치. 양쪽을 "렌더된 plain text" 기준으로 통일해 해결.
- 버그 1: 단일 텍스트 노드 가정이 노드 쪼개짐에 깨졌기에, 블록 전체를 이어붙여 매칭하고 Range로 자식 요소까지 걸쳐 제거해 해결.

저장(에디터 모드 공유)이 아니라 **표시·매칭 시점**에서만 고친 것이 핵심 — blast radius를 읽기 모드로 한정했다.

## Prevention

- **읽기 모드 처리 코드는 raw 소스와 DOM 구조가 1:1이라고 가정하지 말 것.** 인라인 마크다운은 자식 요소로 변환되고 `textContent`는 마커를 잃는다. 텍스트 비교는 항상 "렌더된 plain text" 기준, 또는 위치/순서 기준으로.
- **DOM 조작 버그는 "쪼개진 DOM"으로 RED를 먼저 확인할 것.** 단일 미렌더 텍스트 노드(`{>>**x**<<}` 한 노드)로 테스트하면 버그가 재현되지 않아 **깨진 코드에서도 초록불**이 뜬다. 테스트 입력을 실제 렌더 모양으로 구성해야 한다:
  - 버그 1: `text("...{>>")` + `<strong>...</strong>` + `text("<<}...")`
  - 버그 2: `<mark><strong>...</strong></mark>`
- **DOM 테스트는 happy-dom 환경**(`// @vitest-environment happy-dom`)으로. `textContent`는 `display:none`이어도 텍스트를 포함하므로, "보이는 텍스트"는 숨김 span(`.hi-note-inline-comment-raw`)을 제거한 뒤 비교한다.
- **`MarkdownRenderer.render`는 로컬 `Component`를 `load()`→render→`unload()`로 감쌀 것.** plugin을 component로 넘기면 임베드/dataview 자식 컴포넌트가 plugin 수명까지 안 풀린다.
- **알려진 한계 — 수식/임베드**: `MarkdownRenderer`는 MathJax·임베드·각주를 비동기 지연 렌더하므로 `await` 직후 `textContent`가 비어 매칭이 어긋날 수 있다. 강조/코드/링크/위키링크/취소선 등 흔한 인라인 마크다운은 정상.

## Verification status

- 단위 테스트 GREEN(전체 95 pass / 0 fail, 신규 6), `tsc` 타입체크 + esbuild production 빌드 통과(exit 0).
- RED→GREEN 사이클 확인: 수정 전 신규 테스트 FAIL 2 → 수정 후 PASS 6.
- **실제 Obsidian vault 수동 검증 완료 (2026-06-19)** — (a) `==**굵게**=={>>코멘트<<}` → 버튼 노출, (b) `{>>**굵은 코멘트**<<}` → raw 미노출 모두 확인.

## Related Issues

- `docs/solutions/logic-errors/comment-insert-position-coordinate-desync.md` — 같은 인라인 코멘트 영역의 **에디터 모드** 좌표 desync. 본 문서는 **읽기 모드** 렌더링 매칭으로, 모드가 다르다(에디터=raw 소스 기준, 읽기=렌더된 DOM 기준).
- `docs/solutions/architecture-patterns/inline-comment-storage-migration-pattern.md` — `{>>...<<}` 인라인 코멘트 저장 포맷의 배경.
- 도메인 용어: `CONCEPTS.md`의 Highlight, Inline Comment Block 참조.
