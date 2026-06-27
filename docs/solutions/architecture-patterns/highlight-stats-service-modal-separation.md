---
title: "하이라이트 통계 — 순수 집계 함수와 Modal UI 분리 패턴"
date: 2026-06-27
category: architecture-patterns
module: highlight-stats
problem_type: architecture_pattern
component: service_object
severity: medium
applies_when:
  - "Vault 전체 하이라이트·코멘트 집계 기능을 추가할 때"
  - "Obsidian Modal에서 비동기 데이터 로드 + 집계 연산을 함께 처리할 때"
  - "플러그인 기능에 단위 테스트(vitest)를 도입하려 할 때"
  - "Virtual/Orphan HighlightInfo를 집계 대상에서 올바르게 분류해야 할 때"
tags:
  - stats
  - dashboard
  - modal
  - tdd
  - pure-function
  - service-layer
  - vitest
---

# 하이라이트 통계 — 순수 집계 함수와 Modal UI 분리 패턴

## Context

하이라이트 통계 대시보드(`open-highlight-dashboard` 커맨드)를 구현할 때, 집계 로직과 Obsidian Modal UI를 한 파일에 두는 방식은 두 가지 문제를 낳는다.

1. **테스트 불가**: Obsidian API(`Modal`, `App`, `Vault`)에 의존하면 vitest 단위 테스트를 작성할 수 없다. 목(Mock)을 만들거나 E2E에 의존해야 한다.
2. **책임 혼재**: 집계 알고리즘 변경과 UI 변경이 같은 파일에 혼재하여, 어느 변경이 어느 버그를 일으켰는지 추적하기 어렵다.

이 브랜치에서는 집계 로직을 `computeHighlightStats` 순수 함수로 분리하고, Modal은 UI 조립만 담당하게 하여 이 두 문제를 동시에 해결했다.

## Guidance

### 레이어 분리

세 파일로 관심사를 나눈다:

```
src/services/stats/HighlightStatsService.ts  ← 타입 정의 + 순수 집계 함수
src/views/stats/HighlightStatsModal.ts       ← Obsidian Modal UI
src/commands/openStatsDashboard.ts           ← 커맨드 등록 + 초기화 게이트
```

**HighlightStatsService** — Obsidian API 의존 없음:

```typescript
// 입력 타입: Obsidian TFile을 직접 받지 않고 직렬화된 구조를 받는다
export interface StatsInputFile {
    filePath: string;
    fileName: string;
    highlights: HighlightInfo[];
}

export interface NoteRankEntry {
    filePath: string;
    fileName: string;
    count: number;
}

export interface HighlightStats {
    totalHighlights: number;
    totalComments: number;
    notesWithHighlights: number;
    topByHighlights: NoteRankEntry[];
    topByComments: NoteRankEntry[];
}

// 순수 함수 — 입력만으로 결과가 결정된다
export function computeHighlightStats(files: StatsInputFile[]): HighlightStats { ... }
```

**HighlightStatsModal** — Obsidian API 의존, 집계 로직 없음:

```typescript
export class HighlightStatsModal extends Modal {
    async onOpen(): Promise<void> {
        // 1. 데이터 로드 (Obsidian API)
        const raw = await this.plugin.highlightService.getAllHighlights();
        // 2. StatsInputFile 변환 (어댑터)
        const files = raw.map(({ file, highlights }) => ({
            filePath: file.path,
            fileName: file.basename,
            highlights,
        }));
        // 3. 집계 위임 (순수 함수 호출)
        const stats = computeHighlightStats(files);
        // 4. UI 렌더링
        this.renderSummaryCards(contentEl, stats);
        ...
    }
}
```

### HighlightInfo 집계 분류 규칙

`HighlightInfo`에는 세 종류가 존재하며, 집계 대상이 다르다:

| 종류 | 조건 | 하이라이트 집계 | 코멘트 집계 |
|------|------|:-----------:|:-----------:|
| **실제 하이라이트** | `!isVirtual && !isOrphan && !!text` | ✓ | ✓ |
| **파일레벨 가상** | `isVirtual && !isOrphan` | ✗ | ✓ |
| **고아** | `isOrphan === true` | ✗ | ✗ |

파일레벨 코멘트(Virtual Highlight에 붙은 Comments)는 **총 코멘트 수에는 포함**되지만 **총 하이라이트 수에는 제외**된다. 이 구분이 `isFileLevelVirtual` 헬퍼로 명시화된다:

```typescript
function isRealHighlight(h: HighlightInfo): boolean {
    return !h.isVirtual && !h.isOrphan && !!h.text;
}

function isFileLevelVirtual(h: HighlightInfo): boolean {
    return !!h.isVirtual && !h.isOrphan;
}
```

### 랭킹 정책

- 상위 N개(기본값 10)로 절단
- `count > 0`인 항목만 포함 (0인 노트는 랭킹에 진입하지 않음)
- 동점 시 `fileName` 오름차순으로 결정론적 정렬 보장

```typescript
const sortRank = (a: NoteRankEntry, b: NoteRankEntry) =>
    b.count - a.count || a.fileName.localeCompare(b.fileName);

topByHighlights: highlightRank.filter(e => e.count > 0).sort(sortRank).slice(0, TOP_N),
```

### 커맨드 등록 — 초기화 게이트

커맨드 콜백에서 `ensureInitialized`를 먼저 실행해 플러그인이 준비되지 않은 상태에서 Modal이 열리는 것을 방지한다:

```typescript
callback: async () => {
    try {
        await ensureInitialized();
    } catch (err) {
        new Notice(t('Plugin initialization failed'));
        return;
    }
    new HighlightStatsModal(plugin).open();
},
```

### 방어 패턴 (코드 리뷰에서 추가됨)

**1. onOpen catch 블록** — 데이터 로드 실패 시 사용자에게 메시지 표시:

```typescript
try {
    stats = computeHighlightStats(files);
} catch (err) {
    contentEl.createEl('p', { text: t('Failed to load stats'), cls: 'hinote-stats-error' });
    console.error('[HiNote] Stats load failed', err);
    return;
} finally {
    loading.remove(); // 성공·실패 모두 로딩 표시 제거
}
```

**2. 파일 삭제 방어** — 랭킹 클릭 시 이미 삭제된 파일 처리:

```typescript
// getAbstractFileByPath 대신 getFileByPath 사용 (TFile | null 반환)
const file = this.app.vault.getFileByPath(entry.filePath);
if (file) {
    void this.app.workspace.getLeaf(false).openFile(file);
}
```

**3. Promise void 명시** — `openFile`이 Promise를 반환하지만 await하지 않을 때:

```typescript
void this.app.workspace.getLeaf(false).openFile(file);
// ❌ this.app.workspace.getLeaf(false).openFile(file); // 암묵적 무시
```

**4. 타입 재사용** — 인라인 타입 대신 `NoteRankEntry` 재사용:

```typescript
// ✓
private renderRankingSection(container: HTMLElement, title: string, entries: NoteRankEntry[]): void

// ✗
private renderRankingSection(container: HTMLElement, title: string, entries: { filePath: string; fileName: string; count: number }[]): void
```

### i18n 키 패턴

커맨드 이름도 `t()` 래핑:

```typescript
plugin.addCommand({
    id: 'open-highlight-dashboard',
    name: t('Open highlight dashboard'), // ✓ 하드코딩 금지
    callback: ...
});
```

## Why This Matters

**순수 함수 분리의 이점**:
- Obsidian 환경 없이 vitest에서 직접 단위 테스트 실행 가능
- 집계 알고리즘 버그를 UI 렌더링과 독립적으로 재현·수정 가능
- 같은 집계 로직을 다른 UI(사이드바, 상태바 등)에서 재사용 가능

**Virtual/Orphan 분류 명시화**:
- 집계 함수 내부에 암묵적으로 처리하면, 새 개발자가 왜 `totalHighlights ≠ highlights.length`인지 이해하기 어렵다. `isRealHighlight`, `isFileLevelVirtual` 헬퍼로 의도를 코드로 문서화한다.

## When to Apply

- 새 집계·통계 기능을 Obsidian Modal로 구현할 때
- 집계 함수가 5줄 이상이거나 복수의 필터 조건을 포함할 때
- vitest 테스트 커버리지를 집계 로직에 추가하고 싶을 때
- 기존 서비스(`highlightService`)의 반환값을 변환해야 할 때 (어댑터 레이어가 필요한 경우)

## Examples

### 테스트 구조 (9개 케이스)

순수 함수이므로 Obsidian mock 없이 테스트 작성:

```typescript
import { describe, it, expect } from 'vitest';
import { computeHighlightStats, StatsInputFile } from '../../src/services/stats/HighlightStatsService';

describe('computeHighlightStats', () => {
    it('빈 입력 → 모든 카운트 0, 빈 랭킹 배열', () => {
        const result = computeHighlightStats([]);
        expect(result.totalHighlights).toBe(0);
        expect(result.topByHighlights).toEqual([]);
    });

    it('파일레벨 가상 항목은 총 하이라이트에서 제외, 코멘트는 포함', () => {
        const virtualItem = makeHighlight({ text: '', isVirtual: true, isOrphan: false,
            comments: [{ id: '1', content: 'file comment', createdAt: 0, updatedAt: 0 }] });
        const realItem = makeHighlight({ text: 'real' });
        const result = computeHighlightStats([makeFile('note.md', 'note', [virtualItem, realItem])]);
        expect(result.totalHighlights).toBe(1); // 가상 제외
        expect(result.totalComments).toBe(1);   // 가상의 코멘트 포함
    });

    it('파일 11개 → 랭킹 정확히 10개로 절단', () => {
        const files = Array.from({ length: 11 }, (_, i) =>
            makeFile(`file${i}.md`, `file${i}`, [makeHighlight({ text: `h${i}` })]));
        const result = computeHighlightStats(files);
        expect(result.topByHighlights).toHaveLength(10);
    });
});
```

### CSS 클래스 네이밍 컨벤션

모든 통계 관련 CSS 클래스는 `hinote-stats-` 접두사 사용:

```css
.hinote-stats-grid { ... }
.hinote-stats-card { ... }
.hinote-stats-card-value { ... }
.hinote-stats-ranking { ... }
.hinote-stats-ranking-item { ... }
.hinote-stats-error { ... }
.hinote-stats-empty { ... }
```

## Related

- `docs/solutions/architecture-patterns/file-comment-frontmatter-storage-pattern.md` — 파일레벨 코멘트 CRUD 패턴 (Virtual Highlight의 저장 방식)
- `src/services/stats/HighlightStatsService.ts` — 집계 서비스 구현체
- `src/views/stats/HighlightStatsModal.ts` — Modal UI 구현체
- `test/stats/HighlightStatsService.test.ts` — vitest 단위 테스트 9개
