# 파일 코멘트 → 프론트매터 `comments` 전체 CRUD

- **날짜**: 2026-06-23
- **상태**: 설계 승인됨 (구현 대기)
- **브랜치**: `feat/file-comment-frontmatter`
- **유형**: 동작 변경 (behavior change) — 사이드바 우상단 "Add file comment" 버튼

## 배경 / 현재 상태 (확정된 사실)

HiNote Enhanced에는 노트 전체에 붙는 **File-level Comment**(CONCEPTS.md) 개념이 있고, 저장 위치는 노트 YAML 프론트매터의 `comments` 키(`{text, ts}` 객체 배열)다. 인프라는 대부분 갖춰져 있으나 버튼만 옛 경로에 묶여 있다.

- **읽기/렌더 (완료)**: `HighlightExtractor.extractHighlights`가 `extractFileLevelComments(file)` → `parseFileLevelComments(cache.frontmatter)`로 프론트매터 코멘트를 읽어, 사이드바에 **통합 가상 하이라이트 카드 1개**(`text:''`, `position:-1`, `isVirtual:true`)로 렌더링한다 (`HighlightExtractor.ts:88–102`). 모든 파일 코멘트가 이 카드 하나 아래 개별 코멘트 아이템으로 모인다.
- **쓰기 서비스 (존재)**: `InlineCommentWriter.addFileLevelComment / updateFileLevelComment / deleteFileLevelComment`가 `app.fileManager.processFrontMatter`로 프론트매터 `comments`에 기록한다. 단, `update/delete`는 **`ts` 키**로 동작하고 **외부 호출자가 0개**다(미사용/예비 상태).
- **순수 변환 (존재)**: `FrontmatterComments.ts`의 `parseFileLevelComments` / `mergeFileLevelComments`. 온디스크 형상 계약은 정확히 `{text: string, ts: string}` (그 외 형상은 foreign으로 보존). `mergeFileLevelComments`는 foreign 항목을 앞에, HiNote 항목을 뒤에 순서대로 둔다.
- **문제 지점**: "Add file comment" 버튼(`VirtualHighlightManager.handleAddFileComment`)은 여전히 문서 최상단에 가상 하이라이트를 만들어 **사이드카 데이터 저장소**(`HighlightManager.addHighlight`)에 저장한다. 프론트매터로 가지 않는다.
- **현재의 깨진 동작**: 최근 `feat/inline-comment-storage`(인라인 `{>>...<<}` 전환) 이후 `CommentService.add/update/deleteComment`는 **무조건 인라인 writer**로 라우팅한다. 따라서 프론트매터 통합 카드(`position:-1`)의 코멘트는 편집/삭제가 사실상 불가능하다(본문에서 앵커를 못 찾음). 이 작업은 "절반쯤 깔린 전환을 완성"하는 성격이다.

## 목표

"Add file comment" 버튼과 그 통합 카드의 **추가·편집·삭제**가 모두 노트 프론트매터 `comments` 배열로 라운드트립한다. 사이드카 저장소는 더 이상 신규 파일 코멘트를 만들지 않는다.

## 범위

### 포함
- 버튼 클릭 → 모달 입력 → 프론트매터 `comments`에 추가.
- 통합 카드 내 개별 코멘트 편집 → 프론트매터 라운드트립.
- 통합 카드 내 개별 코멘트 삭제 → 프론트매터 라운드트립 (마지막 삭제 시 카드 제거).

### 제외
- 기존 사이드카(가상 하이라이트) 파일 코멘트의 프론트매터 마이그레이션 — 별도 `InlineMigrationRunner`가 담당. 사용자가 이번 범위에서 명시적으로 제외.
- 마이그레이션의 UTC vs 로컬 `ts` 포맷 불일치(기존 잠재 이슈) — 건드리지 않음.
- 일반 하이라이트의 인라인 코멘트 경로 — 변경 없음.

## 설계

### 핵심 결정: `ts`가 아니라 **ordinal(순번) 주소법**

편집/삭제의 식별 키로 `ts`가 아니라 **파싱된 file-level 코멘트 목록에서의 순번(index)**을 쓴다.

