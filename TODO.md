# TODO

## 후속 (선택)

- [ ] `PreviewWidgetRenderer.plainTextCache` 메모리 밸브: 현재 순수 무한 Map. 키가 내용 기반이라 stale 위험은 없고 실사용 규모(세션 내 distinct 하이라이트 텍스트 수)에서 메모리 문제는 없음. 만약 밸브가 필요해지면 `vault.on('modify')`에서 해당 파일 키만 비우는 방식이 적절 (LRU/상한 불필요). — `perf/preview-plaintext-cache`에서 도출

- [x] `onload` 배선을 단언하는 회귀 가드 테스트. `test/plugin/ColdStartRendering.test.ts`가 실제 `CommentPlugin`을 만들어 `onload()`를 돌리고, 그 결과 등록된 후처리기·에디터 확장으로 검증한다. 배선을 지연 경로로 되돌리면 빨개진다.

- [x] `HighlightDecorator.enable()`에 남은 후처리기 2건(`hideInlineCommentBlocks`, `processPreview`)의 늦은 등록 결함. `onload`에서 서비스를 초기화하도록 바꿔 세 등록(후처리기 2건 + CM6 확장)이 첫 렌더 이전에 모두 걸리게 했다.
