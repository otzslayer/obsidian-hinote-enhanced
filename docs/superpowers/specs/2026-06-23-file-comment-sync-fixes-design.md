# 파일 레벨 코멘트 동기화 수정 — 설계 스펙

- 날짜: 2026-06-23
- 브랜치: `feat/file-comment-frontmatter`
- 선행 기능 스펙: `2026-06-23-file-comment-frontmatter-storage-design.md`
- 상태: 승인됨 (브레인스토밍 → 설계 승인 완료, ce-plan 대상)

## 1. 배경

`feat/file-comment-frontmatter` 브랜치에서 파일 레벨 코멘트(프론트매터 `comments` 키, `{text, ts}` 형태)를 추가한 뒤 수동 테스트에서 버그 3건이 발견됐다. systematic-debugging으로 세 건의 근본 원인을 모두 규명했고(아래 §2), 사용자 런타임 증거로 초기 가설(인용부호/파서 문제)이 **반증**됐다. 본 스펙은 확정된 진단과 승인된 수정 설계를 기록한다.

## 2. 진단 (근본 원인)

### 이슈 1 — "Add file comment" 모달 UI 결함
- 증상: 코멘트 입력 textarea가 모달 대비 너무 작고, 불필요하게 resize 가능.
- 근본 원인: `styles.css`에 `.file-comment-modal-textarea` 규칙이 **아예 없음** → 브라우저 기본 textarea 크기(좁음) + 기본 `resize: both`.
- 상태: **이미 수정 완료** (`width:100%`, `min-height:120px`, `resize:none`, 기존 textarea 컨벤션 준수). 본 스펙엔 결과만 기록하며 ce-plan 대상 아님.

### 이슈 2 — 코멘트 추가 후 사이드바 미표시
- 증상: 추가 시 프론트매터엔 기록되나 사이드바에 안 보임. (사용자 관찰: **다른 노트로 갔다 오면 보임.**)
- 근본 원인: **metadataCache staleness**. `HiNoteViewSetup.onAddFileComment`이 낙관적 인메모리 카드를 그린 직후, `vault.on('modify')` 핸들러(`EventCoordinator` → `updateHighlights` → `loadFileHighlights` → `extractHighlights` → `extractFileLevelComments`)가 아직 재파싱되지 않은 `metadataCache`를 읽어 인메모리 모델을 덮어쓴다. 파일 전환/리로드 시 fresh 캐시로 다시 추출되어 표시됨.
- 반증된 가설: "프론트매터 `text`를 인용부호로 감싸면 해결" → 사실은 두 번째 'modify'가 캐시를 따라잡게 한 것(레드헤링). `parseFileLevelComments`의 타입 검사는 정상이며 **건드리지 않는다.**

### 이슈 3a — 수동 프론트매터 삭제가 사이드바에 미반영
- 증상: 프론트매터에서 `comments`를 지워도 카드가 남음. (사용자 관찰: **리로드하면 사라짐** → 일시적/transient.)
- 근본 원인: 이슈 2와 동일한 staleness. 수동 편집 후 `vault.on('modify')` 재추출이 stale 캐시를 읽어 카드 잔존. `metadataCache.on('changed')` 구독이 없어 fresh 갱신 트리거가 없음. 영구 저장소(data.json) 잔존이 **아님**(리로드 시 사라지므로).

### 이슈 3b — 카드 전체 삭제가 프론트매터에 미반영
- 증상: 사이드바 ⋯ 메뉴로 카드 전체를 삭제해도 프론트매터 코멘트가 안 지워짐. (사용자 관찰: **리로드 직후 깨끗한 상태에서도 재현**, 삭제 *실패* 토스트 없음.)
- 근본 원인: **staleness와 별개의 독립 버그.** `HighlightDeletionManager.deleteHighlight`에 파일 레벨(`position === -1`) 카드 처리가 없음. 본문 포맷 제거(`removeHighlightFromFile`, text=''·position=-1이라 본문엔 no-op) + repository 항목 제거(`removeHighlight`, virtual 카드는 repo에 없어 no-op)만 수행하고 **프론트매터 `comments`는 전혀 건드리지 않음.** 또한 "Highlight deleted successfully" 성공 토스트가 부정확하게 표시됨.
- 참고: 개별 코멘트 삭제(코멘트 더블클릭 → 편집창 삭제 버튼 → `deleteFileLevelCommentAt`)는 이미 정상 동작.

## 3. 설계 결정 (승인됨)

- **D1 (이슈 2 + 3a)**: 프론트매터를 파일 레벨 코멘트의 **단일 진실의 원천**으로 삼고, `metadataCache.on('changed')`를 **권위 있는 갱신 트리거**로 사용한다. 인라인 하이라이트는 본문에서 읽으므로 `vault.on('modify')`를 유지한다. 낙관적 인메모리 푸시는 제거해 단일 경로화한다. (트레이드오프: 추가 후 캐시 갱신 지연(수십~수백 ms)만큼 표시가 늦을 수 있음 — 사용자 수용함.)
- **D2 (이슈 3b)**: `position === -1`(파일 레벨 통합 카드) 전체 삭제 = 그 파일의 HiNote 파일 레벨 코멘트 **전부**를 프론트매터에서 제거(foreign 항목 보존). 개별 코멘트 삭제 경로는 그대로 유지하여 "전부 삭제"와 "하나씩 삭제"가 공존. 성공 시에만 정확한 토스트.

