import { Plugin } from 'obsidian';
import { AISettingTab } from './src/settings/SettingsTab';
import { PluginSettings } from './src/types/settings';
import { InitializationManager } from './src/services/InitializationManager';
import { WindowManager } from './src/plugin/WindowManager';
import type { PluginServices } from './src/plugin/PluginServices';
import { migrateSettings, normalizeSettings } from './src/settings/SettingsMigration';
import { SectionLineRegistry } from './src/editor/SectionLineRegistry';
import { HighlightService } from './src/services/HighlightService';
import {
	createPluginWindowManager,
	registerPluginCommands,
	registerPluginMarkdownPostProcessors,
	registerPluginRibbon,
	registerPluginVaultEvents,
	registerPluginViews
} from './src/plugin/PluginBootstrap';

export default class CommentPlugin extends Plugin {
	settings: PluginSettings;
	private initManager: InitializationManager;
	private windowManager: WindowManager;

	// 읽기 모드 블록 → 소스 줄범위 레지스트리.
	// 서비스가 아니라 플러그인이 소유한다 — 지연 초기화 이전의 렌더도 잡아야 하므로
	// 던지는 게터(requireInitializedServices 계열)가 아닌 평범한 필드여야 한다.
	//
	// 아래 onload 주석 참고: 이제 초기화가 onload 에서 끝나므로 "초기화 이전의 렌더"는
	// 더 이상 발생하지 않는다. 소유권은 방어적으로 유지한다.
	readonly sectionLineRegistry = new SectionLineRegistry();

	// 하이라이트 서비스도 플러그인이 소유한다.
	//
	// 읽기 모드 하이라이트 명령(Mod+Shift+S)이 서비스 그래프에서 필요로 하는 것은
	// 이 서비스뿐인데, 그 경로에서 지연 초기화를 돌리면 initialize() 가
	// registerEditorExtension 으로 CM6 를 재구성하면서 읽기 모드의 DOM Selection 을
	// 지운다. 그러면 선택을 읽는 시점엔 이미 비어 있어 첫 입력이 무조건 실패한다.
	// 소유권을 올려 그 경로에서 초기화 자체를 없앤다.
	//
	// 생성자는 순수 객체 할당이라 시작 비용이 사실상 없다 — 파일 이벤트 등록과
	// 검색 인덱스 구축은 별도의 initialize() 이고, 그쪽은 InitializationManager 가
	// 호출한다.
	//
	// 위 단락이 경고한 CM6 재구성 문제는 이제 구조적으로 발생하지 않는다. onload 에서
	// 초기화가 끝나므로 단축키 경로의 ensureServicesInitialized() 는 조기 반환만 하고
	// registerEditorExtension 을 다시 부르지 않는다. 소유권은 방어적으로 유지한다.
	readonly highlightService = new HighlightService(this.app, () => this.settings);

	// 외부 접근을 위한 서비스 인스턴스 공개
	get services(): PluginServices | null { return this.initManager.currentServices; }
	get highlightDecorator() { return this.requireInitializedServices().highlightDecorator; }
	get fsrsManager() { return this.requireInitializedServices().fsrsManager; }
	get eventManager() { return this.requireInitializedServices().eventManager; }
	get dataManager() { return this.requireInitializedServices().dataManager; }
	get canvasService() { return this.requireInitializedServices().canvasService; }
	
	// 아키텍처 레이어 인스턴스
	get highlightRepository() { return this.requireInitializedServices().highlightRepository; }
	get highlightManager() { return this.requireInitializedServices().highlightManager; }

	requireInitializedServices(): PluginServices {
		const services = this.initManager.currentServices;
		if (!services) {
			throw new Error('HiNote services have not been initialized.');
		}
		return services;
	}

	async ensureServicesInitialized(): Promise<PluginServices> {
		return this.initManager.ensureInitialized();
	}

	async onload() {
		// 설정 로드
		const loadedData = await this.loadData();
		this.settings = migrateSettings(loadedData);

		// 관리자 초기화
		this.initManager = new InitializationManager(this);
		this.windowManager = createPluginWindowManager(this);

		registerPluginViews(this);
		registerPluginMarkdownPostProcessors(this);
		registerPluginRibbon(this, this.windowManager);
		registerPluginCommands(this, this.windowManager);

		// 설정 탭 추가
		this.addSettingTab(new AISettingTab(this.app, this));

		registerPluginVaultEvents(this);

		// 서비스를 onload 에서 초기화한다.
		//
		// 하이라이트 데코레이터가 거는 세 등록(인라인 코멘트 숨김 후처리기, 미리보기
		// 위젯 후처리기, CM6 확장)이 모두 HighlightDecorator.enable() 안에 있고
		// enable() 은 이 초기화 경로에서만 불린다. 초기화를 사이드바 활성화까지 미루면
		// 사이드바를 한 번도 열지 않은 콜드 스타트에서 세 등록이 전부 없는 상태로
		// 노트가 렌더되어 {>>...<<} 원문이 그대로 노출된다. 게다가
		// registerMarkdownPostProcessor 는 등록 이후의 렌더에만 적용되므로,
		// 나중에 초기화해도 이미 렌더된 노트는 복구되지 않는다.
		//
		// 시작 비용은 사실상 없다 — initialize() 는 동기 객체 생성뿐이고, 인덱스 구축과
		// 데이터 로드는 그 안에서 이미 논블로킹으로 떼어져 있다.
		await this.ensureServicesInitialized();
	}


	onunload() {
		// 초기화 관리자 정리
		if (this.initManager) {
			void this.initManager.cleanup();
		}
	}

	async saveSettings() {
		const existingData = await this.loadData();
		this.settings = normalizeSettings(this.settings, existingData);
		await this.saveData(this.settings);
	}
}
