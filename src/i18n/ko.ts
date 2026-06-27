export default {

// 공통 번역

    "Ollama (Local)": "Ollama (로컬)",
    "Model": "모델",
    "Save": "저장",
    "Cancel": "취소",
    "Edit": "편집",
    "Delete": "삭제",
    "Custom Model": "사용자 지정 모델",
    "Checking...": "확인 중...",
    "Cloze card": "빈칸 채우기 카드",
    "Cloze card content": "빈칸 채우기 카드 내용",
    "Cloze card answer": "빈칸 채우기 카드 정답",

// AI 공통

    "Select the AI service provider": "AI 서비스 제공자를 선택하세요.",
    "API Key": "API 키",
    "Please enter your API Key.": "API 키를 입력하세요.",
    "API Key is valid!": "API 키가 유효합니다!",
    "API Key and model available.": "API 키와 모델을 사용할 수 있습니다.",
    "Invalid API Key or server error. Please verify your API Key.": "API 키가 유효하지 않거나 서버 오류입니다. API 키를 확인하세요.",
    "Select a model or enter a custom one.": "모델을 선택하거나 사용자 지정 모델을 입력하세요.",
    "Provider URL": "제공자 URL",
    "Leave it blank, unless you are using a proxy.": "프록시를 사용하지 않는다면 비워 두세요.",
    "Please enter an API Key first": "먼저 API 키를 입력하세요.",
    "Custom model unavailable. Please check the model ID and your access permissions.": "사용자 지정 모델을 사용할 수 없습니다. 모델 ID와 접근 권한을 확인하세요.",

// OpenAI 설정

    "OpenAI service": "OpenAI 서비스",
    "No models available. Please check your API Key.": "사용 가능한 모델이 없습니다. API 키를 확인하세요.",

// Anthropic 설정

    "Anthropic service": "Anthropic 서비스",
    "Model ID can only contain letters, numbers, underscores, dots and hyphens.": "모델 ID에는 영문자, 숫자, 밑줄, 마침표, 하이픈만 사용할 수 있습니다.",

// Gemini 설정

    "Unable to create model selection dropdown menu.": "모델 선택 드롭다운 메뉴를 만들 수 없습니다.",
    "Gemini service": "Gemini 서비스",

// Deepseek 설정

    "Deepseek service": "Deepseek 서비스",

// Custom AI 설정

    "Custom AI Service": "사용자 지정 AI 서비스",
    "Configure your own AI service provider. Supports OpenAI, Anthropic, and Gemini compatible APIs.": "직접 AI 서비스 제공자를 구성합니다. OpenAI, Anthropic, Gemini 호환 API를 지원합니다.",
    "The API type will be automatically detected based on your URL.": "API 유형은 URL을 기준으로 자동으로 감지됩니다.",
    "Service Name": "서비스 이름",
    "Give your custom AI service a name": "사용자 지정 AI 서비스의 이름을 지정하세요",
    "e.g., My AI Service": "예: 내 AI 서비스",
    "API Endpoint URL": "API 엔드포인트 URL",
    "The base URL of your AI service API": "AI 서비스 API의 기본 URL입니다",
    "Your API key for authentication": "인증에 사용할 API 키입니다",
    "Test Connection": "연결 테스트",
    "Testing...": "테스트 중...",
    "Please fill in all required fields first": "먼저 모든 필수 항목을 입력하세요",
    "Connection successful! Detected API type: ": "연결에 성공했습니다! 감지된 API 유형: ",
    "Connection successful!": "연결에 성공했습니다!",
    "Connection failed. Please check your settings.": "연결에 실패했습니다. 설정을 확인하세요.",
    "Connection failed: ": "연결 실패: ",
    "The model identifier to use": "사용할 모델 식별자입니다",
    "gpt-4, claude-3-opus, gemini-pro, etc.": "gpt-4, claude-3-opus, gemini-pro 등",
    "Detected API Type: ": "감지된 API 유형: ",
    "Advanced Options": "고급 옵션",
    "Optional custom headers (JSON format)": "선택적 사용자 지정 헤더 (JSON 형식)",
    "Example: {\"X-Custom-Header\": \"value\"}": "예: {\"X-Custom-Header\": \"value\"}",
    "Invalid JSON format. Headers must be an object.": "JSON 형식이 올바르지 않습니다. 헤더는 객체여야 합니다.",
    "Invalid JSON format": "JSON 형식이 올바르지 않습니다",

// 주석 펼치기/접기

    "Expand": "펼치기",
    "Collapse": "접기",

// Ollama 설정

    "Ollama service": "Ollama 서비스",
    "Ollama server URL (default: http://localhost:11434)": "Ollama 서버 URL (기본값: http://localhost:11434)",
    "Check": "확인",
    "Server URL": "서버 URL",
    "Successfully connected to Ollama service": "Ollama 서비스에 연결되었습니다.",
    "No models found. Please download models using ollama": "모델을 찾을 수 없습니다. ollama로 모델을 내려받으세요.",
    "Could not connect to Ollama service": "Ollama 서비스에 연결할 수 없습니다",
    "Failed to connect to Ollama service. Please check the server URL.": "Ollama 서비스에 연결하지 못했습니다. 서버 URL을 확인하세요.",
    "Currently selected model (Test connection to see all available models)": "현재 선택된 모델 (사용 가능한 모든 모델을 보려면 연결을 테스트하세요)",
    "Select a Ollama model.": "Ollama 모델을 선택하세요.",
    "No models available. Please load an available model first.": "사용 가능한 모델이 없습니다. 먼저 사용 가능한 모델을 불러오세요.",
    "No models available": "사용 가능한 모델이 없습니다",

// Prompt 설정

    "Prompt settings": "사용자 지정 프롬프트",
    "Add Prompt": "프롬프트 추가",
    "Input Prompt Name": "프롬프트 이름 입력",
    "Input Prompt Content\nAvailable parameters:\n{{highlight}} - Current highlighted text\n{{comment}} - Existing comment": "프롬프트 내용 입력\n사용 가능한 매개변수:\n{{highlight}} - 현재 하이라이트된 텍스트\n{{comment}} - 기존 코멘트",
    "Prompt added": "프롬프트가 추가되었습니다",
    "Prompt updated": "프롬프트가 업데이트되었습니다",

//CommentInput

    "Shift + Enter Wrap, Enter Save": "Shift + Enter 줄바꿈, Enter 저장",
    "Tab AI, Shift + Enter Wrap, Enter Save": "Tab AI, Shift + Enter 줄바꿈, Enter 저장",
    "Please enter AI instruction": "AI 지시문을 입력하세요",
    "AI response generated": "AI 응답이 생성되었습니다",
    "AI generation failed": "AI 생성에 실패했습니다",
    "Delete comment": "삭제",

//ActionButtons

    "Add Comment": "코멘트 추가",
    "Export as Image": "이미지로 내보내기",

//AIButton

    "Select Prompt": "프롬프트 선택",
    "Please add Prompt in the settings first": "먼저 설정에서 프롬프트를 추가하세요",
    "AI comments have been added": "AI 코멘트가 추가되었습니다",
    "AI comments failed:": "AI 코멘트 실패:",

//ExportModal

    "Download": "다운로드",
    "Export successful!": "내보내기에 성공했습니다!",
    "Export failed, please try again.": "내보내기에 실패했습니다. 다시 시도하세요.",

//CommentView

    "Loading...": "불러오는 중...",
    "Search...": "검색...",
    "No matching content found.": "일치하는 내용을 찾을 수 없습니다.",
    "The current document has no highlighted content.": "현재 문서에 하이라이트된 내용이 없습니다.",
    "No corresponding file found.": "해당 파일을 찾을 수 없습니다.",
    "Export failed: Failed to load necessary components.": "내보내기 실패: 필요한 구성 요소를 불러오지 못했습니다.",
    "All Highlight": "전체 하이라이트",
    "Export as notes": "노트로 내보내기",
    "Add File Comment": "파일 코멘트 추가",
    "File Comment": "파일 코멘트",
    "File comments": "파일 코멘트",
    "Add file comment placeholder": "코멘트를 입력하세요...",
    "Successfully exported highlights to: ": "하이라이트를 내보냈습니다: ",
    "Failed to export highlights: ": "하이라이트 내보내기에 실패했습니다: ",

//index

    "Default Template": "기본 템플릿",
    "Modern minimalist knowledge card style": "현대적이고 미니멀한 지식 카드 스타일",
    "Academic Template": "학술 템플릿",
    "Formal style suitable for academic citations": "학술 인용에 적합한 격식 있는 스타일",
    "Social Template": "소셜 템플릿",
    "Modern style suitable for social media sharing": "소셜 미디어 공유에 적합한 현대적인 스타일",

//main

    "Open HiNote window": "HiNote Enhanced 창 열기",

// Settings
    'General': '하이라이트',
    'Export Path': '내보내기 경로',
    'Set the path for exported highlight notes. Leave empty to use vault root. The path should be relative to your vault root.': '내보낸 하이라이트 노트를 저장할 경로를 설정합니다. 비워 두면 보관소 루트를 사용합니다. 경로는 보관소 루트를 기준으로 한 상대 경로여야 합니다.',
    "Exclusions": "제외 항목",
    "Comma separated list of paths, tags, note titles or file extensions that will be excluded from highlighting. e.g. folder1, folder1/folder2, [[note1]], [[note2]], *.excalidraw.md": "하이라이트에서 제외할 경로, 태그, 노트 제목 또는 파일 확장자를 쉼표로 구분하여 입력합니다. 예: folder1, folder1/folder2, [[note1]], [[note2]], *.excalidraw.md",
    "Custom text extraction": "사용자 지정 텍스트 추출",
    "Use Custom Pattern": "사용자 지정 패턴 사용",
    "Enable to use a custom regular expression for extracting text.": "텍스트 추출에 사용자 지정 정규식을 사용하려면 활성화하세요.",
    "Custom Pattern": "사용자 지정 패턴",
    "Enter a custom regular expression for extracting text. Use capture groups () to specify the text to extract. The first non-empty capture group will be used as the extracted text.": "텍스트를 추출할 사용자 지정 정규식을 입력합니다. 캡처 그룹 ()을 사용하여 추출할 텍스트를 지정하세요. 비어 있지 않은 첫 번째 캡처 그룹이 추출된 텍스트로 사용됩니다.",
    "Default Color": "기본 색상",
    "Set the default color for decorators when no color is specified. Leave empty to use system default.": "색상을 지정하지 않았을 때 데코레이터에 사용할 기본 색상을 설정합니다. 비워 두면 시스템 기본값을 사용합니다.",
    "Show Comment Widget": "코멘트 위젯 표시",
    "Show or hide the comment widget next to highlights. Disabling this can reduce visual clutter while reading.": "하이라이트 옆의 코멘트 위젯을 표시하거나 숨깁니다. 비활성화하면 읽는 동안 시각적 복잡함을 줄일 수 있습니다.",
    "Export template": "내보내기 템플릿",
    "Clean orphaned data": "고아 데이터 정리",
    "Remove highlights and comments that no longer exist in your documents. This is useful if you have deleted highlights but their comments are still stored in the data file.": "문서에 더 이상 존재하지 않는 하이라이트와 코멘트를 제거합니다. 하이라이트를 삭제했지만 해당 코멘트가 데이터 파일에 여전히 저장되어 있는 경우에 유용합니다.",

// Flashcard Settings
    "Flashcard learning": "플래시카드 학습",
    "New cards per day": "하루 새 카드 수",
    "Maximum number of new cards to learn each day": "하루에 학습할 새 카드의 최대 개수입니다.",
    "Reviews per day": "하루 복습 수",
    "Maximum number of cards to review each day": "하루에 복습할 카드의 최대 개수입니다.",
    "Target retention": "목표 기억 유지율",
    "Target memory retention rate (0.8 = 80%)": "목표 기억 유지율입니다 (0.8 = 80%).",
    "Maximum interval": "최대 간격",
    "Maximum interval in days between reviews": "복습 사이의 최대 간격(일)입니다.",
    "Reset daily stats": "일일 통계 초기화",
    "Reset today's learning statistics": "오늘의 학습 통계를 초기화합니다.",
    "Reset": "초기화",
    "Daily statistics have been reset": "일일 통계가 초기화되었습니다",
    "No statistics to reset for today": "오늘 초기화할 통계가 없습니다",
    "Advanced": "고급",
    "These settings control the FSRS algorithm parameters. Only change them if you understand the algorithm.": "이 설정은 FSRS 알고리즘 매개변수를 제어합니다. 알고리즘을 이해하는 경우에만 변경하세요.",
    "Reset algorithm parameters": "알고리즘 매개변수 초기화",
    "Reset the FSRS algorithm parameters to default values": "FSRS 알고리즘 매개변수를 기본값으로 초기화합니다.",
    "Reset to Default": "기본값으로 초기화",
    "FSRS parameters have been reset to default values": "FSRS 매개변수가 기본값으로 초기화되었습니다.",
    "days": "일",

    // Flashcard UI
    "Activate HiCard": "HiCard 활성화",
    "Enter your license key to activate HiCard feature.": "HiCard 기능을 활성화하려면 라이선스 키를 입력하세요.",
    "Get your license key from": "라이선스 키 발급처:",
    "HiNote official website": "HiNote 공식 웹사이트",
    "Enter license key": "라이선스 키 입력",
    "Activate": "활성화",
    "Please enter a license key": "라이선스 키를 입력하세요",
    "HiCard activated successfully!": "HiCard가 활성화되었습니다!",
    "Invalid license key": "유효하지 않은 라이선스 키",
    "Use global settings": "전역 설정 사용",
    "New cards per day:": "하루 새 카드 수:",
    "Reviews per day:": "하루 복습 수:",
    "Create Group": "그룹 만들기",
    "Create": "만들기",
    "Again": "다시",
    "Hard": "어려움",
    "Good": "좋음",
    "Add answer": "정답 추가",
    "Add answer...": "정답 추가...",
    "Please enter an answer.": "정답을 입력하세요.",
    "No corresponding highlight found.": "해당 하이라이트를 찾을 수 없습니다.",
    "Answer saved.": "정답이 저장되었습니다.",
    "Saved as a comment on the original highlight.": "원본 하이라이트의 코멘트로 저장되었습니다.",
    "Easy": "쉬움",
    "Card": "카드",
    "of": "/",
    "Settings": "설정",
    "Are you sure you want to delete this group?": "이 그룹을 삭제하시겠습니까?",
    "Yes": "예",
    "No": "아니요",
    "You've completed All cards for today!": "오늘의 모든 카드를 완료했습니다!",
    "No cards available.": "사용 가능한 카드가 없습니다.",
    "Return to First Card": "첫 번째 카드로 돌아가기",
    "Edit Group": "그룹 편집",
    "Create New Group": "새 그룹 만들기",
    "Please fill in all fields": "모든 항목을 입력하세요",
    "Saving...": "저장 중...",
    "Creating...": "만드는 중...",
    "Group updated successfully": "그룹이 업데이트되었습니다",
    "Failed to update group": "그룹 업데이트에 실패했습니다",
    "Group created successfully": "그룹이 생성되었습니다",
    "Failed to create or update group": "그룹 생성 또는 업데이트에 실패했습니다",
    "Retention": "유지율",
    "Limits:": "제한:",
    "Learning completed!": "학습을 완료했습니다!",
    "Group deleted": "그룹이 삭제되었습니다",

    // 검색 접두사 힌트
    "search-prefix-all": "모든 파일 하이라이트와 일치",
    "search-prefix-hicard": "플래시카드만 일치",
    "search-prefix-comment": "코멘트가 있는 항목만 일치",
    "search-prefix-path": "파일 경로와 일치",

    // 기타

    "Open (DoubleClick)": "열기 (더블클릭)",

    // AI Test Feedback
    "Testing": "테스트 중",
    "connection": "연결",
    "connection successful!": "연결에 성공했습니다!",
    "connection failed. Please check your configuration.": "연결에 실패했습니다. 구성을 확인하세요.",
    "test failed": "테스트 실패",
    "Please enter your": "먼저",
    "API Key first.": "API 키를 입력하세요.",
    "host address first.": "호스트 주소를 입력하세요.",

    // Friendly Error Messages
    "Invalid API Key": "유효하지 않은 API 키",
    "Access denied": "접근이 거부되었습니다",
    "Rate limit exceeded": "요청 한도를 초과했습니다",
    "Connection timeout": "연결 시간이 초과되었습니다",
    "Service unavailable": "서비스를 사용할 수 없습니다",
    "Service not found": "서비스를 찾을 수 없습니다",
    "Server error": "서버 오류",

    // Custom AI
    "Detected API type": "감지된 API 유형",

    // Reading mode highlight command
    "Toggle highlight": "하이라이트 토글",
    "No text selected": "선택된 텍스트가 없습니다",
    "Cannot determine block range": "블록 범위를 확인할 수 없습니다",
    "Multi-block selection is not supported": "여러 블록에 걸친 선택은 지원되지 않습니다",
    "Selected text not found in source (may contain inline markdown)": "선택한 텍스트를 원본에서 찾을 수 없습니다 (인라인 마크다운이 포함되어 있을 수 있습니다)",
    "Selected text is ambiguous (appears multiple times)": "선택한 텍스트가 모호합니다 (여러 번 나타납니다)",
    "Selection overlaps an existing highlight": "선택 영역이 기존 하이라이트와 겹칩니다",

// 하이라이트 통계 대시보드
    "Highlight dashboard": "하이라이트 통계 대시보드",
    "Total highlights": "전체 하이라이트",
    "Total comments": "전체 코멘트",
    "Notes with highlights": "하이라이트 포함 노트",
    "Top notes by highlights": "하이라이트 많은 노트 Top 10",
    "Top notes by comments": "코멘트 많은 노트 Top 10",
    "No data to display": "표시할 데이터가 없습니다",
    "Open highlight dashboard": "하이라이트 통계 대시보드 열기",
    "Failed to load stats": "하이라이트 통계 로드에 실패했습니다",
    "Plugin initialization failed": "플러그인 초기화에 실패했습니다"

};
