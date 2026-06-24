---
title: "feat: 파일 코멘트 → 프론트매터 comments 전체 CRUD"
type: feat
date: 2026-06-23
origin: docs/superpowers/specs/2026-06-23-file-comment-frontmatter-storage-design.md
intended_final_path: docs/plans/2026-06-23-001-feat-file-comment-frontmatter-storage-plan.md
---

# feat: 파일 코멘트 → 프론트매터 `comments` 전체 CRUD (구현 계획)

- **원본 설계**: `docs/superpowers/specs/2026-06-23-file-comment-frontmatter-storage-design.md` (설계 승인됨)
- **브랜치**: `feat/file-comment-frontmatter`
- **유형**: 동작 변경 (behavior change)
- **깊이**: Standard (4 구현 단위, ~8 파일)
- **실행 자세**: 순수/계약 계층은 test-first (vitest 인프라·모킹 패턴 존재)

---

## Context (왜 이 변경인가)

HiNote Enhanced의 **File-level Comment**(CONCEPTS.md)는 노트 YAML 프론트매터의 `comments` 키(`{text, ts}` 배열)에 저장된다. 읽기/렌더·순수 변환·쓰기 서비스 인프라는 이미 존재하지만, **"Add file comment" 버튼만 옛 경로에 묶여** 있다 — 버튼은 여전히 사이드카(가상 하이라이트) 저장소(`HighlightManager.addHighlight`)에 기록한다.

최근 `feat/inline-comment-storage`(인라인 `{>>...<<}` 전환) 이후 `CommentService.add/update/deleteComment`가 **무조건 인라인 writer로 라우팅**한다(검증됨: `CommentService.ts:109/159/188`에 분기 없음). 그 결과 프론트매터 통합 카드(`position:-1`)의 코멘트는 편집/삭제가 사실상 불가능하다 — `InlineCommentWriter.toHighlightMatch()`(`InlineCommentWriter.ts:131`)가 `start = position ?? 0 = -1`로 쓰레기 오프셋을 만들기 때문.

**목표**: "Add file comment" 버튼과 통합 카드의 추가·편집·삭제가 모두 노트 프론트매터 `comments` 배열로 라운드트립한다. 사이드카는 더 이상 신규 파일 코멘트를 만들지 않는다. (반쯤 깔린 전환의 완성)

---

## 핵심 기술 결정 (KTD)

### KTD1 — `ts`가 아니라 **ordinal(순번) 주소법**
편집/삭제의 식별 키로 `ts`(분 단위 `"YYYY-MM-DD HH:mm"`)가 아니라 **`parseFileLevelComments(fm)` 목록에서의 index**를 쓴다. `ts`는 분 단위라 같은 분에 만든 두 코멘트가 충돌하여 `c.ts===x` 기반 update/delete가 **둘 다** 건드린다. ts 키 메서드는 **외부 호출자가 0개**(codegraph 검증)라 시그니처 교체 비용이 없다. 읽기(extractor)와 쓰기(writer)가 동일하게 `parseFileLevelComments(fm)`(원래 순서) 기준으로 index를 계산하므로 안정적이다.

### KTD2 — 통합 카드에 **안정적 합성 `id` 부여**로 기존 새로고침 경로 재사용 (설계 대비 단순화)
설계는 편집/삭제 후 새로고침을 막연히 "기존 흐름 재사용"으로 뒀으나, 코드 검증 결과 **통합 카드(`position:-1`)는 `id`가 없어**(`HighlightExtractor.ts:91-101`가 `id`를 안 넣음) 기존 `CommentService`의 `onCardUpdate`/`onCardRemove`(둘 다 `findByHighlightId(highlight.id || '')`로 카드 조회)가 **no-op**이 된다. 또한 디스크 재추출형 새로고침(`onRefreshView` → `HighlightListController.updateHighlights()`)은 `processFrontMatter` resolve 시점에 metadataCache가 아직 갱신 전이라 **stale 프론트매터**를 읽는다(첫 추가 시 `[]` 반환 → 카드 소멸).

