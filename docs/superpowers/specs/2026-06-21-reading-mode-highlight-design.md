# 읽기 모드 하이라이트 (Mod+Shift+S 통합 명령) — 설계

- 작성일: 2026-06-21
- 상태: 설계 승인됨 (스펙 리뷰 대기)
- 범위: 읽기 모드에서 선택 텍스트를 단축키로 하이라이트하는 단일 통합 명령. 데스크톱 단축키 전용 MVP.

## 배경 / 동기

하이라이트의 본질은 마크다운 `==text==`(및 `<mark>`, `<span>`)다. 플러그인은 문서 텍스트에서 이를 `extractHighlights`로 추출해 코멘트·AI·플래시카드 기능을 얹는다. 즉 **하이라이트 생성 = 소스에 `==...==` 삽입**이다.

- **편집 모드(원본 / 실시간 미리보기)**: 사용자가 텍스트를 선택하고 Obsidian **네이티브 "Toggle highlight"** 명령(사용자가 Mod+Shift+S에 바인딩)으로 `==...==`를 삽입한다. 플러그인은 자체 하이라이트 생성 명령을 등록하지 않는다(확인됨: `commands/index.ts`에 없음).
- **읽기 모드**: 읽기 전용 렌더 HTML이라 에디터가 없고, 네이티브 highlight 명령은 비활성이다. 플러그인은 `registerMarkdownPostProcessor`로 기존 하이라이트 옆에 코멘트 버튼만 그린다(`HighlightDecorator.enable` → `PreviewWidgetRenderer.processPreview`).

**원하는 것**: 읽기 모드에서도 텍스트를 선택해 **같은 Mod+Shift+S**로 하이라이트하고, 삽입 직후 기존 hinote enhanced 흐름(렌더링·코멘트 버튼·AI·플래시카드)이 그대로 이어지게 한다.

## 결정된 사항 (브레인스토밍)

1. **현재 Mod+Shift+S** = Obsidian 네이티브 "Toggle highlight"(편집 모드 전용). — 사용자 확인.
2. **단축키 구조** = **통합 명령**. 플러그인이 양쪽 모드를 모두 처리하는 단일 명령을 등록하고, Mod+Shift+S를 이 명령에 둔다.
3. **트리거/플랫폼 범위** = **데스크톱 단축키 전용 MVP**. 모바일 선택 메뉴는 후속 과제.

---

## 명령 구조 — 통합 "Toggle highlight"

- 새 명령 `hi-note:toggle-highlight` 등록. 기본 단축키로 `Mod+Shift+S` 선언(`addCommand({ hotkeys: [{ modifiers: ['Mod','Shift'], key: 'S' }] })` — `toggleInlineCommentSyntax`의 Mod+Shift+C 선례와 동일 패턴).
- **1회 마이그레이션(사용자 작업)**: 기존 네이티브 *Toggle highlight*의 Mod+Shift+S 바인딩을 해제해 충돌을 없앤다. README/설정 안내 문구로 명시.
- **`checkCallback`**: 활성 `MarkdownView`가 있으면 명령 활성. (실제 동작 가능 여부는 실행 시점에 판정하고, 불가 시 `Notice`로 안내.)
- **실행 분기** (`MarkdownView.getMode()` — `LocationService.ts:115`가 이미 `'source' | 'preview'`로 사용 중):
  - **편집 모드(`source`)**: 네이티브 `editor:toggle-highlight`에 위임 → 기존 동작·토글오프 100% 유지(재구현 없음). 명령 id는 구현 시 `app.commands.commands` 조회로 검증하고, 다를 경우 폴백으로 `editor.replaceSelection('==' + sel + '==')` 단순 래핑.
  - **읽기 모드(`preview`)**: 아래 "읽기 모드 하이라이트" 로직 수행.

---

## 읽기 모드 하이라이트 — DOM 선택 → 소스 매핑 (핵심)

명령 핸들러에는 `MarkdownPostProcessorContext`가 없어 `context.getSectionInfo`를 직접 쓸 수 없다. 이것이 이 기능의 유일한 난관이다.

### 블록 줄범위 기록 (보조 패스)

- 기존 preview 후처리 경로(`HighlightDecorator.enable`)에 **블록 줄범위 기록 처리기**를 추가한다. 각 렌더 섹션 엘리먼트 `el`에 대해 `context.getSectionInfo(el)`의 `{lineStart, lineEnd}`를 **`WeakMap<Element, {lineStart, lineEnd}>`** 에 저장한다.
- `getSectionInfo`는 `PreviewHighlightResolver.getSectionInfo`에서 이미 사용 중인 지원 API다. WeakMap은 엘리먼트가 GC되면 함께 정리되어 누수가 없다.
- *검토한 대안*: ① 엘리먼트에 `data-*` 속성 부착(디버깅 쉬움, DOM 오염) ② preview 렌더러 내부 API 직접 조회(`ObsidianInternals` 선례 있으나 버전 취약). → **WeakMap**이 지원 API에 머물면서 가장 안전.

