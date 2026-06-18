import { App, PluginSettingTab } from 'obsidian';
import { GeneralSettingsTab } from './tabs/GeneralSettingsTab';
import { AIServiceTab } from './tabs/AIServiceTab';
import { FlashcardSettingsTab } from '../flashcard';
import { t } from '../i18n';
import { LicenseManager } from '../services/LicenseManager';
import type CommentPlugin from '../../main';
import { ObsidianInternals } from '../utils/ObsidianInternals';

export class AISettingTab extends PluginSettingTab {
    plugin: CommentPlugin;
    private licenseManager: LicenseManager;

    constructor(app: App, plugin: CommentPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.licenseManager = new LicenseManager(this.plugin);
    }

    display(): void {
        void this.render();
    }

    private async render(): Promise<void> {
        await this.plugin.ensureServicesInitialized();

        const { containerEl } = this;
        containerEl.empty();

        // 탭 컨테이너 생성
        const tabContainer = containerEl.createEl('div', { cls: 'setting-tabs' });
        const contentContainer = containerEl.createEl('div', { cls: 'setting-tab-content' });

        // 탭 버튼 생성
        const generalTab = tabContainer.createEl('div', {
          text: t('General'),
          cls: 'setting-tab-btn active',
          attr: { role: 'button', tabindex: '0' }
        });
        const aiTab = tabContainer.createEl('div', {
          text: t('AI service'),
          cls: 'setting-tab-btn',
          attr: { role: 'button', tabindex: '0' }
        });
        // 콘텐츠 컨테이너
        const generalContent = contentContainer.createEl('div', { cls: 'setting-tab-pane active' });
        const aiContent = contentContainer.createEl('div', { cls: 'setting-tab-pane' });

        // 탭 전환 이벤트 추가
        const switchTab = (targetTab: HTMLElement, targetContent: HTMLElement) => {
            tabContainer.findAll('.setting-tab-btn').forEach(tab => tab.removeClass('active'));
            contentContainer.findAll('.setting-tab-pane').forEach(pane => pane.removeClass('active'));
            targetTab.addClass('active');
            targetContent.addClass('active');
        };

        generalTab.onclick = () => switchTab(generalTab, generalContent);
        aiTab.onclick = () => switchTab(aiTab, aiContent);

        // General 탭에 일반 설정 추가
        new GeneralSettingsTab(this.plugin, generalContent).display();
        // AI Service 탭에 AI 서비스 설정 추가
        new AIServiceTab(this.plugin, aiContent).display();

        // HiCard 탭은 항상 표시
        const flashcardTab = tabContainer.createEl('div', {
            text: 'HiCard',
            cls: 'setting-tab-btn',
            attr: { role: 'button', tabindex: '0' }
        });
        const flashcardContent = contentContainer.createEl('div', { cls: 'setting-tab-pane' });
        flashcardTab.onclick = () => {
            void this.renderFlashcardTab(switchTab, flashcardTab, flashcardContent);
        };
        // 기본 HiCard 콘텐츠 로드 (선택, 첫 로드 시 자동 판단)
        // flashcardTab.onclick();
    }

    private async renderFlashcardTab(
        switchTab: (targetTab: HTMLElement, targetContent: HTMLElement) => void,
        flashcardTab: HTMLElement,
        flashcardContent: HTMLElement
    ): Promise<void> {
            switchTab(flashcardTab, flashcardContent);
            flashcardContent.empty();
            // 활성화 상태 확인
            const isFlashcardActivated = await this.licenseManager.isActivated();
            if (isFlashcardActivated) {
                new FlashcardSettingsTab(this.plugin, flashcardContent).display();
            } else {
                // 활성화 입력창 표시 (메인 뷰와 유사한 구조, 설명 문구 및 class 포함)
                const activationDiv = flashcardContent.createEl('div', { cls: 'flashcard-activation-container' });
                activationDiv.createEl('div', { cls: 'flashcard-activation-header', text: t('Activate HiCard') });

                // 링크가 포함된 설명 문구 생성
                const descriptionDiv = activationDiv.createEl('div', { cls: 'flashcard-activation-description' });
                descriptionDiv.createEl('span', { text: t('Enter your license key to activate HiCard feature.') + ' ' });
                descriptionDiv.createEl('br');
                descriptionDiv.createEl('span', { text: t('Get your license key from') + ' ' });

                // 언어 설정에 따라 링크 변경
                const locale = ObsidianInternals.getMomentLocale();
                const websiteUrl = locale.startsWith('zh') ? 'https://www.hinote.vip/index.html' : 'https://www.hinote.vip/en.html';
                
                const link = descriptionDiv.createEl('a', { 
                    text: t('HiNote official website'),
                    cls: 'external-link',
                    href: websiteUrl
                });
                link.setAttr('target', '_blank');
                link.setAttr('rel', 'noopener noreferrer');
                const inputContainer = activationDiv.createEl('div', { cls: 'flashcard-activation-input-container' });
                const input = inputContainer.createEl('input', { cls: 'flashcard-activation-input', type: 'text', placeholder: t('Enter license key') });
                const btn = inputContainer.createEl('button', { cls: 'flashcard-activation-button', text: t('Activate') });
                const msg = activationDiv.createEl('div', { cls: 'activation-msg' });
                btn.onclick = () => {
                    void this.activateFlashcardLicense(input, btn, msg, flashcardContent);
                };
            }
    }

    private async activateFlashcardLicense(input: HTMLInputElement, btn: HTMLButtonElement, msg: HTMLElement, flashcardContent: HTMLElement): Promise<void> {
        btn.setAttr('disabled', 'true');
        msg.textContent = t('Verifying...');
        const ok = await this.licenseManager.activateLicense(input.value);
        if (ok) {
            msg.textContent = t('Activation successful!');
            flashcardContent.empty();
            new FlashcardSettingsTab(this.plugin, flashcardContent).display();
        } else {
            msg.textContent = t('Activation failed. Please check your license key.');
            btn.removeAttribute('disabled');
        }
    }
}