**해법**: extractor가 통합 카드에 **파일 경로 기반 결정적 id**(`IdGenerator.generateHighlightId(file.path, -1, '')` — 해시 기반, 파일별 안정적)를 부여한다. 그러면 **인라인 경로가 이미 쓰는 그 패턴**(`CommentService.updateComment:166-178` / `deleteComment:194-219`: write → 인메모리 변경 → `onCardUpdate`/`onCardRemove`)이 통합 카드에도 그대로 작동한다.
- `onCardUpdate(highlight)` → `updateCard` → `HighlightCard.updateComments(highlight)`가 인메모리 highlight에서 댓글만 재렌더 (`HighlightCard.ts:293`).
- `onCardRemove(highlight)` → `removeCard`가 id로 state 필터 + DOM 제거.

**근거 (영속화 누수 없음 검증)**: 사이드카 저장은 `HighlightManager.addHighlight`(`HighlightManager.ts:30`) **명시 호출로만** 발생하고 extractor 카드는 이를 거치지 않는다. 플래시카드 마커는 별도 `Set<string>`(`getFlashcardMarkers`)이라 id 보유만으로 연관되지 않는다. 레거시 사이드카 파일 코멘트(`position:0`)도 이미 `isVirtual:true`+id 카드로 같은 렌더 파이프라인을 통과한다. → 합성 id는 안전하며, **별도 새로고침 채널을 배선할 필요가 없다**.

### KTD3 — 프론트매터판 **Anchor Safety** (앵커 text 검증)
ordinal 위치 쓰기 직전, writer가 `processFrontMatter` 콜백 안에서 `parseFileLevelComments(fm)`를 재계산하고 `parsed[index]?.text !== expectedText`면 **중단**(클로저 플래그 → `{success:false}` 반환, 호출부 Notice). 렌더~쓰기 사이의 외부 프론트매터 편집 방어. 인라인 writer의 anchor 패턴과 동형.

### KTD4 — add 시 **분 단위 `ts`**
`formatTimestamp(Date.now()).slice(0, 16)` → `"YYYY-MM-DD HH:mm"`. 검증됨: `parseTimestampToMs`(`HighlightExtractor.ts:391`)가 분 단위 문자열을 정규식으로 감지해 `:00`을 자동 부착하므로 라운드트립 안전 (설계 오픈 퀘스천 2 해소).

---

## 구현 단위

### U1. Writer — ordinal 키 `*At` 메서드 + 앵커 검증
**Goal**: 미사용 `ts` 키 file-level 메서드를 ordinal 주소·`WriteResult` 반환 메서드로 교체.

**Files**: `src/services/comment/inline/InlineCommentWriter.ts`, `test/inline/InlineCommentWriter.fileLevel.test.ts` (신규)

**Dependencies**: 없음 (외부 호출자 0개 — 자유롭게 교체)

**Approach**:
- `addFileLevelComment(file, comment): Promise<WriteResult>` — 반환 타입을 `void`→`WriteResult`로 변경(append 로직은 유지, `{success:true}` 반환). add는 무조건 — 앵커 불필요.
- `updateFileLevelComment(file, oldTs, newComment)` → **`updateFileLevelCommentAt(file, index, expectedText, newComment): Promise<WriteResult>`** 로 교체.
- `deleteFileLevelComment(file, ts)` → **`deleteFileLevelCommentAt(file, index, expectedText): Promise<WriteResult>`** 로 교체.
- 앵커 패턴: `processFrontMatter` 콜백 안에서 클로저 `ok=false`; `parseFileLevelComments(fm)` 재계산; `parsed[index]?.text !== expectedText`면 무변경 return; 일치하면 해당 index만 교체(update)/제거(delete) 후 `mergeFileLevelComments(existing, updated)`로 되쓰기, `ok=true`. 반환 `{success: ok, reason: ok ? undefined : 'anchor mismatch'}`.
- `WriteResult`는 기존 `InlineCommentWriter.ts:20-23` 재사용.

