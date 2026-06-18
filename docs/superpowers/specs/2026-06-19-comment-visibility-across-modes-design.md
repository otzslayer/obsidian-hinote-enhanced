# 모드별 코멘트 표시 일관성 — 설계

- 작성일: 2026-06-19
- 상태: 설계 승인 대기
- 범위: 두 개의 독립 기능 (A·B). 한 스펙에 담되 구현은 순차 진행.

## 배경 / 동기

현재 플러그인은 모드(원본 / 실시간 미리보기 / 읽기)에 따라 코멘트 표시·상호작용이 제각각이다.

1. **편집 모드(원본 + 실시간 미리보기)** — `EditorHighlightDecorations.ts`의 CodeMirror ViewPlugin이 담당. 코멘트 버튼(위젯)을 붙이고 `{>>...<<}` 원본 문법을 `Decoration.replace`로 숨긴다.
2. **읽기 모드** — `PreviewWidgetRenderer.ts`의 마크다운 후처리기가 담당(별도 경로).

관찰된 두 가지 문제:

- **(A 동기)** 사이드바(HiNoteView) 빈 공간을 클릭하면 라이브 프리뷰에서 숨겨졌던 `{>>...<<}`가 노출된다. 이는 의도된 기능이 아니라, `buildDecorations`가 *그 에디터 자신의 파일*이 아니라 **전역 활성 마크다운 뷰**를 기준으로 동작해 활성 뷰가 마크다운이 아니게 되는 순간 장식이 통째로 제거되는 부작용이다. 사용자는 이 "문법 노출"을 의도적·예측 가능하게 제어하길 원한다.
- **(B 동기)** 읽기 모드에서는 코멘트가 **없는** 하이라이트에 버튼이 영구 숨김 처리되어, 사이드바로만 코멘트를 확인/추가할 수 있다. 모든 하이라이트에서 버튼으로 코멘트를 보고 추가하길 원한다.

확정된 사실: 원본 모드의 기본 상태도 "버튼만 보이고 `{>>...<<}` 문법은 숨김"이다. 즉 `Decoration.replace`는 원본·라이브 프리뷰 두 모드에 동일하게 적용된다(코드 주석 "Source mode shows them as-is"는 실제 동작과 어긋나 있었다).

---

## 기능 A — 인라인 코멘트 문법 표시 토글

### 동작

두 개의 깔끔한 보기 상태를 명령으로 전환한다. 원본 모드·실시간 미리보기 모두 동일하게 동작하며, 읽기 모드는 영향받지 않는다.

| 상태 | `{>>...<<}` 원본 문법 | 코멘트 버튼(위젯) |
| --- | --- | --- |
| 토글 OFF (기본값) | 숨김 | 표시 |
| 토글 ON | 노출(원본 그대로) | 숨김 |

- OFF = 현재의 기본 "깔끔 보기".
- ON = "원본 편집 보기" — 코멘트를 텍스트로 직접 읽고 편집.

### 구현

1. **설정 플래그 추가**: `PluginSettings`에 `showInlineCommentSyntax?: boolean`, `DEFAULT_SETTINGS`에서 `false`. `saveSettings()`로 영속화하여 재시작 후에도 유지(전역 상태).
2. **명령 추가**: `src/commands/toggleInlineCommentSyntax.ts`에 `registerToggleInlineCommentSyntaxCommand(plugin)` — `registerCommands`에서 호출. 동작: 플래그 반전 → `plugin.saveSettings()` → 열려 있는 **모든** 마크다운 에디터의 장식 새로고침. 명령 id `toggle-inline-comment-syntax`, 이름은 i18n `t()` 키(예: `'Toggle inline comment syntax'`)로.
3. **`EditorHighlightDecorations.buildDecorations` 분기**:
   - 위젯 생성: `shouldShowCommentWidget(plugin) && !plugin.settings.showInlineCommentSyntax` 일 때만.
   - `{>>...<<}` 숨김 루프(`findInlineCommentRanges` → `Decoration.replace`): `!plugin.settings.showInlineCommentSyntax` 일 때만 적용.
4. **새로고침 범위**: 현재 `HighlightDecorator.refreshDecorations()`는 활성 뷰 1개만 갱신한다. 토글은 전역 상태이므로 열린 모든 마크다운 leaf의 에디터에 빈 트랜잭션을 디스패치하도록 확장(`workspace.getLeavesOfType('markdown')` 순회).

### 필수 동반 수정 — 활성 뷰 버그

토글이 문법 표시의 **유일한 제어 수단**이 되려면, 사이드바 포커스로 장식이 통째로 날아가는 현재 동작을 고쳐야 한다. 안 고치면 토글 OFF여도 사이드바 클릭 시 문법이 노출된다.

- `buildDecorations`에서 `plugin.app.workspace.getActiveViewOfType(MarkdownView)` 대신, **그 에디터 자신의 파일**을 `view.state.field(editorInfoField).file`로 해석한다(`editorInfoField`는 `obsidian` 모듈에서 import, 가용 확인됨).
- 부수 효과: "사이드바 포커스 시 코멘트 버튼이 사라지던" 글리치도 함께 해결된다.
- 트레이드오프: 기존의 "사이드바 누르면 문법 노출" 부작용은 사라지고, 의도된 토글이 그 역할을 대체한다.

