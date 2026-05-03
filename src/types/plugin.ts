import type { Plugin } from "obsidian";
import type { EventManager } from "../services/EventManager";
import type { HighlightService } from "../services/HighlightService";
import type { PluginSettings } from "./settings";

export interface HiNotePluginContext extends Plugin {
    settings: PluginSettings;
    eventManager: EventManager;
    highlightService: HighlightService;
}
