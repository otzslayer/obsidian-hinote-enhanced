---
title: "콜드 스타트 첫 하이라이트가 '선택된 텍스트가 없습니다'로 실패 (지연 초기화의 CM6 재구성이 DOM Selection 을 지움)"
date: 2026-07-16
category: docs/solutions/logic-errors/
module: plugin-initialization
problem_type: logic_error
component: service_object
related_components:
  - frontend_stimulus
symptoms:
  - "Obsidian 재시작 후 첫 `Mod+Shift+S` 가 읽기 모드에서 '선택된 텍스트가 없습니다' Notice 로 끝남 (두 번째 입력부터는 정상)"
  - "명령 실행 직후 하이라이트하려던 선택 텍스트가 화면에서 시각적으로 사라짐"
  - "수정 이전에는 `Mod+Shift+S` / `Mod+Shift+C` 가 콜드 스타트에서 아무 반응 없이 죽음 — 던져진 예외를 Obsidian 이 삼켜 로그도 남지 않음"
  - "이미 렌더된 읽기 모드 문서가 `SectionLineRegistry` 에 등록되지 않아 줄범위 조회가 실패함"
  - "단위 테스트 220개 전량 통과 · 빌드 통과 · 리뷰어 5인 무결점 — 그럼에도 실제 볼트 콜드 스타트에서 재현"
root_cause: async_timing
resolution_type: code_fix
severity: medium
tags:
  - obsidian-plugin
  - reading-mode
  - lazy-initialization
  - cold-start
  - dom-selection
  - codemirror6
  - highlight
  - init-side-effect
---

# 읽기 모드 하이라이트가 콜드 스타트 첫 입력에서 항상 실패 (지연 초기화가 같은 틱에 DOM Selection 을 지움)

## Problem

플러그인은 `onload()` 에서 명령·리본·뷰만 등록하고 서비스 그래프는 `InitializationManager.ensureInitialized()` 가 첫 사용 시점에 구축하는 지연 초기화 구조다. 읽기 모드 하이라이트 명령(`Mod+Shift+S`)이 그 경로에서 초기화를 트리거하도록 만들었더니, **초기화가 같은 틱에 CM6 를 재구성하면서 읽기 모드의 DOM Selection 을 지워** 콜드 스타트 이후 첫 입력이 항상 "No text selected" 로 끝나고 두 번째 입력부터만 동작했다.

## Symptoms

- Obsidian 재시작(콜드 스타트) 직후 읽기 모드에서 텍스트를 선택하고 `Mod+Shift+S` → Notice **"No text selected"**. 선택은 눈에 보이게 살아 있는데도 실패한다.
- **두 번째 입력부터는 정상 동작** — 콜드/웜 비대칭. 이미 초기화가 끝난 뒤라 초기화 경로를 타지 않기 때문이며, 이 비대칭 자체가 "초기화가 범인"이라는 유일한 관측 단서였다.
- 최초 결함 형태는 더 조용했다: 명령이 `getDecorator()` 썽크를 통해 `main.ts` 의 `requireInitializedServices()` (`main.ts:54-60`) 를 거쳤는데, 이 게터는 초기화 전에 `throw` 하고 Obsidian 이 그 예외를 삼켜 **단축키가 아무 반응 없이 죽은 것처럼** 보였다.
- 함께 있던 별개 결함: `SectionLineRegistry` 를 채우는 포스트프로세서가 `HighlightDecorator.enable()` 안에 있어(수정 이전 `src/editor/HighlightDecorator.ts:99-106` — 이번 브랜치에서 제거하고 `src/plugin/PluginBootstrap.ts:40-50` 으로 이전했으므로 현재 트리에는 없다) 초기화 시점에만 등록됐고, `registerMarkdownPostProcessor` 는 **등록 이후의 렌더에만** 적용되므로 이미 렌더된 문서는 레지스트리에서 통째로 누락됐다.

## What Didn't Work

### 첫 번째 시도 — "명령이 실행 시점에 지연 초기화하면 된다"

레지스트리를 플러그인 필드 + `onload` 등록으로 올린 부분은 옳았고 지금도 유지된다(`src/plugin/PluginBootstrap.ts:40-50`, `main.ts:27`). 문제는 나머지 절반이었다. `checkCallback` 은 **동기 시그니처**라 `await` 를 걸 수 없으므로, 초기화를 fire-and-forget async IIFE 로 감쌌다:

