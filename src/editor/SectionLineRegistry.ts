/**
 * 읽기 모드 블록 엘리먼트 → 소스 줄범위 레지스트리.
 *
 * WeakMap을 사용해 GC가 DOM 노드 해제 시 자동 정리한다.
 * 인스턴스는 CommentPlugin이 소유하고, 기록은 onload에서 등록되는
 * registerPluginMarkdownPostProcessors의 후처리기가 담당한다 — 서비스 지연 초기화
 * 이전에 렌더된 문서도 잡아야 하므로 서비스 수명주기에 묶지 않는다.
 */
export interface BlockLineRange {
    lineStart: number;
    lineEnd: number;
}

export class SectionLineRegistry {
    private readonly map = new WeakMap<Element, BlockLineRange>();

    set(el: Element, range: BlockLineRange): void {
        this.map.set(el, range);
    }

    /** node 자신 또는 조상 체인 중 등록된 첫 Element의 줄범위를 반환. 없으면 null. */
    findBlockRange(node: Node): BlockLineRange | null {
        let current: Node | null = node;
        while (current) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const range = this.map.get(current as Element);
                if (range) return range;
            }
            current = current.parentNode;
        }
        return null;
    }
}
