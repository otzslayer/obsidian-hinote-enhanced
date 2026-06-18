import { TextComponent, ToggleComponent, setIcon } from 'obsidian';
import type { RegexRule } from '../../types/highlight';
import { t } from '../../i18n';
import type CommentPlugin from '../../../main';

/**
 * 정규식 규칙 편집기 컴포넌트
 * 하이라이트 매칭에 사용되는 정규식 규칙 목록 관리용
 */
export class RegexRuleEditor {
  private containerEl: HTMLElement;
  private plugin: CommentPlugin;
  private rules: RegexRule[];
  private rulesContainer: HTMLElement;

  constructor(containerEl: HTMLElement, plugin: CommentPlugin) {
    this.containerEl = containerEl;
    this.plugin = plugin;
    this.rules = plugin.settings.regexRules || [];
    this.rulesContainer = containerEl.createDiv({ cls: 'regex-rules-container' });
    
    // 스타일은 전역 styles.css 파일로 이동됨
    this.display();
  }

  // 스타일은 전역 styles.css 파일로 이동됨

  /**
   * 규칙 목록 표시
   */
  private display() {
    this.rulesContainer.empty();

    // 경고 안내 및 예시 추가
    const warningEl = this.rulesContainer.createDiv({ cls: 'regex-rule-warning' });
    warningEl.setText(t('Use regex with caution. If there are capture groups (), the first capture group will be used as the highlight text; if there are no capture groups, the entire match will be used.'));
    
    // 기존 규칙 표시
    if (this.rules.length === 0) {
      const emptyEl = this.rulesContainer.createDiv();
      emptyEl.setText(t('No custom regex rules. Click "+" to add a new rule.'));
    } else {
      this.rules.forEach((rule, index) => {
        this.createRuleItem(rule, index);
      });
    }
    
    // 새 규칙 추가 버튼
    const addButton = this.rulesContainer.createDiv({ cls: 'regex-rule-add' });
    
    // 플러스 아이콘 및 텍스트 추가
    const textSpan = addButton.createSpan({ cls: 'regex-rule-add-text' });
    textSpan.setText(t('Add new rule'));
    
    // 클릭 이벤트 추가
    addButton.addEventListener('click', () => {
      const newRule: RegexRule = {
        id: `rule-${Date.now()}`,
        name: '',
        pattern: '',
        color: '#ffeb3b', // 고정된 기본 노란색 사용
        enabled: true
      };

      this.rules.push(newRule);
      void this.saveRules();
      this.display(); // 전체 목록 다시 렌더링
    });
  }
  
  /**
   * 단일 규칙 항목 생성
   * @param rule 규칙 객체
   * @param index 규칙 인덱스
   */
  private createRuleItem(rule: RegexRule, index: number) {
    const ruleContainer = this.rulesContainer.createDiv({ cls: 'regex-rule-item' });

    // 이름 입력창
    const nameInput = new TextComponent(ruleContainer);
    nameInput.setPlaceholder(t('Rule name'));
    nameInput.setValue(rule.name);
    nameInput.onChange(value => {
      rule.name = value;
      void this.saveRules();
    });
    
    // 정규식 입력창
    const patternInput = new TextComponent(ruleContainer);
    patternInput.setPlaceholder(t('Regular expression with capture groups'));
    patternInput.setValue(rule.pattern);
    patternInput.onChange(value => {
      rule.pattern = value;
      void this.saveRules();
    });
    
    // 색상 텍스트 입력창
    const colorContainer = ruleContainer.createDiv();
    const colorInput = new TextComponent(colorContainer);
    colorInput.setPlaceholder('#ffeb3b');
    colorInput.setValue(rule.color);
    colorInput.inputEl.addClass('color-input'); // 인라인 스타일 대신 CSS 클래스 사용
    colorInput.onChange(value => {
      // 색상값 유효성 확인
      const colorValue = value.trim();
      if (colorValue && (colorValue.startsWith('#') || colorValue.startsWith('rgb') || colorValue.startsWith('rgba'))) {
        rule.color = colorValue;
        void this.saveRules();
      }
    });
    
    // 삭제 아이콘
    const deleteContainer = ruleContainer.createDiv({ cls: 'regex-rule-delete' });
    setIcon(deleteContainer, 'trash-2'); // Obsidian의 trash-2 아이콘 사용
    deleteContainer.setAttr('aria-label', t('Delete rule'));
    deleteContainer.addEventListener('click', () => {
      this.rules.splice(index, 1);
      void this.saveRules();
      this.display(); // 전체 목록 다시 렌더링
    });

    // 활성화/비활성화 토글 - 규칙 컨테이너에 직접 추가, 별도 div 사용 안 함
    const toggle = new ToggleComponent(ruleContainer);
    toggle.setValue(rule.enabled);
    toggle.onChange(value => {
      rule.enabled = value;
      void this.saveRules();
    });
    // 토글에 클래스명 추가, CSS 선택자 접근 용이
    toggle.toggleEl.addClass('regex-rule-toggle');
  }
  
  /**
   * 플러그인 설정에 규칙 저장
   */
  private async saveRules() {
    this.plugin.settings.regexRules = this.rules;
    await this.plugin.saveSettings();
  }
}