```ts
// checkCallback 은 동기 시그니처 → fire-and-forget
void (async () => {
    try { await ensureInitialized(); } catch { new Notice(...); return; }
    const highlighter = new ReadingModeHighlighter(ctx.app, ctx.highlightService, ctx.sectionLineRegistry);
    await highlighter.highlightSelection();   // ← activeWindow.getSelection() 를 여기서 읽는다
})().catch(...);
```

**단위 테스트 220개 통과. 빌드 통과. 5개 병렬 코드 리뷰어(correctness · adversarial · reliability · testing · project-standards) 전원 무결함 판정.** 그리고 **수동 콜드 스타트 테스트에서 즉시 실패했다** — 재시작 후 첫 `Mod+Shift+S` 가 "No text selected", 두 번째는 정상.

### 검증 장치 전체가 놓친 이유 — 이 문서의 핵심

**1. 단위 테스트가 잡을 수 있는 종류의 버그가 아니었다.**
실제 결함은 "CM6 재구성이 DOM Selection 을 지운다"인데, vitest 에는 CM6 도 DOM Selection 도 없다. `obsidian` 은 목이고 `registerEditorExtension` 은 아무 일도 하지 않는다. 220개가 초록인 것은 **무결함의 증거가 아니라 테스트가 그 축을 관측하지 않는다는 증거**였다. 초록 테스트를 안전 신호로 읽은 것이 첫 오독이다.

**2. adversarial 리뷰어는 옳은 논증으로 틀린 대상을 반박했다.**
리뷰어는 선택 소실 가설을 명시적으로 기각하며 이렇게 썼다:

> "`await ensureInitialized()` yields exactly one microtask; microtasks cannot re-render or collapse a DOM Selection."

**이 추론은 그 자체로 정확하다.** 마이크로태스크 하나가 리렌더를 유발하거나 Selection 을 붕괴시킬 수는 없다. 그런데 그것은 애초에 범인이 아니었다. 반박은 `await` 를 겨눴고, 진짜 범인은 `await` 가 **아직 suspend 하기도 전에** 이미 끝나 있던 동기 `initialize()` 였다. 정확한 반박이 잘못된 표적을 맞히면 그 정확성이 그대로 **거짓 확신으로 전환된다** — 실제 메커니즘은 검토된 적조차 없는데 "검토 후 기각됨"이라는 기록만 남는다.

**일반화** — **틀린 가설에 대한 옳은 반박은 무죄 판결이 아니다.** 리뷰가 어떤 가설을 기각했다면 물어야 할 것은 "논증이 타당한가"가 아니라 **"기각된 가설이 관측된 증상을 설명할 수 있는 유일한 후보였는가"** 다. 여기서 관측 증상(콜드/웜 비대칭)은 여전히 설명되지 않은 채 남아 있었고, 그것이 반박의 사거리 밖에 다른 메커니즘이 있다는 신호였다.

**3. 다섯 리뷰어는 독립적이지 않았다.** 전원이 같은 코드와 같은 목 기반 테스트를 봤고, 아무도 실제 볼트를 띄우지 않았다. 리뷰어 수를 늘리는 것은 **관측 축이 하나일 때 신뢰도를 곱해 주지 않는다** — 같은 맹점을 다섯 번 재확인할 뿐이다. 이 결함을 잡은 것은 리뷰어 다섯이 아니라 수동 재시작 테스트 한 번이었다.

## Solution

plan 의 KTD7 이 **"패턴 일관성"만을 이유로 고려 후 기각했던 중간 옵션**을 채택했다. `HighlightService` 를 `sectionLineRegistry` 와 마찬가지로 `CommentPlugin` 의 readonly 필드로 승격하고, `InitializationManager` 는 새로 만드는 대신 **그 인스턴스를 공유**한다. 그러면 읽기 모드 경로는 초기화를 아예 트리거하지 않고 preview 분기가 완전히 동기로 돌아온다.

**Before** — 실행 시점 지연 초기화 (위 IIFE). 초기화가 같은 틱에 CM6 를 재구성 → Selection 소멸.

**After** — 초기화 없음. 하이라이터를 같은 틱에 만들어 Selection 이 살아 있는 동안 읽는다 (`src/commands/toggleHighlight.ts:63-79`):

```ts
} else {
    // preview 모드 — 초기화를 기다리지 않는다(위 주석 참조).
    // 하이라이터를 같은 틱에 만들어 DOM Selection 이 살아 있는 동안 읽는다.
    const highlighter = new ReadingModeHighlighter(
        ctx.app,
        ctx.highlightService,
        ctx.sectionLineRegistry,
    );
    void highlighter.highlightSelection().catch((e) => { ... });
}
```

