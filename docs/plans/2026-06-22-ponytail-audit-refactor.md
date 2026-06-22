# ponytail-audit 후속 리팩터링 — 과잉 설계 제거

작성일: 2026-06-22
출처: `/ponytail:ponytail-audit` 전체 저장소 스캔 결과 + 후속 호출자 검증

## 목적

ponytail-audit가 찾아낸 과잉 설계(죽은 코드, 단일 구현 인터페이스, 팩토리/레지스트리 계층)를
**위험도 순으로 3개 Wave에 나눠** 제거한다. 각 Wave는 독립적인 리뷰 경계를 가지며,
완료 후 `/clear` 해도 이 파일만 다시 읽으면 진행 상황과 남은 작업을 그대로 이어갈 수 있다.

## 범위 밖 (Scope Boundaries)

- 정확성 버그, 보안, 성능은 이 작업의 대상이 아니다 (ponytail은 복잡도만 다룬다).
- 동작 변경 없음. 모든 Wave는 외부에서 관찰 가능한 동작을 보존한다.
- `~/.claude/` 글로벌 설정, 빌드 설정(esbuild)은 건드리지 않는다. 단, `package.json`의 dead 의존성 1건은 제거 대상.

## 검증 게이트 (모든 Wave 공통)

각 Wave 종료 시 아래를 **모두** 통과해야 `[x]` 처리:

```bash
npm run build      # tsc -noEmit 타입체크 + esbuild 번들 → 타입 에러 0
npm test           # vitest run → 기존 테스트 전부 통과
```

테스트 파일은 `test/` 하위에 19개 존재. 본 리팩터링은 동작을 바꾸지 않으므로 기존 테스트가 그대로 통과해야 한다.

---

## 진행 상태

- [x] **Wave 1** — 순수 죽은 코드 삭제 (호출자 없음, 동작·시그니처 변경 없음)
- [ ] **Wave 2** — 지역 단순화 + 단일 구현 인터페이스 제거 (호출자 타입 갱신, 사소함)
- [ ] **Wave 3** — 구조 변경: AI 팩토리/레지스트리 → Map 리터럴 (아키텍처 설계 필요)

> 각 Wave 완료 시 위 체크박스를 `[x]`로 바꾸고, 해당 Wave 섹션 하단의 "결과 기록"에 실제 삭제 라인 수와 빌드/테스트 결과를 적은 뒤 `/clear`.

---

## Wave 1 — 순수 죽은 코드 삭제

**성격**: 전부 호출자가 0인 코드. 시그니처·동작 변경 없음. 가장 안전.
**모델·effort 권장**: Sonnet · high (면제 케이스 — 단순 삭제).
**참고**: 항목 1(`supports()`)과 항목 2(`AIServiceRegistry` 메서드 3개)는 Wave 3에서 `factories.ts`/`AIServiceRegistry`를 통째로 제거하면 함께 사라진다. Wave는 별도 세션이고 Wave 3이 미뤄질 수 있으므로 Wave 1에서 그대로 정리한다(중복 작업 인지만 하면 됨).

### 작업 항목

0. **baseline 확인** — 편집 전에 `npm run build && npm test`를 한 번 실행해 기준선이 이미 green인지 확인.
   (그래야 "기존 테스트 통과"가 의미 있는 게이트가 된다.)

1. **`IAIServiceFactory.supports()` 구현 7개 삭제**
   - 인터페이스 정의: `src/services/ai/types.ts:175` 의 `supports()` 메서드 제거
   - 구현 7개 제거: `src/services/ai/factories.ts` 의 각 `XxxServiceFactory.supports()`
     (OpenAI/Anthropic/Gemini/Deepseek/SiliconFlow/Ollama/Custom)
   - 근거: `AIServiceRegistry`는 `getProviderType()`를 키로 조회. `supports()`는 어디서도 호출 안 됨 (`grep "\.supports("` → 0건).

2. **`AIServiceRegistry` 미사용 메서드 3개 삭제** — `src/services/ai/AIServiceRegistry.ts`
   - `registerAll()` (L24) — 호출자 없음. `AIServiceManager`는 항상 `register()` 7회 개별 호출.
   - `isRegistered()` (L59) — 호출자 없음.
   - `getActiveServices()` (L84) — 호출자 없음.

