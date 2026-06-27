---
status: approved
date: 2026-06-27
topic: highlight-dashboard
origin: docs/superpowers/specs/2026-06-27-highlight-dashboard-design.md
intended_final_path: docs/plans/2026-06-27-001-feat-highlight-dashboard-plan.md
---

# feat: 하이라이트 통계 대시보드 (모달) — 구현 계획

**Origin (승인된 설계):** `docs/superpowers/specs/2026-06-27-highlight-dashboard-design.md`
**Branch:** `feat/highlight-dashboard`
**Depth:** Lightweight · **Posture:** 순수 집계 함수는 test-first(TDD)

---

## Context

하이라이트가 쌓일수록 "내 지식 베이스가 지금 어느 규모인지"를 한눈에 보고 싶은
요구가 있다. 명령으로 여는 **읽기 전용 모달**로, 볼트 전체 하이라이트를 집계해
**총계 카드 + 노트별 랭킹**을 보여준다. 무료 전용, 시계열·Pro·새 저장소 없음.

설계 단계에서 확인된 핵심 제약: 하이라이트에는 신뢰할 수 있는 "생성 시각"이 없어
(코멘트 타임스탬프는 최종 편집 시각) **시계열은 제외**하고 순수 집계만 다룬다.

---

## Scope

**In scope**
- 명령(`open-highlight-dashboard`)으로 여는 `Modal`
- 총계 카드 3종: 총 하이라이트 수 / 총 코멘트 수 / 하이라이트 포함 노트 수
- 노트별 랭킹: 하이라이트 Top 10 / 코멘트 Top 10 (행 클릭 → 노트 열기)
- 순수 집계 함수 `computeHighlightStats` + vitest 단위 테스트
- i18n 키 추가 (en/zh/ko)

**Out of scope (Deferred)**
- 활동/습관 시계열 (데이터 부재 — 별도 스펙)
- 유형·색상 분포, 코멘트 인사이트(AI vs 사람)
- Pro/플래시카드 연동, 대시보드 설정(Top N 조정 등)

---

## Key Technical Decisions

- **KTD1. 형태 = 명령으로 여는 Modal.** 메인 뷰(`HiNoteView`) 모드 처리가 플래그
  기반(`ViewState`)으로 얽혀 있어 모드 추가 대신 독립 `Modal`로 분리(변경 범위 최소).
  패턴: `src/utils/ConfirmModal.ts`(`Modal` 서브클래스, `onOpen`/`onClose`, `t()`).
- **KTD2. 데이터 소스 = `HighlightService.getAllHighlights()`** (`src/services/HighlightService.ts:59`
  → `HighlightExtractor.getAllHighlights`). 볼트 전체 마크다운을 직접 스캔하고
  **제외 패턴을 이미 존중**하며 `{ file, highlights }[]`(파일별 그룹)을 반환 →
  랭킹에 그대로 맞음. 인덱스 상태와 무관하게 자체 스캔이라 staleness 없음.
- **KTD3. 집계 로직은 Obsidian 비의존 순수 함수로 분리.** `HighlightInfo`는 순수
  인터페이스(`src/types/highlight.ts`)라 vitest 단위 테스트 가능. 모달은 얇게 유지.
- **KTD4. 계산 시점 = 모달 오픈 시 즉석(on-demand).** 실시간 갱신·새 저장소 없음.
  `onOpen`에서 로딩 표시 → `await getAllHighlights()` → 렌더.
- **KTD5. 카운트 기준(정확히):**
  - 총 하이라이트 = `!isVirtual && !isOrphan && text` 인 실제 하이라이트만.
  - 총 코멘트 = 실제 하이라이트 + 파일레벨 가상 항목의 `comments` 합 (**고아 제외**).
  - 포함 노트 수 = 실제 하이라이트 ≥ 1인 파일 수.
  - 랭킹 = 파일별 (하이라이트수 / 코멘트수) 내림차순 Top 10, 동점 시 `fileName` 오름차순.

---

## Implementation Units

### U1. 순수 집계 서비스 + 타입 + 테스트 (TDD)

**Goal:** 파일별 하이라이트 입력을 받아 통계 객체를 반환하는 순수 함수와 타입 정의.
**Requirements:** KTD3, KTD5.
**Dependencies:** 없음.
**Files:**
- `src/services/stats/HighlightStatsService.ts` (신규)
- `test/stats/HighlightStatsService.test.ts` (신규)
**Approach:**
- 타입: `StatsInputFile { filePath; fileName; highlights: HighlightInfo[] }`,
  `NoteRankEntry { filePath; fileName; count }`,
  `HighlightStats { totalHighlights; totalComments; notesWithHighlights; topByHighlights[]; topByComments[] }`.
- `computeHighlightStats(files: StatsInputFile[]): HighlightStats`. Top N 상수 `TOP_N = 10`.
- 실제 하이라이트 판별 헬퍼: `!isVirtual && !isOrphan && !!text`.
- 코멘트 합산: 실제 하이라이트 + 파일레벨 가상 항목(`isVirtual && !isOrphan`)의 `comments?.length`.
- 정렬: count desc, 동점 시 `fileName` asc; `slice(0, TOP_N)`.
**Patterns to follow:** `src/types/highlight.ts`의 `HighlightInfo`/`CommentItem` 타입 재사용.
기존 vitest 패턴 `test/highlight/HighlightExtractor.comments.test.ts`.
**Execution note:** 실패하는 테스트부터 작성(test-first).
**Test scenarios:**
- 빈 입력 → 모든 카운트 0, 빈 랭킹 배열.
- 단일 파일 N개 하이라이트 → totalHighlights=N, 포함 노트=1.
- 다중 파일 합산(하이라이트·코멘트 총합 정확).
- 가상(파일레벨, text 빈값) 항목은 총 하이라이트에서 **제외**되나, 그 `comments`는 총 코멘트에 **포함**.
- 고아(`isOrphan`) 항목은 하이라이트·코멘트 양쪽에서 **제외**.
- `comments` undefined인 하이라이트 방어(코멘트 0으로 계산).
- 랭킹 내림차순 + 동점 시 fileName 오름차순.
- 파일 11개 → 랭킹 정확히 10개로 절단.
**Verification:** `npm test`(vitest) 통과, 위 시나리오 전부 green.

