import type { HiCardState, FSRSStorage } from '../types/FSRSTypes';

interface FlashcardUIStateServiceOptions {
    getStorage: () => FSRSStorage;
    saveStorage: () => Promise<void>;
    saveDebounced: () => void;
}

export class FlashcardUIStateService {
    constructor(private options: FlashcardUIStateServiceOptions) {}

    getUIState(): HiCardState {
        return { ...this.options.getStorage().uiState };
    }

    updateUIState(state: Partial<HiCardState>): void {
        const storage = this.options.getStorage();
        storage.uiState = {
            ...storage.uiState,
            ...state
        };
        this.options.saveDebounced();
    }

    async renameGroupUIState(oldName: string, newName: string): Promise<void> {
        const uiState = this.options.getStorage().uiState;

        if (uiState.groupProgress?.[oldName]) {
            uiState.groupProgress[newName] = uiState.groupProgress[oldName];
            delete uiState.groupProgress[oldName];
        }

        if (uiState.currentGroupName === oldName) {
            uiState.currentGroupName = newName;
        }

        await this.options.saveStorage();
    }
}
