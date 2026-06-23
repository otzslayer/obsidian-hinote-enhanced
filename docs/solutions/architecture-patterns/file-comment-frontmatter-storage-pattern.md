---
title: "파일 레벨 코멘트 — 프론트매터 기반 CRUD 패턴"
date: 2026-06-23
category: architecture-patterns
module: comment-storage
problem_type: architecture_pattern
component: service_object
severity: high
applies_when:
  - "파일 레벨(position === -1) 코멘트를 추가·수정·삭제할 때"
  - "본문에 앵커를 박기 어려운 메타데이터를 저장할 때"
  - "vault.read + vault.modify 대신 원자적 frontmatter 쓰기가 필요할 때"
  - "동일 frontmatter 키를 외부 플러그인과 공유할 가능성이 있을 때"
  - "Modal → async 흐름에서 여러 닫힘 경로가 존재할 때"
tags:
  - frontmatter
  - file-comment
  - ordinal-addressing
  - anchor-verification
  - process-frontmatter
  - comment-routing
  - atomic-write
  - settle-pattern
---

# 파일 레벨 코멘트 — 프론트매터 기반 CRUD 패턴

## Context

인라인 코멘트(`{>>텍스트<<}`)는 하이라이트된 문장에 물리적으로 붙어 있어 위치(`position >= 0`)로 주소를 지정한다. 그러나 **파일 전체에 대한 코멘트**(특정 구절이 아닌 노트 자체에 달리는 메모)는 본문 어디에도 앵커를 박을 수 없다.

두 가지 실패 경로를 검토했다:

1. **본문에 마커 삽입**: 사용자 본문을 오염시키고, 줄바꿈·포맷 충돌, 외부 편집 시 마커 소실 위험.
2. **vault.read + vault.modify**: 읽기와 쓰기 사이에 외부 편집이 끼어들면 좌표 불일치(coordinate desync) 발생. 이미 문서화된 알려진 버그 패턴 (→ `comment-insert-position-coordinate-desync.md`).

채택한 해결책: **YAML frontmatter를 파일 레벨 코멘트의 전용 저장소로 사용**하고, Obsidian의 `processFrontMatter` API(원자적 콜백)로 쓰기 경쟁을 구조적으로 차단.

저장 형식과 마이그레이션 결정의 배경은 `inline-comment-storage-migration-pattern.md`에 기록되어 있다. 이 문서는 그 위에 올라가는 **CRUD 레이어** — ordinal 주소, 앵커 검증, 원자적 쓰기, 모달 패턴 — 을 다룬다.

---

## Guidance

### 1. 이중 저장소 라우팅 — `position === -1` 분기

`CommentService`는 `highlight.position`으로 저장 경로를 결정한다:

```typescript
// CommentService.ts — updateComment / deleteComment 내부
if (highlight.position === -1) {
    // 프론트매터 경로 (ordinal 주소)
    const index = comment.fileCommentIndex;
    if (index === undefined) return;
    const result = await this.inlineWriter.updateFileLevelCommentAt(
        file, index, comment.content, { text: content, ts: timestamp.slice(0, 16) }
    );
    // ... 결과 처리 후 early return
    return;
}
// 이 아래는 인라인 경로 (position >= 0)
```

`position === -1`은 "파일 전체"를 뜻하는 sentinel 값이다. 분기 후 즉시 `return`하므로 두 경로가 절대 교차하지 않는다.

---

### 2. `processFrontMatter` — 원자적 쓰기로 race 제거

```typescript
// InlineCommentWriter.ts
async addFileLevelComment(file: TFile, comment: FileLevelComment): Promise<WriteResult> {
    try {
        await this.app.fileManager.processFrontMatter(file, (fm) => {
            const existing = Array.isArray(fm.comments) ? fm.comments : [];
            const current = parseFileLevelComments(fm);
            fm.comments = mergeFileLevelComments(existing, [...current, comment]);
        });
        return { success: true };
    } catch (e) {
        return { success: false, reason: e instanceof Error ? e.message : 'write failed' };
    }
}
```

`processFrontMatter`는 Obsidian이 파일을 잠근 상태에서 콜백을 실행하고 결과를 기록한다. **단일 콜백 안에서 읽기-수정-쓰기가 완결**되므로 외부 편집과의 경쟁 조건이 구조적으로 불가능하다. `vault.read` → 처리 → `vault.modify`의 3단계 비원자 흐름을 절대 사용하지 않는다.