### 명령 실행 시퀀스 (읽기 모드)

1. `activeWindow.getSelection()`으로 선택 Range·텍스트 획득(팝아웃 창 대응 — 코드베이스가 이미 `activeDocument` 사용).
2. 선택 텍스트가 비었으면 `Notice` 후 중단.
3. 선택의 시작 노드에서 위로 올라가며 **WeakMap에 등록된 블록 조상**을 찾아 `{lineStart, lineEnd}` 조회. 못 찾으면 중단.
4. `vault.process(file, (data) => ...)`로 현재 소스를 원자적으로 읽어:
   a. `lineStart..lineEnd` 범위의 소스 substring 추출.
   b. 선택 plain text를 그 범위 안에서 **유일 substring**으로 탐색. (0건/2건 이상 → 중단, `Notice`.)
   c. 매칭 구간이 **이미 하이라이트 안인지** 검사(double-wrap 방지) → 겹치면 중단.
   d. 매칭 구간을 `==...==`로 감싼 새 소스를 반환.
5. 파일 변경 → Obsidian이 preview를 재렌더 → 기존 `PreviewWidgetRenderer`가 새 하이라이트에 코멘트 버튼을 붙인다(추가 작업 불필요).

### 매핑 핵심 로직 (순수 함수로 분리)

`(sourceText, lineStart, lineEnd, selectedPlainText, existingHighlightRanges) → { ok: true, newText, insertedAt } | { ok: false, reason }`

- 입력은 모두 문자열·숫자·범위 배열 → DOM 비의존 → vitest 단위 테스트 가능.
- `existingHighlightRanges`는 `highlightService.extractHighlights(sourceText, file)`의 `position`/`originalLength`로 구성.

---

## 하이라이트 생성 후 동작

네이티브와 동일하게 **하이라이트만 생성**한다. 코멘트 입력을 자동으로 열지 않는다. 기존 흐름대로 하이라이트 옆 코멘트 버튼이 나타나고, 사용자가 필요 시 클릭해 코멘트를 추가한다("기존 기능 그대로" 요구사항과 일치).

## MVP 컷 — 처리 범위와 graceful degradation

처리: **단일 블록(섹션) 내에서, 정규화 소스에 유일하게 매칭되는 plain 텍스트.**

아래는 모두 안전하게 중단하고 `Notice`로 사유를 안내한다(노트 훼손 0):

- 선택에 inline 마크다운(굵게·기울임·링크·코드 등)이 섞여 소스에서 verbatim 매칭 실패.
- 여러 블록(섹션)에 걸친 선택.
- 소스 범위 내 다중 매칭(모호).
- 이미 하이라이트된 영역과 겹침(double-wrap 방지).
- 빈 선택 / 블록 줄범위 조회 실패.

## 데이터 모델 변경

- 없음. 설정 플래그·저장 스키마 변경 없음. 기존 `==...==` 마크다운에 그대로 합류한다.

## 에러 처리 / 엣지 케이스

- 활성 `MarkdownView` 없음 / 비파일 뷰 → 명령 비활성 또는 즉시 중단.
- `vault.process` 콜백 내 매칭 실패는 **원본을 그대로 반환**(no-op)하고 호출부에서 `Notice` — 파일 수정 0.
- 선택이 블록 경계를 넘거나 줄범위 조회 실패 → 중단.
- `shouldProcessFile(file)`이 false면 처리 제외(기존 정책 일관).
- 읽기 모드 재렌더 타이밍: 파일 modify 이벤트가 preview 재렌더와 기존 post-processor 재실행을 보장한다(기존 코멘트 추가 흐름에서 검증된 경로).

## 테스트

- **단위(vitest)**: 매핑 순수 함수 — 정상 매칭/삽입 오프셋, verbatim 매칭 실패, 0건·다중 매칭, 기존 하이라이트와 겹침, 빈 선택. happy-dom 환경.
- **단위**: 모드 분기 — `getMode()` 'source'면 네이티브 위임 경로, 'preview'면 읽기 모드 경로 선택.
- **수동**: 읽기 모드에서 plain 텍스트 선택 → Mod+Shift+S → 하이라이트 생성 + 코멘트 버튼 등장 확인. 마크다운 섞인 선택/다중 블록/겹침에서 Notice + 무수정 확인. 편집 모드에서 기존 토글 동작 회귀 확인.

## 범위 밖 (YAGNI)

- 모바일/터치 선택 메뉴 트리거(후속 과제).
- 읽기 모드 선택 컨텍스트 메뉴·툴바 UI.
- inline 마크다운이 섞인 선택의 정밀 매핑(렌더 텍스트↔소스 토큰 정렬).
- 다중 블록 걸친 선택 하이라이트.
- 하이라이트 **해제**(읽기 모드에서 기존 하이라이트 제거) — 생성만 범위.
- 네이티브 명령과의 자동 hotkey 마이그레이션(사용자가 1회 수동 해제).