**Patterns to follow**: 같은 파일의 인라인 `updateComment`/`deleteComment`의 anchor + `WriteResult` 패턴.

**Test scenarios** (신규 테스트는 `fm.comments`를 시드하고 변형 결과를 되읽는 모킹 필요 — 기존 `InlineCommentWriter.test.ts:18-23`의 빈-fm 모킹으로는 불충분):
- add: 빈 프론트매터에 append → `{success:true}`, `fm.comments` 1개.
- add: foreign 항목 보존 + HiNote 항목 뒤에 append (순서 `[foreign, ...hinote]`).
- updateAt: expectedText 일치 시 해당 index만 text/ts 교체, 다른 index 불변, `{success:true}`.
- updateAt: expectedText **불일치** 시 `fm.comments` 불변 + `{success:false}` (외부 편집 가드).
- updateAt: index out-of-bounds(`parsed[index]` undefined) → `{success:false}`.
- deleteAt: 일치 시 해당 index 제거, `{success:true}`.
- deleteAt: 불일치 시 불변 + `{success:false}`.
- deleteAt: 유일 HiNote 항목 삭제 시 foreign 보존(`['foreign']`).

**Verification**: `npm run test` 신규 파일 그린.

---

### U2. 읽기/렌더 — durable key·id·라벨
**Goal**: 통합 카드를 **주소 가능**(ordinal index + 안정적 id)하고 **인식 가능**(라벨)하게 만든다. 편집/삭제 배선 전에도 카드가 정상 렌더된다.

**Files**: `src/types/highlight.ts`, `src/services/highlight/HighlightExtractor.ts`, `src/components/highlight/HighlightContent.ts`, `src/i18n/en.ts`, `src/i18n/zh.ts`, `test/highlight/HighlightExtractor.fileLevel.test.ts` (신규 또는 기존 `HighlightExtractor.comments.test.ts` 확장)

**Dependencies**: 없음 (순수, U1과 병렬 가능)

**Approach**:
- `CommentItem`(`types/highlight.ts:1-6`)에 옵셔널 `fileCommentIndex?: number` 추가 (인라인 코멘트는 미설정 → 영향 없음).
- `HighlightExtractor.ts:88-102` 통합 카드 생성부:
  - 카드에 **결정적 id** 부여: `id: IdGenerator.generateHighlightId(file.path, -1, '')` (KTD2).
  - 글로벌 뷰 견고성 하드닝: `filePath: file.path` (+ `fileName: file.basename`) 부여 — `getFileForHighlight`(`CommentService.ts:258`)가 `currentFile` 없을 때 `filePath`로 해석하므로 전체-하이라이트 뷰에서도 편집/삭제가 동작. **콜아웃 참조**.
  - `comments` 매핑을 `.map((c, i) => ({..., fileCommentIndex: i}))`로 — 각 `CommentItem`에 index 부여 (순서는 `parseFileLevelComments` 원래 순서와 1:1).
- `text:''`는 유지(인라인/dedup 로직 불간섭). 통합 카드 라벨은 **렌더 계층**에서 `highlight.position === -1` 분기로 표시 — `HighlightContent.renderText`(`HighlightContent.ts`)에서 `position===-1`일 때 `t("File comments")` 라벨 렌더.
- i18n: `en.ts`/`zh.ts`에 `"File comments"` 키 추가.

**Patterns to follow**: `HighlightExtractor.ts:91-101` 기존 매핑; `IdGenerator.generateHighlightId`(`HighlightManager.ts:32` 사용례).

