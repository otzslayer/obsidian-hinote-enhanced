export interface Flashcard {
    id: string;
    front: string;    // highlight text
    back: string;     // comment content
    sourceFile?: string;  // 원본 파일 출처
}

export interface FlashcardUIState {
    currentIndex: number;
    isFlipped: boolean;
    cards: Flashcard[];
}