### 접점 파일 (A)

- `src/types/settings.ts` — 플래그 + 기본값.
- `src/editor/EditorHighlightDecorations.ts` — 분기 + 파일 해석 수정.
- `src/editor/HighlightDecorator.ts` — `refreshDecorations` 전역화.
- `src/commands/toggleInlineCommentSyntax.ts` (신규) + `src/commands/index.ts` — 명령 등록.
- `src/i18n/*` — 명령 이름 키.

---

## 기능 B — 읽기 모드: 모든 하이라이트 버튼 + 코멘트 추가

### 동작

- **모든** 하이라이트에 코멘트 버튼을 렌더링한다.
  - 코멘트 **없는** 하이라이트: 편집 모드와 동일하게 **호버 시 노출**(`setupEmptyCommentHover` 패턴).
  - 코멘트 **있는** 하이라이트: 카운트와 함께 상시 표시 + 호버 미리보기 툴팁 유지.
- 버튼 **클릭** → 마크 옆에 인라인 `CommentInput` 팝오버를 띄워 새 코멘트 추가. (확정: ⓐ — 코멘트 유무와 무관하게 클릭은 "인라인 추가 입력 열기"로 **통일**. 기존 "클릭 → 사이드바 패널" 동작은 대체된다. 편집 모드와 동일한 상호작용.)

### 구현

1. `PreviewWidgetRenderer.renderPreviewWidget`을 수정: `hasComments` 분기에 갇혀 있던 버튼 노출/상호작용을 모든 하이라이트로 확장.
   - 코멘트 없음 → `setupEmptyCommentHover(widget, button)`로 호버 노출.
   - 코멘트 있음 → 기존 카운트 + 툴팁.
   - 공통 → 클릭 시 인라인 추가 입력 열기.
2. **인라인 추가 입력**: 편집 모드의 `openInlineCommentInput`과 동일하게 공유 `CommentInput` 컴포넌트를 마크 옆 컨테이너에 마운트. 단 저장 경로가 다르다.
3. **저장 경로(핵심)**: 읽기 모드엔 에디터가 없으므로 `editor.replaceRange` 대신 **`CommentService.addComment(highlight, content)`** 를 사용한다. 이미 `InlineCommentWriter`를 통해 `vault.read` + `vault.modify`로 쓰는 **에디터 독립** 경로이므로 그대로 재사용 가능하다. 저장 후 Obsidian이 파일 modify로 읽기 뷰를 재렌더 → 새 코멘트가 반영된다.

### 접점 파일 (B)

- `src/views/highlight/preview/PreviewWidgetRenderer.ts` — 버튼/클릭 확장.
- `src/components/comment/CommentInput.ts` (재사용) — 읽기 모드용 onSave 콜백에서 `CommentService.addComment` 호출.
- `src/services/comment/CommentService.ts` (재사용, 변경 없음 목표).

---

## 데이터 모델 변경

- `PluginSettings.showInlineCommentSyntax?: boolean` (신규, 선택적, 기본 `false`).
- 마이그레이션 영향 없음(선택적 키, 기본값 존재). `migrateSettings`/`normalizeSettings`가 미지정 키를 유지하는지 구현 단계에서 확인.

## 에러 처리 / 엣지 케이스

- **A**: 에디터에 `editorInfoField`가 없거나 `.file`이 null(비파일 에디터)이면 기존처럼 `Decoration.none` 반환(안전).
- **A**: `shouldProcessFile`이 false면 분기 이전과 동일하게 처리 제외.
- **B**: 같은 위젯에 입력이 이미 열려 있으면 중복 오픈 방지(편집 모드의 가드와 동일).
- **B**: `CommentService.addComment`가 앵커 불일치 등으로 실패하면 사용자에게 알리고 입력은 유지(데이터 유실 방지).
- **B**: 코멘트가 없는 하이라이트는 `highlight.id`가 추출 시점에 부여됨 — 추가 시 매처가 text/position으로 앵커링하므로 동작 확인 필요.

## 테스트

- **A(단위)**: `showInlineCommentSyntax` ON/OFF에 따른 `buildDecorations` 분기 — 위젯 생성 여부, `{>>...<<}` 숨김 루프 적용 여부. 파일 해석이 활성 뷰가 아닌 에디터 자신을 따르는지(회귀: 사이드바 포커스 시 장식 유지).
- **B(단위)**: `renderPreviewWidget`이 코멘트 없는 하이라이트에도 버튼·호버·클릭을 연결하는지. 저장 콜백이 `CommentService.addComment`로 라우팅되는지.
- **수동**: 세 모드 전환 + 토글 명령 + 사이드바 포커스 회귀 + 읽기 모드에서 코멘트 추가 후 재렌더 확인.

## 범위 밖 (YAGNI)

- 토글의 리본/사이드바 헤더/설정 UI 표면(명령 팔레트만 채택).
- 읽기 모드 코멘트 **수정/삭제** 인라인 UI(추가만 범위). 기존 사이드바 경로 유지.
- 토글의 per-note 상태(전역 상태로 단순화).
