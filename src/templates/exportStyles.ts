// 내보내기 미리보기에 사용되는 스타일
export const exportStyles = `
    /* 내보내기 카드 기본 스타일 */
    .highlight-export-card {
        transition: all 0.3s ease;
        padding: 20px;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        
        /* 더 엄격한 텍스트 제어 추가 */
        font-size: 16px;
        line-height: 1.6;
        letter-spacing: normal;
        word-spacing: normal;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    /* 모던 스타일 템플릿 */
    .highlight-export-card-modern {
        padding: 24px;
        position: relative;
        overflow: hidden;
    }

    .highlight-export-card-modern::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 4px;
        background: linear-gradient(to bottom right, #5871ef 0%, #4c63e6 100%);
    }

    .highlight-export-card-modern .highlight-export-quote-decoration {
        position: absolute;
        top: 24px;
        right: 24px;
        opacity: 0.06;
        transform: scale(2);
    }

    .highlight-export-card-modern .highlight-export-quote-section {
        position: relative;
        padding: 24px 0;
        /* 인용 섹션의 텍스트 스타일 일관성 보장 */
        font-size: inherit;
        line-height: inherit;
        letter-spacing: inherit;
        word-spacing: inherit;
    }

    .highlight-export-card-modern .highlight-export-quote {
        font-size: 1em;
        line-height: 1.7;
        color: #333333;
        font-weight: 400;
        margin: 0;
        position: relative;
        z-index: 1;
        /* 인용 텍스트의 스타일 일관성 보장 */
        letter-spacing: normal;
        word-spacing: normal;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
    }

    /* 모든 텍스트 요소가 기본 스타일을 상속하도록 보장 */
    .highlight-export-card * {
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
    }

    /* 내보내기 미리보기 컨테이너 */
    .highlight-export-preview {
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        padding: 20px;
    }

    /* 내보내기 컨테이너 */
    .highlight-export-container {
        padding: 20px;
        margin: 0;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        width: 480px;
    }
`;
