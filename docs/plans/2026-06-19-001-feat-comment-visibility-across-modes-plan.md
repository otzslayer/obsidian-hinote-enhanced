# feat: 모드별 코멘트 표시 일관성 (문법 토글 + 읽기 모드 버튼/추가)

- 작성일: 2026-06-19
- 유형: feat
- 깊이: Standard
- 브랜치: `feat/comment-visibility-across-modes`
- 원본 스펙(origin): `docs/superpowers/specs/2026-06-19-comment-visibility-across-modes-design.md`

---

## Context

플러그인은 편집 모드(원본/라이브 프리뷰)와 읽기 모드에서 코멘트 표시·상호작용이 제각각이다. 두 가지를 일관되게 만든다.

- **기능 A** — 라이브 프리뷰에서 사이드바(HiNoteView) 빈 공간을 클릭하면 숨겨졌던 `{>>...<<}` 문법이 노출되는데, 이는 의도된 기능이 아니라 `EditorHighlightDecorations.buildDecorations`가 *에디터 자신의 파일*이 아니라 **전역 활성 마크다운 뷰**를 기준으로 동작해, 활성 뷰가 마크다운이 아니게 되는 순간 장식이 통째로 제거되는 부작용이다. 이 노출을 **명령 팔레트 토글**로 의도적·예측 가능하게 제어한다. 부작용을 없애기 위해 활성 뷰 의존도 함께 제거한다.
- **기능 B** — 읽기 모드에서 코멘트가 **없는** 하이라이트는 버튼이 영구 숨김이라 사이드바로만 코멘트를 다룰 수 있다. 모든 하이라이트에 버튼을 보이고, 클릭으로 코멘트를 **추가**할 수 있게 한다.

확정 사실: 원본 모드의 기본 상태도 "버튼만 보이고 `{>>...<<}` 숨김"이다(`Decoration.replace`가 원본·라이브 프리뷰 두 모드에 동일 적용). 코드 주석 "Source mode shows them as-is"는 실제 동작과 어긋나 있었다.

기능 A·B는 서로 독립적이다(A는 에디터 장식 경로, B는 마크다운 후처리기 경로). A는 U1→U2→U3 순차, B는 U4 독립.

---

## Requirements

- **R1** — 명령 팔레트 명령으로 `{>>...<<}` 문법 표시를 켜고 끈다(기본 단축키 `Mod+Shift+C`). 원본 모드 + 라이브 프리뷰에서 동일 동작, 읽기 모드 무관.
- **R2** — 토글 OFF(기본): 문법 숨김 + 코멘트 버튼 표시. 토글 ON: 문법 노출 + 코멘트 버튼 숨김.
- **R3** — 토글 상태는 전역이며 재시작 후에도 유지된다.
- **R4** — 사이드바 포커스(빈 공간 클릭 등)가 더 이상 에디터 장식을 제거하지 않는다(토글이 유일한 제어 수단).
- **R5** — 읽기 모드에서 모든 하이라이트에 코멘트 버튼이 보인다(코멘트 없으면 호버 노출, 있으면 카운트와 함께 상시 + 호버 미리보기 툴팁 유지).
- **R6** — 읽기 모드에서 버튼 클릭 시 인라인 입력으로 새 코멘트를 추가한다(코멘트 유무 무관, ⓐ 통일). 저장 후 읽기 뷰에 반영된다.

---

## Key Technical Decisions

- **KTD1 — 활성 뷰 의존 제거.** `buildDecorations`에서 `app.workspace.getActiveViewOfType(MarkdownView)` 대신 `view.state.field(editorInfoField).file`로 **에디터 자신의 파일**을 해석한다. `editorInfoField`는 `obsidian` 모듈에서 export됨(가용 확인). 이로써 R4를 달성하고 "사이드바 포커스 시 코멘트 버튼이 사라지던" 글리치도 함께 해결된다.
- **KTD2 — 토글은 전역 영속 플래그 + 명령 팔레트 단일 표면.** 리본/사이드바 헤더/설정 UI는 범위 밖(YAGNI). 상태는 `PluginSettings.showInlineCommentSyntax`로 `saveSettings()` 영속화.
- **KTD3 — 읽기 모드 추가는 `CommentService.addComment` 재사용.** 읽기 모드엔 에디터가 없어 `editor.replaceRange` 불가. `CommentService.addComment` → `InlineCommentWriter.addComment`는 `vault.read`+`vault.modify`로 쓰는 **에디터 독립** 경로이며, 인라인 삽입 좌표 desync 버그를 이미 하드닝했다(`docs/solutions/logic-errors/comment-insert-position-coordinate-desync.md`). **재구현 금지, 그대로 재사용.**
- **KTD4 — 두 보기 모델.** 토글 OFF=깔끔 보기(버튼만), ON=원본 편집 보기(원본만). 위젯 생성과 문법 숨김을 동일 플래그로 상호 배타 분기.

