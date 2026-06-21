---
title: "읽기 모드 하이라이트가 stale 줄범위로 엉뚱한 위치를 조용히 수정 (전역 유일성 게이트 누락)"
date: 2026-06-21
category: docs/solutions/logic-errors/
module: reading-mode-highlight
problem_type: logic_error
component: service_object
related_components:
  - frontend_stimulus
symptoms:
  - "읽기 모드에서 Mod+Shift+S로 선택한 텍스트가 아닌 다른 단락의 동일 단어/구문이 ==…==로 감싸짐"
  - "오삽입 시 Notice가 전혀 표시되지 않아 사용자가 인지하기 어려움 (silent data-integrity)"
  - "파일 변경 직후(렌더 후 stale 범위 발생) 읽기 모드에서 하이라이트할 때 재현 가능성이 높음"
root_cause: async_timing
resolution_type: code_fix
severity: medium
tags:
  - obsidian-plugin
  - reading-mode
  - stale-range
  - data-integrity
  - global-uniqueness
  - vault-process
  - dom-source-mapping
---

# 읽기 모드 하이라이트가 stale 줄범위로 엉뚱한 위치를 조용히 수정 (전역 유일성 게이트 누락)

## Problem

읽기 모드 하이라이트 명령은 렌더된 DOM 텍스트 선택을 마크다운 소스 위치로 역매핑한 뒤 `app.vault.process`(원자적 fresh-read + write)로 `==…==`를 삽입한다. `SectionLineRegistry`는 마크다운 포스트프로세서가 각 블록 요소를 렌더할 때 `getSectionInfo`로 얻은 줄 범위 `{lineStart, lineEnd}`를 WeakMap에 기록하고, 순수 함수 `mapHighlightInsertion`이 그 줄 범위로 블록 슬라이스를 잘라 선택 텍스트를 찾아 래핑한다. **줄 범위는 렌더 시점에 캡처되지만 파일 내용은 쓰기 시점에 fresh-read되므로**, 그 사이 파일이 바뀌면 stale 범위가 엉뚱한 블록을 가리킬 수 있고, 원래 가드는 선택 텍스트가 "블록 슬라이스 안에서 유일"하기만 하면 통과시켜 **Notice 없이 디스크의 잘못된 위치를 래핑**하는 조용한 데이터 무결성 버그가 발생했다.

## Symptoms

- 읽기 모드에서 Mod+Shift+S를 눌렀을 때 선택한 텍스트가 아닌 **다른 단락**의 동일 단어/구문이 `==…==`로 감싸짐.
- 오삽입 시 Notice가 전혀 표시되지 않아 사용자가 오삽입 사실을 인지하기 어려움.
- 렌더 후 파일을 변경하고 읽기 모드를 빠져나가지 않은 채 하이라이트를 적용할 때(= stale 범위) 재현 가능성이 높음.

## What Didn't Work

**Approach A (검토 후 기각)** — 선택 영역의 렌더된 좌우 컨텍스트를 캡처하고, 마크다운 마커를 제거한 뒤 소스 매치와 대조해 stale 범위를 교정하는 방안.

- **마크다운 스트리핑 자체가 오탐 표면이 된다**: 스트리핑 로직에 버그가 있으면 stale 매치를 오히려 통과시켜 가드에 구멍이 생긴다. 안전 가드가 복잡해질수록 신뢰가 떨어진다.
- **DOM 컨텍스트 캡처 복잡도**가 plan이 이미 MVP 위험(R5)으로 수용한 좁은 리스크에 비해 비례하지 않는다.
- 무회귀라는 장점은 R1("블록 내 유일")을 지키는 것이지만, 단순함·안전 우선을 종합하면 과하다.

Approach A는 "문서에 반복되는 텍스트의 하이라이트가 자주 막힌다"는 실제 사용 피드백이 쌓일 경우의 follow-up으로 남겨 두었다.

## Solution

`mapHighlightInsertion`(`src/services/highlight/HighlightInsertionMapper.ts`)에 **전역(문서 전체) 유일성 게이트**를 추가했다. 블록 내 매치의 절대 오프셋 `absStart`를 계산한 뒤, 선택 텍스트가 전체 `sourceText`에 정확히 1회만 존재하는지 검증하고 아니면 `ambiguous`를 반환한다. 이 게이트는 기존 블록 내 중복 체크 **이후**에 위치하고, 매핑은 좌표 desync를 피하기 위해 `vault.process` 콜백 안에서 수행된다.

