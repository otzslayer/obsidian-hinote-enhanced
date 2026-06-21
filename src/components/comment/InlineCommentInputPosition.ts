import { COMMENT_BOUNDARY_MARGIN } from './constants';

export interface InlinePopupShiftParams {
    /** 팝업의 현재 좌측 경계 (viewport 좌표, getBoundingClientRect().left) */
    popupLeft: number;
    /** 팝업의 현재 우측 경계 (viewport 좌표) */
    popupRight: number;
    /** 문서 뷰 컨테이너의 좌측 경계 */
    boundaryLeft: number;
    /** 문서 뷰 컨테이너의 우측 경계 */
    boundaryRight: number;
    /** 경계와 팝업 사이 최소 여백 (px) */
    margin: number;
}

/**
 * 인라인 코멘트 입력 팝업이 문서 뷰의 우측 경계를 넘지 않도록 적용할
 * 수평 이동량(px)을 계산한다. 음수면 왼쪽으로 이동, 0이면 보정 불필요.
 *
 * 팝업이 문서 뷰보다 넓어 왼쪽 여유가 부족하면, 좌측 경계까지만 당겨
 * 더 이상 왼쪽으로 벗어나지 않도록 한다.
 */
export function computeInlineCommentInputShift(params: InlinePopupShiftParams): number {
    const { popupLeft, popupRight, boundaryLeft, boundaryRight, margin } = params;

    const overflowRight = popupRight - (boundaryRight - margin);
    if (overflowRight <= 0) return 0;

    const maxLeftShift = Math.max(0, popupLeft - (boundaryLeft + margin));
    const shift = Math.min(overflowRight, maxLeftShift);
    return shift === 0 ? 0 : -shift;
}

/**
 * 인라인 코멘트 입력 팝업이 속한 문서 뷰의 스크롤/콘텐츠 경계 요소를 찾는다.
 * 편집(라이브 프리뷰/소스)·읽기 모드 각각의 컨테이너를 우선순위로 탐색한다.
 */
function findDocumentViewBoundary(popup: HTMLElement): HTMLElement | null {
    return (
        popup.closest<HTMLElement>('.cm-scroller') ??
        popup.closest<HTMLElement>('.markdown-preview-view') ??
        popup.closest<HTMLElement>('.markdown-source-view') ??
        popup.closest<HTMLElement>('.view-content')
    );
}

/**
 * 인라인 코멘트 입력 팝업이 문서 뷰의 우측 경계를 넘지 않도록 위치를 보정한다.
 * 팝업이 DOM에 마운트되어 레이아웃이 잡힌 뒤(예: requestAnimationFrame 콜백)
 * 호출해야 getBoundingClientRect가 유효한 좌표를 반환한다.
 */
export function applyInlineCommentInputPosition(
    popup: HTMLElement,
    margin: number = COMMENT_BOUNDARY_MARGIN
): void {
    // rAF 사이에 팝업이 detach(취소/CM 재렌더)됐으면 좌표 측정·보정을 생략
    if (!popup.isConnected) return;

    const boundary = findDocumentViewBoundary(popup);
    if (!boundary) return;

    const popupRect = popup.getBoundingClientRect();
    const boundaryRect = boundary.getBoundingClientRect();

    const shift = computeInlineCommentInputShift({
        popupLeft: popupRect.left,
        popupRight: popupRect.right,
        boundaryLeft: boundaryRect.left,
        boundaryRight: boundaryRect.right,
        margin,
    });

    if (shift !== 0) {
        popup.style.left = `${shift}px`;
    }
}
