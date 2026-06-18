# HiNote 코멘트 인라인 저장 전환 설계

- 날짜: 2026-06-18
- 상태: 설계 검토 (브레인스토밍 산출물 → 다음 단계 `/ce-plan`)
- 범위: 하이라이트 코멘트 데이터의 **저장 위치·포맷** 재설계. 사이드바 UI·AI·export 동작은 원칙적으로 유지. **Pro(플래시카드/FSRS) 기능은 범위 밖.**

---

## 1. 배경 / 문제

현재 HiNote는 하이라이트·코멘트 데이터를 Vault 루트 숨김 폴더 `.hinote/`에 노트별 JSON으로 저장한다 (`.hinote/highlights/<safe-name>.json`, `.hinote/metadata/file-mapping.json`, 그리고 Pro의 `.hinote/flashcards/cards.json`). 저장은 `app.vault.adapter`(raw DataAdapter, 모바일 포함)로 수행하며, `manifest.json`의 `isDesktopOnly: false`라 **모바일을 지원**한다.

**핵심 문제**: 이 `.hinote/`가 **Obsidian Sync로 기기 간 동기화되지 않는다.** 동기화 수단은 **Obsidian Sync만** 사용.

---

## 2. 검토 결과 — 기각된 선택지와 근거

### 2.1 JSON → SQLite 전환 — **기각**
- `isDesktopOnly: false`라 네이티브 SQLite 불가. 모바일에선 sql.js(WASM)뿐.
- sql.js는 DB를 **단일 바이너리 파일**로 통째 저장(`adapter.writeBinary`) → 노트별 JSON 분할보다 **동기화 충돌에 더 취약**(동기화 목표를 악화). 접근 패턴상 관계형 쿼리 불필요 → YAGNI.

### 2.2 `.obsidian` 내부 이동 — **기각**
- Obsidian Sync는 dot-폴더 제외, 예외는 `.obsidian`뿐이나 그 안의 **커스텀 하위폴더는 어떤 selective-sync 카테고리에도 매핑되지 않아** 동기화 미보장. 플러그인 폴더도 표준 파일(`main.js/manifest.json/styles.css/data.json`)만 동기화.

### 2.3 가시 Vault 폴더(`HiNote/`) — **기각**
- `.json`은 마크다운과 달리 **"Sync all other types" 토글(기본 OFF)** 필요. 게다가 Obsidian 코어엔 **가시 폴더를 탐색기에서 숨기는 네이티브 기능이 없음** → 사용자 거부.

### 2.4 플러그인 `data.json` 통합 — **기각**
- 숨김+동기화는 가능하나 **단일 파일 비대화**·설정 혼재·알려진 반영 지연 버그.

### 2.5 핵심 사실
- Obsidian Sync에서 **토글 없이 항상 동기화되는 유일한 파일 유형은 Markdown(`.md`)**. → 채택안의 토대.

---

## 3. 채택 결정 — 인라인(in-note) 코멘트 저장

코멘트 데이터를 별도 사이드카가 아니라 **코멘트가 달린 노트 본문 안에** 인라인으로 저장한다.

### 왜 이게 두 문제를 동시에 해결하나
- 코멘트가 마크다운 본문에 있으므로 **토글·별도 폴더·탐색기 클러터 없이 네이티브 동기화**.
- 데이터 이식성(플러그인 삭제해도 노트에 남음)·가독성.
- **숨은 이득**: 코멘트가 하이라이트에 물리적으로 인접 → "위치가 곧 연결". 현재 코드가 ID·텍스트·위치·context·fingerprint 다중 전략으로 재매칭하던 복잡성(`HighlightMatcher`)과 파일 매핑·rename·orphan 처리가 **상당 부분 불필요**.

### 선행 사례 (검증된 패턴)
- 인라인 저장: CriticMarkup, Comments(chetachiezikeuzor), Annotator, Note Annotations. 표준 구문(CriticMarkup)까지 존재.

---

## 4. 인라인 구문 설계

### 4.1 하이라이트 코멘트 (CriticMarkup 스타일 · 짧음 · 사이드바 전용 렌더)
하이라이트 바로 뒤에 CriticMarkup 코멘트 블록을 붙인다. 텍스트는 평문, 메타데이터는 분리 토큰.

```markdown
[Source 모드]
==세포의 발전소=={>>중요한 포인트 ^2026-06-18 14:30^<<}

[Reading / Live Preview]   (코멘트 숨김, 하이라이트 + 작은 마커만)
세포의 발전소 ●
  └ 사이드바: "중요한 포인트"  ·  2026-06-18 14:30
```