- `ts`(`"YYYY-MM-DD HH:mm"`, 분 단위)는 **고유성이 없다** — 같은 분에 만들어진 두 코멘트가 동일 `ts`를 가지면 `updateFileLevelComment`(`.map(c => c.ts===old ? new : c)`)와 `deleteFileLevelComment`(`.filter(c => c.ts!==ts)`)가 **둘 다 함께** 수정/삭제한다.
- `createdAt`에서 `ts`를 복원하는 우회도 불가: `formatTimestamp`는 **초 단위**(`HH:mm:ss`)를 내지만 file-level `ts`는 **분 단위**라 라운드트립이 깨진다.
- ordinal은 충돌-면역이며, ts 키 메서드는 호출자가 0이라 시그니처 교체 비용이 없다.
- ordinal은 `parseFileLevelComments(fm)`(HiNote 형상만, 원래 순서 유지)에 대해 계산한다 — 읽기와 쓰기가 동일 기준을 쓰므로 안정적이다. 각 편집/삭제는 재추출 → 재렌더로 ordinal을 새로 계산한다.

### 변경 지점 ①: 추가 경로 — 모달 + 버튼 리와이어

**파일**: 새 `src/components/comment/FileCommentModal.ts`(또는 `ui/`), `VirtualHighlightManager.ts`, `HiNoteViewSetup.ts`, `CommentService.ts`

- `VirtualHighlightManager.handleAddFileComment`에서 사이드카 가상 하이라이트 생성(`highlightManager.addHighlight`)과 그에 딸린 `onVirtualHighlightCreated`/자동 입력창 열기/스크롤 로직을 **제거**.
- 버튼 클릭 핸들러: `getCurrentFile()` 없으면 기존 Notice. 있으면 **`FileCommentModal`**(Obsidian `Modal`: textarea + Cancel/Save)을 연다.
- 모달 Save(공백 트림 후 비어있지 않을 때만) → 새 콜백 `onAddFileComment(file, text)` 호출.
- `onAddFileComment` 배선(`HiNoteViewSetup`): `CommentService.addFileLevelComment(file, text)` → 뷰 새로고침.
- 새 메서드 `CommentService.addFileLevelComment(file, text)`: 분 단위 `ts` 생성(예: `formatTimestamp(Date.now()).slice(0, 16)`) → `inlineWriter.addFileLevelComment(file, {text, ts})` → 새로고침. **하이라이트 객체 불필요**(첫 추가 시 카드가 없는 비대칭을 모달이 흡수).

### 변경 지점 ②: 읽기/렌더 — durable key 보관 + 라벨

**파일**: `HighlightExtractor.ts`, `types/highlight.ts`

- `CommentItem`에 옵셔널 필드 `fileCommentIndex?: number` 추가(`types/highlight.ts`).
- `HighlightExtractor.ts:88–102`에서 통합 카드 생성 시 각 `CommentItem`에 `fileCommentIndex`(= `parseFileLevelComments` 결과에서의 index)를 실어준다.
- 통합 카드(`position:-1`)에 인식 가능한 라벨(localized "File comments")을 렌더. `text:''`는 유지(인라인/dedup 로직에 영향 없도록) — 라벨은 렌더 계층에서 `position===-1` 분기로 표시.

### 변경 지점 ③: 편집/삭제 — `CommentService` 분기

**파일**: `CommentService.ts`

- `updateComment`/`deleteComment` **최상단**에서 file-level 분기 가드: `highlight.position === -1`(= 프론트매터 통합 카드 판별자). 인라인 writer의 오프셋 계산(`toHighlightMatch`)이 `position:-1`에서 쓰레기값을 만들기 전에 가른다.
  - 판별자는 `position === -1`. (레거시 사이드카 파일 코멘트는 `position:0`, `text:"File Comment"`라 구분됨.)
- file-level 분기:
  - `commentId`로 해당 `CommentItem` 찾고 그 `fileCommentIndex`(ordinal)와 현재 `content`(expectedText) 확보.
  - **편집**: `inlineWriter.updateFileLevelCommentAt(file, index, expectedText, {text: newContent, ts})`. `ts`는 **원래 값 보존**(코멘트 정체성/순서 안정). 내용 무변경이면 기존처럼 쓰기 생략 + 카드 리렌더만.
  - **삭제**: `inlineWriter.deleteFileLevelCommentAt(file, index, expectedText)`. 삭제 후 통합 카드의 `comments.length===0`이면 기존 카드 제거 로직 재사용(파일 코멘트 카드는 플래시카드 연관이 없으므로 항상 제거).