**Test scenarios**:
- 프론트매터 코멘트 1개 → `position:-1, isVirtual:true` 카드, `comments[0].fileCommentIndex===0`, `content===text`.
- 3개 → index 0,1,2 (parse 순서).
- 카드 `id`가 같은 파일에 대해 재추출 시 **동일**(결정적), `filePath===file.path`.
- file-level 코멘트 없음 → `position:-1` 카드 미생성 (기존 가드 유지).
- 인라인 코멘트(회귀) → `CommentItem.fileCommentIndex===undefined`.
- (라벨) `position===-1` 카드 렌더 시 "File comments" 라벨 노출 — 경량 렌더 단언 또는 수동.

**Verification**: extractor 테스트 그린 + 라벨 수동 확인.

---

### U3. 편집/삭제 — `CommentService` file-level 분기 + add 서비스
**Goal**: `update/deleteComment` 최상단에서 `position === -1` 분기 → ordinal writer로 라운드트립. add용 서비스 메서드 신설.

**Files**: `src/services/comment/CommentService.ts`, `test/comment/CommentService.fileLevel.test.ts` (신규)

**Dependencies**: U1(writer `*At`), U2(`fileCommentIndex`·id)

**Approach** (인라인 경로와 **동형**으로 자기완결 분기, 인라인 writer·인라인 이벤트는 우회):
- `updateComment`(`:135`): 기존 `comment` 탐색 + 내용 동일 no-op 가드(`:146`) 이후, `highlight.position === -1`이면 — `index = comment.fileCommentIndex`, `expectedText = comment.content`(OLD), `ts = formatTimestamp(now).slice(0,16)`; `inlineWriter.updateFileLevelCommentAt(file, index, expectedText, {text: content, ts})`; `!success`면 Notice + return; 성공 시 인메모리(`comment.content/updatedAt`, `highlight.updatedAt`) 갱신 후 `onCardUpdate?.(highlight)` (없으면 `onRefreshView`) + return. **인라인 `emitCommentUpdate`는 호출 안 함**(본문 앵커 없음).
- `deleteComment`(`:184`): 최상단에서 `highlight.position === -1`이면 — `comment` 탐색 → `inlineWriter.deleteFileLevelCommentAt(file, comment.fileCommentIndex, comment.content)`; `!success`면 Notice + return; 성공 시 `highlight.comments` 필터 + 남은 코멘트 `fileCommentIndex` **재계산**(`forEach((c,i)=>c.fileCommentIndex=i)`); `length===0`이면 기존 카드 제거 경로(`:203-209` id-OR-(position+text) 필터 + `onHighlightsUpdate`) 재사용 후 `onCardRemove(highlight)`, 아니면 `onCardUpdate(highlight)`. 파일 코멘트 카드는 플래시카드 연관이 없으므로 `checkHasFlashcard` 생략하고 항상 제거.
- 신규 `addFileLevelComment(file, text): Promise<WriteResult>`: `ts = formatTimestamp(Date.now()).slice(0,16)` → `inlineWriter.addFileLevelComment(file, {text, ts})` → 결과 반환 (인메모리·렌더는 호출부 U4가 담당).

**Patterns to follow**: 같은 파일 인라인 `updateComment:166-178` / `deleteComment:194-219`의 인메모리 변경 + `onCardUpdate`/`onCardRemove` 흐름.

**Test scenarios** (inlineWriter 메서드는 `vi.fn` 모킹, `updateState({currentFile})`로 `getFileForHighlight` 충족):
- update@-1: `updateFileLevelCommentAt`에 `comment.fileCommentIndex`와 OLD content(expectedText) 전달.
- update@-1 성공: 인메모리 content 갱신 + `onCardUpdate` 발화, `inlineWriter.updateComment` **미호출**.
- update@-1 실패(`{success:false}`): Notice + 인메모리 불변.
- update@-1 `ts`가 `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/`(16자, 초 없음).
- delete@-1: `deleteFileLevelCommentAt`에 index+expectedText 전달.
- delete@-1 재인덱싱: 3개(0,1,2) 중 index 1 삭제 → 남은 둘 0,1.
- delete@-1 마지막 삭제: `state.highlights`에서 카드 제거 + `onCardRemove`.
- delete@-1 실패: Notice + 모델 유지.
- 회귀: `position:5`는 `inlineWriter.updateComment/deleteComment`로 라우팅(`*At` 미호출).
- addFileLevelComment: 분 단위 ts 생성 + `inlineWriter.addFileLevelComment({text, ts})` 호출, writer 결과 그대로 반환.