규칙:
- 컨테이너: CriticMarkup 코멘트 `{>> ... <<}`.
- 코멘트 텍스트: 평문(읽기·직접 편집 가능).
- 메타데이터: 텍스트 뒤 `^...^` 토큰 = **단일 타임스탬프**. 생성 시 현재 시각으로 기록하고, **사이드바에서 코멘트를 수정하면 인라인 토큰의 타임스탬프도 함께 갱신**(사실상 최종 수정 시각).
- **ID는 인라인에 저장하지 않음**(위치가 연결 → 영속 ID 불필요, 파싱 시 임시 생성). 사이드바 편집은 노트 내 해당 `{>>...<<}` 출현을 **위치/순서로 특정**해 텍스트·타임스탬프를 재기록.
- 여러 코멘트: `{>> <<}` 블록 연속. AI 코멘트는 `{>>🤖 ...<<}` 접두로 구분.
- 소스에서 사람이 텍스트만 입력해 스탬프가 없으면 다음 저장 시 플러그인이 채움.

### 4.2 노트 전체(파일 레벨) 코멘트 — frontmatter
특정 하이라이트에 묶이지 않는 노트 전체 코멘트는 **YAML frontmatter의 `comments` 키**로 저장·파싱한다.

```yaml
---
comments:
  - text: "이 노트 전체에 대한 생각"
    ts: 2026-06-18 14:30
  - text: "추가 메모"
    ts: 2026-06-19 09:00
---
```

- 읽기/쓰기: Obsidian 네이티브 API(`metadataCache.getFileCache().frontmatter` 읽기, `app.fileManager.processFrontMatter()` 안전 쓰기).
- 키는 **`comments`로 확정**(사용자 결정). 사용자/타 플러그인의 기존 `comments` 키와 겹칠 가능성은 구현 시 방어적으로 처리.

### 4.3 렌더링 (기존 파이프라인 재사용)
표시 동작은 저장 구문과 독립적이며, **현재 HiNote의 렌더 파이프라인을 그대로 재사용**:
- 읽기 뷰: `HighlightDecorator`의 `registerMarkdownPostProcessor`로 `{>>...<<}`를 숨기고 **작은 마커**로 치환.
- 라이브 프리뷰/소스: `EditorHighlightDecorations`의 CodeMirror `ViewPlugin` + `createCommentWidget`(=기존 마커 위젯) 재사용.
- 변경점은 하나: "코멘트 존재 여부"를 **사이드카 조회 대신 인접 `{>>...<<}` 감지**로 판단.
- 마커: **기존 HiNote의 작은 에디터 마커를 그대로 사용**(사용자 결정). 순수 소스 모드에선 원형 `{>>...<<}` 노출(불가피).

### 4.4 파싱 / 인덱싱
- 노트 텍스트를 정규식 스캔: 하이라이트 마커(`==`, `<mark>`, `<span>`, 사용자 정의 regex) + 직후 `{>>...<<}` → 현재와 **동일한 인메모리 모델**(`HighlightInfo`/`HiNote`) 구성 → 사이드바·All Highlights에 공급.
- 전체 조회: 로드 시 1회 인덱스 + `vault.on('modify')` 증분 갱신.

---

## 5. 코멘트 입력 명령 + 기본 단축키

- 현재 HiNote는 명령 2개(`openCommentPanel`, `openMainWindow`)만 등록하고 **기본 단축키는 없음**(Ctrl+Shift+S 하이라이트는 사용자가 직접 바인딩).
- 신규: **"선택 텍스트/하이라이트에 코멘트 추가"** 명령을 `editorCallback`으로 등록.
  - 기본 단축키 제안: **`Mod+Shift+C`** (Mod = macOS Cmd / Win·Linux Ctrl). "C=Comment" 직관적, 하이라이트 `Mod+Shift+S`와 페어, Obsidian 기본 단축키와 비충돌.
  - 안전장치: Obsidian 단축키 설정이 충돌을 시각 표시하며 사용자가 재바인딩 가능. (Obsidian 가이드라인은 기본 단축키 지양을 권하나, 사용자 요청 우선으로 저충돌 조합 채택.)
  - 명령은 Command Palette·에디터 메뉴에서도 접근 가능하게 유지.

---

## 6. 영향 범위

### 6.1 단순화/제거 (인접성으로 불필요)
- `HighlightMatcher`(다중 전략) — 대폭 축소/제거.
- `FileMappingStore`, `FilePathUtils`의 highlights 경로/safe-name 로직 — 제거.
- `HiNoteDataManager`의 노트별 highlight JSON I/O, rename/orphan 처리 — 인라인 파서/라이터로 대체.

### 6.2 유지
- 사이드바/카드 UI, `CommentInput`, export(image/note), AI 코멘트 흐름 — 인메모리 모델 동일하므로 대부분 그대로.
- **Pro 플래시카드 저장(`.hinote/flashcards/`)은 손대지 않음**(범위 밖). 따라서 `.hinote/` 디렉토리와 `FlashcardDataStore`는 플래시카드 용도로 잔존. 단, highlights/metadata 데이터는 더 이상 `.hinote/`에 두지 않음.

---

## 7. 마이그레이션 (핵심·위험)

기존 `.hinote/highlights/*.json` 코멘트를 각 노트 본문에 인라인으로 써넣는 일회성 변환.

