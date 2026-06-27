---
status: approved
date: 2026-06-27
topic: highlight-dashboard
---

# 하이라이트 통계 대시보드 (모달) — 설계 스펙

## 1. 배경 / 동기

하이라이트가 쌓일수록 "내 지식 베이스가 지금 어느 규모인지"를 한눈에 보고 싶은
요구가 있다. 사용자가 원하는 핵심 가치는 두 가지로 좁혀졌다.

- **전체 현황 조감(overview)**: 볼트 전체 하이라이트·코멘트 규모를 한눈에 파악.
- 보조로 **어떤 노트에 집중되어 있는지**(노트별 랭킹) 확인.

명시적으로 **범위에서 제외**한 것:

- **활동/습관 시계열**: 데이터 부재로 제외(§2 참조).
- **Pro/플래시카드 데이터**: 이 플러그인은 단독 사용 목적이라 무료 전용으로 간주,
  플래시카드(`DailyStats`, FSRS) 데이터는 일절 참조하지 않음.
- 유형·색상 분포, 코멘트 인사이트(AI vs 사람 등): 이번 범위 제외(향후 확장 여지).

## 2. 데이터 가용성 진단 (시계열을 제외한 이유)

설계 전 데이터 모델을 확인한 결과, **신뢰할 수 있는 "생성 시각" 데이터가 없다.**

- `HighlightExtractor.processRegexMatches`(`src/services/highlight/HighlightExtractor.ts:119`)가
  추출하는 하이라이트 객체에는 `createdAt`이 **설정되지 않는다**(id·text·position·
  색상·컨텍스트만). 마크다운 본문에 타임스탬프가 없으므로 순수 `==하이라이트==`는
  생성 시각을 가질 수 없다.
- `createdAt`은 `HighlightMatcher.createMergedHighlight`(`src/services/highlight/HighlightMatcher.ts:162`)에서만
  `storedComment.createdAt`로 채워진다 → 코멘트/상호작용으로 저장된 하이라이트만 값을 가짐.
- 코멘트의 `createdAt`/`updatedAt`은 둘 다 `blockToCommentItem`(`HighlightExtractor.ts:405`)에서
  **동일한** 인라인 `^YYYY-MM-DD HH:mm^` 토큰으로 설정된다. README대로 이 토큰은
  **편집할 때마다 갱신**되므로 "생성"이 아니라 **최종 편집 시각**이다. 타임스탬프가
  없는 코멘트는 `Date.now()`(파싱 시점)로 떨어져 볼트를 열 때마다 "오늘"로 몰린다.

→ 무료 영역에는 정직한 시계열 근거가 없어, **시계열 차트는 이번 설계에서 제외**하고
순수 집계(조감)에 집중한다.

## 3. 설계 결정 (승인됨)

- **D1. 형태**: 명령으로 여는 **읽기 전용 모달**(`Modal`). 메인 뷰(`HiNoteView`)의
  모드 처리는 플래그 기반(`ViewState`의 `isFlashcardMode`/`isShowingFileList` 등)으로
  얽혀 있어, 모드를 추가하지 않고 독립 모달로 분리해 변경 범위를 최소화한다.
- **D2. 데이터 소스**: `HighlightService.getAllHighlights()`
  (`src/services/HighlightService.ts:59` → `HighlightExtractor.getAllHighlights`)를 재사용.
  볼트 전체 마크다운을 순회하고 **제외 패턴(`shouldProcessFile`)을 이미 존중**하며,
  `{ file: TFile, highlights: HighlightInfo[] }[]` 형태로 파일별 그룹을 반환 →
  노트별 랭킹에 그대로 맞는다. 내부 content 캐시로 재호출이 저렴하다.
- **D3. 계산 시점**: 모달을 열 때마다 즉석 계산(on-demand). 실시간 갱신·새 저장소 없음.
- **D4. 집계 로직 분리**: 집계는 **Obsidian 비의존 순수 함수**로 분리해 단위 테스트
  대상으로 삼는다(§6).
- **D5. 무료 전용**: `LicenseManager`/플래시카드 데이터를 참조하지 않는다.

## 4. 집계 정의 (정확한 카운트 기준)

`getAllHighlights()`는 일반 하이라이트 외에 **파일레벨 코멘트 가상 항목**(`isVirtual`,
text 빈값)과 **고아 코멘트**(`isOrphan`)를 함께 반환한다. 카운트 기준을 명확히 한다.

- **총 하이라이트 수(totalHighlights)** = `!isVirtual && !isOrphan && text` 인
  실제 하이라이트만 합산.
- **총 코멘트 수(totalComments)** = 실제 하이라이트 + 파일레벨 가상 항목의
  `comments` 길이 합. **고아 코멘트는 제외**(끊어진 블록이라 수치 부풀림 방지).