**Verification**: `CommentService.fileLevel.test.ts` 그린.

---

### U4. 추가 경로 — 모달 + 버튼 리와이어 + 배선
**Goal**: 버튼 클릭 → 모달 → 프론트매터 기록 → 인메모리 카드 합성/append → 렌더.

**Files**: `src/components/comment/FileCommentModal.ts` (신규), `src/views/highlight/virtual/VirtualHighlightManager.ts`, `src/views/hinote/HiNoteViewSetup.ts`, `src/i18n/en.ts`, `src/i18n/zh.ts`

**Dependencies**: U1(writer add `WriteResult`), U2(id·`fileCommentIndex`), U3(`addFileLevelComment`)

**Approach**:
- **모달**: `ConfirmModal.ts` 패턴(`extends Modal`, `onOpen`/`onClose`, `.modal-button-container`) 미러. textarea(autofocus) + Cancel/Save. `showFileCommentModal(app): Promise<string | null>` — 트림 후 비어있지 않으면 텍스트, 아니면 `null`(빈 입력 → 프론트매터 미생성). i18n 키 `"Save"`/`"Cancel"`(기존) + 제목 `"Add file comment"`(기존 `"Add File Comment"` 활용) + placeholder 키 신규.
- **VirtualHighlightManager.handleAddFileComment**(`:53-102`): 사이드카 가상 하이라이트 생성(`:72-86`) + `onVirtualHighlightCreated`/100ms 자동 입력창/스크롤(`:91-101`) **제거**. 대신 `getCurrentFile()` 가드(없으면 기존 Notice) → 모달 오픈 → 텍스트 있으면 새 콜백 `onAddFileComment(file, text)` 호출. 콜백 타입에 `onAddFileComment` 추가, 사용처 사라진 콜백(`onVirtualHighlightCreated`/`onShowCommentInput` 등)은 **편집 전 전체 콜백 타입을 codegraph로 확인 후** 정리(`getHighlights` 등 다른 사용처가 있으면 보존).
- **HiNoteViewSetup**(`:92-104`): `createFileCommentButton` 콜백 객체에 `onAddFileComment: async (file, text) => {...}` 추가. 내부: `const r = await commentService.addFileLevelComment(file, text); if(!r.success){Notice; return;}` → **합성-또는-append**:
  - `state.highlights`에서 `position===-1` 카드 탐색(또는 동일 id). 있으면 새 `CommentItem`(`fileCommentIndex = card.comments.length`, content=text, createdAt/updatedAt=now) push.
  - 없으면(첫 추가 비대칭) extractor 형상 미러로 카드 합성(`{id: generateHighlightId(file.path,-1,''), text:'', position:-1, isVirtual:true, filePath:file.path, comments:[{id:generateCommentId(), content:text, createdAt:now, updatedAt:now, fileCommentIndex:0}]}`) 후 `unshift`.
  - `highlightListController.renderHighlights(state.highlights)` (기존 `:97-100` unshift+render 패턴). **두 번째 추가 시 두 번째 카드 생성 금지**(dedup).

**Patterns to follow**: `ConfirmModal.ts`; `HiNoteViewSetup.ts:92-104`의 기존 콜백 객체·`renderHighlights` 패턴.

**Test scenarios**:
- (합성/append 순수 헬퍼로 추출 시) 첫 추가: `position:-1` 카드 합성 + `fileCommentIndex:0`; 둘째 추가: 기존 카드 append + `fileCommentIndex:1`; 중복 카드 미생성.
- 모달(DOM 경량/수동): Save→트림 텍스트, Cancel→null, 빈 입력→null.

