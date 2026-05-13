import type { HighlightDecorator } from "../core/HighlightDecorator";
import type { FSRSManager } from "../flashcard";
import type { HighlightRepository } from "../repositories/HighlightRepository";
import type { HiNoteDataManager } from "../storage/HiNoteDataManager";
import type { CanvasService } from "./CanvasService";
import type { EventManager } from "./EventManager";
import type { HighlightManager } from "./HighlightManager";
import type { HighlightService } from "./HighlightService";

export interface PluginServices {
    eventManager: EventManager;
    dataManager: HiNoteDataManager;
    highlightService: HighlightService;
    canvasService: CanvasService;
    fsrsManager: FSRSManager;
    highlightDecorator: HighlightDecorator;
    highlightRepository: HighlightRepository;
    highlightManager: HighlightManager;
}