## 4. 아키텍처 / 컴포넌트 변경

### 4-1. 갱신 모델 (D1)
- `EventCoordinator`: `app.metadataCache.on('changed', (file) => …)` 구독 신설. 변경 파일이 현재 파일이고 메인뷰 드래그가 아닌 경우에만 갱신 콜백을 호출 → `HighlightListController.updateHighlights()`. `'changed'`는 캐시 재파싱 **후** 발화하므로 fresh 읽기 보장. 등록은 `component.registerEvent`로 unload 시 정리.
- `HiNoteViewSetup.onAddFileComment`: 낙관적 인메모리 푸시 블록(기존 L107–137) 제거. `commentService.addFileLevelComment` 성공 후 인메모리 조작/렌더 없이 `'changed'` 재추출에 위임. 실패 시 Notice는 유지.

### 4-2. 삭제 경로 (D2)
- `InlineCommentWriter`에 신규 메서드 `deleteAllFileLevelComments(file)`: `app.fileManager.processFrontMatter`로 `fm.comments = mergeFileLevelComments(existing, [])` (foreign 보존). `{success, reason}` 반환.
- `HighlightDeletionManager.deleteHighlight`: 메서드 진입부에 `highlight.position === -1` 분기 추가 → 본문(`removeHighlightFromFile`)/repo(`removeHighlight`) 제거 대신 `deleteAllFileLevelComments` 호출 후 early return. 성공 시에만 적절한 토스트("파일 코멘트 삭제됨" 류), 실패 시 실패 토스트. 플래시카드 동반 시 기존 flashcard 선삭제 로직(`handleDeleteHighlight`) 유지.
- 확인 모달: 파일 레벨 분기도 기존 `showConfirmModal` 확인 단계를 유지하되(파괴적 동작), 문구는 파일 코멘트 맥락에 맞게 조정 가능(필수 아님).

## 5. 데이터 흐름

- 추가: 버튼 → `showFileCommentModal` → `addFileLevelComment`(프론트매터 write) → `metadataCache 'changed'` → `updateHighlights` → `extractFileLevelComments`(fresh) → 카드 표시.
- 카드 삭제: ⋯ 메뉴 → `handleDeleteHighlight` →(position-1 분기)→ `deleteAllFileLevelComments`(프론트매터 write) → `'changed'` → `updateHighlights` → 카드 사라짐.
- 개별 삭제: 기존 `deleteFileLevelCommentAt` 경로 유지 + `'changed'`로도 정합.

## 6. 에러 처리
- `processFrontMatter` 실패 → `{success:false, reason}` → Notice 표시.
- `metadataCache.on('changed')` 핸들러는 현재 파일/뷰 가드로 불필요 갱신 방지. `component.registerEvent`로 등록해 누수 방지.

## 7. 테스트
- 단위(vitest): `InlineCommentWriter.deleteAllFileLevelComments` — foreign 항목 보존하며 HiNote 코멘트 전부 제거. (`mergeFileLevelComments`/`parseFileLevelComments` 기존 테스트 유지.)
- 런타임(수동, 프로젝트 관행): ① 추가 → 리로드 없이 표시, ② 수동 프론트매터 삭제 → 리로드 없이 반영, ③ 카드 삭제 → 프론트매터 반영 + 사이드바 정합.
- `parseFileLevelComments`/`isFileLevelComment`는 **변경 없음**(이슈 2는 파서 문제 아님 — 변경 시 타 플러그인의 `comments` 데이터 훼손 위험).

## 8. 범위 / 비범위
- 범위: 이슈 2, 3a, 3b 수정. (이슈 1은 이미 완료.)
- 비범위(YAGNI): `'modify'`/`'changed'` 디바운싱(성능 문제 관측 시에만), 파일 레벨 카드 per-comment vs all 삭제 UX 재설계, 플래시카드 저장(.hinote/flashcards/) 변경.

## 9. 영향 파일(예상)
- `styles.css` (이슈 1, 완료)
- `src/views/managers/EventCoordinator.ts` (구독 신설)
- `src/views/hinote/HiNoteViewEventBindings.ts` (콜백 배선)
- `src/views/hinote/HiNoteViewSetup.ts` (낙관적 푸시 제거)
- `src/services/comment/inline/InlineCommentWriter.ts` (`deleteAllFileLevelComments` 신설)
- `src/views/highlight/actions/HighlightDeletionManager.ts` (position-1 분기)
- `test/inline/InlineCommentWriter.test.ts` (신규 단위 테스트)
