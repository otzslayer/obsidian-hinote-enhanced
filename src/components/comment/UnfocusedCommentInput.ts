import { HighlightInfo } from "../../types/highlight";
import { t } from "../../i18n";

/**
 * 포커스 해제된 주석 입력창 컴포넌트
 * 하이라이트 카드의 활성 상태에서 표시되며, 클릭 시 실제 입력창으로 전환
 */
export class UnfocusedCommentInput {
    private container: HTMLElement;

    constructor(
        private parent: HTMLElement,
        private highlight: HighlightInfo,
        private onClick: () => void
    ) {
        this.render();
    }

    private render() {
        // 포커스 해제된 입력창 컨테이너 생성
        this.container = this.parent.createEl("div", {
            cls: "unfocused-comment-input"
        });

        // 입력 힌트 영역 생성
        const inputArea = this.container.createEl("div", {
            cls: "unfocused-input-area",
            attr: {
                "placeholder": t("Add comment...")
            }
        });

        // 클릭 이벤트 추가, 클릭 시 onClick 콜백 호출
        inputArea.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.onClick();
        });
    }

    /**
     * 포커스 해제된 입력창 제거
     */
    public remove() {
        this.container.remove();
    }

    /**
     * 포커스 해제된 입력창 숨기기
     */
    public hide() {
        this.container.setCssProps({ display: 'none' });
    }
}