소유권은 `main.ts:40` 으로 올라갔고, **왜 그래야 하는지가 코드 주석으로 박혀 있다**(`main.ts:29-39`):

```ts
readonly highlightService = new HighlightService(this.app, () => this.settings);
```

`InitializationManager` 는 자기 인스턴스를 만들지 않고 플러그인 것을 공유한다(`src/services/InitializationManager.ts:58-63`):

```ts
// 하이라이트 서비스는 플러그인이 소유한 인스턴스를 공유합니다.
// 읽기 모드 하이라이트 명령이 초기화 없이 같은 서비스를 쓰므로,
// 여기서 새로 만들면 인덱스와 명령이 서로 다른 인스턴스를 보게 됩니다.
const highlightService = this.plugin.highlightService;
void highlightService.initialize();
```

`registerCommands` 시그니처에서 이 명령만 `ensureInitialized` · `getDecorator` 를 받지 않으며, 이유가 호출부에도 남아 있다(`src/commands/index.ts:30-34`). `toggle-inline-comment-syntax` 는 `ensureInitialized` 를 그대로 유지한다 — `refreshAllDecorations()` 가 실제로 필요하고 선택에 민감하지 않기 때문이다.

즉 **초기화 썽크를 받는 명령 모듈 중에서는 이 선택 민감 명령 하나만 계약에서 이탈하고, 나머지 넷은 계약을 그대로 따른다**(`openCommentPanel` · `openMainWindow` · `toggleInlineCommentSyntax` · `openStatsDashboard`). 여섯 번째 등록인 `run-inline-migration`(`src/commands/index.ts:37`)은 애초에 이 계약 밖이다 — `app` 만으로 모달을 열 뿐 서비스 그래프를 건드리지 않으므로, 의도적 이탈이 아니라 해당 없음이다.

## Why This Works

**진짜 메커니즘 — `await` 는 무죄다.**

`await ensureInitialized()` 는 먼저 그 함수를 **호출**한다. `async` 함수의 본문은 자기 내부의 첫 `await` 까지 **동기로** 실행된다. 그런데 `ensureInitialized()` 는 `this.initialize()` 를 호출하고(`src/services/InitializationManager.ts:39`), `initialize()` 는 반환 타입이 `Promise` 도 아닌 `PluginServices` 이고 **본문에 `await` 가 단 하나도 없다**(`src/services/InitializationManager.ts:48-97`). 따라서 **서비스 그래프 전체가 키 입력과 같은 틱에 동기로 구축된다 — `await` 가 suspend 하기도 전에.**

그 안에서 `highlightDecorator.enable()` (`src/services/InitializationManager.ts:85`) 이 `registerEditorExtension([highlightPlugin])` (`src/editor/HighlightDecorator.ts:107`) 을 호출해 CM6 를 재구성하고, 그 과정이 읽기 모드의 DOM Selection 을 지운다. IIFE 가 마이크로태스크 하나 뒤에 재개해 `activeWindow.getSelection()` (`src/services/highlight/ReadingModeHighlighter.ts:28-33`) 을 읽을 때는 **이미 비어 있다** → `Notice(t('No text selected'))`.

리뷰어의 반박이 조준한 것은 `await` 였고, 범인은 그 앞에서 이미 실행을 마친 동기 `initialize()` 였다. 두 번째 입력이 성공한 것은 `isInitialized` 가 참이라 `initialize()` 가 다시 돌지 않아 CM6 재구성이 없기 때문이다 — 콜드/웜 비대칭이 정확히 이 메커니즘의 지문이다.

**소유권 승격이 시작 비용을 되살리지 않는 이유** (`onload` 경량 유지는 지연 초기화의 존재 이유이므로 반드시 확인해야 했다):

- `new HighlightService(...)` 는 **순수 객체 할당**이다 — `HighlightExtractor` · `HighlightIndexer` · `HighlightBatchOps` 를 만들 뿐 I/O 가 없다(`src/services/HighlightService.ts:26-33`).
- `HighlightIndexer` 생성자도 빈 `HighlightIndexStore` 와 `HighlightIndexFileWatcher` **객체만** 만든다(`src/services/highlight/HighlightIndexer.ts:16-36`).
- 실제 비용 — `fileWatcher.register()` 와 인덱스 구축 타이머 — 은 전부 별도의 `initialize()` 에 있고(`src/services/highlight/HighlightIndexer.ts:41-54`), 그쪽은 `InitializationManager` 가 지연 초기화 시점에 계속 호출한다(`src/services/InitializationManager.ts:63`).

