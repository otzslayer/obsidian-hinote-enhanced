---
title: "Obsidian Sync 호환을 위한 인라인 CriticMarkup 코멘트 저장 패턴"
date: 2026-06-18
category: docs/solutions/architecture-patterns/
module: comment-storage
problem_type: architecture_pattern
component: documentation
severity: high
applies_when:
  - "Obsidian Sync 환경에서 사이드카 파일(.json)이 동기화되지 않는 경우"
  - "하이라이트 코멘트를 노트 본문과 함께 버전 관리하려는 경우"
  - "외부 저장소 없이 데이터를 노트 파일에 내재화해야 하는 경우"
tags:
  - obsidian-plugin
  - inline-storage
  - criticmarkup
  - migration
  - sync-compatibility
---

# Obsidian Sync 호환을 위한 인라인 CriticMarkup 코멘트 저장 패턴

## Context

Obsidian Sync는 `.md` 파일만 동기화하며, 사이드카 JSON 파일(`.hinote/highlights/*.json`)은 동기화 대상에서 제외된다. HiNote 플러그인은 기존에 하이라이트 댓글을 이 사이드카 파일에 저장했기 때문에, Obsidian Sync를 사용하는 환경에서는 다른 기기에서 댓글이 전혀 보이지 않는 치명적인 동기화 문제가 있었다.

SQLite, `.obsidian` 내부 스토리지, 보이는 폴더 스토리지, `data.json` 통합 등 여러 대안을 검토했으나 모두 동기화 보장 부재, vault 오염, 파일 크기/경쟁 조건 문제로 기각되었다. 결론은 **댓글을 마크다운 파일 본문에 직접 인라인으로 삽입**하는 방식으로의 전환이었다.

## Guidance

### 아키텍처 결정: CriticMarkup 인라인 저장

댓글은 CriticMarkup의 `{>>...<<}` 블록 형태로 마크다운 노트 본문에 직접 삽입된다. 파일 레벨(노트 전체) 댓글은 프론트매터의 `comments` 키로 저장한다.

#### 하이라이트 댓글 포맷

```
==highlighted text=={>>comment text ^YYYY-MM-DD HH:mm^<<}
```

- 타임스탬프는 `<<}` 직전에 end-anchored 형태(`^YYYY-MM-DD HH:mm^`)로만 인식
- 텍스트 중간에 `^`가 있어도 타임스탬프로 오인되지 않음
- AI 댓글에는 `🤖 ` 프리픽스 사용
- 대응 하이라이트가 없는 댓글은 `isOrphan: true`로 태깅되며 자동 삭제 금지

#### 파일 레벨 댓글 포맷 (프론트매터)

```yaml
---
comments:
  - text: "노트 전체에 걸친 댓글"
    ts: "2024-01-15 10:30"
---
```

HiNote는 `{text: string, ts: string}` 형태로만 자기 항목을 식별하며, 이질적인 형태의 `comments` 항목은 건드리지 않는다.

### 핵심 모듈 구조

```
src/services/comment/inline/
  InlineCommentParser.ts      # {>>...<<} 블록 파싱 (순수 함수)
  InlineCommentSerializer.ts  # 삽입/수정/삭제 + 앵커 안전성
  InlineCommentWriter.ts      # Obsidian vault 어댑터
  FrontmatterComments.ts      # 프론트매터 {text, ts} 형태 관리

src/migration/
  InlineMigration.ts          # 순수 변환 함수 (vitest 테스트)
  InlineMigrationRunner.ts    # Obsidian 어댑터 + dry-run Modal
```

### 앵커 안전성 — 쓰기 경로 (KTD3)

쓰기 시점에 재파싱을 수행해 `(하이라이트 텍스트 + ordinal + 현재 코멘트 텍스트)`를 검증한 후에만 패치를 적용한다. 불일치(파싱과 쓰기 사이 노트가 외부에서 변경됨) 시 쓰기를 중단하고 사용자에게 리포트한다 — 노트 손상 방지가 최우선.

```typescript
// InlineCommentWriter.ts — 쓰기 전 앵커 재검증
const noteText = await this.app.vault.read(file);
const match = this.toHighlightMatch(highlight);
const target = this.buildTarget(highlight, commentId);
const patched = updateComment(noteText, match, target, newContent, timestamp);

if (patched === noteText) {
  // 앵커 불일치 — 노트 무변형, 실패 반환
  return { success: false, reason: 'anchor mismatch: note was modified externally' };
}
await this.app.vault.modify(file, patched);
```

### 추출 파이프라인 통합

```typescript
// HighlightExtractor.ts
extractHighlights(content: string, file: TFile): HighlightInfo[] {
  // 1. 기존 하이라이트 마커 추출 (==text==, <mark>, <span>, 커스텀 regex)
  // 2. attachInlineComments(): {>>...<<} 파싱 → HighlightInfo.comments 첨부
  //    orphan 블록 → isOrphan: true 가상 하이라이트로 모델에 포함
  // 3. extractFileLevelComments(): frontmatter → 가상 하이라이트로 합류
}
```