- 인메모리 모델 갱신 + 새로고침은 기존 흐름 재사용.

### 변경 지점 ④: Writer — ordinal 키 + 앵커 안전성

**파일**: `InlineCommentWriter.ts`

- 미사용 `updateFileLevelComment`/`deleteFileLevelComment`(ts 키)를 ordinal 키로 **교체**:
  - `updateFileLevelCommentAt(file, index, expectedText, newComment): Promise<WriteResult>`
  - `deleteFileLevelCommentAt(file, index, expectedText): Promise<WriteResult>`
- `processFrontMatter` 콜백 안에서 `const parsed = parseFileLevelComments(fm)`; **`parsed[index]?.text !== expectedText`면 중단**(클로저 플래그로 `success:false` 반환, 호출부 Notice). 일치하면 해당 index만 교체/제거 후 `mergeFileLevelComments`로 되쓰기.
- 이 text 검증 = 프론트매터판 **Anchor Safety**(렌더~쓰기 사이 외부 편집 방어).

## 엣지 케이스

| 케이스 | 처리 |
| --- | --- |
| 같은 분(`ts` 동일) 코멘트 2개 | ordinal 주소법으로 충돌 제거 |
| 렌더~쓰기 사이 외부 프론트매터 편집 | ordinal 위치 text 불일치 검증 → 중단 + Notice |
| 모달에 빈/공백 텍스트 입력 | Save 비활성 또는 무시 — 빈 프론트매터 코멘트 미생성 |
| 통합 카드의 마지막 코멘트 삭제 | 카드 제거(기존 `length===0` 경로) |
| 레거시 사이드카 파일 코멘트(있다면) | 기존 `filterVirtualHighlights` 경로로 계속 렌더, 버튼은 더 이상 생성 안 함. 편집/삭제 라운드트립은 보장 안 함(마이그레이션 도구 담당). |
| `comments`에 foreign 형상 항목 공존 | `parseFileLevelComments`/`mergeFileLevelComments`가 foreign 보존 — ordinal은 HiNote 형상 목록 기준이므로 안전 |

## 테스트 전략 (TDD)

- **순수/단위**:
  - ordinal 주소법 — verify 일치 시 정확한 index만 교체/삭제, 불일치 시 무변경 + 실패 반환.
  - `ts` 충돌 시나리오(동일 `ts` 2개) — 하나만 영향.
  - add 시 분 단위 `ts` 포맷 검증.
  - foreign 항목 보존 검증.
- **분기 로직**: `CommentService.update/deleteComment`가 `position===-1`에서 file-level writer로, 그 외에서 인라인 writer로 라우팅.
- **통합/수동**: 모달 입력 → 프론트매터 기록, 편집/삭제 라운드트립, 마지막 삭제 시 카드 제거, 빈 입력 무시.

## 변경 파일 인벤토리

| 파일 | 변경 |
| --- | --- |
| `src/components/comment/FileCommentModal.ts` (신규) | 모달 컴포넌트 |
| `src/views/highlight/virtual/VirtualHighlightManager.ts` | 버튼 핸들러 → 모달 오픈으로 교체, 사이드카 생성 제거 |
| `src/views/hinote/HiNoteViewSetup.ts` | `onAddFileComment` 콜백 배선 |
| `src/services/comment/CommentService.ts` | `addFileLevelComment` 신규, `update/deleteComment`에 `position===-1` 분기 |
| `src/services/comment/inline/InlineCommentWriter.ts` | ts 키 메서드 → ordinal 키 `*At` 메서드로 교체(+앵커 text 검증) |
| `src/services/highlight/HighlightExtractor.ts` | 통합 카드 생성 시 `fileCommentIndex` 부여 |
| `src/types/highlight.ts` | `CommentItem.fileCommentIndex?: number` 추가 |
| 렌더 계층(카드) | `position===-1` 통합 카드 라벨 표시 |
| `src/i18n/*` | "File comments" 라벨/모달 문자열 |

## 오픈 퀘스천

- 통합 카드 라벨의 정확한 문구·위치(헤더 vs 카드 텍스트)는 구현 시 렌더 코드를 보고 확정.
- add 시 `ts` 포맷 생성 방식(`formatTimestamp(...).slice(0,16)` vs 전용 포맷터)은 `parseTimestampToMs`가 받는 형식 재확인 후 확정.