즉 **생성(비용 0)과 초기화(비용 있음)의 분리를 소유권 경계로 활용**한 것이 이 수정의 본질이다. 인스턴스 공유 덕에 인덱스와 명령이 서로 다른 서비스를 보는 분열도 없다.

## Prevention

### 1. 구조적 속성을 회귀 가드로 고정하라 (관측 불가능한 버그를 테스트 가능한 것으로 치환)

진짜 버그(Selection 소멸)는 단위 테스트가 불가능하다 — vitest 에 Obsidian 이 없다. 대신 **그 버그를 유발하는 구조적 속성**을 고정한다: preview 분기는 하이라이터를 **같은 틱에** 만들어야 한다. `await` 를 다시 넣으면 즉시 깨진다(`test/commands/toggleHighlight.test.ts:120-128`).

```ts
it('preview 모드에서 하이라이터가 같은 틱에 동기로 만들어진다', () => {
    const { plugin, addCommand } = makePlugin('preview');
    registerToggleHighlightCommand(plugin as never);

    getCheckCallback(addCommand)(false);

    // flush 하지 않는다 — await 가 끼어 있으면 여기서 아직 0회다
    expect(ReadingModeHighlighter).toHaveBeenCalledOnce();
});
```

**패턴**: `await flush()` 를 **의도적으로 생략**하는 것이 어서션의 핵심이다. 실제 실패 모드를 재현할 수 없을 때, 그것을 **필연적으로 함의하는** 관측 가능한 구조적 불변식(여기서는 "동기성")을 찾아 못 박아라. 그리고 그 테스트에는 왜 이 어서션이 이런 모양인지를 주석으로 남겨라 — 그 주석이 없으면 다음 사람이 "flush 를 빠뜨렸네" 하며 친절히 고쳐 버린다.

### 2. 일반화 — `async` 함수 호출은 그 부작용을 미루지 않는다

**`await f()` 는 `f()` 의 부작용을 나중으로 미루지 않는다.** `f` 의 본문은 자기 내부의 첫 `await` 까지 동기로 실행되고, 내부에 `await` 가 없으면 **전부 호출 지점과 같은 틱에** 끝난다. `async` 라는 시그니처는 지연을 약속하지 않는다.

- 타이밍에 민감한 코드(DOM Selection · 포커스 · 스크롤 위치 · 진행 중인 제스처)를 다룰 때는 **호출하는 함수의 async 여부가 아니라 그 함수가 실제로 무엇을 언제 하는지**를 확인하라. `initialize()` 처럼 `await` 없는 동기 본문은 async 래퍼 뒤에 숨어 있어도 동기다.
- **"휘발성 상태를 읽기 전에 무거운 초기화를 돌린다"는 순서 자체가 안티패턴이다.** 초기화를 나중으로 미루는 것보다, 그 경로에서 **초기화를 아예 없애는 것**이 확실하다.

### 3. 일반화 — 지연 초기화 경로 설계 규칙

- 지연 초기화가 **명령 실행 중간**에 끼면, 그 명령이 읽는 모든 휘발성 상태가 초기화의 부작용에 노출된다. 명령이 필요로 하는 것이 **초기화 비용 0 인 객체뿐**이라면, 소유권을 플러그인으로 올려 그 경로에서 초기화를 제거하라 — "모든 명령이 `ensureInitialized` 를 호출한다"는 **패턴 일관성은 정확성 앞에서 양보해야 한다**. 이번 결함이 정확히 그 일관성 때문에 중간 옵션이 기각되어 생겼다.
- 이탈은 **인스턴스 공유**로 하라. 별도 인스턴스를 만들면 인덱스와 명령이 서로 다른 상태를 보는 조용한 분열이 생긴다.
- 계약에서 이탈하는 지점에는 **이유를 코드 주석으로** 남겨라. 이 저장소는 명령 본문(`src/commands/toggleHighlight.ts:17-24`) · 필드 선언(`main.ts:29-39`) · 등록부(`src/commands/index.ts:30-33`) · 테스트(`test/commands/toggleHighlight.test.ts:108-118`) 네 곳에 남겼다. 주석 없는 이탈은 다음 리팩터링에서 "일관성 개선"으로 되돌려진다.
- `registerMarkdownPostProcessor` 처럼 **등록 이후의 이벤트에만 적용되는 API 는 지연 초기화에 넣지 마라** — 등록 전에 지나간 것은 영원히 놓친다. `onload` 에서 등록하고, 서비스 의존이 없다면 그 자체로 안전하다(`src/plugin/PluginBootstrap.ts:36-50`).

