import type { HighlightDecorator } from "../core/HighlightDecorator";
import type { FSRSManager } from "../flashcard";
import type { HighlightRepository } from "../repositories/HighlightRepository";
import type { HiNoteDataManager } from "../storage/HiNoteDataManager";
import type { CanvasService } from "../services/CanvasService";
import type { EventManager } from "../services/EventManager";
import type { HighlightManager } from "../services/HighlightManager";
import type { HighlightService } from "../services/HighlightService";

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
