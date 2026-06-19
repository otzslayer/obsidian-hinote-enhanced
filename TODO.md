# TODO

## 후속 (선택)

- [ ] `PreviewWidgetRenderer.plainTextCache` 메모리 밸브: 현재 순수 무한 Map. 키가 내용 기반이라 stale 위험은 없고 실사용 규모(세션 내 distinct 하이라이트 텍스트 수)에서 메모리 문제는 없음. 만약 밸브가 필요해지면 `vault.on('modify')`에서 해당 파일 키만 비우는 방식이 적절 (LRU/상한 불필요). — `perf/preview-plaintext-cache`에서 도출