### U2. i18n 키 추가 (en/zh/ko)

**Goal:** 대시보드 모달 UI 문자열을 세 로캘에 동일 키로 추가.
**Requirements:** 무료 전용 UI, 한국어 지원 유지.
**Dependencies:** 없음.
**Files:** `src/i18n/en.ts`, `src/i18n/zh.ts`, `src/i18n/ko.ts` (수정)
**Approach:**
- 키(값 예시): 모달 제목("Highlight dashboard"), "Total highlights", "Total comments",
  "Notes with highlights", "Top notes by highlights", "Top notes by comments",
  "No data to display", "Loading...". (`Loading...`는 기존 키 존재 — 재사용 가능.)
- 세 파일 모두 동일 키 집합 추가. `t()` 폴백은 `ko → zh → en`이라 누락 시 키 노출.
**Patterns to follow:** 기존 `src/i18n/*.ts` 키-값 구조, 주석 구획.
**Test scenarios:** `Test expectation: none -- 정적 문자열 추가(동작 변화 없음)`. tsc 타입 통과로 확인.
**Verification:** `npx tsc -noEmit -skipLibCheck` 통과, 세 파일 키 집합 일치.

### U3. 통계 모달 (HighlightStatsModal)

**Goal:** 서비스 결과를 렌더하는 얇은 `Modal`(로딩/결과/빈 상태).
**Requirements:** KTD1, KTD4, KTD5.
**Dependencies:** U1, U2.
**Files:** `src/views/stats/HighlightStatsModal.ts` (신규)
**Approach:**
- `ConfirmModal` 패턴 미러: `extends Modal`, `onOpen`/`onClose`, `this.titleEl.setText(t(...))`.
- `onOpen`: 로딩 표시 → `await plugin.highlightService.getAllHighlights()` →
  `{filePath: file.path, fileName: file.basename, highlights}`로 매핑 →
  `computeHighlightStats()` → 렌더.
- 렌더: 총계 카드 3종 + 랭킹 2섹션(Top 10). 랭킹 행 클릭 →
  `this.app.workspace.openLinkText(filePath, '')` 후 `this.close()`.
- 데이터 0 → 빈 상태 텍스트(`t("No data to display")`).
- 스타일은 기존 클래스/`styles.css` 관례 따름(필요 시 최소 클래스만).
**Patterns to follow:** `src/utils/ConfirmModal.ts`.
**Test scenarios:** `Test expectation: none -- 얇은 뷰(수동 검증)`. (집계 로직은 U1에서 커버.)
**Verification:** 수동 — 명령 실행 시 모달 표시, 수치/랭킹 정확, 행 클릭 시 노트 열림, 빈 볼트에서 빈 상태.

### U4. 명령 등록 (openStatsDashboard)

**Goal:** 안정적 id의 명령으로 모달을 연다.
**Requirements:** KTD1.
**Dependencies:** U3.
**Files:**
- `src/commands/openStatsDashboard.ts` (신규)
- `src/commands/index.ts` (수정 — `registerCommands` 내 등록 추가)
**Approach:**
- `registerOpenStatsDashboardCommand(plugin, ensureInitialized)`:
  `plugin.addCommand({ id: 'open-highlight-dashboard', name: 'Open highlight dashboard', callback })`.
  콜백: `await ensureInitialized(); new HighlightStatsModal(plugin).open();`
- 명령 모듈은 구체 플러그인 타입을 import해 `highlightService` 접근
  (예: `CommentInputManager`가 `CommentPlugin from '../../../../main'` import하는 패턴).
- `index.ts`의 `registerCommands`에서 호출 추가(기존 `ensureInitialized` 인자 재사용).
**Patterns to follow:** `src/commands/openCommentPanel.ts`, `src/commands/index.ts`.
**Test scenarios:** `Test expectation: none -- 명령 배선(수동 검증)`.
**Verification:** 명령 팔레트에 "Open highlight dashboard" 노출 → 실행 시 모달 오픈.

---

## End-to-End Verification

1. `npm test` — U1 단위 테스트 전부 통과.
2. `npx tsc -noEmit -skipLibCheck` — 타입 클린.
3. `npm run build` — 번들 성공.
4. 수동(Obsidian): 플러그인 로드 → 명령 팔레트 "Open highlight dashboard" 실행 →
   총계 카드 3종 + 랭킹 Top 10 표시 확인 → 랭킹 행 클릭 시 해당 노트 열림 →
   하이라이트 없는 볼트/노트에서 빈 상태 표시.
5. 로캘 전환(ko/zh/en)에서 라벨 정상 표시.

---

## Notes / Deferred

- `getAllHighlights()`는 자체 전체 스캔이라 인덱스 초기화 여부와 무관(KTD2). 대규모
  볼트에서 스캔이 길면 로딩 표시로 충분(실시간성 불필요).
- 향후: 시계열(이벤트 로깅 후), 유형·색상 분포, 코멘트 인사이트는 별도 스펙.
