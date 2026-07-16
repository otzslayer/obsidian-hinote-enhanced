import type { Plugin } from "obsidian";
import type { SectionLineRegistry } from "../editor/SectionLineRegistry";
import type { EventManager } from "../services/EventManager";
import type { HighlightService } from "../services/HighlightService";
import type { PluginSettings } from "./settings";

export interface HiNotePluginContext extends Plugin {
    settings: PluginSettings;
    eventManager: EventManager;
    highlightService: HighlightService;
    /** 초기화 여부와 무관하게 항상 존재하는 필드 — 서비스 게터와 달리 던지지 않는다. */
    sectionLineRegistry: SectionLineRegistry;
    saveSettings(): Promise<void>;
}