---

### 3. Ordinal 주소 지정 — `fileCommentIndex`

텍스트 탐색 대신 **배열 인덱스로 코멘트를 주소 지정**한다. O(1) 조회이고 본문 텍스트 편집에 영향받지 않는다.

```typescript
// InlineCommentWriter.ts — updateFileLevelCommentAt
async updateFileLevelCommentAt(
    file: TFile,
    index: number,        // ordinal: 배열 내 위치
    expectedText: string, // 앵커: 쓰기 전 일치 검증
    newComment: FileLevelComment
): Promise<WriteResult> {
    let ok = false;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
        const current = parseFileLevelComments(fm);
        if (current[index]?.text !== expectedText) return; // 앵커 불일치 → 중단
        const updated = current.map((c, i) => (i === index ? newComment : c));
        fm.comments = mergeFileLevelComments(
            Array.isArray(fm.comments) ? fm.comments : [],
            updated
        );
        ok = true;
    });
    return ok ? { success: true } : { success: false, reason: 'anchor mismatch' };
}
```

`ok` 플래그는 콜백이 실제로 쓰기를 완료했는지 바깥에 전달하는 유일한 방법이다. 콜백이 `return`으로 조기 종료하면 `ok`는 `false`로 남는다.

---

### 4. 앵커 검증 — silent write 금지

수정/삭제 전에 반드시 `current[index].text === expectedText`를 검사한다. 불일치 시:

- 콜백에서 `return` (쓰기 건너뜀)
- 호출자에게 `{ success: false, reason: 'anchor mismatch' }` 반환

절대 예외를 던지지 않는다. 모든 실패는 **`WriteResult` 타입으로 명시적으로 반환**한다:

```typescript
export interface WriteResult {
    success: boolean;
    reason?: string;
}
```

---

### 5. `mergeFileLevelComments` — 외래 frontmatter 항목 보존

다른 플러그인이나 사용자가 `comments` 키에 다른 형태의 데이터를 넣었을 수 있다. `{text: string, ts: string}` 형태가 아닌 항목은 외래 항목으로 간주하여 원래 위치에 보존한다:

```typescript
// FrontmatterComments.ts
export function mergeFileLevelComments(
    existing: unknown,
    newComments: FileLevelComment[]
): unknown[] {
    const base = Array.isArray(existing) ? existing : [];
    const foreignItems = base.filter((x) => !isFileLevelComment(x));
    return [...foreignItems, ...newComments]; // 외래 항목 앞, HiNote 항목 뒤
}
```

삭제 후에는 남은 HiNote 코멘트에 `fileCommentIndex`를 재번호 부여한다. 이때 **`fileCommentIndex`가 없는 항목(사이드카 마이그레이션 등)은 건너뛴다**:

```typescript
// CommentService.ts — deleteComment 내부
let fileLevelIdx = 0;
highlight.comments.forEach((c) => {
    if (c.fileCommentIndex !== undefined) c.fileCommentIndex = fileLevelIdx++;
});
```

모든 항목에 무조건 `i`를 부여하면 `undefined`이었던 항목이 ordinal을 가지게 되어 이후 `updateComment`/`deleteComment`의 `undefined` 가드를 우회, 잘못된 frontmatter 쓰기를 일으킨다.

---

### 6. `settle()` 패턴 — Promise double-resolve 방지

Modal은 여러 경로(Cancel 버튼, Save 버튼, ESC/외부 클릭으로 `onClose()` 호출)로 닫힐 수 있다. `resolved` 플래그로 **Promise가 최대 한 번만 resolve**되도록 보장한다:

```typescript
// FileCommentModal.ts
class FileCommentModal extends Modal {
    private resolved = false;

    private settle(text: string | null): void {
        if (this.resolved) return; // 이미 처리됨 → 무시
        this.resolved = true;
        this.resolve(text);
    }

    onClose(): void {
        this.settle(null); // ESC나 외부 클릭도 안전하게 처리
        this.contentEl.empty();
    }
}
```

`onClose()`에서 `settle(null)`을 호출하지 않으면 ESC로 닫혔을 때 Promise가 영구 hang한다.

---

### 7. `isModalOpen` 가드 — 더블클릭 경쟁 방지

`VirtualHighlightManager`는 Modal이 이미 열려 있으면 새 Modal 열기를 차단한다:

```typescript
// VirtualHighlightManager.ts
private isModalOpen = false;

private async handleAddFileComment(callbacks: { ... }): Promise<void> {
    if (this.isModalOpen) return; // 동시 열기 차단
    this.isModalOpen = true;
    try {
        // modal 열기, await, 결과 처리
    } finally {
        this.isModalOpen = false; // 예외 발생해도 반드시 해제
    }
}
```

`finally` 블록이 없으면 Modal이 예외로 닫혔을 때 `isModalOpen`이 `true`로 고착된다.

---

## Why This Matters

| 결정 | 대안 | 채택 이유 |
|---|---|---|
| `processFrontMatter` (원자적) | `vault.read` + `vault.modify` | 비원자 경로는 외부 편집과 경쟁 조건. 이미 알려진 coordinate desync 버그 패턴 |
| ordinal 주소 (`fileCommentIndex`) | 텍스트 기반 탐색 | O(1), 텍스트 편집에 무관, 앵커 검증과 조합 시 안전한 주소 체계 |
| `WriteResult` (반환 타입) | `throw` | Obsidian 플러그인에서 uncaught exception은 사용자 노이즈. 호출자가 실패를 선택적으로 처리 가능 |
| YAML frontmatter 저장 | 별도 `.json` 사이드카 | Obsidian이 frontmatter를 first-class로 관리. 동기화·백업·외부 도구 모두 단일 `.md` 파일 |
| `settle()` 플래그 | Promise를 직접 resolve | Modal은 여러 닫힘 경로 존재. 멱등성이 없으면 double-resolve로 Promise 오동작 |

---

## When to Apply

- 파일 전체를 대상으로 하는 메타데이터를 저장할 때 (`position === -1` 류)
- 동일 파일이 여러 경로(사용자, 외부 앱, 다른 플러그인)에서 동시에 편집될 수 있을 때
- 같은 frontmatter 키를 여러 플러그인이 공유할 가능성이 있을 때
- Modal → async → 부수효과 패턴에서 여러 닫힘 경로가 존재할 때
- 버튼이 async 작업 중 중복 클릭될 수 있을 때

**적용하지 않는 경우:**
- 본문 텍스트에 명확한 앵커 위치가 있는 경우 → 기존 인라인 `{>><<}` 방식
- frontmatter를 전혀 쓰지 않는 워크플로우

---

## Examples

**파일 레벨 코멘트 추가 전체 흐름:**

```
사용자 클릭
  └─ VirtualHighlightManager.handleAddFileComment()
       ├─ isModalOpen 체크 → 중복 차단
       └─ showFileCommentModal(app)  ← Promise 반환
            └─ FileCommentModal.onOpen()
                 ├─ Save 클릭    → settle(text) → resolve(text)
                 ├─ Cancel 클릭  → settle(null) → resolve(null)
                 └─ ESC/외부    → onClose() → settle(null) → resolve(null)
       text가 있으면:
       └─ callbacks.onAddFileComment(file, text)
            └─ CommentService.addFileLevelComment(file, text)
                 └─ InlineCommentWriter.addFileLevelComment()
                      └─ processFrontMatter(file, (fm) => {
                           parseFileLevelComments(fm)
                           → [...existing, newComment]
                           → mergeFileLevelComments(...)
                           fm.comments = result  ← 원자적 쓰기
                         })
```

**frontmatter 결과물:**

```yaml
---
title: My Note
comments:
  - text: "첫 번째 파일 코멘트"
    ts: "2026-06-23 14:30"
  - text: "두 번째 파일 코멘트"
    ts: "2026-06-23 15:00"
---
```

**삭제 후 ordinal 재계산:**

삭제 전: `[index 0] "첫 번째"`, `[index 1] "두 번째"`
index 0 삭제 후: `[index 0] "두 번째"` (재번호 부여)
다음 update/delete는 새 ordinal 기준으로 동작.

---

## Related

- `docs/solutions/architecture-patterns/inline-comment-storage-migration-pattern.md` — 저장 형식 결정(frontmatter `comments` 배열)과 마이그레이션 패턴. 이 문서의 전제.
- `docs/solutions/logic-errors/comment-insert-position-coordinate-desync.md` — 인라인 경로(editor)의 coordinate desync 버그. 프론트매터 경로가 `processFrontMatter`를 채택한 배경.