```ts
// src/services/highlight/HighlightInsertionMapper.ts — mapHighlightInsertion

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
```

`ReadingModeHighlighter`는 `ambiguous` 사유에 대해 `t('Selected text is ambiguous (appears multiple times)')` Notice를 띄운다. Notice 문구는 기존 "...in block"에서 "..."(블록이 아닌 문서 전체 기준)로 정정했고 en/zh i18n과 README를 함께 동기화했다.

## Why This Works

선택 텍스트가 문서 전체에 **정확히 1회** 존재하면, 줄 범위가 stale이어도 래핑할 위치는 논리적으로 단 하나뿐이다 — 엉뚱한 블록에 동일 텍스트가 없으므로 잘못 감쌀 자리 자체가 존재하지 않는다. 게다가 현실적인 stale 시나리오에서 사용자가 실제로 선택한 텍스트는 파일의 진짜 위치에 여전히 남아 있으므로 전역 카운트가 최소 2가 되어 게이트가 안전하게 중단한다. 즉 이 게이트는 "이론적으로 안전"할 뿐 아니라 실제 발생 경로를 직접 막는다.

트레이드오프: 문서 내 2곳 이상에 동일 텍스트가 있으면 이제 `ambiguous`로 중단된다. 이는 **graceful한 실패**(Notice + 파일 무수정)이고, 편집 모드 하이라이트(네이티브 토글)에는 영향을 주지 않는다.

## Prevention

**일반화 원칙** — 한 스냅샷(렌더 시점 DOM/줄 범위)에서 캡처한 좌표를 **다른 스냅샷**(fresh 디스크 읽기)에 매핑할 때, 로컬/블록 범위 유일성만으로는 올바른 위치를 보장하기에 **충분하지 않다**. 스냅샷 간격 동안 좌표가 무효화될 수 있기 때문이다. 안전 설계 규칙:

- 스냅샷 간격을 살아남는 **전역 유일성** 또는 **명시적 콘텐츠 핑거프린트**를 요구하라.
- 매치 실패는 반드시 **가시적 중단**(Notice)으로 처리하라 — 조용한 쓰기는 절대 허용하지 않는다.
- 사용자 노트를 직접 수정하는 매핑은 `vault.process` 콜백 안에서 수행해 좌표 desync를 피하라.

회귀 테스트(`test/highlight/HighlightInsertionMapper.test.ts`):

- **전역 중복 → ambiguous**: `'foo bar\nbaz foo'`에서 line 0 기준 `'foo'` 선택은 블록 내 1회지만 문서 전체 2회 → `ambiguous`.
- **전역 유일 → ok (무회귀)**: 다중 블록 문서에서 전체 1회인 텍스트는 게이트 통과 후 정상 래핑.

관련 파일: `src/services/highlight/HighlightInsertionMapper.ts`(게이트 추가), `src/services/highlight/ReadingModeHighlighter.ts`(Notice 문구), `test/highlight/HighlightInsertionMapper.test.ts`(회귀 테스트).

## Related Issues

- [`logic-errors/comment-insert-position-coordinate-desync.md`](comment-insert-position-coordinate-desync.md) — 같은 "스냅샷 좌표 안전" 테마. 그쪽은 에디터 컨텍스트 오프셋을 디스크 스냅샷에 적용해 생긴 desync(같은 스냅샷으로 읽기·쓰기로 해결), 이쪽은 렌더 시점 줄범위를 fresh `vault.process` 내용에 적용해 생긴 staleness(전역 유일성으로 해결). 근본 원인·해법은 다르나 쌍으로 읽으면 write-path 좌표 안전 패턴을 이해하기 쉽다.
- [`ui-bugs/reading-mode-markdown-highlight-comment-mismatch.md`](../ui-bugs/reading-mode-markdown-highlight-comment-mismatch.md) — 읽기 모드 렌더 `textContent` ≠ raw 소스(inline 마커 제거). 같은 읽기 모드 하이라이트 파이프라인의 인접 함정. 본 버그가 graceful `not-found`로 처리하는 inline 마크다운 케이스의 배경.
- [`architecture-patterns/inline-comment-storage-migration-pattern.md`](../architecture-patterns/inline-comment-storage-migration-pattern.md) — `==…==` 인라인 저장 포맷과 write-path Anchor Safety(KTD3) 아키텍처 맥락. Anchor Safety 불변식은 기존 코멘트 패칭 경로 전용이라 신규 삽입에 강제 적용되진 않지만, "쓰기 전 라이브 콘텐츠 검증" 정신이 이 게이트와 같다.
