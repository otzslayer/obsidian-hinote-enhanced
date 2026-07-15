---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-plan-bootstrap
origin: docs/superpowers/specs/2026-07-04-comment-card-font-family-design.md
plan_depth: lightweight
created: 2026-07-04
---

# feat: 하이라이트/코멘트 카드 글꼴(font-family) Style Settings 노출

**Target repo:** obsidian-hinote-enhanced (single file: `styles.css`)

## Product Contract preservation

changed: none — 이 문서는 `ce-plan-bootstrap`로 직접 작성되었으며(설계 문서는
요구사항 전용 unified plan이 아님), 원본 설계 문서(`docs/superpowers/specs/2026-07-04-comment-card-font-family-design.md`)의
결정을 그대로 실행 유닛으로 전환했다.

---

## Summary

`.highlight-text`(하이라이트 문구)와 `.hi-note-content`(코멘트 문구)에 이미
`font-size`/`line-height`가 Style Settings로 노출되어 있으나 `font-family`는
빠져 있다. CSS 변수 2개를 기존 선택자에 추가하고, 같은 이름의 `@settings`
`variable-text` 항목 2개를 추가해 Style Settings UI에서 자유 입력으로 글꼴을
지정할 수 있게 한다. TypeScript 변경 없음, `styles.css` 단일 파일만 수정한다.

## Problem Frame

- 오른쪽 사이드바 코멘트 카드의 글자 크기/행간은 Style Settings에서 조절
  가능하지만 글꼴(font-family)은 조절할 수 없다.
- 사용자는 자유 입력 텍스트로 임의의 font-family 스택(예: `Pretendard,
  sans-serif`)을 지정하고 싶어 한다.
- 기존 사용자(값을 설정하지 않은 사용자)에게는 시각적 영향이 없어야 한다.

## Requirements

- R1: `.highlight-text`에 `--highlight-text-font-family` CSS 변수를 적용하고,
  Style Settings에 `variable-text` 타입 항목으로 노출한다.
- R2: `.hi-note-content`에 `--hi-note-font-family` CSS 변수를 적용하고, Style
  Settings에 `variable-text` 타입 항목으로 노출한다.
- R3: 값이 비어 있으면 `inherit`으로 폴백해 Obsidian 기본 폰트를 유지한다
  (기존 사용자 영향 없음).

## Key Technical Decisions

- **KTD1 — 기존 선택자에 나란히 추가**: 새 `font-family` 선언을 font-size/
  line-height가 이미 걸린 동일 선택자(`.highlight-text` 505행,
  `.hi-note-content` 539행)에 추가한다. 별도 선택자를 만들지 않아 크기·행간·
  글꼴이 항상 같은 요소에 함께 적용되도록 일관성을 보장한다.
- **KTD2 — fallback은 `inherit`, `default: ''`**: `font-family: var(--x,
  inherit)`로 선언하고 Style Settings `default`를 빈 문자열로 둔다. 값이
  없으면 상속된 Obsidian 기본 폰트를 그대로 사용하며, 빈 문자열이 변수로
  기록되어도 `font-family: ;`는 무효 선언이라 무시되어 안전하다.
- **KTD3 — 기존 블록의 중국어 title 관례를 유지**: `@settings` 블록의 기존
  heading·항목 title이 모두 중국어(`高亮文本字号`, `评论文本字号` 등)이므로,
  신규 항목도 같은 관례를 따라 중국어 title(`高亮文本字体`, `评论文本字体`)을
  사용한다. CSS 주석 블록이라 i18n 처리 대상이 아니다.

## Implementation Units

### U1. `.highlight-text`에 font-family 변수 추가

- **Goal**: 하이라이트 문구 선택자에 `--highlight-text-font-family` CSS 변수를
  적용한다.
- **Requirements**: R1, R3
- **Dependencies**: 없음
- **Files**: `styles.css` (505~515행, `.highlight-text` 규칙)
- **Approach**: `font-size`/`line-height` 선언 옆에
  `font-family: var(--highlight-text-font-family, inherit);` 한 줄을 추가한다.
- **Patterns to follow**: 508~509행의 기존 `font-size`/`line-height` 변수
  선언 패턴(`var(--x, fallback)`)을 그대로 따른다.
- **Test scenarios**:
  - Test expectation: none -- 순수 CSS 선언 추가이며 동작 분기가 없음. 수동
    검증은 U3에서 통합 확인.
- **Verification**: 변수 미설정 시 렌더링된 하이라이트 문구가 기존과 동일한
  폰트(Obsidian 기본)로 표시된다.

