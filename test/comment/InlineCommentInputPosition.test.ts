import { describe, it, expect } from 'vitest';
// 순수 함수 단위 테스트는 무거운 모듈 그래프(barrel)를 끌어오지 않도록 구현 경로를 직접 import 한다.
import { computeInlineCommentInputShift } from '../../src/components/comment/InlineCommentInputPosition';

describe('computeInlineCommentInputShift', () => {
    it('팝업이 문서 뷰 경계 안에 있으면 이동하지 않는다', () => {
        const shift = computeInlineCommentInputShift({
            popupLeft: 100,
            popupRight: 400,
            boundaryLeft: 0,
            boundaryRight: 800,
            margin: 8,
        });
        expect(shift).toBe(0);
    });

    it('팝업 우측이 문서 뷰 우측을 넘으면 초과분만큼 왼쪽으로 이동한다', () => {
        // popupRight(850) - (boundaryRight(800) - margin(8)) = 58 초과
        const shift = computeInlineCommentInputShift({
            popupLeft: 550,
            popupRight: 850,
            boundaryLeft: 0,
            boundaryRight: 800,
            margin: 8,
        });
        expect(shift).toBe(-58);
    });

    it('팝업이 문서 뷰보다 넓으면 좌측 경계까지만 이동한다', () => {
        // overflowRight = 350 - (300 - 8) = 58, 그러나 왼쪽 여유는 50 - 8 = 42뿐
        const shift = computeInlineCommentInputShift({
            popupLeft: 50,
            popupRight: 350,
            boundaryLeft: 0,
            boundaryRight: 300,
            margin: 8,
        });
        expect(shift).toBe(-42);
    });

    it('margin을 우측 경계 계산에 반영한다', () => {
        // popupRight(795)가 boundaryRight(800)보다 작아도 margin(8) 안으로 들어오면 보정
        const shift = computeInlineCommentInputShift({
            popupLeft: 500,
            popupRight: 795,
            boundaryLeft: 0,
            boundaryRight: 800,
            margin: 8,
        });
        expect(shift).toBe(-3);
    });

    it('팝업 좌측이 이미 경계를 벗어난 비정상 상황에서는 더 이동하지 않는다', () => {
        // 왼쪽 여유가 음수 → 더 왼쪽으로 당길 수 없음
        const shift = computeInlineCommentInputShift({
            popupLeft: -20,
            popupRight: 850,
            boundaryLeft: 0,
            boundaryRight: 800,
            margin: 8,
        });
        expect(shift).toBe(0);
    });
});
