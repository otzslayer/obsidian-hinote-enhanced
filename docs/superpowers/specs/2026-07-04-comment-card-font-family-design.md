# 하이라이트/코멘트 글꼴(font-family) Style Settings 노출 — 설계

- 작성일: 2026-07-04
- 상태: 승인 대기 (사용자 리뷰 게이트)
- 대상 파일: `styles.css` (단일 파일)

## 배경 / 문제

오른쪽 사이드바의 코멘트 카드는 하이라이트 문구(`.highlight-text`)와 코멘트
문구(`.hi-note-content`)를 렌더링한다. 현재 `styles.css`에는 이미 Style
Settings 통합(`/* @settings */` 블록, line 36~87)이 존재하지만, 노출된 항목은
글자 크기와 행간 4개뿐이다:

- `highlight-text-font-size`, `highlight-text-line-height`
- `hi-note-font-size`, `hi-note-line-height`

**글꼴(font-family)만 빠져 있다.** 사용자는 하이라이트 문구와 코멘트 문구의
글꼴 종류를 Style Settings 플러그인 UI에서 직접 고를 수 있기를 원한다.

## 목표

- 하이라이트 문구와 코멘트 문구의 `font-family`를 Style Settings에서 각각
  설정 가능하게 한다.
- 입력 방식은 **자유 입력 텍스트**(`variable-text`)로, 사용자가 임의의
  font-family 스택(예: `Pretendard, sans-serif`)을 직접 입력한다.
- 기존 사용자에게 영향이 없어야 한다(비워두면 Obsidian 기본 폰트 유지).

## 비목표 (YAGNI)

- font-weight, font-style, 프리셋 드롭다운 등은 요청 범위 밖 — 추가하지 않는다.
- TypeScript/로직 변경 없음. CSS만 수정한다.

## 설계

### 1. CSS 변수 2개를 기존 선택자에 추가

글자 크기·행간이 이미 걸려 있는 동일 선택자에 나란히 추가하여 적용 위치의
일관성을 보장한다.

```css
/* .highlight-text (현재 line ~505) — 하이라이트 문구 */
font-family: var(--highlight-text-font-family, inherit);

/* .hi-note-content (현재 line ~539) — 코멘트 문구 */
font-family: var(--hi-note-font-family, inherit);
```

### 2. `@settings` 블록에 항목 2개 추가

각 항목은 기존 heading(하이라이트 "文本设置", 코멘트 "评论设置") 아래에
`variable-text` 타입으로 배치한다. 기존 블록이 중국어 title이므로 일관성을 위해
신규 항목도 중국어 title을 사용한다(CSS 주석이라 i18n 불가).

```yaml
# 하이라이트 "文本设置" heading 아래, font-size 앞 또는 뒤
- id: highlight-text-font-family
  title: 高亮文本字体
  type: variable-text
  default: ''
  description: 留空则使用 Obsidian 默认字体。可输入 font-family，例如 "Pretendard, sans-serif"

# 코멘트 "评论设置" heading 아래
- id: hi-note-font-family
  title: 评论文本字体
  type: variable-text
  default: ''
  description: 留空则使用 Obsidian 默认字体。可输入 font-family，例如 "Pretendard, sans-serif"
```

## 동작 / 엣지 케이스

- **비워둠**: 변수 미설정 → `var(--x, inherit)`의 fallback `inherit` 적용 →
  Obsidian 기본 폰트 유지. 기존 사용자 영향 0.
- **빈 문자열 방어**: 만약 Style Settings가 빈 문자열을 변수로 기록하더라도
  `font-family: ;`는 무효 선언으로 무시되어 결과적으로 상속된다. 어느 경로든
  안전하다.
- **코드 블록**: `.highlight-text` / `.hi-note-content`의 자식 중 `pre`/`code`는
  자체 monospace 폰트를 유지한다(컨테이너 상속을 덮어씀). 의도된 동작.
- **적용 범위**: font-size가 걸린 바로 그 선택자에만 추가하므로, 크기/행간과
  글꼴이 항상 같은 요소에 함께 적용된다.

## 검증 계획

1. `npm run build` 성공 (styles.css는 번들 대상이 아니지만 회귀 방지 차원의 빌드 확인).
2. 수동 검증: Obsidian Vault에 `styles.css` 반영 → Style Settings 플러그인에서
   HiNote 섹션에 "高亮文本字体", "评论文本字体" 항목이 나타나는지 확인.
3. 값을 입력하면 사이드바 카드의 하이라이트/코멘트 글꼴이 바뀌고, 비우면 기본
   폰트로 되돌아오는지 확인.