---

## 코멘트 보기 상태 (기능 A)

| 상태 | `{>>...<<}` 원본 문법 | 코멘트 버튼(위젯) | 적용 모드 |
| --- | --- | --- | --- |
| 토글 OFF (기본) | 숨김(`Decoration.replace`) | 표시 | 원본 + 라이브 프리뷰 |
| 토글 ON | 노출(replace 미적용) | 숨김 | 원본 + 라이브 프리뷰 |

---

## Implementation Units

### U1. 설정 플래그 `showInlineCommentSyntax` 추가

- **Goal**: 토글 상태를 담을 전역 영속 플래그. (R3)
- **Dependencies**: 없음
- **Files**:
  - `src/types/settings.ts` — `PluginSettings`에 `showInlineCommentSyntax?: boolean` 추가, `DEFAULT_SETTINGS`에 `false`.
  - `src/settings/SettingsMigration.ts` — `normalizeSettings`에 `showInlineCommentSyntax: source.showInlineCommentSyntax ?? defaults.showInlineCommentSyntax` 매핑 추가.
  - `test/settings/SettingsMigration.test.ts` (신규).
- **Approach**: `normalizeSettings`는 키를 **명시적으로 매핑**한다(`showCommentWidget` 미러). 새 키를 여기에 추가하지 않으면 저장 시 버려지므로 반드시 매핑한다.
- **Patterns to follow**: `src/settings/SettingsMigration.ts`의 `showCommentWidget` 처리, `src/types/settings.ts`의 `DEFAULT_SETTINGS`.
- **Execution note**: 테스트 우선(순수 로직, 단위 테스트 용이).
- **Test scenarios** (`test/settings/SettingsMigration.test.ts`):
  - 미지정 입력 → `showInlineCommentSyntax === false`(기본값 적용).
  - `showInlineCommentSyntax: true` 입력 → 보존.
  - 기존 다른 설정 키와 함께 → 둘 다 보존(회귀: 새 키 추가가 기존 키를 떨구지 않음).
- **Verification**: 위 테스트 통과. `npm run build` 타입 오류 없음.

### U2. `EditorHighlightDecorations` 토글 분기 + 활성 뷰 버그 수정

- **Goal**: 에디터 자신의 파일로 동작하고(R4), `showInlineCommentSyntax`로 위젯/문법을 상호 배타 분기(R2). (KTD1, KTD4)
- **Dependencies**: U1
- **Files**:
  - `src/editor/EditorHighlightDecorations.ts`
- **Approach**:
  - `obsidian`에서 `editorInfoField` import. `buildDecorations`에서 `getActiveViewOfType(MarkdownView)` 제거 → `view.state.field(editorInfoField)?.file`로 파일 해석. `file`이 없거나 `shouldProcessFile`이 false면 기존처럼 `Decoration.none`.
  - 위젯 생성: 기존 `shouldShowCommentWidget(plugin)` 조건에 `&& !plugin.settings.showInlineCommentSyntax` 추가.
  - `{>>...<<}` 숨김 루프(`findInlineCommentRanges` → `Decoration.replace`): `!plugin.settings.showInlineCommentSyntax`일 때만 적용.
- **Patterns to follow**: 같은 파일의 기존 `buildDecorations` 구조, 순수 헬퍼 `findInlineCommentRanges`(변경 없음).
- **Execution note**: 활성 뷰 → 에디터 자신 파일 전환은 회귀 위험(사이드바 포커스 시 장식 유지, 다중 마크다운 창에서 각 에디터가 자기 파일 기준). 수동 회귀 확인 필수.
- **Test scenarios**:
  - 순수 헬퍼 `findInlineCommentRanges`: 다중 `{>>...<<}` 블록의 from/to 범위 정확(기존 동작 회귀, `test/editor/` 신규 또는 기존 inline 테스트 인접).
  - 통합(수동): OFF에서 두 모드 모두 문법 숨김+버튼 표시 / ON에서 문법 노출+버튼 숨김 / 사이드바 빈 공간 클릭해도 OFF 상태 유지(문법 안 새어 나옴).