- 각 노트: 저장된 코멘트를 하이라이트 위치에 매칭(기존 매칭 로직 1회 활용) → 하이라이트 뒤 `{>>...<<}` 삽입. 파일 레벨 코멘트는 frontmatter `comments`로 이전.
- **비파괴 원칙**: 노트를 수정하므로 `.hinote/highlights`는 자동 삭제하지 않고 **백업 보존** + 완료 Notice(사용자 데이터 자동 삭제는 승인 대상).
- 매칭 실패/모호한 코멘트는 노트를 임의 변형하지 않고 **리포트**로 남겨 사용자 확인.
- 가역성: 변환 전 안내 + dry-run 미리보기. 대량 노트 동시 수정은 Sync 충돌·diff 폭증을 유발 → 배치·확인 절차.

---

## 8. 동기화 동작 / 한계 (정직한 명시)

- 코멘트가 `.md` 본문/frontmatter에 있으므로 **Obsidian Sync가 토글 없이 네이티브 동기화**.
- **본질적 한계**: 두 기기에서 **같은 노트를 동시 오프라인 편집** 시 일반 마크다운 노트와 동일한 충돌(한쪽 유지/충돌 사본). 인라인이라도 자동 병합되지 않음 — 단 일반 노트 편집과 같은 익숙한 흐름.

---

## 9. 테스트 전략 (Obsidian 플러그인 초심자용 구체 계획)

**핵심 난점**: `obsidian` 모듈은 런타임에서만 제공되어 Node 테스트에서 import 불가. **해결의 열쇠는 순수 로직 분리.**

1. **계층 분리 (가장 중요)**
   - 순수 함수로 추출 → `app`/`vault` 의존 없이 직접 단위 테스트:
     - 인라인 파서: 노트 텍스트 → 코멘트 모델
     - 시리얼라이저: 코멘트 모델 → 노트 텍스트 패치
     - frontmatter 변환: frontmatter 객체 ↔ 코멘트 리스트
     - 마이그레이션 변환: (`.hinote` JSON + 노트 텍스트) → 새 노트 텍스트
   - Obsidian API 의존부(파일 읽기/쓰기, 이벤트 등록, 데코레이션)는 얇은 어댑터로 격리.

2. **러너: Vitest** — 설정 간단, TS/ESM 기본 지원, 빠름. devDependency 추가 + `npm test` 스크립트.

3. **obsidian 모킹** — 꼭 import해야 하는 파일용으로 `test/__mocks__/obsidian.ts`에 `TFile`/`Vault` 등 최소 스텁 + vitest `resolve.alias`로 `obsidian` → mock 매핑.

4. **스냅샷 테스트** — 시리얼라이저는 "노트 텍스트 입력 → 출력" 스냅샷으로 회귀 방지.

5. **통합/수동 테스트 (테스트 Vault)**
   - throwaway 테스트 Vault 생성, 빌드 산출물을 `<vault>/.obsidian/plugins/hi-note/`에 심볼릭 링크. `hot-reload` 플러그인으로 반복 단축.
   - 수동 체크리스트: 텍스트 선택 → `Mod+Shift+C` → 인라인 `{>>...<<}` 생성 확인 → 읽기 뷰(코멘트 숨김+마커) → 사이드바 표시 → 재시작 후 재파싱 → 두 기기 Sync 동기화 → 마이그레이션 dry-run.

6. **CI(선택)** — GitHub Actions에서 `npm test` + `tsc -noEmit`.

참고: [Obsidian Hub — 플러그인 API 테스트 가이드], [Jest용 Obsidian API 모킹], [obsidian-sample-plugin-with-tests].

---

## 10. 리스크 / 캐비엇

1. **플러그인이 사용자 노트를 수정함** — 가장 큰 전환. 안전한 삽입/수정 로직 + 충분한 테스트 필수.
2. **순수 소스 모드에선 `{>>...<<}` 원형 노출** — 불가피.
3. **숨김 렌더는 HiNote 활성 시에만** — 비활성 시 원형 노출(데이터는 읽힘).
4. **CriticMarkup 플러그인 동시 사용 시 이중 스타일** 가능 — 문서화.
5. **대량 마이그레이션**이 다수 노트 변경 → Sync 부하·diff. 배치/확인으로 완화.
6. 하이라이트 텍스트 삭제 시 인접 `{>>...<<}` **고아화** — 처리 정책 필요(OPEN).

---

## 11. Open Questions (plan 단계로 이월)

1. 타임스탬프 토큰의 파싱 구분자 충돌·이스케이프 규칙(텍스트에 `^`·`<<`/`>>`가 포함되는 경우).
2. 고아 코멘트(하이라이트 삭제됨) 처리 정책.
3. 사용자 정의 regex 하이라이트 포맷에 대한 인라인 코멘트 부착 규칙.
4. 마이그레이션 dry-run/미리보기 범위와 롤백 안내.
5. 대량 노트 인덱싱 성능 목표치와 증분 갱신 전략 검증.

---

## 12. 다음 단계

스펙 승인 후: `/clear` → **`/ce-plan`** 으로 구현 계획 작성(이 파이프라인은 writing-plans 미사용). Plan은 Open Questions를 해소하고 파일별 변경·마이그레이션·테스트 도입(vitest 셋업 포함)을 구체화한다.
