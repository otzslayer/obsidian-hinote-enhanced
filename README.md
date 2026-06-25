<div align="center">
	<h1>HiNote Enhanced — 하이라이트 텍스트에 코멘트 추가하기</h1>
	<img src="https://img.shields.io/github/downloads/otzslayer/obsidian-hinote-enhanced/total" alt="GitHub Downloads (all assets, all releases)" />
	<img src="https://img.shields.io/github/v/release/otzslayer/obsidian-hinote-enhanced" alt="GitHub release (latest by date)" />
	<img src="https://img.shields.io/github/last-commit/otzslayer/obsidian-hinote-enhanced" alt="GitHub last commit" />
	<img src="https://img.shields.io/github/issues/otzslayer/obsidian-hinote-enhanced" alt="GitHub issues" />
	<img src="https://img.shields.io/github/stars/otzslayer/obsidian-hinote-enhanced?style=social" alt="GitHub stars" />
</div>

---

한국어 | [English](./README_en.md)

---

> **이 플러그인은 [CatMuse/HiNote](https://github.com/CatMuse/HiNote)의 Fork입니다.**
> 원본 저장소의 기능을 기반으로 추가 개선 및 기능을 적용하고 있습니다.

---

AI로 개발된 Obsidian 플러그인으로, 노트의 하이라이트된 텍스트를 자동으로 추출하여 코멘트 추가, AI 코멘트 생성, 하이라이트 텍스트와의 대화가 가능합니다. 다양한 형식으로 텍스트를 하이라이트하고, 지식 카드 이미지로 내보내거나 새 노트를 생성할 수 있으며, 메인 뷰에서 다양한 확장 기능을 활용할 수 있습니다.

> 이 플러그인은 AI의 도움을 받아 개발되었으며, 현재 베타 테스트 중입니다. 주의해서 사용하고 데이터를 정기적으로 백업해 주세요.

👇🏻 이미지를 클릭하면 비디오 튜토리얼을 볼 수 있습니다

[![HiNote Plugin Tutorial](https://img.youtube.com/vi/c1mxMGi1ZEk/maxresdefault.jpg)](https://www.youtube.com/watch?v=c1mxMGi1ZEk)

---

## ✨ 주요 기능

🎯 다양한 형식의 하이라이트 자동 추출 | 📝 하이라이트에 코멘트 및 메모 추가 | 🤖 AI 보조 코멘트 및 스마트 대화 | 📸 아름다운 지식 카드로 내보내기 | 📝 소스와 연결된 새 노트 생성 | 🧠 간격 반복 학습 시스템 (Pro)

> 💡 **팁:** [Pro로 업그레이드](https://hinote.vip)하면 FSRS 기반 플래시카드 시스템을 잠금 해제하여 하이라이트를 효율적으로 암기할 수 있습니다

---

## 하이라이트 텍스트 추출

하이라이트된 텍스트가 있는 노트를 열면, 사이드바에 자동으로 카드 형식으로 하이라이트 텍스트가 표시됩니다. `==`, `<mark>`, `<span>` 세 가지 형식의 하이라이트 태그가 지원됩니다. 정규식을 사용해 커스텀 형식을 정의할 수도 있습니다.

![하이라이트 텍스트 추출](./doc/highlighted-text-retrieval.jpg)

---

## 하이라이트 코멘트

하이라이트 코멘트 기능을 사용하면 하이라이트된 텍스트에 빠르게 생각을 기록해 아이디어를 놓치지 않을 수 있습니다. 편집 영역의 위젯을 클릭하거나 카드의 코멘트 추가 버튼을 직접 클릭하면 입력창이 열립니다.

노트 코멘트 기능을 사용하면 하이라이트에 의존하지 않고 문서 전체에 생각을 추가할 수 있습니다. 검색창 오른쪽의 파일 코멘트 추가 버튼을 클릭하면 하이라이트 목록 상단에 입력창이 열립니다.

> **인라인 저장 및 Obsidian Sync**: 코멘트는 `{>>코멘트 텍스트 ^YYYY-MM-DD HH:mm^<<}` 형식으로 하이라이트 텍스트 바로 뒤에 Markdown 노트 내부에 직접 저장됩니다. 코멘트가 `.md` 파일 안에 있으므로 **Obsidian Sync가 별도 설정 없이 자동으로 동기화**합니다.
>
> 플래시카드 데이터 (Pro)는 계속 `.hinote` 폴더에 저장되며, 이 변경 사항의 영향을 받지 않습니다.

---

## 인라인 코멘트 저장 및 동기화

### 코멘트 저장 방식

HiNote는 [CriticMarkup](https://criticmarkup.com/) 코멘트 블록으로 노트의 Markdown 소스에 코멘트를 직접 임베드합니다:

```
==하이라이트 텍스트=={>>내 코멘트 ^2024-01-15 10:30^<<}
```

- 블록은 하이라이트 마커 **바로 뒤**에 위치합니다.
- 끝의 `^YYYY-MM-DD HH:mm^` 토큰은 타임스탬프로, 코멘트를 편집할 때마다 업데이트됩니다.
- AI가 생성한 코멘트는 블록 내부에 `🤖 ` 접두사가 붙습니다.
- 파일 수준 코멘트(특정 하이라이트에 연결되지 않은 것)는 `comments` 키 아래 `{text, ts}` 객체 목록으로 노트의 `frontmatter`에 저장됩니다.

### 키보드 단축키

| 동작 | 기본 단축키 |
|------|------------|
| 선택 영역에 코멘트 추가 | `Mod+Shift+C` |
| 텍스트 하이라이트 (편집·읽기 모드 통합) | `Mod+Shift+S` |
| 코멘트 입력 중 줄바꿈 삽입 | `Shift+Enter` |

단축키는 **설정 → 단축키**에서 변경할 수 있습니다.

> **팁:** 코멘트 입력창에서 `Shift+Enter`를 누르면 줄바꿈을 삽입할 수 있습니다. 사이드바에서는 CommonMark 하드 브레이크(`<br>`)로 렌더링됩니다. `Enter`를 누르면 코멘트가 저장됩니다.

### 읽기 모드에서 하이라이트 생성 (데스크톱 전용)

HiNote는 **읽기 모드(Reading View)**에서 텍스트를 선택하고 `Mod+Shift+S`를 눌러 `==하이라이트==`를 바로 삽입할 수 있습니다. 삽입 직후 코멘트 버튼이 자동으로 나타납니다.

#### 1회 단축키 설정 (최초 1회만 필요)

Obsidian의 기본 *Toggle highlight* 명령과 단축키가 겹치므로, 아래 단계를 따라 주세요:

1. **설정 → 단축키**를 엽니다.
2. 검색창에 **"Toggle highlight"** 를 입력합니다.
3. Obsidian 기본 **Toggle highlight** 항목의 `Mod+Shift+S` 바인딩을 **제거**합니다 (×를 클릭).
4. **HiNote Enhanced > Toggle highlight** 항목에 `Mod+Shift+S`를 **지정**합니다.

이후 편집 모드에서는 기존과 동일하게 하이라이트 토글(온/오프)이 작동하고, 읽기 모드에서는 선택한 텍스트에 하이라이트가 삽입됩니다.

> **참고**: 다음 경우에는 알림과 함께 삽입이 취소됩니다.
> - 빈 선택 또는 다중 문단 선택
> - 선택 텍스트에 인라인 마크다운(`**굵게**` 등)이 포함된 경우
> - 선택 텍스트가 문서에 여러 번 등장하는 경우
> - 기존 하이라이트와 겹치는 경우

### Obsidian Sync

코멘트는 `.md` 파일과 함께 이동하며, 별도의 동기화 설정이 필요 없습니다. 오프라인 동시 편집 시 충돌 해결은 다른 Markdown 노트와 동일한 방식으로 처리됩니다.

### 알려진 제한 사항

| 상황 | 동작 |
|------|------|
| **소스 모드** | `{>>...<<}` 원시 문법이 표시됩니다. HiNote는 소스 모드에서 데코레이션을 숨길 수 없습니다. |
| **플러그인 비활성화** | `{>>...<<}` 블록이 파일에 남아 있지만 일반 텍스트로서 무해합니다. |
| **CriticMarkup 플러그인 설치** | 두 플러그인 모두 `{>>...<<}` 블록에 스타일을 적용하여 이중 데코레이션이 발생할 수 있습니다. |
| **고아 코멘트** | 이전 하이라이트 마커가 삭제된 `{>>...<<}` 블록은 *고아*로 태그됩니다. HiNote는 고아를 자동으로 삭제하지 않으며, 사이드바에 별도 그룹으로 표시됩니다. 더 이상 필요하지 않으면 수동으로 제거해 주세요. |
| **백슬래시(`\`) 포함 기존 코멘트** | 코멘트 텍스트의 백슬래시(`\`)는 디스크에 `\\`로 인코딩됩니다. 이 버전 이전에 저장된 코멘트에 `\`가 포함되어 있으면, 다음 저장 시 `\\`로 변환됩니다. 기존 코멘트를 읽기만 한다면 영향이 없으며, 수동 편집 후 저장할 때만 적용됩니다. |

### 기존 코멘트 마이그레이션

레거시 `.hinote/highlights/` 사이드카 형식에 저장된 코멘트가 있다면, 일회성 마이그레이션 명령을 실행하세요:

1. **명령 팔레트**(`Mod+P`)를 엽니다.
2. **"Migrate comments to inline storage"**를 검색합니다.
3. 드라이런 리포트를 검토하고 **Apply Migration**을 클릭합니다.

기존 `.hinote/highlights/` 폴더는 **마이그레이션 후 자동으로 삭제되지 않습니다** — 마이그레이션 후 백업 역할을 합니다.

---

## 이미지로 내보내기

하이라이트된 텍스트와 코멘트를 내보내 공유하기 쉬운 아름다운 지식 카드를 만들 수 있습니다.

![이미지로 내보내기](./doc/export-image.jpg)

---

## 노트로 내보내기

모든 하이라이트 텍스트와 코멘트를 Callout 형식의 새 노트로 내보낼 수 있습니다. 각 하이라이트와 코멘트는 블록 참조(Block ID)를 통해 소스 노트로 다시 연결할 수 있습니다.

![노트로 내보내기](./doc/export-as-file.jpg)

---

## 메인 뷰의 확장 기능

오른쪽 사이드바 창을 메인 뷰로 드래그하면 하이라이트된 텍스트가 있는 노트 목록, 모든 하이라이트 카드, HiCard 등 더 많은 기능을 사용할 수 있습니다.

- **노트 목록**: 하이라이트 텍스트가 있는 모든 노트를 하이라이트 수와 함께 표시합니다.
- **전체 하이라이트**: 지식 베이스의 모든 하이라이트 카드를 표시하여 하이라이트 내용에 더 집중할 수 있습니다.
- **HiCard**: 하이라이트 텍스트와 코멘트에서 플래시카드를 생성하는 기능으로, 암기와 학습을 도와줍니다 (Pro 기능)

![메인 뷰](./doc/main-view.jpg)

---

## AI 코멘트

AI가 생각을 보조하고 생성된 내용을 하이라이트 텍스트 아래 코멘트로 추가할 수 있습니다.

먼저, 플러그인 설정 메뉴에서 AI 제공자, API 키, 모델을 설정해야 합니다. 현재 지원되는 제공자는 OpenAI, Gemini, Anthropic, Deepseek, SiliconFlow, Ollama입니다.

다음으로, 커스텀 프롬프트를 설정합니다. 여기서 `{{highlight}}`와 `{{comment}}`를 사용해 하이라이트 텍스트와 코멘트 내용을 가져올 수 있습니다.

마지막으로, 하이라이트 카드의 AI 버튼에서 커스텀 프롬프트를 사용하거나, 코멘트 입력창에 직접 입력하고 Tab 키를 눌러 AI 서비스를 실행할 수 있습니다.

![AI 코멘트](./doc/ai-comment.jpg)

---

## Pro 기능

HiNote는 노트 작성 및 학습 경험을 향상시키는 추가 프리미엄 기능을 제공합니다:

### 플래시카드 시스템

플래시카드 기능은 HiNote Pro 버전에서 사용 가능합니다. 이 고급 간격 반복 시스템은 하이라이트된 내용을 더 효과적으로 암기하는 데 도움을 줍니다:

- 클릭 한 번으로 하이라이트를 플래시카드로 변환
- 최적의 학습 효율을 위한 FSRS(Free Spaced Repetition Scheduler) 알고리즘 활용
- 학습 스타일에 맞게 복습 일정 커스터마이즈

이 프리미엄 기능을 이용하려면 [Pro로 업그레이드](https://hinote.vip)해야 합니다.

![HiCard](./doc/hi-card.jpg)

![HiCard 설정](./doc/hicard-setting.jpg)

[![HiNote Pro](./doc/hinote-pro.jpg)](https://www.hinote.vip/en.html)

---

## 지원

이 플러그인이 유용하다면 개발을 지원해 주세요:

- [Ko-fi에서 커피 사주기](https://ko-fi.com/catmuse)
- 프로젝트에 ⭐ 스타를 눌러 지지를 표현해 주세요!

---

## 라이선스

이 플러그인은 MIT 라이선스 하에 배포됩니다. 기본 기능은 무료 오픈소스이며, 일부 고급 기능은 Pro 라이선스가 필요합니다.