- **Verification**: 수동 체크리스트(아래 Verification 섹션) 통과. 빌드 타입 오류 없음.

### U3. 토글 명령 추가 + 전역 장식 새로고침

- **Goal**: 명령 팔레트에서 플래그 토글 → 저장 → 열린 모든 마크다운 에디터 새로고침. (R1, R3)
- **Dependencies**: U1, U2
- **Files**:
  - `src/commands/toggleInlineCommentSyntax.ts` (신규) — `registerToggleInlineCommentSyntaxCommand(plugin)`.
  - `src/commands/index.ts` — 등록 호출 추가.
  - `src/i18n/` — 명령 이름 키(예: `'Toggle inline comment syntax'`).
  - `src/editor/HighlightDecorator.ts` — 모든 마크다운 leaf를 새로고침하는 메서드 추가(기존 `refreshDecorations`는 활성 뷰 1개만 갱신).
- **Approach**: 명령 id `toggle-inline-comment-syntax`, 기본 단축키 `hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'C' }]`(`addCommand`에 지정). 콜백: `plugin.settings.showInlineCommentSyntax = !plugin.settings.showInlineCommentSyntax` → `await plugin.saveSettings()` → `plugin.highlightDecorator.refreshAllDecorations()`. 새 메서드는 `workspace.getLeavesOfType('markdown')`를 순회하며 각 에디터에 빈 트랜잭션 디스패치(기존 `refreshDecorations`의 단일 뷰 로직 일반화).
- **Patterns to follow**: `src/commands/openCommentPanel.ts`의 `registerXxxCommand` 패턴과 `t()` 사용, `src/settings/tabs/GeneralSettingsTab.ts`의 `highlightDecorator.refreshDecorations()` 호출, 기존 `HighlightDecorator.refreshDecorations`의 빈 트랜잭션 디스패치.
- **Test scenarios**:
  - 통합(수동): 명령 팔레트 노출 + 기본 단축키 `Mod+Shift+C` 동작 → 실행 시 상태 토글 → 두 모드 즉시 반영 → 재시작 후 상태 유지 → 여러 마크다운 창 동시 갱신.
- **Verification**: 수동 체크리스트 통과. 빌드 타입 오류 없음.

### U4. 읽기 모드 — 모든 하이라이트 버튼 + 인라인 코멘트 추가

- **Goal**: 읽기 모드 모든 하이라이트에 버튼, 클릭 시 인라인 추가. (R5, R6)
- **Dependencies**: 없음(기능 A와 독립)
- **Files**:
  - `src/views/highlight/preview/PreviewWidgetRenderer.ts` — 버튼/호버/클릭 확장.
  - `src/components/comment/CommentInput.ts` (재사용, 변경 없음 목표).
  - `src/services/comment/CommentService.ts` (재사용, 변경 없음 목표).
- **Approach**:
  - `renderPreviewWidget`을 `hasComments` 분기에서 해방: 코멘트 없음 → `CommentWidgetHelper.setupEmptyCommentHover(widget, button)`로 호버 노출, 코멘트 있음 → 기존 카운트 + 툴팁.
  - 공통 클릭 핸들러: 마크 옆 컨테이너에 `CommentInput`(create 모드, `existingComment: undefined`) 마운트. `onSave: async (content) => { await commentService.addComment(highlight, content); }`. 중복 입력 가드(편집 모드 동일).
  - `CommentService` 인스턴스는 플러그인 서비스에서 해석(생성자 주입 또는 `plugin.services` 경유 — 구현 시 확정). `plugin`을 `CommentInput`에 넘길 때 편집 모드처럼 `as unknown as CommentPlugin` 캐스트.
  - ⓐ 통일: 코멘트 있는 하이라이트의 클릭도 "인라인 추가"로(기존 "클릭→사이드바 패널" 대체). 수정/삭제는 사이드바 유지(범위 밖).