### U2. `.hi-note-content`에 font-family 변수 추가

- **Goal**: 코멘트 문구 선택자에 `--hi-note-font-family` CSS 변수를 적용한다.
- **Requirements**: R2, R3
- **Dependencies**: 없음
- **Files**: `styles.css` (539~549행, `.hi-note-content` 규칙)
- **Approach**: `font-size`/`line-height` 선언 옆에
  `font-family: var(--hi-note-font-family, inherit);` 한 줄을 추가한다.
- **Patterns to follow**: 541~542행의 기존 변수 선언 패턴을 그대로 따른다.
- **Test scenarios**:
  - Test expectation: none -- 순수 CSS 선언 추가이며 동작 분기가 없음. 수동
    검증은 U3에서 통합 확인.
- **Verification**: 변수 미설정 시 렌더링된 코멘트 문구가 기존과 동일한 폰트로
  표시된다.

### U3. `@settings` 블록에 font-family 항목 2개 추가

- **Goal**: Style Settings 플러그인 UI에 하이라이트/코멘트 글꼴 입력 항목을
  노출한다.
- **Requirements**: R1, R2, R3
- **Dependencies**: U1, U2 (같은 변수 이름을 참조하므로 선행 유닛과 이름 일치가
  필요)
- **Files**: `styles.css` (36~87행, `@settings` YAML 블록)
- **Approach**:
  - `highlight-text-font-size` 항목(52~57행) 앞 또는 뒤에
    `highlight-text-font-family` 항목을 `type: variable-text`,
    `default: ''`로 추가한다.
  - `hi-note-font-size` 항목(72~77행) 앞 또는 뒤에 `hi-note-font-family`
    항목을 동일한 형식으로 추가한다.
  - title은 기존 관례에 따라 중국어로 작성한다(`高亮文本字体`,
    `评论文本字体`). description은 "비워두면 Obsidian 기본 폰트 유지, 자유
    입력 가능(예: Pretendard, sans-serif)"이라는 의미를 중국어로 전달한다.
- **Patterns to follow**: 기존 `variable-number`/`variable-number-slider`
  항목의 YAML 구조(`id`, `title`, `type`, `default`, `description`)를 그대로
  따르되 `type: variable-text`를 사용한다.
- **Test scenarios**:
  - Test expectation: none -- YAML 설정 블록 추가이며 로직 분기 없음. 아래
    수동 검증으로 대체.
- **Verification** (수동, Obsidian Vault 필요):
  1. `npm run build` 성공 확인 (회귀 방지용 빌드 확인 — `styles.css` 자체는
     번들 대상이 아님).
  2. `styles.css`를 Vault의 플러그인 폴더에 반영 후 Style Settings 플러그인
     설정에서 HiNote 섹션에 "高亮文本字体", "评论文本字体" 항목이 나타나는지
     확인.
  3. 값을 입력하면 사이드바 카드의 하이라이트/코멘트 글꼴이 바뀌고, 값을
     비우면 기본 폰트로 되돌아오는지 확인.

## Scope Boundaries

### Out of scope

- font-weight, font-style, 프리셋 드롭다운 — 요청 범위 밖.
- TypeScript/로직 변경 — CSS만 수정.

### Deferred to Follow-Up Work

- 없음.

### 알려진 제약 (Known Limitation)

- 코멘트 편집 모드(`.hi-note-input textarea`, `styles.css` ~720~733행)는
  `--hi-note-font-family` 변수를 상속하지 않는다. 이는 기존 font-size/
  line-height도 동일하게 동기화되지 않는 기존 동작이며, 이번 변경으로 인한
  회귀가 아니다. U3의 수동 검증 시 편집 모드에서는 폰트가 바뀌지 않는 것이
  정상 동작임을 확인한다.

## Verification Contract

- `npm run build` 성공.
- 수동: Style Settings UI에 신규 항목 2개 노출, 값 입력/공백 시 렌더링 확인
  (U3 Verification 참고).

## Definition of Done

- [ ] U1: `.highlight-text`에 `--highlight-text-font-family` 변수 적용
- [ ] U2: `.hi-note-content`에 `--hi-note-font-family` 변수 적용
- [ ] U3: `@settings` 블록에 항목 2개 추가, Style Settings UI에서 노출 확인
- [ ] `npm run build` 통과
- [ ] 수동 검증(빈 값 → 기본 폰트 유지, 값 입력 → 폰트 변경) 완료