**Verification**: 수동 — 빈 파일에서 버튼 클릭 → 모달 → Save → 프론트매터 `comments`에 `{text, ts}` 기록 + 카드 등장.

---

## 시퀀싱

`U1(writer) + U2(타입/extractor/라벨)` 병렬(순수·계약 계층, test-first) → `U3(서비스 분기)` → `U4(추가 UI)`. U3은 U1·U2 계약에 의존, U4는 U1·U2·U3에 의존. "순수 → 서비스 → UI" 자세. 각 단위는 독립 커밋·테스트 가능.

---

## 범위 밖 / 콜아웃

- **레거시 사이드카(`position:0`) 파일 코멘트 마이그레이션 — 제외**. 별도 `InlineMigrationRunner` 담당, 사용자가 명시 제외. 본 작업 후 신규 `position:0` 파일 코멘트는 더 이상 생성되지 않으나, 기존 사이드카 데이터의 코멘트는 편집/삭제 라운드트립이 보장되지 않는다(`position===-1`이 아니므로 인라인 writer로 라우팅됨). 마이그레이션이 필요하면 별도 단위.
- **글로벌 뷰 `filePath` 하드닝 (U2에 포함, 권고)**: extractor 카드에 `filePath` 부여로 전체-하이라이트 뷰에서도 편집/삭제가 동작하게 한다. 단일 파일 뷰로만 제한하고 싶으면 이 한 줄을 빼면 된다 — 다만 통합 카드가 글로벌 뷰에 노출되는 경우 편집이 무음 실패하므로 부여를 권장.
- **마이그레이션의 UTC vs 로컬 `ts` 불일치 / 일반 하이라이트 인라인 경로 — 불변**.

---

## 리스크

| 리스크 | 처리 |
| --- | --- |
| writer 반환 타입 `void`→`WriteResult` | 외부 호출자 0개(codegraph 검증) + `*At` 리네임으로 stale 호출 컴파일 차단. 신규 호출부(U3/U4)만 `result.success` 소비 |
| ordinal 안정성·metadataCache 타이밍 | **즉시 디스크 재추출 안 함**. 인메모리 변경 + `onCardUpdate`/`renderHighlights`(메모리 렌더). 렌더~쓰기 레이스는 KTD3 앵커로 방어. 인라인 경로와 동일 전략 |
| 첫 추가 비대칭(카드 없음) | U4 합성-또는-append로 흡수, dedup |
| anchor (index, text) — 동일 text 2개 + 외부 reorder | 잔여 엣지(ts 분 단위보다 우수). 수용, 문서화 |
| 테스트 모킹 | U1은 `fm.comments` 시드 + 되읽기 모킹 필요(기존 빈-fm 모킹 불충분) |

---

## E2E 검증

1. `npm run test` — U1/U2/U3 신규·확장 테스트 그린.
2. 빌드: `npm run build` (타입 클린).
3. 수동(Obsidian, 플러그인 폴더에 `main.js`/`manifest.json` 복사 후 리로드):
   - 빈 노트 → 사이드바 우상단 버튼 → 모달 Save → 프론트매터 `comments`에 `{text, ts}` 1개 + 통합 카드 "File comments" 라벨 등장.
   - 같은 분에 2개 추가 → 한 코멘트만 편집해도 다른 것 불변(ordinal 충돌 면역).
   - 코멘트 편집 → 프론트매터 라운드트립(텍스트 변경, ts 보존은 선택). 삭제 → 해당 항목만 제거. 마지막 삭제 → 카드 제거.
   - 빈/공백 입력 → 프론트매터 미생성.
   - 외부 편집(다른 인덱스 텍스트 변경) 후 편집 시도 → anchor 불일치 Notice, 무변경.

---

## 다음 단계 (워크플로)

`/clear` → **Phase 2' Build (Sonnet·high)** 에서 `/ce-work docs/plans/2026-06-23-001-feat-file-comment-frontmatter-storage-plan.md`로 test-first 실행.
