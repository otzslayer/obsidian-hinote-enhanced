import { Setting, Notice } from 'obsidian';
import { t } from '../../i18n';
import { FSRSService } from '../services';
import type CommentPlugin from '../../../main';

export class FlashcardSettingsTab {
    private plugin: CommentPlugin;
    private containerEl: HTMLElement;
    private fsrsService: FSRSService;

    constructor(plugin: CommentPlugin, containerEl: HTMLElement) {
        this.plugin = plugin;
        this.containerEl = containerEl;
        this.fsrsService = plugin.fsrsManager.fsrsService;
    }

    display(): void {
        const container = this.containerEl.createEl('div', {
            cls: 'flashcard-settings-container'
        });

        new Setting(container)
            .setName(t('Flashcard learning'))
            .setHeading();

        // 일일 새 카드 학습 상한
        new Setting(container)
            .setName(t('New cards per day'))
            .setDesc(t('Maximum number of new cards to learn each day'))
            .addSlider(slider => {
                const params = this.fsrsService.getParameters();
                slider
                    .setLimits(1, 200, 1)
                    .setValue(params.newCardsPerDay)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        const params = this.fsrsService.getParameters();
                        params.newCardsPerDay = value;
                        this.fsrsService.setParameters(params);
                        await this.plugin.saveSettings();
                    });
                
                // 수치 표시 추가
                const valueDisplay = createEl('span', {
                    cls: 'slider-value',
                    text: String(params.newCardsPerDay)
                });
                
                slider.sliderEl.parentElement?.appendChild(valueDisplay);
                
                slider.sliderEl.addEventListener('input', () => {
                    valueDisplay.textContent = String(slider.getValue());
                });
            });

        // 일일 복습 카드 상한
        new Setting(container)
            .setName(t('Reviews per day'))
            .setDesc(t('Maximum number of cards to review each day'))
            .addSlider(slider => {
                const params = this.fsrsService.getParameters();
                slider
                    .setLimits(10, 500, 10)
                    .setValue(params.reviewsPerDay)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        const params = this.fsrsService.getParameters();
                        params.reviewsPerDay = value;
                        this.fsrsService.setParameters(params);
                        await this.plugin.saveSettings();
                    });

                // 수치 표시 추가
                const valueDisplay = createEl('span', {
                    cls: 'slider-value',
                    text: String(params.reviewsPerDay)
                });
                
                slider.sliderEl.parentElement?.appendChild(valueDisplay);
                
                slider.sliderEl.addEventListener('input', () => {
                    valueDisplay.textContent = String(slider.getValue());
                });
            });

        // 목표 기억 유지율
        new Setting(container)
            .setName(t('Target retention'))
            .setDesc(t('Target memory retention rate (0.8 = 80%)'))
            .addSlider(slider => {
                const params = this.fsrsService.getParameters();
                slider
                    .setLimits(0.7, 0.95, 0.01)
                    .setValue(params.request_retention)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        const params = this.fsrsService.getParameters();
                        params.request_retention = value;
                        this.fsrsService.setParameters(params);
                        await this.plugin.saveSettings();
                    });
                
                // 수치 표시 추가
                const valueDisplay = createEl('span', {
                    cls: 'slider-value',
                    text: `${Math.round(params.request_retention * 100)}%`
                });
                
                slider.sliderEl.parentElement?.appendChild(valueDisplay);
                
                slider.sliderEl.addEventListener('input', () => {
                    valueDisplay.textContent = `${Math.round(slider.getValue() * 100)}%`;
                });
            });

        // 최대 간격 일수
        new Setting(container)
            .setName(t('Maximum interval'))
            .setDesc(t('Maximum interval in days between reviews'))
            .addText(text => {
                const params = this.fsrsService.getParameters();
                text
                    .setValue(params.maximum_interval.toString())
                    .setPlaceholder('365')
                    .onChange(async (value) => {
                        const numValue = parseInt(value);
                        if (!isNaN(numValue) && numValue > 0) {
                            const params = this.fsrsService.getParameters();
                            params.maximum_interval = numValue;
                            this.fsrsService.setParameters(params);
                            await this.plugin.saveSettings();
                        }
                    });
                
                // 입력창 스타일 및 접미사 설정
                const inputEl = text.inputEl;
                inputEl.type = 'number';
                inputEl.min = '1';
                inputEl.setCssProps({ width: '80px' });

                // 일수 접미사 추가
                const suffixEl = createEl('span', {
                    text: ` ${t('days')}`,
                    cls: 'setting-item-suffix'
                });
                
                inputEl.after(suffixEl);
            });

        // 학습 통계 초기화
        new Setting(container)
            .setName(t('Reset daily stats'))
            .setDesc(t('Reset today\'s learning statistics'))
            .addButton(button => button
                .setButtonText(t('Reset'))
                .onClick(async () => {
                    const wasReset = await this.plugin.fsrsManager.resetTodayStats();
                    if (wasReset) {
                        new Notice(t('Daily statistics have been reset'));
                    } else {
                        new Notice(t('No statistics to reset for today'));
                    }
                }));

        // 고급 설정 제목 추가
        new Setting(container)
            .setName(t('Advanced'))
            .setHeading();
        
        // 고급 설정 설명 추가
        container.createEl('p', { 
            text: t('These settings control the FSRS algorithm parameters. Only change them if you understand the algorithm.'),
            cls: 'setting-item-description'
        });
        
        // 기본값으로 초기화 버튼 추가
        new Setting(container)
            .setName(t('Reset algorithm parameters'))
            .setDesc(t('Reset the FSRS algorithm parameters to default values'))
            .addButton(button => button
                .setButtonText(t('Reset to default'))
                .onClick(async () => {
                    // FSRS 파라미터 초기화
                    this.fsrsService.resetParameters();
                    await this.plugin.saveSettings();

                    // 초기화 후 파라미터 가져오기
                    const params = this.fsrsService.getParameters();

                    // 목표 유지율 슬라이더 업데이트
                    const retentionSlider = this.containerEl.querySelector('.setting-item:nth-child(4) .slider') as HTMLInputElement;
                    const retentionValue = this.containerEl.querySelector('.setting-item:nth-child(4) .slider-value') as HTMLElement;
                    if (retentionSlider && retentionValue) {
                        retentionSlider.value = String(params.request_retention);
                        retentionValue.textContent = `${Math.round(params.request_retention * 100)}%`;
                    }
                    
                    // 최대 간격 입력창 업데이트
                    const maxIntervalInput = this.containerEl.querySelector('.setting-item:nth-child(5) input[type="number"]') as HTMLInputElement;
                    if (maxIntervalInput) {
                        maxIntervalInput.value = String(params.maximum_interval);
                    }
                    
                    // 일일 새 카드 슬라이더 업데이트
                    const newCardsSlider = this.containerEl.querySelector('.setting-item:nth-child(2) .slider') as HTMLInputElement;
                    const newCardsValue = this.containerEl.querySelector('.setting-item:nth-child(2) .slider-value') as HTMLElement;
                    if (newCardsSlider && newCardsValue) {
                        newCardsSlider.value = String(params.newCardsPerDay);
                        newCardsValue.textContent = String(params.newCardsPerDay);
                    }
                    
                    // 일일 복습 카드 슬라이더 업데이트
                    const reviewsSlider = this.containerEl.querySelector('.setting-item:nth-child(3) .slider') as HTMLInputElement;
                    const reviewsValue = this.containerEl.querySelector('.setting-item:nth-child(3) .slider-value') as HTMLElement;
                    if (reviewsSlider && reviewsValue) {
                        reviewsSlider.value = String(params.reviewsPerDay);
                        reviewsValue.textContent = String(params.reviewsPerDay);
                    }
                    
                    // FSRS 가중치 파라미터 텍스트 영역 업데이트
                    const textareaEl = this.containerEl.querySelector('.fsrs-weights-textarea') as HTMLTextAreaElement;
                    if (textareaEl) {
                        textareaEl.value = JSON.stringify(params.w);
                    }
                    
                    new Notice(t('FSRS parameters have been reset to default values'));
                }));

        // FSRS 알고리즘 파라미터 편집
        const fsrsParamsContainer = container.createEl('div', {
            cls: 'fsrs-params-container'
        });

        // FSRS 파라미터 설명 추가
        fsrsParamsContainer.createEl('p', {
            text: t('FSRS weight parameter. The default value is obtained from a smaller sample; if adjustment is needed, please use the FSRS optimizer for calculation.'),
            cls: 'setting-item-description'
        });

        // 현재 파라미터 가져오기
        const params = this.fsrsService.getParameters();
        const wParamsString = JSON.stringify(params.w);

        // 텍스트 영역 설정 생성
        new Setting(fsrsParamsContainer)
            .setName(t('FSRS parameters'))
            .setDesc(t('Edit the 21 FSRS algorithm weights. Format: JSON array of numbers.'))
            .addTextArea(textarea => {
                textarea
                    .setValue(wParamsString)
                    .setPlaceholder('[0.4872, 1.4003, ...]')
                    .onChange(async (value) => {
                        try {
                            // 사용자 입력 JSON 파싱 시도
                            const newParams = JSON.parse(value);

                            // 파라미터 유효성 검사 (21개 숫자 배열이어야 함)
                            if (Array.isArray(newParams) &&
                                newParams.length === 21 &&
                                newParams.every(p => typeof p === 'number')) {

                                // 파라미터 업데이트
                                const currentParams = this.fsrsService.getParameters();
                                currentParams.w = newParams;
                                this.fsrsService.setParameters(currentParams);
                                await this.plugin.saveSettings();

                                // 성공 알림 표시
                                new Notice(t('FSRS weights updated successfully'));
                            } else {
                                // 오류 알림 표시
                                new Notice(t('Invalid format. Must be an array of 21 numbers.'), 5000);
                            }
                        } catch {
                            // JSON 파싱 오류
                            new Notice(t('Invalid JSON format. Please check your input.'), 5000);
                        }
                    });
                
                // 텍스트 영역 스타일 설정
                textarea.inputEl.rows = 2;
                textarea.inputEl.cols = 32;
                textarea.inputEl.addClass('fsrs-weights-textarea');
            });

        // 버튼 컨테이너 및 유효성 검사 버튼 더 이상 불필요
    }
}
