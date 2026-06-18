import { setIcon, Notice, Menu, MenuItem } from "obsidian";
import { AIServiceManager } from "../services/ai";
import { t } from "../i18n";
import CommentPlugin from "../../main";

/**
 * AI 분석에 필요한 텍스트와 댓글을 가져오기 위한 콘텐츠 제공자 인터페이스
 */
export interface ContentProvider {
    getText: () => string;
    getComments: () => string;
}

/**
 * AI 버튼 옵션 인터페이스
 */
export interface AIButtonOptions {
    /** AI 응답 후 콜백 함수 */
    onResponse: (content: string) => Promise<void>;
    /** 버튼의 CSS 클래스명 */
    buttonClass: string;
    /** 버튼의 아이콘 이름 */
    buttonIcon: string;
    /** 버튼의 aria-label 속성 */
    buttonLabel: string;
    /** 버튼 위치 */
    position: 'left' | 'right' | 'titlebar';
}

/**
 * AI 관련 기능의 버튼과 드롭다운 메뉴를 표시하는 AI 버튼 컴포넌트
 */
export class AIButton {
    private container: HTMLElement;
    private aiContainer: HTMLElement;
    private aiButton: HTMLElement;
    private plugin: CommentPlugin;
    private contentProvider: ContentProvider;
    private options: AIButtonOptions;

    /**
     * AI 버튼 컴포넌트 생성
     * @param container 컨테이너 요소
     * @param contentProvider 콘텐츠 제공자
     * @param plugin 플러그인 인스턴스
     * @param options 버튼 옵션
     */
    constructor(
        container: HTMLElement,
        contentProvider: ContentProvider,
        plugin: CommentPlugin,
        options: AIButtonOptions
    ) {
        this.plugin = plugin;
        this.container = container;
        this.contentProvider = contentProvider;
        // 옵션 병합, 전달된 옵션으로 기본값 덮어쓰기
        this.options = {
            ...options
        };

        this.initButton();
    }

    /**
     * 컴포넌트 소멸, 리소스 정리
     */
    destroy() {
        this.aiContainer.detach();
    }

    /**
     * 버튼 및 드롭다운 메뉴 초기화
     */
    private initButton() {
        // AI 버튼 및 드롭다운 메뉴 컨테이너
        const aiContainer = this.container.createEl("div", {
            cls: "highlight-ai-container"
        });
        this.aiContainer = aiContainer;

        // 위치에 따라 컨테이너 클래스명 설정
        if (this.options.position) {
            aiContainer.addClass(`highlight-ai-container-${this.options.position}`);
        }

        // AI 버튼
        const aiButton = aiContainer.createEl("div", {
            cls: this.options.buttonClass,
            attr: { 'aria-label': this.options.buttonLabel }
        });
        setIcon(aiButton, this.options.buttonIcon);

        // 버튼 클릭 이벤트 추가
        aiButton.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // 상태 업데이트를 위한 버튼 참조 저장
        this.aiButton = aiButton;
    }

    /**
     * 드롭다운 메뉴 표시/숨김 전환
     */
    private toggleDropdown() {
        const menu = new Menu();
        const prompts = Object.entries(this.plugin.settings.ai.prompts || {});

        if (prompts.length > 0) {
            prompts.forEach(([promptName]) => {
                menu.addItem((item: MenuItem) => item
                    .setTitle(promptName)
                    .onClick(async () => {
                        await this.handleAIAnalysis(promptName);
                    })
                );
            });
        } else {
            menu.addItem((item: MenuItem) => item
                .setTitle(t("Please add Prompt in the settings first"))
                .setDisabled(true)
            );
        }

        const rect = this.aiButton.getBoundingClientRect();
        menu.showAtPosition({ x: rect.left - 92, y: rect.bottom + 8 });
    }

    /**
     * AI 분석 처리
     * @param promptName 프롬프트 이름
     */
    private async handleAIAnalysis(promptName: string) {
        try {
            this.setLoading(true);

            const aiService = new AIServiceManager(this.plugin.settings.ai);
            const prompt = this.plugin.settings.ai.prompts[promptName];

            if (!prompt) {
                throw new Error(t(`Not found named "${promptName}" Prompt`));
            }

            // 콘텐츠 제공자에서 텍스트와 댓글 가져오기
            const text = this.contentProvider.getText();
            const commentsText = this.contentProvider.getComments();

            // AI 서비스를 호출하여 분석
            const response = await aiService.generateResponse(
                prompt,
                text,
                commentsText
            );

            // AI 분석 결과 추가
            await this.options.onResponse(response);

            new Notice(t('AI comments added'));

        } catch (error) {
            new Notice(t(`AI comments failed: ${error.message}`));
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 버튼의 로딩 상태 설정
     * @param loading 로딩 중 여부
     */
    private setLoading(loading: boolean) {
        if (loading) {
            this.aiButton.addClass('loading');
            setIcon(this.aiButton, 'loader');
        } else {
            this.aiButton.removeClass('loading');
            setIcon(this.aiButton, this.options.buttonIcon || "bot-message-square");
        }
    }

    /**
     * 버튼 요소 가져오기
     */
    public getButtonElement(): HTMLElement {
        return this.aiButton;
    }
}
