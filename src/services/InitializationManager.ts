import { HighlightDecorator } from '../editor/HighlightDecorator';
import { FSRSManager } from '../flashcard';
import { HighlightService } from './HighlightService';
import { HiNoteDataManager } from '../storage/HiNoteDataManager';
import { CanvasService } from './CanvasService';
import { EventManager } from './EventManager';
import { HighlightManager } from './HighlightManager';
import { HighlightRepository } from '../repositories/HighlightRepository';
import type CommentPlugin from '../../main';
import type { PluginServices } from '../plugin/PluginServices';

/**
 * 초기화 관리자
 * 플러그인의 지연 초기화 로직을 관리합니다
 */
export class InitializationManager {
    // 지연 초기화 플래그
    private isInitialized: boolean = false;
    private initializationPromise: Promise<PluginServices> | null = null;
    private services: PluginServices | null = null;

    constructor(private plugin: CommentPlugin) {}

    /**
     * 플러그인이 초기화되었는지 확인합니다 (지연 초기화)
     * 사용자가 기능을 처음 사용할 때만 초기화를 실행합니다
     */
    async ensureInitialized(): Promise<PluginServices> {
        // 이미 초기화된 경우 바로 반환합니다
        if (this.isInitialized && this.services) {
            return this.services;
        }

        // 초기화 중이면 완료될 때까지 기다립니다
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // 초기화를 시작합니다
        this.services = this.initialize();
        this.isInitialized = true;
        this.initializationPromise = Promise.resolve(this.services);
        return this.services;
    }

    /**
     * 실제 초기화 로직
     */
    private initialize(): PluginServices {
        // 이벤트 관리자를 초기화합니다 (공유 인스턴스)
        const eventManager = new EventManager(this.plugin.app);

        // 데이터 관리자를 초기화합니다 (공유 인스턴스)
        const dataManager = new HiNoteDataManager(this.plugin.app);

        // 아키텍처 레이어를 초기화합니다
        const highlightRepository = new HighlightRepository(dataManager);

        // 하이라이트 서비스를 초기화합니다 (공유 인스턴스)
        const highlightService = new HighlightService(
            this.plugin.app,
            () => this.plugin.settings,
        );
        // 비동기로 인덱스를 구축하여 초기화를 차단하지 않습니다
        void highlightService.initialize();

        // Canvas 서비스를 초기화합니다 (공유 인스턴스)
        const canvasService = new CanvasService(this.plugin.app.vault);

        const highlightManager = new HighlightManager(
            this.plugin.app,
            highlightRepository,
            eventManager,
            highlightService
        );
        
        // 비동기로 데이터를 로드하여 초기화를 차단하지 않습니다
        highlightRepository.initialize().catch(error => {
            console.error('[HiNote] 하이라이트 데이터 로드 실패:', error);
        });

        // FSRS 관리자를 초기화합니다 (새 저장 레이어를 사용하도록 데이터 관리자를 전달합니다)
        const fsrsManager = new FSRSManager(this.plugin, dataManager);

        // 하이라이트 데코레이터를 초기화합니다
        const highlightDecorator = new HighlightDecorator(this.plugin, highlightRepository, highlightService, eventManager, highlightManager);
        highlightDecorator.enable();

        return {
            eventManager,
            dataManager,
            highlightService,
            canvasService,
            fsrsManager,
            highlightDecorator,
            highlightRepository,
            highlightManager
        };
    }

    /**
     * 리소스를 정리합니다
     */
    async cleanup(): Promise<void> {
        // 데이터는 자동 저장되므로 수동 저장이 필요하지 않습니다

        // 하이라이트 데코레이터를 정리합니다
        if (this.services?.highlightDecorator) {
            this.services.highlightDecorator.disable();
        }

        // 하이라이트 서비스를 정리합니다 (이벤트 리스너 해제 및 인덱스 초기화)
        if (this.services?.highlightService) {
            this.services.highlightService.destroy();
        }
    }

    /**
     * 초기화 여부를 확인합니다
     */
    get initialized(): boolean {
        return this.isInitialized;
    }

    get currentServices(): PluginServices | null {
        return this.services;
    }
}
