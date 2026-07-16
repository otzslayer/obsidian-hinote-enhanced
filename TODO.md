# TODO

## 후속 (선택)

- [ ] `PreviewWidgetRenderer.plainTextCache` 메모리 밸브: 현재 순수 무한 Map. 키가 내용 기반이라 stale 위험은 없고 실사용 규모(세션 내 distinct 하이라이트 텍스트 수)에서 메모리 문제는 없음. 만약 밸브가 필요해지면 `vault.on('modify')`에서 해당 파일 키만 비우는 방식이 적절 (LRU/상한 불필요). — `perf/preview-plaintext-cache`에서 도출

- [ ] `onload`가 `registerPluginMarkdownPostProcessors`를 실제로 호출하는지 단언하는 회귀 가드 테스트. 현재 `test/plugin/PluginBootstrap.test.ts`는 후처리기의 *동작*만 덮고 *배선*은 덮지 않는다. 향후 리팩터가 이 호출을 지연 경로로 되돌리면 스위트가 초록인 채 콜드 스타트 버그가 되살아난다. `CommentPlugin` 인스턴스화에 `loadData`/`InitializationManager`/`WindowManager` 스텁이 필요해 비용이 있어 이번엔 의도적으로 보류. — `fix/reading-mode-highlight-cold-start` 코드 리뷰에서 도출 (testing P2, 사용자 판단으로 보류)

- [ ] `HighlightDecorator.enable()`에 남은 후처리기 2건(`hideInlineCommentBlocks`, `processPreview`)의 늦은 등록 결함. 서비스 초기화 전에 렌더된 문서에는 코멘트 블록 숨김과 하이라이트 위젯이 적용되지 않는다. 콜드 스타트 계획이 단축키 경로만 고치고 명시적으로 후속으로 넘긴 항목. — `docs/plans/2026-07-16-001-fix-reading-mode-highlight-cold-start-plan.md` Scope Boundaries