- **Patterns to follow**: `src/editor/EditorHighlightDecorations.ts`의 `openInlineCommentInput`(저장 경로만 `editor.replaceRange` → `CommentService.addComment`로 교체), `src/components/comment/CommentWidgetHelper.ts`의 `setupEmptyCommentHover`/`createButton`/`setupClickEvent`.
- **학습 참조**: `docs/solutions/logic-errors/comment-insert-position-coordinate-desync.md` — 삽입 좌표 로직은 `CommentService`/`InlineCommentWriter`가 캡슐화. 직접 좌표 계산 재구현 금지.
- **Test scenarios**:
  - 단위(가능 시): `CommentService.addComment`가 코멘트 없는 하이라이트(추출 id 보유)에 대해 `==text=={>>...<<}` 삽입을 만들어내는지 — 기존 `test/inline/InlineCommentWriter.test.ts` 패턴 확장. (실제 anchor: `extractHighlights`가 `IdGenerator.generateHighlightId`로 결정적 id 부여 확인됨.)
  - 통합(수동): 읽기 모드에서 코멘트 없는 하이라이트 호버 시 버튼 노출 → 클릭 → 입력 → 저장 → 새 코멘트가 노트에 삽입되고 읽기 뷰 재렌더로 카운트/툴팁 반영. 코멘트 있는 하이라이트 클릭도 인라인 추가로 동작.
- **Verification**: 수동 체크리스트 통과. 저장된 마크다운에 `{>>...<<}` 블록이 올바른 하이라이트 뒤에 위치. 빌드 타입 오류 없음.

---

## Scope Boundaries

- **범위 안**: R1–R6.
- **범위 밖 (YAGNI / 후속)**:
  - 토글의 리본/사이드바 헤더/설정 UI 표면(명령 팔레트만).
  - 읽기 모드 코멘트 **수정/삭제** 인라인 UI(추가만). 기존 사이드바 경로 유지.
  - 토글의 per-note 상태(전역으로 단순화).

---

## Verification (end-to-end 수동 체크리스트)

선행: `npm run build` 성공, `npm test`(vitest) 통과.

기능 A:
1. 원본 모드: 기본=버튼만/문법 숨김 → 토글 명령 → 문법 노출/버튼 숨김 → 다시 토글 → 원복.
2. 라이브 프리뷰: 동일 검증.
3. 회귀(핵심): 토글 OFF 상태에서 HiNote 사이드바 열고 빈 공간 클릭 → **문법이 노출되지 않고** 버튼도 사라지지 않음.
4. 재시작 후 토글 상태 유지.
5. 마크다운 창 2개 동시 열고 토글 → 둘 다 갱신.

기능 B:
6. 읽기 모드: 코멘트 없는 하이라이트 호버 → 버튼 노출 → 클릭 → 입력 → 저장 → 노트에 `{>>...<<}` 삽입 + 읽기 뷰 재렌더 반영.
7. 코멘트 있는 하이라이트: 카운트/툴팁 유지, 클릭 시 인라인 추가 입력.
8. 여러 하이라이트 노트에서 대상 하이라이트 **바로 뒤**에 삽입(좌표 정확).

---

## Risks & Notes

- **R(위험) — CM/후처리기 단위 테스트 한계**: 저장소 테스트 문화는 순수 로직만 다룬다(`test/`는 serializer/parser/writer/extractor). U2–U4의 CM 장식·DOM 렌더링은 수동 검증 의존. 순수 헬퍼·서비스 경로는 단위 테스트로 커버.
- **R — `editorInfoField` 가정**: obsidian export 확인됨. 비파일 에디터에서 `.file` null 가드 필요(→ `Decoration.none`).
- **R — `CommentService` 접근**: `PreviewWidgetRenderer`가 현재 `CommentService`를 보유하지 않음. 주입 경로(생성자 추가 vs `plugin.services` 경유)는 구현 시 최소 변경으로 확정.
- **R — 기본 단축키 충돌**: `Mod+Shift+C`가 다른 플러그인/사용자 바인딩과 충돌할 수 있음. 기본값으로 지정하되 충돌 시 사용자가 **Settings → Hotkeys**에서 재바인딩 가능(Obsidian 기본 동작).

---

## Sources & Research

- origin 스펙: `docs/superpowers/specs/2026-06-19-comment-visibility-across-modes-design.md`
- 학습: `docs/solutions/logic-errors/comment-insert-position-coordinate-desync.md`, `docs/solutions/architecture-patterns/inline-comment-storage-migration-pattern.md`
- 코드 접점: `src/editor/EditorHighlightDecorations.ts`, `src/editor/HighlightDecorator.ts`, `src/views/highlight/preview/PreviewWidgetRenderer.ts`, `src/components/comment/{CommentWidgetHelper,CommentInput}.ts`, `src/services/comment/CommentService.ts`, `src/settings/SettingsMigration.ts`, `src/types/settings.ts`, `src/commands/`
