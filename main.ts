import { Plugin } from 'obsidian';
import { AISettingTab } from './src/settings/SettingsTab';
import { PluginSettings } from './src/types/settings';
import { InitializationManager } from './src/services/InitializationManager';
import { WindowManager } from './src/plugin/WindowManager';
import type { PluginServices } from './src/plugin/PluginServices';
import { migrateSettings, normalizeSettings } from './src/settings/SettingsMigration';
import {
	createPluginWindowManager,
	registerPluginCommands,
	registerPluginRibbon,
	registerPluginVaultEvents,
	registerPluginViews
} from './src/plugin/PluginBootstrap';

export default class CommentPlugin extends Plugin {
	settings: PluginSettings;
	private initManager: InitializationManager;
	private windowManager: WindowManager;

	// 외부 접근을 위한 서비스 인스턴스 공개
	get services(): PluginServices | null { return this.initManager.currentServices; }
	get highlightDecorator() { return this.requireInitializedServices().highlightDecorator; }
	get fsrsManager() { return this.requireInitializedServices().fsrsManager; }
	get eventManager() { return this.requireInitializedServices().eventManager; }
	get highlightService() { return this.requireInitializedServices().highlightService; }
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
		registerPluginRibbon(this, this.windowManager);
		registerPluginCommands(this, this.windowManager);

		// 설정 탭 추가
		this.addSettingTab(new AISettingTab(this.app, this));

		registerPluginVaultEvents(this);
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