3. **`BaseHTTPClient.buildJSONHeaders()` 삭제** — `src/services/ai/BaseHTTPClient.ts:115`
   - 정의만 존재, 호출자 0건. (`buildAuthHeaders`는 사용 중이므로 유지.)

4. **`HighlightMatcher` 정적 메서드 2개 삭제** — `src/services/highlight/HighlightMatcher.ts:32-44`
   - `static findMatch()` + `static findExactMatch()` 모두 제거 (서로 동일 코드, 둘 다 외부 호출 0건).
   - **주의**: 인스턴스 메서드 `findMatchingHighlight()`는 `PreviewHighlightResolver`/`PreviewWidgetRenderer`가 사용 → **유지**.

5. **`FlashcardFactory.createCard()` try/catch 3중첩 단순화** — `src/flashcard/services/FlashcardFactory.ts:34-51`
   - 동일한 `fsrsService.initializeCard(text, answer, filePath)`를 실패 시 같은 인자로 재호출 → 같은 예외 발생, 무의미.
   - 한 줄로 교체:
     ```ts
     public createCard(text: string, answer: string, filePath?: string): FlashcardState {
         return this.fsrsService.initializeCard(text, answer, filePath);
     }
     ```
   - (메서드 자체는 `addCard`가 호출하므로 유지. 본문만 단순화.)

6. **`minimatch` 의존성 제거** — `package.json:32`
   - 저장소 전역 검증 완료(2026-06-22): `main.ts`, `deploy.mjs`, `version-bump.mjs`, `esbuild.config.mjs`, `src/` 전체에서 import 0건.
     `ExcludePatternMatcher`는 자체 구현(쉼표 분리 + `*.ext`/폴더 prefix 매칭)을 사용하며 minimatch에 의존하지 않음.
   - **⚠️ 검증 사각지대 주의**: `npm run build`(tsc는 `.ts`만)·`npm test`는 `.mjs` 빌드/배포 스크립트의 런타임 import를 못 잡는다.
     실행 세션에서 **dep를 빼기 직전** 아래 grep이 깨끗한지(매칭 0건) 재확인할 것:
     ```bash
     grep -rn minimatch . --include="*.ts" --include="*.mjs" --include="*.js" \
       --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=graphify-out
     ```
   - `package.json` dependencies에서 줄 삭제 후 `npm install`로 `package-lock.json` 갱신.

### 결과 기록
- 삭제 라인: -48줄 소스 (package-lock 포함 전체 -160줄) / 빌드: ✅ 타입 에러 0 / 테스트: ✅ 19 files, 136 tests all passed
- 커밋: fa2826a (refactor/wave1-dead-code-removal)

---

## Wave 2 — 지역 단순화 + 단일 구현 인터페이스 제거

**성격**: 호출자 타입 갱신이 필요하지만 범위가 좁고 기계적.
**모델·effort 권장**: Sonnet · high.

### 작업 항목

1. **`IHighlightRepository` 인터페이스 제거** — 단일 구현(`HighlightRepository`)뿐인 76줄 인터페이스
   - `src/repositories/IHighlightRepository.ts` 파일 삭제
   - `src/repositories/HighlightRepository.ts`:
     - import 제거 (`import { IHighlightRepository } ...`)
     - `class HighlightRepository implements IHighlightRepository` → `implements` 절 제거
   - `src/services/HighlightManager.ts:3,19`:
     - import 제거
     - 생성자 파라미터 타입 `private repository: IHighlightRepository` → `private repository: HighlightRepository`
   - 근거: 구현체가 `HighlightRepository` 하나뿐. 참조 site 2곳(`HighlightRepository`, `HighlightManager`)만 갱신하면 됨.

### ⚠️ 의도적으로 제외한 항목 (false positive — 실행하지 말 것)