- **하이라이트 포함 노트 수(notesWithHighlights)** = 실제 하이라이트 ≥ 1인 파일 수.
- **노트별 랭킹**:
  - `topByHighlights`: 파일별 실제 하이라이트 수 내림차순 **Top 10**.
  - `topByComments`: 파일별 코멘트 수(위 정의) 내림차순 **Top 10**.
  - 각 항목: `{ filePath, fileName, count }`. Top N 상수(`10`)는 모듈 상수로 둔다.
  - 동점 시 안정적 보조 정렬: `fileName` 오름차순.

## 5. 컴포넌트 / 모듈 구조

단일 책임 기준으로 작은 모듈로 나눈다.

| 파일 | 책임 |
|------|------|
| `src/services/stats/HighlightStatsService.ts` | 순수 함수 `computeHighlightStats(input)` + `HighlightStats`·입력 타입. Obsidian 비의존 |
| `src/views/stats/HighlightStatsModal.ts` | `Modal` 서브클래스. 서비스 호출 → 렌더(로딩/결과/빈 상태). 얇게 유지 |
| `src/commands/openStatsDashboard.ts` | 명령 콜백. 모달 생성·오픈 |
| `src/commands/index.ts` (수정) | 명령 등록. 안정적 id `open-highlight-dashboard`, 이름 "Open highlight dashboard" |
| `src/i18n/{en,zh,ko}.ts` (수정) | 모달 UI 문자열 키 추가(세 로캘 모두) |

### 5.1 순수 함수 시그니처(안)

```ts
// 입력은 TFile 비의존 형태로 정규화하여 테스트 용이성 확보
interface StatsInputFile { filePath: string; fileName: string; highlights: HighlightInfo[]; }

interface NoteRankEntry { filePath: string; fileName: string; count: number; }

interface HighlightStats {
  totalHighlights: number;
  totalComments: number;
  notesWithHighlights: number;
  topByHighlights: NoteRankEntry[];
  topByComments: NoteRankEntry[];
}

function computeHighlightStats(files: StatsInputFile[]): HighlightStats;
```

모달에서 `getAllHighlights()`의 `{file, highlights}[]`를
`{ filePath: file.path, fileName: file.basename, highlights }`로 매핑해 주입한다.

## 6. 데이터 흐름

```
명령 실행 → HighlightStatsModal.onOpen()
  → 로딩 표시
  → await highlightService.getAllHighlights()        // 제외패턴 존중, 캐시됨
  → files = map({filePath, fileName, highlights})
  → stats = computeHighlightStats(files)              // 순수
  → 렌더: 총계 카드 3종 + 랭킹 2종(하이라이트/코멘트 Top 10)
  → 랭킹 행 클릭 → app.workspace.openLinkText(filePath, '') 후 모달 close
```

## 7. 에러 / 엣지 케이스

- **데이터 없음**(하이라이트 0) → "표시할 데이터가 없습니다" 빈 상태.
- **스캔 지연** → 모달 진입 시 로딩 표시 후 결과로 교체.
- **방어**: `comments` undefined, text 빈 항목, 파일명 중복, Top N 미만(파일 < 10).
- **모바일**: 순수 데이터 + 표준 `Modal`이라 데스크톱 전용 API 불필요
  (`isDesktopOnly` 영향 없음).

## 8. 테스트 (TDD)

`computeHighlightStats` 단위 테스트(vitest, 기존 `test/` 패턴):

- 빈 입력 → 모든 카운트 0, 빈 랭킹.
- 단일 파일 / 다중 파일 합산.
- 가상(파일레벨)·고아 항목 제외 검증(총 하이라이트), 코멘트 합산에 파일레벨 포함·고아 제외.
- 랭킹 내림차순 정렬 + 동점 보조 정렬(fileName).
- Top N 절단(파일 11개 → 10개).

모달·명령은 얇아 수동 검증(명령 실행 → 모달 표시 → 수치/랭킹/클릭 이동/빈 상태).

## 9. i18n 키 (신규, 세 로캘 동일 키)

모달 제목, "총 하이라이트", "총 코멘트", "하이라이트 있는 노트", "하이라이트 많은 노트",
"코멘트 많은 노트", "표시할 데이터가 없습니다", "불러오는 중..." 등. 정확한 키 목록은
구현 계획에서 확정한다. `t()` 분기는 `ko → zh → en` 폴백이라 누락 시 키 문자열 노출.

## 10. 범위 밖 / 향후

- 시계열(활동/습관) — 정직한 데이터 확보(이벤트 로깅 등) 후 별도 스펙.
- 유형·색상 분포, 코멘트 인사이트(AI vs 사람), Pro 연동.
- 대시보드 설정(Top N 조정 등) — 현재는 상수, YAGNI.