### 4. 검증 절차

- **콜드 스타트 경로는 수동 재시작 테스트가 유일한 관문이다.** 목 기반 테스트 · 빌드 · 다중 리뷰어 어느 것도 이 축을 관측하지 못했다. "지연 초기화를 처음 트리거하는 경로"를 건드렸다면 실제 볼트 재시작 → 첫 입력 검증을 **필수 체크리스트**로 둔다.
- **검증 절차가 콜드/웜을 통제하지 않으면 콜드 경로는 검증되지 않는다.** 원본 기능 계획(`docs/plans/2026-06-21-001-feat-reading-mode-highlight-plan.md:202`)의 수동 검증은 첫 단계로 테스터를 **설정 화면으로 보내 단축키를 재지정**하게 한 뒤 읽기 모드 하이라이트를 확인시켰다. 절차 어디에도 "재시작 후, 아무것도 건드리지 말고 첫 입력을 확인하라"가 없다 — 그래서 그 검증이 콜드 상태에서 돌았는지 웜 상태에서 돌았는지는 **통제되지 않았고, 결과적으로 콜드 경로는 한 번도 검증되지 않았다.**

  주의 — 여기서 "설정 화면 진입이 초기화를 트리거했다"고 단정하면 안 된다. 코드상 초기화를 트리거하는 설정 표면은 **플러그인 자신의 탭뿐**이고(`src/settings/SettingsTab.ts:25`), 네이티브 단축키를 재지정하는 코어 Hotkeys 탭에는 그런 경로가 없다. 그 세션이 실제로 왜 웜이었는지는 코드로 확정할 수 없다. (이 문서의 초안은 바로 그 미검증 메커니즘을 단정했다가 검증 단계에서 걸렸다 — 이 문서가 경고하는 실패를 이 문서가 저지른 셈이라 기록해 둔다.)

  실행 가능한 규칙은 메커니즘이 아니라 절차다: **콜드 경로 검증은 진짜 재시작 직후, 초기화를 트리거할 수 있는 UI 를 단 하나도 건드리지 않은 상태에서** 하고, 그 조건을 검증 절차에 **명시**하라.
- 리뷰가 어떤 가설을 기각했을 때, **관측된 증상이 여전히 설명되지 않은 채 남아 있다면 반박은 완료된 것이 아니다.** 남은 증상(여기서는 콜드/웜 비대칭)이 곧 다음 가설의 좌표다.

## Related Issues

- [`logic-errors/reading-mode-highlight-stale-range-global-uniqueness.md`](reading-mode-highlight-stale-range-global-uniqueness.md) — 같은 읽기 모드 하이라이트 파이프라인의 write-path 결함. 그쪽은 매핑된 좌표가 **stale** 이라 잘못된 위치를 조용히 수정하는 문제(전역 유일성 게이트로 해결), 이쪽은 그 파이프라인이 **시작조차 못 하는** 문제. 두 결함은 같은 경로 위에 쌓인다 — 이번 수정이 `SectionLineRegistry` 포스트프로세서를 `onload` 로 올려 레지스트리를 채우고, 그 레지스트리를 유일성 게이트가 읽는다. 이번 계획의 중단 조건은 그 게이트를 약화시켜 통과시키는 것을 명시적으로 금지했다.
- [`logic-errors/comment-insert-position-coordinate-desync.md`](comment-insert-position-coordinate-desync.md) — "스냅샷 간 상태 안전" 테마의 인접 사례.
- [`architecture-patterns/highlight-stats-service-modal-separation.md`](../architecture-patterns/highlight-stats-service-modal-separation.md) — 명령 콜백의 `await ensureInitialized()` 초기화 게이트를 일반 패턴으로 성문화한 문서. **이번 학습이 그 패턴의 적용 범위를 한정한다**: 게이트는 `await` **이후에** 작업이 시작되는 명령(모달·패널 열기)에는 안전하지만, DOM Selection 처럼 휘발성 상태를 읽는 명령에는 위험하다. 그쪽 코드 자체는 여전히 옳다 — `HighlightStatsModal` 은 선택을 읽지 않는다.
- `docs/plans/2026-07-16-001-fix-reading-mode-highlight-cold-start-plan.md` — 이 학습의 출처 계획. 지연 초기화 리팩터(2026-05-13)가 읽기 모드 하이라이트 기능(2026-06-21)보다 한 달 앞서므로 이 결함은 회귀가 아니라 원본 계획의 공백이었다.