- **`FSRSService` 제거는 하지 않는다.**
  - 초기 audit는 "FSRSAdapter 순수 위임 래퍼"로 분류했으나, 호출자 검증 결과 **타입 경계를 제공**함이 확인됨.
  - `FSRSService.getParameters()`는 앱 도메인 타입 `FSRSParameters`를 반환하는 반면,
    `FSRSAdapter.getParameters()`는 ts-fsrs 라이브러리 타입 `TsFSRSParameters`를 반환한다 (서로 다른 타입).
  - `FlashcardSettingsTab`이 `getParameters/setParameters/resetParameters`를 18곳에서 호출하고,
    `DailyStatsService`가 `newCardsPerDay`/`reviewsPerDay` 필드에 의존한다.
  - FSRSService를 지우면 ts-fsrs 라이브러리 타입이 설정 UI/통계 계층으로 누출됨 → 유지가 옳다.
  - `getReviewableCards`, `resetParameters`도 어댑터에 없는 고유 메서드.

### 결과 기록 (실행 시 작성)
- 삭제 라인: ___ / 빌드: ___ / 테스트: ___

---

## Wave 3 — 구조 변경: AI 팩토리/레지스트리 → Map 리터럴

**성격**: 아키텍처 결정. 7개 팩토리 클래스 + `AIServiceRegistry`(~87줄)를 데이터 구조 하나로 대체.
**모델·effort 권장**: Opus · xhigh (설계). 별도 세션에서 이 계획을 읽고 **구현 직전 설계를 한 번 더 구체화**할 것.

### 현재 구조

```
AIServiceManager
  └─ registerAllServices(): registry.register(new XxxFactory()) × 7
  └─ AIServiceRegistry
       ├─ factories: Map<AIProviderType, IAIServiceFactory>
       ├─ instances: Map<AIProviderType, IAIService>   ← 지연 캐싱
       └─ getService(provider, config):
            캐시에 있고 isConfigured() 면 반환, 아니면 factory.create(config) 후 캐싱
  └─ 7개 XxxServiceFactory 클래스 (factories.ts ~240줄): 각자 create(settings) 한 메서드만 의미 있음
```

### 목표 구조 (제안 — 구현 세션에서 확정)

- 7개 팩토리 클래스 → `Record<AIProviderType, (settings: AISettings) => IAIService>` 생성자 맵 하나로 대체.
  각 엔트리는 기존 `XxxServiceFactory.create()` 본문(설정 검증 + `new XxxService(...)`).
- `AIServiceRegistry` 클래스 → `AIServiceManager` 내부의 지연 캐싱 로직으로 흡수하거나, 훨씬 작은 헬퍼로 축소.
  - **반드시 보존할 의미**: ① 인스턴스 지연 생성 + 캐싱, ② 캐시된 인스턴스가 `isConfigured()`일 때만 재사용,
    ③ `clearCache(provider?)` (모델/설정 업데이트 시 호출됨 — `updateModel`, `updateSettings`가 의존),
    ④ Ollama의 `OllamaServiceAdapter` 경로.
- `OllamaServiceAdapter`(factories.ts 내 클래스)는 어디로 옮길지 결정 — 별도 파일 또는 `OllamaService` 인접.

### 설계 시 확인할 것 (구현 세션 착수 전)

- `codegraph_impact` / `codegraph_callers`로 `AIServiceRegistry`·`IAIServiceFactory`·각 `XxxServiceFactory`의 블라스트 반경 확인.
- `getRegisteredProviders()` 호출자 존재 여부 (Manager가 위임함) → 대체 구조에서 동등 기능 유지.
- `AIServiceManager`의 `register*`/`getService` 의존 지점이 외부에 노출되는지.

### 결과 기록 (실행 시 작성)
- 삭제 라인: ___ / 빌드: ___ / 테스트: ___

---

## 예상 효과 (대략)

| Wave | 내용 | 예상 |
| --- | --- | --- |
| 1 | 죽은 코드 7종 + dep 1 | -~50줄, -1 dep |
| 2 | 단일 구현 인터페이스 + createCard | -~85줄 |
| 3 | 팩토리/레지스트리 → Map | -~250줄 (추정) |

**net: -~380줄, -1 dep** (Wave 3은 추정치, 구현 세션에서 확정)

## 세션 운영 패턴

```
세션 1: 이 파일 읽기 → Wave 1 실행 → 빌드·테스트 → [x] + 결과 기록 → /clear
세션 2: 이 파일 읽기 → Wave 2 실행 → 빌드·테스트 → [x] + 결과 기록 → /clear
세션 3: 이 파일 읽기 → Wave 3 설계 구체화 → 구현 → 빌드·테스트 → [x] + 결과 기록
```