`CommentService`의 `addComment / updateComment / deleteComment`는 이제 `HighlightManager.addHighlight`(사이드카) 대신 `InlineCommentWriter`를 호출한다.

### UI에서 인라인 마크업 숨기기

- **Live Preview**: `EditorHighlightDecorations`에서 `Decoration.replace({})` 로 `{>>...<<}` 범위를 숨김
- **Reading View**: `HighlightDecorator`의 PostProcessor에서 `display:none` span으로 교체
- **Source Mode**: 원형 `{>>...<<}` 그대로 노출 (불가피)

### 일회성 마이그레이션 (InlineMigrationRunner)

```
Command Palette → "Migrate comments to inline storage"
  1. .hinote/highlights/*.json 스캔
  2. dry-run 리포트 (migrated / ambiguous / not_found / already_inlined)
  3. 사용자 확인 → 배치 적용
  4. 기존 사이드카 데이터 보존 (자동 삭제 없음)
```

## Why This Matters

1. **Obsidian Sync 완전 호환**: 댓글이 `.md` 파일 안에 있으므로 Obsidian Sync, iCloud, Git 등 모든 파일 기반 동기화 수단이 자동으로 댓글을 포함한다.
2. **단일 진실 소스**: 하이라이트와 댓글이 동일한 파일에 공존하므로 파일-사이드카 불일치 문제가 구조적으로 사라진다.
3. **이식성**: `.hinote/` 폴더 없이도 노트 파일 하나만으로 댓글 데이터가 온전히 유지된다. 플러그인 삭제 후에도 댓글이 노트에 잔존한다.
4. **데이터 안전성**: 마이그레이션 시 기존 사이드카 데이터를 백업으로 보존(자동 삭제 없음)하며, 앵커 안전성 검증으로 노트 손상을 방지한다.
5. **코드 단순화**: 사이드카 조인(HighlightCommentResolver/Matcher/MatchStrategies)이 제거되어 "위치가 곧 연결"이 되어 추출 파이프라인이 단순해진다.

## When to Apply

다음 조건이 모두 해당될 때 이 패턴을 적용한다:

- **동기화 제약**: 사용하는 동기화 수단이 특정 파일 확장자(예: `.md`)만 지원하며, 메타데이터 파일(`.json`, `.db` 등)은 동기화에서 제외된다.
- **마크다운 호환성**: 저장할 데이터가 표준 또는 준표준 마크다운 구문(CriticMarkup 등)으로 인코딩 가능하다.
- **마크업 숨김 가능**: UI 레이어에서 원형 마크업을 숨길 수 있어 저장 형태가 일반 사용자에게 노출되지 않는다.
- **파일당 메타데이터 양이 적당함**: 수천 개의 댓글이 한 파일에 집중되지 않는 일반적인 노트 사용 패턴.

다음 경우에는 적용하지 않는다:

- 동기화 대상 파일 형식이 자유로운 경우(전용 DB나 JSON도 동기화됨)
- 저장할 메타데이터가 마크다운 구문으로 표현하기 어려운 복잡한 구조인 경우
- 마크다운 파일이 외부 도구로 처리되어 인라인 마크업이 오염으로 간주되는 경우
- Pro 기능처럼 동기화가 필요 없는 플래시카드 데이터 (`.hinote/flashcards/` 사이드카 유지 가능)

## Examples

### 변경 전 (사이드카 JSON — Obsidian Sync 불가)

```
.hinote/highlights/MyNote.json   ← Obsidian Sync 미지원
MyNote.md                        ← 댓글 없음
```

```json
{
  "highlights": [{
    "text": "highlighted text",
    "comments": [{"content": "comment text", "updatedAt": 1705314600000}]
  }]
}
```

### 변경 후 (인라인 CriticMarkup — Obsidian Sync 자동 포함)

```
MyNote.md   ← 하이라이트 + 댓글이 모두 이 파일 안에 존재
```

```markdown
---
comments:
  - text: "노트 전체에 대한 댓글"
    ts: "2024-01-15 10:30"
---

이것은 ==highlighted text=={>>comment text ^2024-01-15 10:30^<<}이 포함된 노트입니다.
```

### AI 댓글 예시

```markdown
==중요한 개념=={>>🤖 이 부분은 핵심 아키텍처 결정입니다 ^2024-01-15 14:22^<<}
```

### 마이그레이션 dry-run 리포트 예시

```
Notes to update: 15
Comments ready: 42
⚠ Ambiguous (will be skipped): 3
⚠ Not found (will be skipped): 1
✓ Already inlined (no action): 5

Old .hinote/highlights will NOT be deleted — preserved as backup.
```

## Related

없음 — 이 프로젝트의 첫 번째 학습 문서.
